'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';
import { getVerifiedDeliveryQuote } from '@/lib/delivery/route-pricing';
import { calculateOrderFinancials } from '@/lib/orders/order-earnings';
import { loadActiveFinancialSettings } from '@/lib/orders/financial-settings';

const paymentMethodSchema = z.enum(['cash', 'transfer']);

const quoteSchema = z.object({
  businessId: z.string().uuid(),
  businessAddressId: z.string().uuid(),
  deliveryAddressId: z.string().uuid(),
  subtotal: z.number().int().min(0),
});

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  unitPrice: z.number().int().min(0),
  customization: z.record(z.string(), z.unknown()).optional(),
  specialInstructions: z.string().max(500).optional(),
});

const createSchema = quoteSchema.extend({
  paymentMethod: paymentMethodSchema,
  paymentReference: z.string().trim().max(120).optional(),
  items: z.array(itemSchema).min(1).max(100),
  taxAmount: z.number().int().min(0).default(0),
  discountAmount: z.number().int().min(0).default(0),
  instructions: z.string().max(1000).default(''),
});

const proofSchema = z.object({
  orderId: z.string().uuid(),
  proofPath: z.string().min(1).max(500),
});

export async function quoteCustomerDeliveryAction(input: z.infer<typeof quoteSchema>) {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues.map((issue) => issue.message).join(', '),
    };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'customer') {
    return {
      success: false as const,
      error: 'Solo una cuenta de cliente puede cotizar un domicilio',
    };
  }

  try {
    const [quote, settings] = await Promise.all([
      getVerifiedDeliveryQuote(
        parsed.data.businessId,
        parsed.data.businessAddressId,
        parsed.data.deliveryAddressId,
        auth.session.user.id,
      ),
      loadActiveFinancialSettings(),
    ]);
    const financials = calculateOrderFinancials(
      {
        subtotal: parsed.data.subtotal,
        deliveryFee: quote.deliveryFee,
        orderType: 'product_order',
      },
      settings,
    );

    return {
      success: true as const,
      distanceKm: quote.distanceKm,
      durationMinutes: quote.durationMinutes,
      deliveryFee: quote.deliveryFee,
      serviceFee: financials.serviceFee,
      customerTotal: financials.customerTotal,
      routeSource: quote.source,
      pickupAddress: quote.pickupAddress,
    };
  } catch (cause) {
    return {
      success: false as const,
      error: cause instanceof Error ? cause.message : 'No se pudo calcular la ruta del domicilio',
    };
  }
}

