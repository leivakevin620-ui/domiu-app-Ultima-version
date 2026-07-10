'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { generateUniqueOrderCode } from '@/lib/orders/order-code';
import { calculateOrderEarnings } from '@/lib/orders/order-earnings';
import type { OrderStatus } from '@/types/database';

const VALID_PAYMENT_METHODS = ['cash', 'transfer', 'credit_card', 'debit_card', 'wallet'] as const;

type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

type BusinessSelectRow = {
  id: string;
  name: string;
  is_active: boolean;
  is_verified?: boolean | null;
};

type BusinessAddressRow = {
  business_id?: string | null;
  street_address?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_primary?: boolean | null;
};

type ProfileContactRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

type DriverAdminRow = {
  id: string;
  is_active?: boolean | null;
  status?: string | null;
};

function mapPaymentMethod(raw: string): PaymentMethod {
  const normalized = raw.toLowerCase().replace(/[\s-]/g, '_');
  if ((VALID_PAYMENT_METHODS as readonly string[]).includes(normalized)) return normalized as PaymentMethod;
  if (['nequi', 'daviplata', 'pse', 'other'].includes(normalized)) return 'transfer';
  return 'cash';
}

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

export interface CreateOrderResult {
  success?: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
  code?: string;
}

export async function createManualOrderAction(input: CreateManualOrderInput): Promise<CreateOrderResult> {
  try {
    const parsed = createManualOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues.map((issue) => issue.message).join(', ') };
    }

    const auth = await requireAuth();
    if (auth.error) return { error: auth.error.message };
    if (auth.session.profile.role !== 'admin') {
      return { error: 'Solo administradores pueden crear pedidos manuales' };
    }

    const supabase = getServiceClient();
    const data = parsed.data;
    const { session } = auth;

    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, is_active, owner_id')
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
        first_name: data.customerName.split(' ')[0] || data.customerName,
        last_name: data.customerName.split(' ').slice(1).join(' ') || '',
        phone: data.customerPhone,
        status: 'active',
      });

      if (profileError) {
        await supabase.auth.admin.deleteUser(customerId).catch(() => {});
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

    const orderNumber = await generateUniqueOrderCode(supabase);
    const earnings = calculateOrderEarnings(data.deliveryFee, data.deliveryFee);
    const status: OrderStatus = data.assignmentMode === 'manual' && data.courierId ? 'assigned' : 'pending';
    const paymentMethod = mapPaymentMethod(data.paymentMethod);

    const metadata: Record<string, unknown> = {
      source: 'admin_manual',
      has_products: false,
      delivery_only: true,
      manual_price_used: data.manualPriceUsed,
      price_calculation_source: data.priceCalculationSource,
      distance_km: data.distanceKm,
      duration_minutes: data.durationMinutes,
      business_name: data.businessName || null,
      business_address: data.businessAddress,
      business_neighborhood: data.businessNeighborhood || null,
      business_city: data.businessCity || null,
      business_lat: data.businessLat ?? null,
      business_lng: data.businessLng ?? null,
      customer_address: data.deliveryAddress,
      customer_phone: data.customerPhone,
      customer_neighborhood: data.neighborhood || null,
      assignment_mode: data.assignmentMode,
      raw_whatsapp_text: data.rawWhatsAppText || null,
      courier_earnings: earnings.courierEarnings,
      platform_earnings: earnings.platformEarnings,
      business_amount: earnings.businessAmount,
      admin_id: session.user.id,
      admin_email: session.user.email,
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_code: orderNumber,
        order_number: orderNumber,
        order_type: 'manual_delivery',
        customer_id: customerId,
        business_id: data.businessId,
        courier_id: data.courierId || null,
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
      .select()
      .single();

    if (orderError || !order) {
      console.error('[admin-orders] insert error:', orderError);
      return { error: 'Error al crear el pedido: ' + (orderError?.message || '') };
    }

    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status,
      notes: status === 'assigned'
        ? 'Pedido manual creado y asignado a repartidor'
        : 'Pedido manual creado por administrador — pendiente de confirmación',
    });

    try {
      await supabase.rpc('create_notification', {
        p_recipient_id: business.owner_id,
        p_notification_type: 'new_order',
        p_title: 'Nuevo Pedido Manual',
        p_message: `Has recibido un nuevo pedido #${orderNumber} creado por administrador`,
        p_order_id: order.id,
      });
    } catch {}

    if (data.assignmentMode === 'manual' && data.courierId) {
      try {
        await supabase.rpc('create_notification', {
          p_recipient_id: data.courierId,
          p_notification_type: 'order_assigned',
          p_title: 'Pedido Asignado',
          p_message: `Se te ha asignado el pedido #${orderNumber}`,
          p_order_id: order.id,
        });
      } catch {}
    }

    await serverAudit.logAction(
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
        deliveryFee: data.deliveryFee,
        manualPriceUsed: data.manualPriceUsed,
        courierId: data.courierId || null,
        paymentMethod,
        calculationSource: data.priceCalculationSource,
        source: 'admin_manual_form',
        courierEarnings: earnings.courierEarnings,
        platformEarnings: earnings.platformEarnings,
      },
    );

    return { success: true, orderId: order.id, orderNumber, code: orderNumber };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[admin-orders] createManualOrderAction error:', err);
    try {
      const auth = await requireAuth();
      if (!auth.error) {
        await serverAudit.logError(
          auth.session.user.id,
          auth.session.user.email,
          auth.session.profile.role,
          'manual_order_created',
          'orders',
          msg,
        );
      }
    } catch {}
    return { error: msg };
  }
}

