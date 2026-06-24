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
  businessAddress: z.string().min(1, 'La dirección del local es requerida'),
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

    const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const status: OrderStatus = data.assignmentMode === 'manual' && data.courierId ? 'assigned' : 'pending';

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
          business_address: data.businessAddress,
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
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name');

  return data || [];
}

export async function getBusinessDetailsForOrder(businessId: string) {
  const result = await requireAuth();
  if (result.error) return null;
  if (result.session.profile.role !== 'admin') return null;

  const supabase = getServiceClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, address, neighborhood, latitude, longitude, city_id, is_active')
    .eq('id', businessId)
    .single();

  if (!business) return null;

  const { data: bizAddress } = await supabase
    .from('business_addresses')
    .select('street_address, city, latitude, longitude, is_primary')
    .eq('business_id', businessId)
    .eq('is_primary', true)
    .maybeSingle();

  return {
    id: business.id,
    name: business.name,
    address: business.address || bizAddress?.street_address || '',
    neighborhood: business.neighborhood || '',
    latitude: business.latitude ?? bizAddress?.latitude ?? null,
    longitude: business.longitude ?? bizAddress?.longitude ?? null,
    is_active: business.is_active,
    hasAddress: !!(business.address || bizAddress?.street_address),
    hasCoordinates: !!(business.latitude || bizAddress?.latitude),
  };
}

export async function getAvailableCouriersForAdmin() {
  const result = await requireAuth();
  if (result.error) return [];
  if (result.session.profile.role !== 'admin') return [];

  const supabase = getServiceClient();

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, is_active, status, user_id')
    .eq('is_active', true)

  if (!drivers) return [];

  const userIds = drivers.map(d => d.user_id).filter(Boolean);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return drivers.map(d => {
    const p = profileMap.get(d.user_id) || null;
    return {
      id: d.id,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' '),
    phone: p?.phone || '',
    status: d.status || null,
    };
  });
}