export async function createCustomerOrderAction(input: z.infer<typeof createSchema>) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues.map((issue) => issue.message).join(', '),
    };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'customer') {
    return { success: false as const, error: 'Solo una cuenta de cliente puede crear este pedido' };
  }

  const supabase = getServiceClient();
  const customerId = auth.session.user.id;
  const data = parsed.data;

  if (data.paymentMethod === 'transfer' && !data.paymentReference?.trim()) {
    return {
      success: false as const,
      error: 'Escribe la referencia o número de comprobante de la transferencia',
    };
  }

  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('id,is_active,is_verified,is_open,metadata')
      .eq('id', data.businessId)
      .is('deleted_at', null)
      .maybeSingle();

    const metadata =
      business?.metadata && typeof business.metadata === 'object'
        ? (business.metadata as Record<string, unknown>)
        : {};
    if (!business?.is_active || !business.is_verified) {
      return { success: false as const, error: 'El negocio no está habilitado para recibir pedidos' };
    }
    if (metadata.catalog_status && metadata.catalog_status !== 'live') {
      return { success: false as const, error: 'El catálogo del negocio todavía está en validación' };
    }
    if (!business.is_open) {
      return { success: false as const, error: 'El negocio está cerrado en este momento' };
    }

    const quote = await getVerifiedDeliveryQuote(
      data.businessId,
      data.businessAddressId,
      data.deliveryAddressId,
      customerId,
    );

    const productIds = data.items.map((item) => item.productId);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id,business_id,name,price,discount_price,status,quantity_available')
      .in('id', productIds)
      .eq('business_id', data.businessId)
      .is('deleted_at', null);

    if (productsError) return { success: false as const, error: productsError.message };
    if (!products || products.length !== new Set(productIds).size) {
      return { success: false as const, error: 'Uno o más productos ya no están disponibles' };
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    let verifiedSubtotal = 0;
    const verifiedItems = data.items.map((item) => {
      const product = productMap.get(item.productId);
      const stock = Number(product?.quantity_available ?? 0);
      if (!product || product.status !== 'available' || stock < item.quantity) {
        throw new Error(
          `El producto ${product?.name ?? 'seleccionado'} está agotado o no tiene inventario suficiente`,
        );
      }

      const basePrice = Math.round(Number(product.discount_price ?? product.price ?? 0));
      const selectedPrice = Math.max(basePrice, item.unitPrice);
      const itemTotal = selectedPrice * item.quantity;
      verifiedSubtotal += itemTotal;
      return {
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: selectedPrice,
        item_total: itemTotal,
        variant_selections: item.customization ?? null,
        special_instructions: item.specialInstructions?.trim() || null,
      };
    });

    const settings = await loadActiveFinancialSettings();
    const financials = calculateOrderFinancials(
      {
        subtotal: verifiedSubtotal,
        deliveryFee: quote.deliveryFee,
        taxAmount: data.taxAmount,
        discountAmount: data.discountAmount,
        orderType: 'product_order',
      },
      settings,
    );

    const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const initialPaymentStatus =
      data.paymentMethod === 'transfer' ? 'pending_verification' : 'pending';

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        order_type: 'product_order',
        customer_id: customerId,
        business_id: data.businessId,
        pickup_address_id: quote.pickupAddressId,
        delivery_address_id: quote.deliveryAddressId,
        status: 'pending',
        payment_method: data.paymentMethod,
        payment_status: initialPaymentStatus,
        payment_reference:
          data.paymentMethod === 'transfer' ? data.paymentReference?.trim() || null : null,
        subtotal: financials.subtotal,
        delivery_fee: financials.deliveryFee,
        service_fee: financials.serviceFee,
        tax_amount: financials.taxAmount,
        discount_amount: financials.discountAmount,
        total_amount: financials.customerTotal,
        business_earnings: financials.businessEarnings,
        courier_earnings: financials.courierEarnings,
        platform_delivery_commission: financials.platformDeliveryCommission,
        platform_service_fee: financials.platformServiceFee,
        platform_earnings: financials.platformEarnings,
        pickup_address: quote.pickupAddress,
        pickup_lat: quote.pickup.lat,
        pickup_lng: quote.pickup.lng,
        pickup_place_id: quote.pickupPlaceId,
        delivery_address: quote.deliveryAddress,
        delivery_lat: quote.delivery.lat,
        delivery_lng: quote.delivery.lng,
        delivery_place_id: quote.deliveryPlaceId,
        delivery_distance_km: quote.distanceKm,
        route_distance_km: quote.distanceKm,
        route_duration_minutes: quote.durationMinutes,
        route_polyline: quote.polyline,
        route_source: quote.source,
        special_instructions: data.instructions.trim() || null,
        financial_snapshot: {
          currency: 'COP',
          ...financials,
          calculated_at: new Date().toISOString(),
        },
        financial_calculated_at: new Date().toISOString(),
        payment_holder: data.paymentMethod === 'cash' ? 'courier' : 'business',
        metadata: {
          created_from: 'customer_checkout_v4_financial',
          delivery_location_status: 'exact',
          delivery_pricing_source: quote.source,
          delivery_duration_minutes: quote.durationMinutes,
          route_verified_on_server: true,
          payment_method_selected_by_customer: data.paymentMethod,
          payment_reference_provided: Boolean(data.paymentReference?.trim()),
          service_fee_disclosed_before_confirmation: true,
          customer_subtotal_received: data.subtotal,
          verified_subtotal: verifiedSubtotal,
        },
      })
      .select(
        'id,order_number,delivery_fee,service_fee,delivery_distance_km,route_duration_minutes,total_amount,estimated_delivery_time,payment_method,payment_status,courier_earnings,platform_earnings,business_earnings',
      )
      .single();

    if (orderError || !order) {
      return { success: false as const, error: orderError?.message || 'No se pudo crear el pedido' };
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      verifiedItems.map((item) => ({ ...item, order_id: order.id })),
    );
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      return { success: false as const, error: itemsError.message };
    }

    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'pending',
      notes: `Pedido creado con ruta verificada, desglose financiero exacto y pago ${
        data.paymentMethod === 'cash'
          ? 'en efectivo'
          : 'por transferencia pendiente de validación'
      }`,
    });

    await serverAudit.logAction(
      customerId,
      auth.session.user.email,
      'customer',
      'create_order',
      'orders',
      order.id,
      {
        order_number: order.order_number,
        pickup_address_id: quote.pickupAddressId,
        delivery_address_id: quote.deliveryAddressId,
        delivery_fee: Number(order.delivery_fee),
        service_fee: Number(order.service_fee),
        customer_total: Number(order.total_amount),
        courier_earnings: Number(order.courier_earnings),
        platform_earnings: Number(order.platform_earnings),
        business_earnings: Number(order.business_earnings),
        delivery_distance_km: Number(order.delivery_distance_km),
        route_source: quote.source,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
      },
    );

    return {
      success: true as const,
      orderId: order.id,
      orderNumber: order.order_number,
      deliveryFee: Number(order.delivery_fee),
      serviceFee: Number(order.service_fee),
      distanceKm: Number(order.delivery_distance_km),
      durationMinutes: Number(order.route_duration_minutes ?? quote.durationMinutes),
      totalAmount: Number(order.total_amount),
      estimatedDeliveryTime: order.estimated_delivery_time,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    };
  } catch (cause) {
    return {
      success: false as const,
      error: cause instanceof Error ? cause.message : 'No se pudo crear el pedido',
    };
  }
}

export async function attachTransferProofAction(input: z.infer<typeof proofSchema>) {
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues.map((issue) => issue.message).join(', '),
    };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'customer') {
    return { success: false as const, error: 'Solo el cliente puede adjuntar este comprobante' };
  }

  const customerId = auth.session.user.id;
  const expectedPrefix = `${customerId}/${parsed.data.orderId}/`;
  if (!parsed.data.proofPath.startsWith(expectedPrefix)) {
    return { success: false as const, error: 'La ruta del comprobante no es válida' };
  }

  const supabase = getServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id,customer_id,payment_method,payment_status')
    .eq('id', parsed.data.orderId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!order) return { success: false as const, error: 'Pedido no encontrado' };
  if (order.payment_method !== 'transfer') {
    return { success: false as const, error: 'Este pedido no utiliza transferencia' };
  }
  if (['completed', 'refunded'].includes(order.payment_status)) {
    return { success: false as const, error: 'El pago ya fue cerrado' };
  }

  const { error } = await supabase
    .from('orders')
    .update({
      payment_proof_url: parsed.data.proofPath,
      payment_status: 'pending_verification',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (error) return { success: false as const, error: error.message };

  await serverAudit.logAction(
    customerId,
    auth.session.user.email,
    'customer',
    'attach_payment_proof',
    'orders',
    order.id,
    { proof_path: parsed.data.proofPath },
  );

  return { success: true as const };
}
