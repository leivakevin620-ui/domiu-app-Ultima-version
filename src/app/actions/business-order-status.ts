'use server';

import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES } from '@/types/auth';
import type { OrderStatus } from '@/types/database';

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
};

function isAllowedTransition(current: string, next: string): next is OrderStatus {
  return Boolean(VALID_TRANSITIONS[current]?.includes(next as OrderStatus));
}

export async function updateBusinessOrderStatusAction(orderId: string, nextStatus: string) {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: auth.error.message };

  const userId = auth.session.user.id;
  const profile = auth.session.profile;
  const role = profile.role;
  const isAdmin = ADMIN_ROLES.includes(role);
  const isMerchant = role === 'merchant' || role === 'business';

  if (!isAdmin && !isMerchant) {
    return { success: false, error: 'Solo el negocio o un administrador pueden actualizar este pedido.' };
  }

  const supabase = getServiceClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,order_number,business_id,status,courier_id,deleted_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) return { success: false, error: orderError.message };
  if (!order || order.deleted_at) return { success: false, error: 'Pedido no encontrado.' };
  if (order.courier_id) {
    return { success: false, error: 'El pedido ya fue tomado por un repartidor y no puede publicarse nuevamente.' };
  }

  if (isMerchant) {
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id,owner_id,is_active,deleted_at')
      .eq('id', order.business_id)
      .maybeSingle();

    if (businessError) return { success: false, error: businessError.message };
    if (!business || business.deleted_at || business.owner_id !== userId) {
      return { success: false, error: 'Este pedido no pertenece a tu negocio.' };
    }
    if (!business.is_active) {
      return { success: false, error: 'El negocio está inactivo y no puede publicar pedidos.' };
    }
  }

  if (!isAllowedTransition(order.status, nextStatus)) {
    return {
      success: false,
      error: `No se puede cambiar el pedido de ${order.status} a ${nextStatus}. Actualiza la pantalla e inténtalo nuevamente.`,
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: nextStatus, updated_at: now })
    .eq('id', order.id)
    .eq('status', order.status)
    .is('courier_id', null)
    .select('id,status')
    .maybeSingle();

  if (updateError) return { success: false, error: updateError.message };
  if (!updated) {
    return { success: false, error: 'El pedido cambió mientras lo actualizabas. Recarga la lista.' };
  }

  await supabase.from('order_tracking').insert({
    order_id: order.id,
    status: nextStatus,
    notes: nextStatus === 'ready'
      ? 'Pedido publicado para repartidores disponibles'
      : `Estado actualizado por el negocio a ${nextStatus}`,
  });

  if (nextStatus === 'ready') {
    const { data: availableCouriers } = await supabase
      .from('drivers')
      .select('id')
      .eq('status', 'available')
      .eq('is_active', true)
      .eq('is_available', true)
      .is('deleted_at', null);

    if (availableCouriers?.length) {
      await supabase.from('notifications').insert(
        availableCouriers.map((courier) => ({
          recipient_id: courier.id,
          sender_id: userId,
          notification_type: 'order_ready',
          title: 'Nuevo domicilio disponible',
          message: `El pedido #${order.order_number} está listo para ser aceptado.`,
          channels: ['in_app'],
          metadata: { order_id: order.id, business_id: order.business_id },
        })),
      );
    }
  }

  await serverAudit.logAction(
    userId,
    auth.session.user.email,
    role,
    nextStatus === 'ready' ? 'publish_order_to_couriers' : 'update_business_order_status',
    'orders',
    order.id,
  );

  return { success: true, status: nextStatus };
}
