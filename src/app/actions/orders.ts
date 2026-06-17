'use server';

import { getServiceClient } from '@/lib/db/supabase';
import type { OrderStatus } from '@/types/database';

export async function createOrderAction(input: {
  customerId: string;
  businessId: string;
  items: { product_id: string; quantity: number }[];
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  deliveryAddress: string;
  specialInstructions?: string;
  paymentMethod?: string;
}) {
  const supabase = await getServiceClient();

  const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: address } = await supabase
    .from('addresses')
    .select('id')
    .eq('user_id', input.customerId)
    .eq('is_primary', true)
    .single();

  let addressId = address?.id;
  if (!addressId) {
    const { data: newAddr } = await supabase
      .from('addresses')
      .insert({
        user_id: input.customerId,
        type: 'home',
        street_address: input.deliveryAddress,
        city: 'Ciudad',
        country: 'Colombia',
        is_primary: true,
      })
      .select('id')
      .single();
    addressId = newAddr?.id;
  }

  if (!addressId) throw new Error('No se pudo crear la dirección de entrega');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_id: input.customerId,
      business_id: input.businessId,
      delivery_address_id: addressId,
      status: 'pending',
      payment_status: 'pending',
      payment_method: (input.paymentMethod as any) ?? 'cash',
      subtotal: input.subtotal,
      delivery_fee: input.deliveryFee,
      tax_amount: input.taxAmount,
      total_amount: input.totalAmount,
      special_instructions: input.specialInstructions ?? null,
    })
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error('No se pudo crear la orden');

  const orderItems = input.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: 0,
    item_total: 0,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems as any);
  if (itemsError) throw new Error(itemsError.message);

  await supabase.from('order_tracking').insert({
    order_id: order.id,
    status: 'pending',
    notes: 'Orden creada',
  });

  return { orderId: order.id, orderNumber: order.order_number };
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const supabase = await getServiceClient();

  const { data: order, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status,
    notes: `Estado actualizado a ${status}`,
  });

  return order;
}

export async function assignCourierAction(orderId: string, courierId: string) {
  const supabase = await getServiceClient();

  const { data: courier } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', courierId)
    .single();

  const courierName = courier
    ? [courier.first_name, courier.last_name].filter(Boolean).join(' ')
    : 'Repartidor';

  const { data: order, error } = await supabase
    .from('orders')
    .update({
      courier_id: courierId,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('order_tracking').insert({
    order_id: orderId,
    status: 'assigned',
    notes: `Asignado a ${courierName}`,
  });

  return order;
}
