'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { generateUniqueOrderCode } from '@/lib/orders/order-code';
import { calculateOrderEarnings } from '@/lib/orders/order-earnings';
import type { OrderStatus } from '@/types/database';

const VALID_PAYMENT_METHODS = ['cash', 'transfer', 'credit_card', 'debit_card', 'wallet'] as const;

const manualDeliverySchema = z.object({
  customerName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  customerPhone: z.string().trim().regex(/^3\d{9}$/, 'El teléfono debe tener 10 dígitos y empezar por 3'),
  deliveryAddress: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres'),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  neighborhood: z.string().trim().optional(),
  addressNotes: z.string().trim().optional(),
  businessId: z.string().uuid('Selecciona un negocio válido'),
  businessName: z.string().trim().optional(),
  businessAddress: z.string().trim().min(1, 'La dirección del negocio es obligatoria'),
  businessNeighborhood: z.string().trim().optional(),
  businessCity: z.string().trim().optional(),
  businessLat: z.number().optional(),
  businessLng: z.number().optional(),
  distanceKm: z.number().positive('La distancia debe ser mayor que cero'),
  durationMinutes: z.number().min(0),
  deliveryFee: z.number().positive('El valor del domicilio debe ser mayor que cero'),
  manualPriceUsed: z.boolean().default(false),
  priceCalculationSource: z.enum(['google_maps', 'manual', 'fallback']).default('manual'),
  paymentMethod: z.string().min(1, 'Selecciona un método de pago'),
  assignmentMode: z.enum(['manual', 'public']).default('public'),
  courierId: z.string().uuid().optional(),
  specialInstructions: z.string().trim().optional(),
  rawWhatsAppText: z.string().optional(),
});

export type CreateManualDeliveryInput = z.infer<typeof manualDeliverySchema>;

export interface ManualDeliveryBusinessOption {
  id: string;
  name: string;
  is_active: boolean;
  is_verified: boolean;
  hasAddress: boolean;
  hasCoordinates: boolean;
}

export interface ManualDeliveryBusinessDetail {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  is_verified: boolean;
  hasAddress: boolean;
  hasCoordinates: boolean;
}

export interface ManualDeliveryCourierOption {
  id: string;
  name: string;
  phone: string;
  status: string | null;
}

function isAdminRole(role: string) {
  return role === 'admin' || role === 'super_admin' || role.startsWith('admin_');
}

function isBusinessRole(role: string) {
  return role === 'business' || role === 'merchant';
}

function mapPaymentMethod(raw: string): (typeof VALID_PAYMENT_METHODS)[number] {
  const normalized = raw.toLowerCase().replace(/[\s-]/g, '_');
  if ((VALID_PAYMENT_METHODS as readonly string[]).includes(normalized)) {
    return normalized as (typeof VALID_PAYMENT_METHODS)[number];
  }
  if (['nequi', 'daviplata', 'pse', 'other'].includes(normalized)) return 'transfer';
  return 'cash';
}

async function requireManualDeliveryActor() {
  const auth = await requireAuth();
  if (auth.error) return { error: auth.error.message } as const;

  const role = String(auth.session.profile.role || '');
  if (!isAdminRole(role) && !isBusinessRole(role)) {
    return { error: 'No tienes permisos para crear domicilios manuales' } as const;
  }

  return {
    auth: auth.session,
    role,
    isAdmin: isAdminRole(role),
    isBusiness: isBusinessRole(role),
  } as const;
}

export async function getManualDeliveryBusinesses(): Promise<ManualDeliveryBusinessOption[]> {
  try {
    const actor = await requireManualDeliveryActor();
    if ('error' in actor) return [];

    const supabase = getServiceClient();
    let query = supabase
      .from('businesses')
      .select('id, name, is_active, is_verified, owner_id')
      .eq('is_active', true)
      .order('name');

    if (actor.isBusiness) query = query.eq('owner_id', actor.auth.user.id);

    const { data: businesses, error } = await query;
    if (error || !businesses?.length) return [];

    const businessIds = businesses.map((business) => business.id);
    const { data: addresses } = await supabase
      .from('business_addresses')
      .select('business_id, street_address, latitude, longitude, is_primary')
      .in('business_id', businessIds)
      .order('is_primary', { ascending: false });

    const addressMap = new Map<string, { hasAddress: boolean; hasCoordinates: boolean }>();
    for (const address of addresses || []) {
      if (!addressMap.has(address.business_id)) {
        addressMap.set(address.business_id, {
          hasAddress: Boolean(address.street_address),
          hasCoordinates: Boolean(address.latitude && address.longitude),
        });
      }
    }

    return businesses.map((business) => {
      const address = addressMap.get(business.id);
      return {
        id: business.id,
        name: business.name,
        is_active: business.is_active,
        is_verified: business.is_verified ?? false,
        hasAddress: address?.hasAddress ?? false,
        hasCoordinates: address?.hasCoordinates ?? false,
      };
    });
  } catch {
    return [];
  }
}

