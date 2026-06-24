'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import type { OrderStatus, PaymentMethod } from '@/types/database';

const createManualOrderSchema = z.object({
  customerName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  customerPhone: z.string().regex(/^3\d{9}$/, 'Teléfono debe ser 10 dígitos empezando por 3'),
  deliveryAddress: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  neighborhood: z.string().optional(),
  addressNotes: z.string().optional(),
  businessId: z.string().uuid('Selecciona un local válido'),
  businessName: z.string().optional(),
  businessAddress: z.string().min(1, 'La dirección del local es requerida'),
  businessNeighborhood: z.string().optional(),
  businessCity: z.string().optional(),
  businessLat: z.number().optional(),
  businessLng: z.number().optional(),
  distanceKm: z.number().positive('La distancia debe ser mayor a 0 km'),
  durationMinutes: z.number().min(0),
  deliveryFee: z.number().positive('El valor del domicilio debe ser mayor a 0'),
  manualPriceUsed: z.boolean().default(false),
  priceCalculationSource: z.enum(['google_maps', 'manual', 'fallback']).default('manual'),
  paymentMethod: z.string().min(1, 'Selecciona un método de pago'),
  assignmentMode: z.enum(['manual', 'public']),
  courierId: z.string().uuid().optional(),
  specialInstructions: z.string().optional(),
  rawWhatsAppText: z.string().optional(),
});

export type CreateManualOrderInput = z.infer<typeof createManualOrderSchema>;

export async function createManualOrderAction(input: CreateManualOrderInput) {
  const parsed = createManualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const result = await requireAuth();
  if (result.error) return { error: result.error.message };
  if (result.session.profile.role !== 'admin') {
    return { error: 'Solo administradores pueden crear pedidos manuales' };
  }

  const { session } = result;
  const supabase = getServiceClient();
  const data = parsed.data;

  try {
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, is_active')
      .eq('id', data.businessId)
      .single();

    if (bizError || !business) return { error: 'Local no encontrado' };
    if (!business.is_active) return { error: 'El local no está activo' };

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', data.customerPhone)
      .maybeSingle();

    let customerId: string;

    if (existingProfile) {
      customerId = existingProfile.id;
    } else {
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: `${data.customerPhone}@pedido-manual.domiu`,
        password: Math.random().toString(36).slice(2, 10),
        phone: data.customerPhone,
        email_confirm: true,
        user_metadata: { full_name: data.customerName, source: 'manual_order' },
      });

      if (createUserError || !newUser?.user) {
        return { error: 'No se pudo crear el perfil del cliente: ' + (createUserError?.message || 'error') };
      }

      customerId = newUser.user.id;

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: customerId,
        email: `${data.customerPhone}@pedido-manual.domiu`,
        role: 'customer',
        first_name: data.customerName.split(' ')[0] || data.customerName,
        last_name: data.customerName.split(' ').slice(1).join(' ') || '',
        phone: data.customerPhone,
        status: 'active',
      });

      if (profileError) {
        await supabase.auth.admin.deleteUser(customerId);
        return { error: 'No se pudo crear el perfil del cliente' };
      }
    }

    const { data: address, error: addrError } = await supabase
      .from('addresses')
      .insert({
        user_id: customerId,
        type: 'other',
        label: 'Pedido manual',
        street_address: data.deliveryAddress,
        city: 'Santa Marta',
        country: 'Colombia',
        latitude: data.deliveryLat || null,
        longitude: data.deliveryLng || null,
        instructions: data.addressNotes || null,
        is_primary: false,
      })
      .select('id')
      .single();

    if (addrError || !address) {
      return { error: 'No se pudo crear la dirección de entrega' };
    }

    const now = new Date();
    const yymmdd = now.getFullYear().toString().slice(2) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { count: todayCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart);
    const seqNumber = (todayCount || 0) + 1;
    const orderNumber = `DOM-${yymmdd}-${String(seqNumber).padStart(3, '0')}`;
    const status: OrderStatus = data.assignmentMode === 'manual' && data.courierId ? 'assigned' : 'confirmed';

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        business_id: data.businessId,
        courier_id: data.courierId || null,
        delivery_address_id: address.id,
        status,
        payment_status: 'pending',
        payment_method: data.paymentMethod as PaymentMethod,
        subtotal: data.deliveryFee,
        delivery_fee: data.deliveryFee,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: data.deliveryFee,
        special_instructions: data.specialInstructions || null,
        metadata: {
          source: 'admin_manual_form',
          manual_price_used: data.manualPriceUsed,
          price_calculation_source: data.priceCalculationSource,
          distance_km: data.distanceKm,
          duration_minutes: data.durationMinutes,
          business_name: data.businessName || null,
          business_address: data.businessAddress,
          business_neighborhood: data.businessNeighborhood || null,
          business_city: data.businessCity || null,
          customer_address: data.deliveryAddress,
          customer_phone: data.customerPhone,
          customer_neighborhood: data.neighborhood || null,
          assignment_mode: data.assignmentMode,
          raw_whatsapp_text: data.rawWhatsAppText || null,
        },
      })
      .select()
      .single();

    if (orderError || !order) {
      return { error: 'Error al crear el pedido: ' + (orderError?.message || '') };
    }

    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status,
      notes: status === 'assigned'
        ? 'Pedido manual creado y asignado a repartidor'
        : status === 'confirmed'
        ? 'Pedido manual creado por administrador — disponible para repartidores'
        : 'Pedido manual creado por administrador',
    });

    serverAudit.logAction(
      session.user.id,
      session.user.email,
      session.profile.role,
      'manual_order_created',
      'orders',
      order.id,
      {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        assignmentMode: data.assignmentMode,
        businessId: data.businessId,
        customerAddress: data.deliveryAddress,
        distanceKm: data.distanceKm,
        automaticDeliveryFee: data.deliveryFee,
        finalDeliveryFee: data.deliveryFee,
        manualPriceUsed: data.manualPriceUsed,
        courierId: data.courierId || null,
        paymentMethod: data.paymentMethod,
        calculationSource: data.priceCalculationSource,
        source: 'admin_manual_form',
      },
    );

    return { success: true, orderId: order.id, orderNumber };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    serverAudit.logError(
      session.user.id,
      session.user.email,
      session.profile.role,
      'manual_order_created',
      'orders',
      msg,
    );
    return { error: msg };
  }
}

