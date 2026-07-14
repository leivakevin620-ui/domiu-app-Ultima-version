'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { generateUniqueOrderCode } from '@/lib/orders/order-code';
import { calculateOrderEarnings } from '@/lib/orders/order-earnings';

const paymentMethods = ['cash', 'transfer', 'credit_card', 'debit_card', 'wallet'] as const;

const businessManualOrderSchema = z.object({
  customerName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  customerPhone: z.string().trim().regex(/^3\d{9}$/, 'El teléfono debe tener 10 dígitos y empezar por 3'),
  deliveryAddress: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres').max(300),
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  addressNotes: z.string().trim().max(500).optional(),
  distanceKm: z.number().positive('La distancia debe ser mayor a 0').max(250),
  durationMinutes: z.number().min(0).max(600),
  deliveryFee: z.number().int().min(1000, 'La tarifa mínima es $1.000').max(500000),
  paymentMethod: z.enum(paymentMethods),
  specialInstructions: z.string().trim().max(1000).optional(),
  priceCalculationSource: z.enum(['google_maps', 'manual', 'fallback', 'neighborhood_zone']).default('manual'),
  rawOrderText: z.string().trim().max(4000).optional(),
});

export type BusinessManualOrderInput = z.infer<typeof businessManualOrderSchema>;

export interface CurrentBusinessForManualOrder {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
  hasCoordinates: boolean;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || fullName.trim(),
    lastName: parts.slice(1).join(' '),
  };
}

