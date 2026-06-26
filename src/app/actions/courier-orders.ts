'use server';

import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import type { OrderStatus } from '@/types/database';

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  assigned: ['picked_up'],
  accepted: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
};

function canTransition(current: string, next: string): boolean {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(next as OrderStatus);
}

async function getDriverId(userId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('drivers')
    .select('id')
    .eq('id', userId)
    .single();
  return data?.id || null;
}

export async function acceptOrderByCourierAction(orderId: string) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };

  const userId = result.session.user.id;
  const driverId = await getDriverId(userId);
  if (!driverId) return { success: false, error: 'Perfil de repartidor no encontrado' };

  if (result.session.profile.role !== 'courier') {
    return { success: false, error: 'Solo repartidores pueden aceptar pedidos' };
  }

  const supabase = getServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, courier_id')
    .eq('id', orderId)
    .single();

  if (!order) return { success: false, error: 'Pedido no encontrado' };
  if (order.courier_id) return { success: false, error: 'El pedido ya tiene un repartidor asignado' };
  if (order.status !== 'confirmed' && order.status !== 'ready') {
    return { success: false, error: 'El pedido no está disponible para asignación' };
  }

  const profile = result.session.profile;
  const courierName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Repartidor';

  const { error: assignError } = await supabase
    .from('orders')
    .update({
      courier_id: userId,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (assignError) return { success: false, error: 'Error al asignar pedido: ' + assignError.message };

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'assigned',
    notes: `Asignado a ${courierName}`,
  });

  await serverAudit.logAction(userId, result.session.user.email, 'courier', 'accept_order', 'orders', orderId);

  return { success: true };
}

export async function markOrderPickedUpAction(orderId: string) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };
  if (result.session.profile.role !== 'courier') return { success: false, error: 'No autorizado' };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, courier_id')
    .eq('id', orderId)
    .single();

  if (!order) return { success: false, error: 'Pedido no encontrado' };
  if (order.courier_id !== userId) return { success: false, error: 'Este pedido no te pertenece' };
  if (!canTransition(order.status, 'picked_up')) {
    return { success: false, error: `No se puede marcar como recogido desde el estado ${order.status}` };
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'picked_up',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) return { success: false, error: 'Error al actualizar: ' + error.message };

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'picked_up',
    notes: 'Pedido recogido por el repartidor',
  });

  await serverAudit.logAction(userId, result.session.user.email, 'courier', 'order_picked_up', 'orders', orderId);

  return { success: true };
}

export async function markOrderInTransitAction(orderId: string) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };
  if (result.session.profile.role !== 'courier') return { success: false, error: 'No autorizado' };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, courier_id')
    .eq('id', orderId)
    .single();

  if (!order) return { success: false, error: 'Pedido no encontrado' };
  if (order.courier_id !== userId) return { success: false, error: 'Este pedido no te pertenece' };
  if (!canTransition(order.status, 'in_transit')) {
    return { success: false, error: `No se puede marcar en camino desde el estado ${order.status}` };
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'in_transit',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) return { success: false, error: 'Error al actualizar: ' + error.message };

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'in_transit',
    notes: 'Repartidor en camino al cliente',
  });

  await serverAudit.logAction(userId, result.session.user.email, 'courier', 'order_in_transit', 'orders', orderId);

  return { success: true };
}

export async function markOrderDeliveredAction(orderId: string, proofPayload?: { photo_url?: string; signature_url?: string; notes?: string }) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };
  if (result.session.profile.role !== 'courier') return { success: false, error: 'No autorizado' };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, courier_id, metadata')
    .eq('id', orderId)
    .single();

  if (!order) return { success: false, error: 'Pedido no encontrado' };
  if (order.courier_id !== userId) return { success: false, error: 'Este pedido no te pertenece' };
  if (!canTransition(order.status, 'delivered')) {
    return { success: false, error: `No se puede marcar entregado desde el estado ${order.status}` };
  }

  const updatedMetadata = {
    ...(order.metadata || {}),
    delivered_at: new Date().toISOString(),
    delivery_proof: proofPayload || null,
  };

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      actual_delivery_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: updatedMetadata,
    })
    .eq('id', orderId);

  if (error) return { success: false, error: 'Error al actualizar: ' + error.message };

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'delivered',
    notes: 'Pedido entregado al cliente',
  });

  await supabase.from('drivers').update({
    total_deliveries: supabase.rpc('increment', { x: 1 }) as unknown as number,
    completed_deliveries: supabase.rpc('increment', { x: 1 }) as unknown as number,
  }).eq('id', userId);

  await serverAudit.logAction(userId, result.session.user.email, 'courier', 'order_delivered', 'orders', orderId);

  return { success: true };
}

export async function reportOrderProblemAction(
  orderId: string,
  payload: { problem_type: string; description: string; severity?: string }
) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };
  if (result.session.profile.role !== 'courier') return { success: false, error: 'No autorizado' };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, courier_id, metadata')
    .eq('id', orderId)
    .single();

  if (!order) return { success: false, error: 'Pedido no encontrado' };
  if (order.courier_id !== userId) return { success: false, error: 'Este pedido no te pertenece' };

  const currentMetadata = order.metadata || {};
  const updatedMetadata = {
    ...currentMetadata,
    problem_reported: true,
    problem_type: payload.problem_type,
    problem_description: payload.description,
    problem_reported_at: new Date().toISOString(),
  };

  const { error: metaError } = await supabase
    .from('orders')
    .update({ metadata: updatedMetadata })
    .eq('id', orderId);

  if (metaError) return { success: false, error: 'Error al reportar problema: ' + metaError.message };

  await supabase.from('courier_incidents').insert({
    driver_id: userId,
    incident_type: 'order_issue',
    description: payload.description,
    severity: (payload.severity as 'minor' | 'moderate' | 'severe' | 'critical') || 'minor',
    order_id: orderId,
  });

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: order.status,
    notes: `Problema reportado: ${payload.description}`,
  });

  return { success: true };
}
