'use server';

import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';

type DispatchMetadata = Record<string, unknown>;

interface ManualOrderForDispatch {
  id: string;
  business_id: string;
  order_type: string | null;
  status: string;
  courier_id: string | null;
  order_number: string | null;
  metadata: DispatchMetadata | null;
}

export interface CourierDistanceOption {
  id: string;
  name: string;
  phone: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

function asRecord(value: unknown): DispatchMetadata {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as DispatchMetadata;
  return {};
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function requireAdminSession() {
  const auth = await requireAuth();
  if (auth.error) return { error: auth.error.message as string };
  if (auth.session.profile.role !== 'admin') return { error: 'Solo administradores pueden gestionar domicilios manuales' };
  return { auth };
}

async function getPendingManualOrder(orderId: string): Promise<{ order?: ManualOrderForDispatch; error?: string }> {
  const supabase = getServiceClient();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, business_id, order_type, status, courier_id, order_number, metadata')
    .eq('id', orderId)
    .single();

  if (error || !order) return { error: 'Pedido no encontrado' };
  if (order.order_type !== 'manual_delivery') return { error: 'Solo pedidos de domicilio manual pueden gestionarse aquí' };
  if (order.status !== 'pending') return { error: 'Solo pedidos pendientes pueden publicarse o asignarse' };
  if (order.courier_id) return { error: 'El pedido ya tiene repartidor asignado' };

  return { order: order as ManualOrderForDispatch };
}

async function getBusinessCoordinates(order: ManualOrderForDispatch): Promise<{ lat?: number; lng?: number; error?: string }> {
  const metadata = asRecord(order.metadata);
  const metadataLat = toNumber(metadata.business_lat);
  const metadataLng = toNumber(metadata.business_lng);
  if (metadataLat !== null && metadataLng !== null) return { lat: metadataLat, lng: metadataLng };

  const supabase = getServiceClient();
  const { data: address, error } = await supabase
    .from('business_addresses')
    .select('latitude, longitude')
    .eq('business_id', order.business_id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lat = toNumber(address?.latitude);
  const lng = toNumber(address?.longitude);

  if (error || lat === null || lng === null) {
    return { error: 'El local no tiene coordenadas exactas para asignar por cercanía.' };
  }

  return { lat, lng };
}

async function notifyCouriers(
  courierIds: string[],
  payload: { senderId: string; orderId: string; title: string; message: string; notificationType: string; metadata?: DispatchMetadata },
): Promise<number> {
  if (courierIds.length === 0) return 0;

  const supabase = getServiceClient();
  const notifications = courierIds.map((courierId) => ({
    recipient_id: courierId,
    sender_id: payload.senderId,
    notification_type: payload.notificationType,
    title: payload.title,
    message: payload.message,
    order_id: payload.orderId,
    channels: ['in_app'],
    metadata: payload.metadata ?? {},
  }));

  const { error } = await supabase.from('notifications').insert(notifications);
  if (error) return 0;
  return notifications.length;
}

export async function getAvailableCouriersByDistance(
  businessLat: number,
  businessLng: number,
): Promise<CourierDistanceOption[]> {
  try {
    const admin = await requireAdminSession();
    if ('error' in admin) return [];

    const supabase = getServiceClient();
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, status, is_active')
      .eq('status', 'available')
      .eq('is_active', true);

    const driverIds = (drivers || [])
      .map((driver: { id?: string | null }) => driver.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (driverIds.length === 0) return [];

    const [{ data: locations }, { data: profiles }] = await Promise.all([
      supabase.from('driver_locations').select('driver_id, latitude, longitude').in('driver_id', driverIds),
      supabase.from('profiles').select('id, first_name, last_name, phone').in('id', driverIds),
    ]);

    const profileMap = new Map<string, { first_name?: string | null; last_name?: string | null; phone?: string | null }>();
    for (const profile of profiles || []) {
      if (typeof profile.id === 'string') profileMap.set(profile.id, profile);
    }

    const couriers: CourierDistanceOption[] = [];
    for (const location of locations || []) {
      const lat = toNumber(location.latitude);
      const lng = toNumber(location.longitude);
      if (!location.driver_id || lat === null || lng === null) continue;

      const profile = profileMap.get(location.driver_id);
      const distance = haversineDistanceKm(businessLat, businessLng, lat, lng);
      couriers.push({
        id: location.driver_id,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Repartidor',
        phone: profile?.phone || '',
        distanceKm: Math.round(distance * 100) / 100,
        latitude: lat,
        longitude: lng,
      });
    }

    return couriers.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (error) {
    console.error('[manual-delivery-dispatch] getAvailableCouriersByDistance error:', error);
    return [];
  }
}

export async function assignManualOrderToCourierAction(orderId: string, courierId: string) {
  try {
    const admin = await requireAdminSession();
    if ('error' in admin) return { success: false, error: admin.error };

    const { order, error } = await getPendingManualOrder(orderId);
    if (error || !order) return { success: false, error };

    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const metadata = {
      ...asRecord(order.metadata),
      assignment_mode: 'manual',
      manually_assigned_at: now,
      manually_assigned_by: admin.auth.session.user.id,
    };

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ courier_id: courierId, status: 'assigned', updated_at: now, metadata })
      .eq('id', orderId)
      .eq('status', 'pending')
      .is('courier_id', null)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedOrder) {
      return { success: false, error: 'No se pudo asignar. El pedido pudo haber sido tomado.' };
    }

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'assigned',
      notes: 'Asignado manualmente por administrador',
    });

    await notifyCouriers([courierId], {
      senderId: admin.auth.session.user.id,
      orderId,
      notificationType: 'order_assigned',
      title: 'Pedido asignado',
      message: `Se te ha asignado el pedido #${order.order_number || orderId.slice(0, 8)}`,
    });

    await serverAudit.logAction(
      admin.auth.session.user.id,
      admin.auth.session.user.email,
      admin.auth.session.profile.role,
      'assign_manual_order_to_courier',
      'orders',
      orderId,
      { courier_id: courierId },
    );

    return { success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[manual-delivery-dispatch] assignManualOrderToCourierAction error:', err);
    return { success: false, error };
  }
}

export async function assignNearestCourierToManualOrderAction(orderId: string) {
  try {
    const admin = await requireAdminSession();
    if ('error' in admin) return { success: false, error: admin.error };

    const { order, error } = await getPendingManualOrder(orderId);
    if (error || !order) return { success: false, error };

    const coords = await getBusinessCoordinates(order);
    if (coords.error || coords.lat == null || coords.lng == null) return { success: false, error: coords.error };

    const couriers = await getAvailableCouriersByDistance(coords.lat, coords.lng);
    const nearest = couriers[0];
    if (!nearest) return { success: false, error: 'No hay repartidores disponibles con ubicación válida' };

    const result = await assignManualOrderToCourierAction(orderId, nearest.id);
    if (!result.success) return result;

    return { success: true, courierName: nearest.name, distanceKm: nearest.distanceKm };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[manual-delivery-dispatch] assignNearestCourierToManualOrderAction error:', err);
    return { success: false, error };
  }
}

export async function notifyClosestCourierForManualOrderAction(orderId: string) {
  try {
    const admin = await requireAdminSession();
    if ('error' in admin) return { success: false, error: admin.error };

    const { order, error } = await getPendingManualOrder(orderId);
    if (error || !order) return { success: false, error };

    const coords = await getBusinessCoordinates(order);
    if (coords.error || coords.lat == null || coords.lng == null) return { success: false, error: coords.error };

    const couriers = await getAvailableCouriersByDistance(coords.lat, coords.lng);
    const closest = couriers[0];
    if (!closest) return { success: false, error: 'No hay repartidores disponibles con ubicación válida' };

    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const metadata = {
      ...asRecord(order.metadata),
      assignment_mode: 'closest_first',
      dispatch_scope: 'closest_only',
      published_at: now,
      closest_courier_id: closest.id,
      closest_courier_distance_km: closest.distanceKm,
      closest_courier_notified_at: now,
    };

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'pending', updated_at: now, metadata })
      .eq('id', orderId)
      .eq('status', 'pending')
      .is('courier_id', null)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedOrder) return { success: false, error: 'No se pudo publicar al repartidor cercano' };

    const notifiedCount = await notifyCouriers([closest.id], {
      senderId: admin.auth.session.user.id,
      orderId,
      notificationType: 'courier_nearby',
      title: 'Nuevo domicilio cerca de ti',
      message: `Tienes un domicilio cercano disponible #${order.order_number || orderId.slice(0, 8)}`,
      metadata: { distance_km: closest.distanceKm, dispatch_scope: 'closest_only' },
    });

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'pending',
      notes: `Publicado primero al repartidor más cercano: ${closest.name} (${closest.distanceKm} km)`,
    });

    await serverAudit.logAction(
      admin.auth.session.user.id,
      admin.auth.session.user.email,
      admin.auth.session.profile.role,
      'notify_closest_courier_manual_order',
      'orders',
      orderId,
      { courier_id: closest.id, courier_name: closest.name, distance_km: closest.distanceKm },
    );

    return { success: true, courierName: closest.name, distanceKm: closest.distanceKm, notifiedCount };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[manual-delivery-dispatch] notifyClosestCourierForManualOrderAction error:', err);
    return { success: false, error };
  }
}

