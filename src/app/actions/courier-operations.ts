'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';

const statusSchema = z.enum(['available', 'busy', 'offline', 'on_break']);

function integerMoney(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export async function setCourierOperationalStatusAction(input: { status: string }) {
  const parsed = statusSchema.safeParse(input.status);
  if (!parsed.success) return { success: false as const, error: 'Estado inválido' };

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'courier') {
    return { success: false as const, error: 'Solo un repartidor puede cambiar su jornada' };
  }

  const courierId = auth.session.user.id;
  const status = parsed.data;
  const supabase = getServiceClient();
  const now = new Date();

  const { data: openOperationalShift, error: shiftReadError } = await supabase
    .from('operational_shifts')
    .select('id,opened_at')
    .eq('participant_type', 'courier')
    .eq('participant_id', courierId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (shiftReadError) return { success: false as const, error: shiftReadError.message };

  let auditSessionId = openOperationalShift?.id ? String(openOperationalShift.id) : courierId;

  if (status === 'offline') {
    const { count, error: activeError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'accepted', 'picked_up', 'in_transit'])
      .is('deleted_at', null);
    if (activeError) return { success: false as const, error: activeError.message };
    if ((count ?? 0) > 0) {
      return {
        success: false as const,
        error: 'No puedes cerrar tu jornada mientras tengas un domicilio activo',
      };
    }

    if (openOperationalShift) {
      const openedAt = String(openOperationalShift.opened_at);
      const { data: deliveredOrders, error: ordersError } = await supabase
        .from('orders')
        .select('delivery_fee,courier_earnings,platform_delivery_commission,total_amount,payment_method')
        .eq('courier_id', courierId)
        .eq('status', 'delivered')
        .gte('updated_at', openedAt)
        .lte('updated_at', now.toISOString())
        .is('deleted_at', null);
      if (ordersError) return { success: false as const, error: ordersError.message };

      const totals = (deliveredOrders ?? []).reduce(
        (summary, order) => {
          summary.deliveryFees += integerMoney(order.delivery_fee);
          summary.courierEarnings += integerMoney(order.courier_earnings);
          summary.platformCommission += integerMoney(order.platform_delivery_commission);
          if (order.payment_method === 'cash') summary.cashCollected += integerMoney(order.total_amount);
          return summary;
        },
        { deliveryFees: 0, courierEarnings: 0, platformCommission: 0, cashCollected: 0 },
      );

      const { data: balance } = await supabase
        .from('participant_settlement_balances')
        .select('company_owes_participant,participant_owes_company,net_balance')
        .eq('participant_type', 'courier')
        .eq('participant_id', courierId)
        .maybeSingle();
      const onlineSeconds = Math.max(
        0,
        Math.floor((now.getTime() - new Date(openedAt).getTime()) / 1000),
      );

      const { error: closeOperationalError } = await supabase
        .from('operational_shifts')
        .update({
          status: 'closed',
          closed_at: now.toISOString(),
          closed_by: courierId,
          online_seconds: onlineSeconds,
          orders_count: deliveredOrders?.length ?? 0,
          delivery_fees: totals.deliveryFees,
          courier_earnings: totals.courierEarnings,
          platform_earnings: totals.platformCommission,
          cash_collected: totals.cashCollected,
          company_owes_participant: integerMoney(balance?.company_owes_participant),
          participant_owes_company: integerMoney(balance?.participant_owes_company),
          net_balance: integerMoney(balance?.net_balance),
          closing_note: 'Jornada cerrada desde el dashboard del repartidor',
          updated_at: now.toISOString(),
        })
        .eq('id', openOperationalShift.id);
      if (closeOperationalError) {
        return { success: false as const, error: closeOperationalError.message };
      }

      await supabase
        .from('courier_shifts')
        .update({
          status: 'closed',
          ended_at: now.toISOString(),
          online_minutes: Math.floor(onlineSeconds / 60),
          delivered_orders: deliveredOrders?.length ?? 0,
          gross_delivery_value: totals.deliveryFees,
          platform_commission: totals.platformCommission,
          net_earnings: totals.courierEarnings,
          cash_collected: totals.cashCollected,
          company_owes_courier: integerMoney(balance?.company_owes_participant),
          courier_owes_company: integerMoney(balance?.participant_owes_company),
          notes: 'Jornada cerrada desde el dashboard del repartidor',
          updated_at: now.toISOString(),
        })
        .eq('courier_id', courierId)
        .eq('status', 'open');
    }
  } else if (!openOperationalShift) {
    let { data: operationDay } = await supabase
      .from('operations_days')
      .select('id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!operationDay) {
      const { data: createdDay, error: dayError } = await supabase
        .from('operations_days')
        .insert({
          status: 'open',
          opened_by: courierId,
          opening_notes: 'Apertura automática para pruebas operativas',
          metadata: { source: 'courier_dashboard_v1' },
        })
        .select('id')
        .single();
      if (dayError) return { success: false as const, error: dayError.message };
      operationDay = createdDay;
    }

    const { data: courierShift, error: courierShiftError } = await supabase
      .from('courier_shifts')
      .insert({ courier_id: courierId, operation_day_id: operationDay.id, status: 'open' })
      .select('id,started_at')
      .single();
    if (courierShiftError) return { success: false as const, error: courierShiftError.message };

    const courierName =
      [auth.session.profile.first_name, auth.session.profile.last_name].filter(Boolean).join(' ') ||
      'Repartidor DomiU';
    const { data: createdShift, error: createShiftError } = await supabase
      .from('operational_shifts')
      .insert({
        participant_type: 'courier',
        participant_id: courierId,
        participant_name: courierName,
        opened_by: courierId,
        opening_note: 'Jornada abierta desde el dashboard del repartidor',
        metadata: { courier_shift_id: courierShift.id, initial_status: status },
      })
      .select('id')
      .single();
    if (createShiftError) return { success: false as const, error: createShiftError.message };
    auditSessionId = String(createdShift.id);
  }

  const { error: driverError } = await supabase
    .from('drivers')
    .update({
      status,
      is_active: status !== 'offline',
      is_available: status === 'available',
      updated_at: now.toISOString(),
    })
    .eq('id', courierId);
  if (driverError) return { success: false as const, error: driverError.message };

  await serverAudit.logAction(
    courierId,
    auth.session.user.email,
    'courier',
    status === 'offline' ? 'close_courier_shift' : 'set_courier_status',
    'operational_shifts',
    auditSessionId,
    { status },
  );

  return { success: true as const, status };
}
