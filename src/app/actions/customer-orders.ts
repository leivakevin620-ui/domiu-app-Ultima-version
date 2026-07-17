'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';
import { getVerifiedDeliveryQuote } from '@/lib/delivery/route-pricing';

const paymentMethodSchema = z.enum(['cash', 'transfer']);

const quoteSchema = z.object({
  businessId: z.string().uuid(),
  businessAddressId: z.string().uuid(),
  deliveryAddressId: z.string().uuid(),
});

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  unitPrice: z.number().min(0),
  customization: z.record(z.string(), z.unknown()).optional(),
  specialInstructions: z.string().max(500).optional(),
});

const createSchema = quoteSchema.extend({
  paymentMethod: paymentMethodSchema,
  items: z.array(itemSchema).min(1).max(100),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).default(0),
  instructions: z.string().max(1000).default(''),
});

export async function quoteCustomerDeliveryAction(input: z.infer<typeof quoteSchema>) {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'customer') {
    return { success: false as const, error: 'Solo una cuenta de cliente puede cotizar un domicilio' };
  }

  try {
    const quote = await getVerifiedDeliveryQuote(
      parsed.data.businessId,
      parsed.data.businessAddressId,
      parsed.data.deliveryAddressId,
      auth.session.user.id,
    );
    return {
      success: true as const,
      distanceKm: quote.distanceKm,
      durationMinutes: quote.durationMinutes,
      deliveryFee: quote.deliveryFee,
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
    return { success: false as const, error: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'customer') {
    return { success: false as const, error: 'Solo una cuenta de cliente puede crear este pedido' };
  }

  const supabase = getServiceClient();
  const customerId = auth.session.user.id;
  const data = parsed.data;

  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('id,is_active,is_verified')
      .eq('id', data.businessId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!business?.is_active || !business.is_verified) {
      return { success: false as const, error: 'El negocio no está disponible para recibir pedidos' };
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
        throw new Error(`El producto ${product?.name ?? 'seleccionado'} está agotado o no tiene inventario suficiente`);
      }

      const basePrice = Number(product.discount_price ?? product.price ?? item.unitPrice);
      const selectedPrice = Math.max(basePrice, Number(item.unitPrice));
      verifiedSubtotal += selectedPrice * item.quantity;
      return {
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: selectedPrice,
        item_total: selectedPrice * item.quantity,
        variant_selections: item.customization ?? null,
        special_instructions: item.specialInstructions?.trim() || null,
      };
    });

    const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const initialPaymentStatus = data.paymentMethod === 'transfer' ? 'pending_verification' : 'pending';

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        business_id: data.businessId,
        pickup_address_id: quote.pickupAddressId,
        delivery_address_id: quote.deliveryAddressId,
        status: 'pending',
        payment_method: data.paymentMethod,
        payment_status: initialPaymentStatus,
        subtotal: verifiedSubtotal,
        delivery_fee: quote.deliveryFee,
        tax_amount: data.taxAmount,
        total_amount: verifiedSubtotal + quote.deliveryFee + data.taxAmount,
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
        metadata: {
          created_from: 'customer_checkout_v3',
          delivery_location_status: 'exact',
          delivery_pricing_source: quote.source,
          delivery_duration_minutes: quote.durationMinutes,
          route_verified_on_server: true,
          payment_method_selected_by_customer: data.paymentMethod,
        },
      })
      .select('id,order_number,delivery_fee,delivery_distance_km,route_duration_minutes,total_amount,estimated_delivery_time,payment_method,payment_status')
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
      notes: `Pedido creado con ruta verificada y pago ${data.paymentMethod === 'cash' ? 'en efectivo' : 'por transferencia'}`,
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
        delivery_fee: order.delivery_fee,
        delivery_distance_km: order.delivery_distance_km,
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
