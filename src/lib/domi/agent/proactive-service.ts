import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiUserSettings } from '@/lib/domi/user-settings';

export interface DomiProactiveEventView {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  priority: string;
  createdAt: string;
}

function inQuietHours(settings: DomiUserSettings, now = new Date()) {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) return false;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const current = formatter.format(now);
  const start = settings.quietHoursStart.slice(0, 5);
  const end = settings.quietHoursEnd.slice(0, 5);
  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

async function queueEvent(args: {
  supabase: SupabaseClient;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  fingerprint: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
  expiresAt?: string | null;
}) {
  await args.supabase.from('domi_proactive_events').upsert(
    {
      user_id: args.userId,
      event_type: args.type,
      title: args.title,
      message: args.message,
      action_url: args.actionUrl || null,
      fingerprint: args.fingerprint,
      priority: args.priority || 'normal',
      status: 'pending',
      metadata: args.metadata || {},
      expires_at: args.expiresAt || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,fingerprint', ignoreDuplicates: true },
  );
}

export async function generateDomiProactiveEvents(args: {
  supabase: SupabaseClient;
  context: DomiServerContext;
  settings: DomiUserSettings;
}) {
  if (
    !args.settings.proactiveEnabled
    || args.settings.proactiveFrequency === 'off'
    || inQuietHours(args.settings)
  ) return;

  const now = new Date();
  const nowIso = now.toISOString();

  if (args.context.role === 'customer') {
    const { data: delayedOrders } = await args.supabase
      .from('orders')
      .select('id,order_number,status,estimated_delivery_time')
      .eq('customer_id', args.context.userId)
      .in('status', ['confirmed', 'preparing', 'ready', 'assigned', 'accepted', 'picked_up', 'in_transit'])
      .lt('estimated_delivery_time', nowIso)
      .is('deleted_at', null)
      .limit(3);
    for (const order of delayedOrders ?? []) {
      await queueEvent({
        supabase: args.supabase,
        userId: args.context.userId,
        type: 'order_delay',
        title: 'Tu pedido puede estar tardando más',
        message: `El pedido ${order.order_number} superó el tiempo estimado registrado. Revisa su estado actual o solicita soporte.`,
        actionUrl: `/cliente/pedidos/${order.id}`,
        fingerprint: `order-delay:${order.id}:${String(order.status)}`,
        priority: 'high',
        metadata: { orderId: order.id, status: order.status },
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    const { data: drafts } = await args.supabase
      .from('domi_order_drafts')
      .select('id,total_amount,expires_at,businesses(name)')
      .eq('user_id', args.context.userId)
      .in('status', ['draft', 'ready'])
      .gt('expires_at', nowIso)
      .order('updated_at', { ascending: false })
      .limit(1);
    for (const draft of drafts ?? []) {
      const business = Array.isArray(draft.businesses) ? draft.businesses[0] : draft.businesses;
      await queueEvent({
        supabase: args.supabase,
        userId: args.context.userId,
        type: 'draft_pending',
        title: 'Tienes una compra preparada por Domi',
        message: `Tu borrador de ${business?.name || 'un negocio'} sigue disponible. Revisa el carrito y confirma dirección y pago manualmente.`,
        actionUrl: `/cliente/cart?domiDraft=${draft.id}`,
        fingerprint: `draft-pending:${draft.id}`,
        priority: 'normal',
        metadata: { draftId: draft.id, totalAmount: Number(draft.total_amount) },
        expiresAt: String(draft.expires_at),
      });
    }

    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: coupons } = await args.supabase
      .from('coupons')
      .select('id,code,expires_at')
      .eq('is_active', true)
      .gt('expires_at', nowIso)
      .lte('expires_at', soon)
      .limit(3);
    for (const coupon of coupons ?? []) {
      await queueEvent({
        supabase: args.supabase,
        userId: args.context.userId,
        type: 'coupon_expiring',
        title: 'Un cupón vence pronto',
        message: `El cupón ${coupon.code} aparece activo y vence dentro de las próximas 24 horas. Su aplicación depende de las condiciones vigentes al confirmar.`,
        actionUrl: '/cliente/cupones',
        fingerprint: `coupon-expiring:${coupon.id}`,
        priority: 'normal',
        metadata: { couponId: coupon.id },
        expiresAt: String(coupon.expires_at),
      });
    }
  }

  const { data: activeConversation } = await args.supabase
    .from('domi_conversations')
    .select('id,title,active_goal,updated_at')
    .eq('user_id', args.context.userId)
    .eq('status', 'active')
    .not('active_goal', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeConversation?.active_goal) {
    const day = String(activeConversation.updated_at).slice(0, 10);
    await queueEvent({
      supabase: args.supabase,
      userId: args.context.userId,
      type: 'conversation_goal',
      title: 'Domi puede continuar una tarea pendiente',
      message: String(activeConversation.active_goal).slice(0, 300),
      actionUrl: args.context.role === 'admin'
        ? '/admin'
        : args.context.role === 'merchant'
          ? '/negocio'
          : args.context.role === 'courier'
            ? '/repartidor'
            : '/cliente',
      fingerprint: `conversation-goal:${activeConversation.id}:${day}`,
      priority: 'low',
      metadata: { conversationId: activeConversation.id },
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

export async function listDomiProactiveEvents(args: {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
}): Promise<DomiProactiveEventView[]> {
  const now = new Date().toISOString();
  const { data, error } = await args.supabase
    .from('domi_proactive_events')
    .select('id,event_type,title,message,action_url,priority,created_at')
    .eq('user_id', args.userId)
    .in('status', ['pending', 'delivered'])
    .lte('deliver_after', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(10, Math.max(1, args.limit || 5)));
  if (error) throw new Error('domi_proactive_events_read_failed');
  return (data ?? []).map((item) => ({
    id: String(item.id),
    type: String(item.event_type),
    title: String(item.title),
    message: String(item.message),
    actionUrl: item.action_url ? String(item.action_url) : null,
    priority: String(item.priority),
    createdAt: String(item.created_at),
  }));
}
