import { getBrowserClient } from '@/lib/db/supabase';
import type { Order } from '@/types/database';

export type OrderStatus = Order['status'];

export interface OrderItemData {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
}

export interface OrderData {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  business_id: string;
  business_name: string;
  courier_id: string | null;
  courier_name: string | null;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  delivery_address: string;
  special_instructions: string | null;
  items: OrderItemData[];
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  order_id: string;
  status: OrderStatus;
  timestamp: string;
  actor: 'system' | 'customer' | 'business' | 'courier';
  note?: string;
}

type OrderListener = (order: OrderData) => void;
const listeners: Set<OrderListener> = new Set();

async function getClient() {
  return getBrowserClient();
}

function mapOrderToData(order: Order, items: OrderItemData[], customerName: string, businessName: string, courierName: string | null, address: string): OrderData {
  return {
    id: order.id,
    order_number: order.order_number,
    customer_id: order.customer_id,
    customer_name: customerName,
    business_id: order.business_id,
    business_name: businessName,
    courier_id: order.courier_id,
    courier_name: courierName,
    status: order.status,
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    tax_amount: order.tax_amount,
    total_amount: order.total_amount,
    delivery_address: address,
    special_instructions: order.special_instructions,
    items,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

async function fetchOrderWithDetails(orderId: string): Promise<OrderData | null> {
  const supabase = await getClient();
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return null;
  return buildOrderData(order);
}

async function buildOrderData(order: Order): Promise<OrderData> {
  const supabase = await getClient();

  const [profileResult, bizResult, itemsResult, addrResult, courierResult] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name').eq('id', order.customer_id).single(),
    supabase.from('businesses').select('name').eq('id', order.business_id).single(),
    supabase.from('order_items').select('*').eq('order_id', order.id),
    supabase.from('addresses').select('street_address, city, state_province').eq('id', order.delivery_address_id).single(),
    order.courier_id
      ? supabase.from('profiles').select('first_name, last_name').eq('id', order.courier_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const customerName = profileResult.data
    ? [profileResult.data.first_name, profileResult.data.last_name].filter(Boolean).join(' ')
    : 'Cliente';
  const businessName = bizResult.data?.name ?? 'Negocio';
  const courierName = courierResult?.data
    ? [courierResult.data.first_name, courierResult.data.last_name].filter(Boolean).join(' ')
    : null;

  const addr = addrResult.data;
  const address = addr
    ? [addr.street_address, addr.city, addr.state_province].filter(Boolean).join(', ')
    : 'Dirección no disponible';

  const itemsData = (itemsResult.data ?? []) as any[];
  const items: OrderItemData[] = itemsData
    .filter((i: any) => i !== null)
    .map((i: any) => ({
      product_id: i.product_id ?? '',
      product_name: '',
      quantity: i.quantity,
      unit_price: i.unit_price,
      item_total: i.item_total,
    }));

  return mapOrderToData(order, items, customerName, businessName, courierName, address);
}

export const orderService = {
  createOrder: async (input: {
    customerId: string;
    customerName: string;
    businessId: string;
    businessName: string;
    items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    deliveryFee: number;
    taxAmount: number;
    totalAmount: number;
    deliveryAddress: string;
    instructions: string;
  }): Promise<OrderData> => {
    const supabase = await getClient();

    const { data: profile } = await supabase.from('profiles').select('id').eq('id', input.customerId).single();
    if (!profile) throw new Error('Usuario no encontrado');

    // Get or create delivery address
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', input.customerId)
      .eq('is_primary', true)
      .single();

    let addressId = existingAddress?.id;
    if (!addressId) {
      const { data: newAddr } = await supabase
        .from('addresses')
        .insert({
          user_id: input.customerId,
          type: 'home' as const,
          street_address: input.deliveryAddress,
          city: 'Ciudad',
          country: 'Colombia',
          is_primary: true,
        })
        .select('id')
        .single();
      addressId = newAddr?.id;
    }
    if (!addressId) throw new Error('No se pudo crear la dirección');

    // Generate order number
    const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: input.customerId,
        business_id: input.businessId,
        delivery_address_id: addressId,
        status: 'pending',
        payment_status: 'pending',
        subtotal: input.subtotal,
        delivery_fee: input.deliveryFee,
        tax_amount: input.taxAmount,
        total_amount: input.totalAmount,
        special_instructions: input.instructions || null,
      })
      .select()
      .single();

    if (orderError || !order) throw new Error(orderError?.message ?? 'Error al crear orden');

    // Insert order items
    const orderItems = input.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      item_total: item.unitPrice * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems as any);
    if (itemsError) throw new Error(itemsError.message);

    // Add order tracking event
    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'pending',
      notes: 'Orden creada',
    });

    return fetchOrderWithDetails(order.id) as Promise<OrderData>;
  },

  getCustomerOrders: async (customerId: string): Promise<OrderData[]> => {
    const supabase = await getClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (!orders) return [];
    return Promise.all(orders.map(buildOrderData));
  },

  getBusinessOrders: async (businessId?: string): Promise<OrderData[]> => {
    const supabase = await getClient();
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (businessId) query = query.eq('business_id', businessId);
    const { data: orders } = await query;
    if (!orders) return [];
    return Promise.all(orders.map(buildOrderData));
  },

  getCourierOrders: async (courierId?: string): Promise<OrderData[]> => {
    const supabase = await getClient();
    let query = supabase.from('orders').select('*').not('courier_id', 'is', null).order('created_at', { ascending: false });
    if (courierId) query = query.eq('courier_id', courierId);
    const { data: orders } = await query;
    if (!orders) return [];
    return Promise.all(orders.map(buildOrderData));
  },

  getAvailableOrders: async (): Promise<OrderData[]> => {
    const supabase = await getClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['confirmed', 'ready'])
      .is('courier_id', null)
      .order('created_at', { ascending: false });
    if (!orders) return [];
    return Promise.all(orders.map(buildOrderData));
  },

  getOrderById: async (orderId: string): Promise<OrderData | null> => {
    return fetchOrderWithDetails(orderId);
  },

  updateStatus: async (orderId: string, status: OrderStatus): Promise<OrderData | null> => {
    const supabase = await getClient();
    const { data: order } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (!order) return null;

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status,
      notes: `Estado actualizado a ${status}`,
    });

    const result = await fetchOrderWithDetails(orderId);
    if (result) {
      listeners.forEach((fn) => fn(result));
    }
    return result;
  },

  assignCourier: async (orderId: string, courierId: string, courierName: string): Promise<OrderData | null> => {
    const supabase = await getClient();
    const { data: order } = await supabase
      .from('orders')
      .update({ courier_id: courierId, status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (!order) return null;

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'assigned',
      notes: `Asignado a ${courierName}`,
    });

    const result = await fetchOrderWithDetails(orderId);
    if (result) {
      listeners.forEach((fn) => fn(result));
    }
    return result;
  },

  acceptOrder: async (orderId: string): Promise<OrderData | null> => {
    return orderService.updateStatus(orderId, 'confirmed');
  },

  rejectOrder: async (orderId: string): Promise<OrderData | null> => {
    return orderService.updateStatus(orderId, 'cancelled');
  },

  getOrderEvents: async (orderId: string): Promise<OrderEvent[]> => {
    const supabase = await getClient();
    const { data: tracking } = await supabase
      .from('order_tracking')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (!tracking) return [];
    return (tracking as any[]).map((t: any) => ({
      order_id: t.order_id,
      status: t.status,
      timestamp: t.created_at,
      actor: 'system' as const,
      note: t.notes ?? undefined,
    }));
  },

  subscribe: (listener: OrderListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  startPolling: (callback: () => void, _intervalMs = 3000): (() => void) => {
    const id = setInterval(callback, _intervalMs);
    return () => clearInterval(id);
  },
};