export async function getBusinessesForOrderSelect() {
  try {
    const auth = await requireAuth();
    if (auth.error) return [];
    if (auth.session.profile.role !== 'admin') return [];

    const supabase = getServiceClient();
    const { data } = await supabase
      .from('businesses')
      .select('id, name, is_active, is_verified')
      .eq('is_active', true)
      .order('name');

    const businesses = (data || []) as BusinessSelectRow[];
    if (businesses.length === 0) return [];

    const businessIds = businesses.map((business) => business.id);
    const { data: addresses } = await supabase
      .from('business_addresses')
      .select('business_id, street_address, latitude, longitude')
      .in('business_id', businessIds);

    const addressMap = new Map<string, { hasAddress: boolean; hasCoordinates: boolean }>();
    for (const addr of (addresses || []) as BusinessAddressRow[]) {
      if (!addr.business_id || addressMap.has(addr.business_id)) continue;
      addressMap.set(addr.business_id, {
        hasAddress: !!addr.street_address,
        hasCoordinates: !!(addr.latitude && addr.longitude),
      });
    }

    return businesses.map((business) => {
      const info = addressMap.get(business.id);
      return {
        id: business.id,
        name: business.name,
        is_active: business.is_active,
        is_verified: business.is_verified ?? false,
        hasAddress: info?.hasAddress ?? false,
        hasCoordinates: info?.hasCoordinates ?? false,
      };
    });
  } catch {
    return [];
  }
}

export async function getBusinessDetailsForOrder(businessId: string) {
  try {
    const auth = await requireAuth();
    if (auth.error) return null;
    if (auth.session.profile.role !== 'admin') return null;

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

    const bizAddress = ((bizAddresses || []) as BusinessAddressRow[])[0] || null;

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
      hasAddress: !!bizAddress?.street_address,
      hasCoordinates: !!(bizAddress?.latitude && bizAddress?.longitude),
    };
  } catch {
    return null;
  }
}

export async function getAvailableCouriersForAdmin() {
  try {
    const auth = await requireAuth();
    if (auth.error) return [];
    if (auth.session.profile.role !== 'admin') return [];

    const supabase = getServiceClient();
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, is_active, status')
      .eq('is_active', true);

    const driverRows = (drivers || []) as DriverAdminRow[];
    if (driverRows.length === 0) return [];

    const driverIds = driverRows
      .map((driver) => driver.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .in('id', driverIds);

    const profileMap = new Map<string, ProfileContactRow>();
    for (const profile of (profiles || []) as ProfileContactRow[]) {
      profileMap.set(profile.id, profile);
    }

    return driverRows.map((driver) => {
      const profile = profileMap.get(driver.id) || null;
      return {
        id: driver.id,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Sin nombre',
        phone: profile?.phone || '',
        status: driver.status || null,
      };
    });
  } catch {
    return [];
  }
}