export async function publishManualDeliveryOrderToAllCouriersAction(orderId: string) {
  try {
    const admin = await requireAdminSession();
    if ('error' in admin) return { success: false, error: admin.error };

    const { order, error } = await getPendingManualOrder(orderId);
    if (error || !order) return { success: false, error };

    const coords = await getBusinessCoordinates(order);
    if (coords.error || coords.lat == null || coords.lng == null) return { success: false, error: coords.error };

    const couriers = await getAvailableCouriersByDistance(coords.lat, coords.lng);
    if (couriers.length === 0) return { success: false, error: 'No hay repartidores disponibles con ubicación válida' };

    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const metadata = {
      ...asRecord(order.metadata),
      assignment_mode: 'public_all',
      dispatch_scope: 'all_available',
      published_at: now,
      notified_courier_ids: couriers.map((courier) => courier.id),
      nearest_courier_id: couriers[0]?.id ?? null,
      nearest_courier_distance_km: couriers[0]?.distanceKm ?? null,
    };

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'pending', updated_at: now, metadata })
      .eq('id', orderId)
      .eq('status', 'pending')
      .is('courier_id', null)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedOrder) return { success: false, error: 'No se pudo publicar el pedido' };

    const notifiedCount = await notifyCouriers(couriers.map((courier) => courier.id), {
      senderId: admin.auth.session.user.id,
      orderId,
      notificationType: 'courier_nearby',
      title: 'Nuevo domicilio disponible',
      message: `Un domicilio manual está disponible #${order.order_number || orderId.slice(0, 8)}`,
      metadata: { dispatch_scope: 'all_available' },
    });

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'pending',
      notes: `Publicado a ${notifiedCount} repartidores disponibles`,
    });

    await serverAudit.logAction(
      admin.auth.session.user.id,
      admin.auth.session.user.email,
      admin.auth.session.profile.role,
      'publish_manual_order_to_all_couriers',
      'orders',
      orderId,
      { notified_couriers: notifiedCount },
    );

    return { success: true, notifiedCount };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[manual-delivery-dispatch] publishManualDeliveryOrderToAllCouriersAction error:', err);
    return { success: false, error };
  }
}

export async function publishManualDeliveryOrderAction(orderId: string) {
  return notifyClosestCourierForManualOrderAction(orderId);
}
