'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import type { PaymentMethod } from '@/types/database';
import { serverAudit } from '@/lib/audit/server-audit';

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  businessId: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1),
  subtotal: z.number().positive(),
  deliveryFee: z.number().min(0),
  taxAmount: z.number().min(0),
  totalAmount: z.number().positive(),
  deliveryAddress: z.string().min(1),
  specialInstructions: z.string().optional(),
  paymentMethod: z.string().optional(),
});

const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'refunded']),
});

export async function createOrderAction(input: z.infer<typeof createOrderSchema>) {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Datos inválidos');
  }

  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);
  if (result.session.user.id !== parsed.data.customerId) {
    throw new Error('No autorizado para crear pedidos para otro usuario');
  }

  const supabase = getServiceClient();

  const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: address } = await supabase
    .from('addresses')
    .select('id')
    .eq('user_id', parsed.data.customerId)
    .eq('is_primary', true)
    .single();

  let addressId = address?.id;
  if (!addressId) {
    const { data: newAddr } = await supabase
      .from('addresses')
      .insert({
        user_id: parsed.data.customerId,
        type: 'home',
        street_address: parsed.data.deliveryAddress,
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
      customer_id: parsed.data.customerId,
      business_id: parsed.data.businessId,
      delivery_address_id: addressId,
      status: 'pending',
      payment_status: 'pending',
      payment_method: (parsed.data.paymentMethod as PaymentMethod) ?? 'cash',
      subtotal: parsed.data.subtotal,
      delivery_fee: parsed.data.deliveryFee,
      tax_amount: parsed.data.taxAmount,
      total_amount: parsed.data.totalAmount,
      special_instructions: parsed.data.specialInstructions ?? null,
    })
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error('No se pudo crear la orden');

  const orderItems = parsed.data.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: 0,
    item_total: 0,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw new Error(itemsError.message);

  await supabase.from('order_tracking').insert({
    order_id: order.id,
    status: 'pending',
    notes: 'Orden creada',
  });

  await serverAudit.logAction(result.session.user.id, result.session.user.email, result.session.profile.role, 'create_order', 'order', order.id, { orderNumber: order.order_number, businessId: parsed.data.businessId });

  return { orderId: order.id, orderNumber: order.order_number };
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  const parsed = updateOrderStatusSchema.safeParse({ orderId, status });
  if (!parsed.success) {
    throw new Error('Datos inválidos');
  }

  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);

  const { session } = result;
  if (session.profile.role === 'customer') {
    throw new Error('Clientes no pueden actualizar estados de pedidos');
  }

  const supabase = getServiceClient();

  const { data: order, error } = await supabase
    .from('orders')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('order_tracking').insert({
    order_id: parsed.data.orderId,
    status: parsed.data.status,
    notes: `Estado actualizado a ${parsed.data.status}`,
  });

  await serverAudit.logAction(session.user.id, session.user.email, session.profile.role, 'update_order_status', 'order', parsed.data.orderId, { newStatus: parsed.data.status });

  return order;
}

export async function assignCourierAction(orderId: string, courierId: string) {
  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);

  const { session } = result;
  if (session.profile.role === 'customer' || session.profile.role === 'courier') {
    throw new Error('No autorizado para asignar repartidores');
  }

  const supabase = getServiceClient();

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

  await serverAudit.logAction(session.user.id, session.user.email, session.profile.role, 'assign_courier', 'order', orderId, { courierId });

  return order;
}