export async function getManualDeliveryBusinessDetails(
  businessId: string,
): Promise<ManualDeliveryBusinessDetail | null> {
  try {
    const actor = await requireManualDeliveryActor();
    if ('error' in actor) return null;

    const supabase = getServiceClient();
    let query = supabase
      .from('businesses')
      .select('id, name, is_active, is_verified, owner_id')
      .eq('id', businessId);

    if (actor.isBusiness) query = query.eq('owner_id', actor.auth.user.id);

    const { data: business, error } = await query.single();
    if (error || !business) return null;

    const { data: addresses } = await supabase
      .from('business_addresses')
      .select('street_address, city, latitude, longitude, is_primary')
      .eq('business_id', businessId)
      .order('is_primary', { ascending: false })
      .limit(1);

    const address = addresses?.[0] || null;
    return {
      id: business.id,
      name: business.name,
      address: address?.street_address || '',
      neighborhood: address?.city || '',
      city: address?.city || 'Santa Marta',
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
      is_active: business.is_active,
      is_verified: business.is_verified ?? false,
      hasAddress: Boolean(address?.street_address),
      hasCoordinates: Boolean(address?.latitude && address?.longitude),
    };
  } catch {
    return null;
  }
}

export async function getManualDeliveryCouriers(): Promise<ManualDeliveryCourierOption[]> {
  try {
    const actor = await requireManualDeliveryActor();
    if ('error' in actor || !actor.isAdmin) return [];

    const supabase = getServiceClient();
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, is_active, status')
      .eq('is_active', true);

    if (!drivers?.length) return [];

    const ids = drivers.map((driver) => driver.id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .in('id', ids);

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    return drivers.map((driver) => {
      const profile = profileMap.get(driver.id);
      return {
        id: driver.id,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Repartidor',
        phone: profile?.phone || '',
        status: driver.status || null,
      };
    });
  } catch {
    return [];
  }
}

export async function createManualDeliveryAction(input: CreateManualDeliveryInput) {
  try {
    const parsed = manualDeliverySchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((issue) => issue.message).join(', ') };
    }

    const actor = await requireManualDeliveryActor();
    if ('error' in actor) return { error: actor.error };

    const supabase = getServiceClient();
    const data = parsed.data;

    let businessQuery = supabase
      .from('businesses')
      .select('id, name, is_active, owner_id')
      .eq('id', data.businessId);
    if (actor.isBusiness) businessQuery = businessQuery.eq('owner_id', actor.auth.user.id);

    const { data: business, error: businessError } = await businessQuery.single();
    if (businessError || !business) return { error: 'El negocio no existe o no pertenece a tu cuenta' };
    if (!business.is_active) return { error: 'El negocio seleccionado no está activo' };

    const assignmentMode = actor.isBusiness ? 'public' : data.assignmentMode;
    const courierId = actor.isAdmin && assignmentMode === 'manual' ? data.courierId || null : null;

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', data.customerPhone)
      .maybeSingle();

    let customerId = existingProfile?.id || '';
    if (!customerId) {
      const email = `${data.customerPhone}@pedido-manual.domiu`;
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        phone: data.customerPhone,
        email_confirm: true,
        user_metadata: { full_name: data.customerName, source: 'manual_delivery' },
      });

      if (createUserError || !newUser?.user) {
        return { error: 'No fue posible crear el perfil operativo del cliente' };
      }

      customerId = newUser.user.id;
      const names = data.customerName.split(/\s+/);
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: customerId,
        email,
        first_name: names[0] || data.customerName,
        last_name: names.slice(1).join(' '),
        phone: data.customerPhone,
        status: 'active',
        role: 'customer',
      });

      if (profileError) {
        await supabase.auth.admin.deleteUser(customerId).catch(() => undefined);
        return { error: 'No fue posible completar el perfil del cliente' };
      }
    }

    const { data: address, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: customerId,
        type: 'other',
        label: 'Domicilio manual',
        street_address: data.deliveryAddress,
        city: 'Santa Marta',
        country: 'Colombia',
        latitude: data.deliveryLat ?? null,
        longitude: data.deliveryLng ?? null,
        instructions: [data.neighborhood, data.addressNotes].filter(Boolean).join(' · ') || null,
        is_primary: false,
      })
      .select('id')
      .single();

    if (addressError || !address) return { error: 'No fue posible registrar la dirección de entrega' };

    const orderNumber = await generateUniqueOrderCode(supabase);
    const earnings = calculateOrderEarnings(data.deliveryFee, data.deliveryFee);
    const status: OrderStatus = courierId ? 'assigned' : 'pending';
    const paymentMethod = mapPaymentMethod(data.paymentMethod);
    const source = actor.isAdmin ? 'admin_manual' : 'business_manual';

    const metadata = {
      source,
      has_products: false,
      delivery_only: true,
      manual_price_used: data.manualPriceUsed,
      price_calculation_source: data.priceCalculationSource,
      distance_km: data.distanceKm,
      duration_minutes: data.durationMinutes,
      business_name: data.businessName || business.name,
      business_address: data.businessAddress,
      business_neighborhood: data.businessNeighborhood || null,
      business_city: data.businessCity || null,
      customer_name: data.customerName,
      customer_address: data.deliveryAddress,
      customer_phone: data.customerPhone,
      customer_neighborhood: data.neighborhood || null,
      assignment_mode: assignmentMode,
      raw_whatsapp_text: data.rawWhatsAppText || null,
      created_by: actor.auth.user.id,
      created_by_role: actor.role,
      courier_earnings: earnings.courierEarnings,
      platform_earnings: earnings.platformEarnings,
      business_amount: earnings.businessAmount,
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_code: orderNumber,
        order_number: orderNumber,
        order_type: 'manual_delivery',
        customer_id: customerId,
        business_id: data.businessId,
        courier_id: courierId,
        delivery_address_id: address.id,
        status,
        payment_status: 'pending',
        payment_method: paymentMethod,
        subtotal: data.deliveryFee,
        delivery_fee: data.deliveryFee,
        courier_earnings: earnings.courierEarnings,
        platform_earnings: earnings.platformEarnings,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: data.deliveryFee,
        special_instructions: data.specialInstructions || null,
        metadata,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('[manual-deliveries] Error creating order:', orderError);
      return { error: `No fue posible crear el domicilio${orderError?.message ? `: ${orderError.message}` : ''}` };
    }

    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status,
      notes: courierId
        ? 'Domicilio manual creado y asignado por administración'
        : 'Domicilio manual creado y pendiente de publicación operativa',
    });

    if (business.owner_id !== actor.auth.user.id) {
      try {
        await supabase.rpc('create_notification', {
          p_recipient_id: business.owner_id,
          p_notification_type: 'new_order',
          p_title: 'Nuevo domicilio manual',
          p_message: `Se creó el domicilio #${orderNumber}`,
          p_order_id: order.id,
        });
      } catch {
        // La creación del domicilio no depende de una notificación secundaria.
      }
    }

    if (courierId) {
      try {
        await supabase.rpc('create_notification', {
          p_recipient_id: courierId,
          p_notification_type: 'order_assigned',
          p_title: 'Domicilio asignado',
          p_message: `Se te asignó el domicilio #${orderNumber}`,
          p_order_id: order.id,
        });
      } catch {
        // La creación del domicilio no depende de una notificación secundaria.
      }
    }

    await serverAudit.logAction(
      actor.auth.user.id,
      actor.auth.user.email,
      actor.auth.profile.role,
      'manual_delivery_created',
      'orders',
      order.id,
      {
        orderNumber,
        businessId: data.businessId,
        assignmentMode,
        courierId,
        distanceKm: data.distanceKm,
        deliveryFee: data.deliveryFee,
        paymentMethod,
        source,
      },
    );

    return { success: true, orderId: order.id, orderNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al crear el domicilio';
    console.error('[manual-deliveries] Unexpected error:', error);
    return { error: message };
  }
}