export async function getBusinessesForOrderSelect() {
  const result = await requireAuth();
  if (result.error) return [];
  if (result.session.profile.role !== 'admin') return [];

  const supabase = getServiceClient();
  const { data } = await supabase
    .from('businesses')
    .select('id, name, is_active, is_verified')
    .eq('is_active', true)
    .order('name');

  if (!data) return [];

  const businessIds = data.map((b: { id: string }) => b.id);
  const { data: addresses } = await supabase
    .from('business_addresses')
    .select('business_id, street_address, latitude, longitude')
    .in('business_id', businessIds);

  const addressMap = new Map<string, { hasAddress: boolean; hasCoordinates: boolean }>();
  for (const addr of addresses || []) {
    if (!addressMap.has(addr.business_id)) {
      addressMap.set(addr.business_id, {
        hasAddress: !!(addr.street_address),
        hasCoordinates: !!(addr.latitude && addr.longitude),
      });
    }
  }

  return data.map((b: { id: string; name: string; is_active: boolean; is_verified: boolean }) => {
    const info = addressMap.get(b.id);
    return {
      id: b.id,
      name: b.name,
      is_active: b.is_active,
      is_verified: b.is_verified ?? false,
      hasAddress: info?.hasAddress ?? false,
      hasCoordinates: info?.hasCoordinates ?? false,
    };
  });
}

export async function getBusinessDetailsForOrder(businessId: string) {
  const result = await requireAuth();
  if (result.error) return null;
  if (result.session.profile.role !== 'admin') return null;

  const supabase = getServiceClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, is_active, is_verified')
    .eq('id', businessId)
    .single();

  if (!business) return null;

  const { data: bizAddresses } = await supabase
    .from('business_addresses')
    .select('street_address, city, latitude, longitude, is_primary')
    .eq('business_id', businessId)
    .order('is_primary', { ascending: false })
    .limit(1);

  const bizAddress = bizAddresses?.[0] || null;

  return {
    id: business.id,
    name: business.name,
    address: bizAddress?.street_address || '',
    neighborhood: bizAddress?.city || '',
    city: bizAddress?.city || 'Santa Marta',
    latitude: bizAddress?.latitude ?? null,
    longitude: bizAddress?.longitude ?? null,
    is_active: business.is_active,
    is_verified: business.is_verified ?? false,
    accepts_orders: true,
    hasAddress: !!(bizAddress?.street_address),
    hasCoordinates: !!(bizAddress?.latitude && bizAddress?.longitude),
  };
}

export async function getAvailableCouriersForAdmin() {
  const result = await requireAuth();
  if (result.error) return [];
  if (result.session.profile.role !== 'admin') return [];

  const supabase = getServiceClient();

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, is_active, status')
    .eq('is_active', true)

  if (!drivers) return [];

  const driverIds = drivers.map(d => d.id).filter(Boolean);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .in('id', driverIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return drivers.map(d => {
    const p = profileMap.get(d.id) || null;
    return {
      id: d.id,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Sin nombre',
    phone: p?.phone || '',
    status: d.status || null,
    };
  });
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findNearestAvailableCourier(businessLat: number, businessLng: number) {
  const result = await requireAuth();
  if (result.error) return null;
  if (result.session.profile.role !== 'admin') return null;

  const supabase = getServiceClient();

  const { data: availableDrivers } = await supabase
    .from('drivers')
    .select('id, status')
    .eq('status', 'available')
    .eq('is_active', true)
    .eq('is_verified', true);

  if (!availableDrivers || availableDrivers.length === 0) return null;

  const driverIds = availableDrivers.map(d => d.id);

  const { data: locations } = await supabase
    .from('driver_locations')
    .select('driver_id, latitude, longitude')
    .in('driver_id', driverIds);

  if (!locations || locations.length === 0) return null;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .in('id', driverIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  let nearest: { id: string; name: string; phone: string; distanceKm: number; latitude: number; longitude: number } | null = null;

  for (const loc of locations) {
    const dist = haversineDistanceKm(businessLat, businessLng, loc.latitude, loc.longitude);
    if (!nearest || dist < nearest.distanceKm) {
      const p = profileMap.get(loc.driver_id);
      nearest = {
        id: loc.driver_id,
        name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Repartidor',
        phone: p?.phone || '',
        distanceKm: Math.round(dist * 100) / 100,
        latitude: loc.latitude,
        longitude: loc.longitude,
      };
    }
  }

  return nearest;
}