export async function getCurrentBusinessForManualOrder(): Promise<CurrentBusinessForManualOrder | null> {
  const auth = await requireAuth();
  if (auth.error || auth.session.profile.role !== 'merchant') return null;

  const db = getServiceClient();
  const { data: business, error } = await db
    .from('businesses')
    .select('id, name, is_active, is_verified')
    .eq('owner_id', auth.session.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !business || !business.is_active) return null;

  const { data: address } = await db
    .from('business_addresses')
    .select('street_address, city, latitude, longitude, is_primary')
    .eq('business_id', business.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latitude = finiteNumber(address?.latitude);
  const longitude = finiteNumber(address?.longitude);

  return {
    id: business.id,
    name: business.name,
    address: address?.street_address || '',
    city: address?.city || 'Santa Marta',
    latitude,
    longitude,
    isVerified: business.is_verified ?? false,
    hasCoordinates: latitude !== null && longitude !== null,
  };
}

export async function createBusinessManualOrderAction(input: BusinessManualOrderInput) {
  const parsed = businessManualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false, error: auth.error.message };
  if (auth.session.profile.role !== 'merchant') {
    return { success: false, error: 'Solo los negocios pueden crear domicilios desde este módulo' };
  }

  const db = getServiceClient();
  const data = parsed.data;
  const { session } = auth;

  const { data: business, error: businessError } = await db
    .from('businesses')
    .select('id, name, is_active, owner_id')
    .eq('owner_id', session.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessError || !business) return { success: false, error: 'No encontramos un negocio asociado a tu cuenta' };
  if (!business.is_active) return { success: false, error: 'Tu negocio está suspendido y no puede crear domicilios' };

  const { data: businessAddress } = await db
    .from('business_addresses')
    .select('street_address, city, latitude, longitude, is_primary')
    .eq('business_id', business.id)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!businessAddress?.street_address) {
    return { success: false, error: 'Configura primero la dirección de tu negocio' };
  }

  let customerId: string | null = null;
  let createdCustomer = false;
  let addressId: string | null = null;
  let orderId: string | null = null;

  const cleanup = async () => {
    if (orderId) await db.from('orders').delete().eq('id', orderId);
    if (addressId) await db.from('addresses').delete().eq('id', addressId);
    if (createdCustomer && customerId) await db.auth.admin.deleteUser(customerId).catch(() => undefined);
  };

  try {
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id')
      .eq('phone', data.customerPhone)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      customerId = existingProfile.id;
    } else {
      const syntheticEmail = `${data.customerPhone}@pedido-manual.domiu`;
      const password = `${crypto.randomUUID()}Aa1!`;
      const { data: newUser, error: userError } = await db.auth.admin.createUser({
        email: syntheticEmail,
        password,
        phone: data.customerPhone,
        email_confirm: true,
        user_metadata: { full_name: data.customerName, source: 'business_manual_order' },
      });

      if (userError || !newUser.user) {
        throw new Error('No se pudo crear el perfil temporal del cliente: ' + (userError?.message || 'error desconocido'));
      }

      customerId = newUser.user.id;
      createdCustomer = true;
      const name = splitName(data.customerName);
      const { error: profileError } = await db.from('profiles').upsert({
        id: customerId,
        email: syntheticEmail,
        first_name: name.firstName,
        last_name: name.lastName,
        phone: data.customerPhone,
        status: 'active',
      });

      if (profileError) throw new Error('No se pudo completar el perfil del cliente');
    }

    const { data: address, error: addressError } = await db
      .from('addresses')
      .insert({
        user_id: customerId,
        type: 'other',
        label: 'Domicilio creado por negocio',
        street_address: data.deliveryAddress,
        city: businessAddress.city || 'Santa Marta',
        state_province: 'Magdalena',
        country: 'Colombia',
        latitude: data.deliveryLat ?? null,
        longitude: data.deliveryLng ?? null,
        instructions: data.addressNotes || null,
        is_primary: false,
      })
      .select('id')
      .single();

    if (addressError || !address) throw new Error('No se pudo registrar la dirección de entrega');
    addressId = address.id;

    const orderNumber = await generateUniqueOrderCode(db);
    const earnings = calculateOrderEarnings(data.deliveryFee, data.deliveryFee);
    const pickupLat = finiteNumber(businessAddress.latitude);
    const pickupLng = finiteNumber(businessAddress.longitude);
    const metadata = {
      source: 'business_manual',
      created_by_role: 'merchant',
      created_by_user_id: session.user.id,
      created_by_email: session.user.email,
      delivery_only: true,
      has_products: false,
      assignment_mode: 'public',
      price_calculation_source: data.priceCalculationSource,
      distance_km: data.distanceKm,
      duration_minutes: data.durationMinutes,
      business_name: business.name,
      business_address: businessAddress.street_address,
      business_city: businessAddress.city || 'Santa Marta',
      customer_address: data.deliveryAddress,
      customer_phone: data.customerPhone,
      customer_neighborhood: data.neighborhood || null,
      raw_order_text: data.rawOrderText || null,
      courier_earnings: earnings.courierEarnings,
      platform_earnings: earnings.platformEarnings,
      business_amount: earnings.businessAmount,
    };

    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        order_code: orderNumber,
        order_number: orderNumber,
        order_type: 'manual_delivery',
        customer_id: customerId,
        business_id: business.id,
        courier_id: null,
        delivery_address_id: addressId,
        status: 'pending',
        payment_status: 'pending',
        payment_method: data.paymentMethod,
        subtotal: data.deliveryFee,
        delivery_fee: data.deliveryFee,
        courier_earnings: earnings.courierEarnings,
        platform_earnings: earnings.platformEarnings,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: data.deliveryFee,
        pickup_address: businessAddress.street_address,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        customer_phone: data.customerPhone,
        delivery_distance_km: data.distanceKm,
        special_instructions: data.specialInstructions || null,
        metadata,
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) throw new Error('No se pudo crear el domicilio: ' + (orderError?.message || 'error desconocido'));
    orderId = order.id;

    const { error: trackingError } = await db.from('order_tracking').insert({
      order_id: order.id,
      status: 'pending',
      notes: `Domicilio creado por ${business.name} y publicado para repartidores`,
    });
    if (trackingError) throw new Error('No se pudo registrar el seguimiento inicial');

    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active')
      .is('deleted_at', null);

    if (admins?.length) {
      await db.from('notifications').insert(
        admins.map((admin) => ({
          recipient_id: admin.id,
          sender_id: session.user.id,
          notification_type: 'new_order',
          title: 'Nuevo domicilio creado por negocio',
          message: `${business.name} creó el domicilio #${order.order_number}`,
          order_id: order.id,
          action_url: `/admin/pedidos`,
          channels: ['in_app'],
          is_read: false,
        })),
      );
    }

    await serverAudit.logAction(
      session.user.id,
      session.user.email,
      session.profile.role,
      'business_manual_order_created',
      'orders',
      order.id,
      {
        businessId: business.id,
        customerPhone: data.customerPhone,
        distanceKm: data.distanceKm,
        deliveryFee: data.deliveryFee,
        calculationSource: data.priceCalculationSource,
      },
    );

    return { success: true, orderId: order.id, orderNumber: order.order_number };
  } catch (error) {
    await cleanup();
    const message = error instanceof Error ? error.message : 'No se pudo crear el domicilio';
    await serverAudit.logError(
      session.user.id,
      session.user.email,
      session.profile.role,
      'business_manual_order_created',
      'orders',
      message,
    ).catch(() => undefined);
    return { success: false, error: message };
  }
}
