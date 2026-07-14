'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  unitPrice: z.number().min(0),
  customization: z.record(z.string(), z.unknown()).optional(),
  specialInstructions: z.string().max(500).optional(),
});

const createSchema = z.object({
  businessId: z.string().uuid(),
  deliveryAddressId: z.string().uuid(),
  items: z.array(itemSchema).min(1).max(100),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).default(0),
  instructions: z.string().max(1000).default(''),
});

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

  const [{ data: address }, { data: business }] = await Promise.all([
    supabase
      .from('addresses')
      .select('id,latitude,longitude')
      .eq('id', data.deliveryAddressId)
      .eq('user_id', customerId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('id,is_active,is_verified')
      .eq('id', data.businessId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (!address) return { success: false as const, error: 'La dirección seleccionada no existe' };
  if (address.latitude == null || address.longitude == null) {
    return { success: false as const, error: 'Comparte la ubicación exacta de la dirección antes de confirmar' };
  }
  if (!business?.is_active || !business.is_verified) {
    return { success: false as const, error: 'El negocio no está disponible para recibir pedidos' };
  }

  const productIds = data.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,business_id,name,price,discount_price,status,is_available')
    .in('id', productIds)
    .eq('business_id', data.businessId);

  if (productsError) return { success: false as const, error: productsError.message };
  if (!products || products.length !== new Set(productIds).size) {
    return { success: false as const, error: 'Uno o más productos ya no están disponibles' };
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  let verifiedSubtotal = 0;
  const verifiedItems = data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || product.status === 'discontinued' || product.is_available === false) {
      throw new Error('Uno o más productos están agotados o retirados');
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

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_id: customerId,
      business_id: data.businessId,
      delivery_address_id: data.deliveryAddressId,
      status: 'pending',
      payment_status: 'pending',
      subtotal: verifiedSubtotal,
      delivery_fee: 0,
      tax_amount: data.taxAmount,
      total_amount: verifiedSubtotal + data.taxAmount,
      special_instructions: data.instructions.trim() || null,
      metadata: { created_from: 'customer_checkout_v2' },
    })
    .select('id,order_number,delivery_fee,delivery_distance_km,total_amount,estimated_delivery_time')
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
    notes: 'Pedido creado por el cliente con ubicación y tarifa verificadas',
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
      delivery_fee: order.delivery_fee,
      delivery_distance_km: order.delivery_distance_km,
    },
  );

  return {
    success: true as const,
    orderId: order.id,
    orderNumber: order.order_number,
    deliveryFee: Number(order.delivery_fee),
    distanceKm: Number(order.delivery_distance_km),
    totalAmount: Number(order.total_amount),
    estimatedDeliveryTime: order.estimated_delivery_time,
  };
}
