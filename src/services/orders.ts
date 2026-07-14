import { getBrowserClient } from '@/lib/db/supabase';
import type { Order } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OrderStatus = Order['status'];

export interface OrderItemData {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  variant_selections?: Record<string, unknown> | null;
  special_instructions?: string | null;
}

export interface OrderData {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  business_id: string;
  business_name: string;
  courier_id: string | null;
  courier_name: string | null;
  status: OrderStatus;
  order_type: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
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

export interface CreateOrderItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  customization?: Record<string, unknown>;
  specialInstructions?: string;
}

type OrderListener = (order: OrderData) => void;
const listeners = new Set<OrderListener>();

async function getClient() {
  return getBrowserClient();
}

function formatAddress(parts: Array<string | null | undefined>, fallback: string) {
  const address = parts.map((part) => part?.trim()).filter(Boolean).join(', ');
  return address || fallback;
}

async function buildOrderData(order: Order): Promise<OrderData> {
  const supabase = await getClient();
  const row = order as Order & {
    pickup_address?: string | null;
    pickup_lat?: number | null;
    pickup_lng?: number | null;
    payment_status?: string | null;
    payment_method?: string | null;
  };

  const [profileResult, bizResult, itemsResult, addrResult, courierResult, bizAddressResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('first_name,last_name,phone')
        .eq('id', order.customer_id)
        .single(),
      supabase.from('businesses').select('name').eq('id', order.business_id).single(),
      supabase.from('order_items').select('*, products(name)').eq('order_id', order.id),
      supabase
        .from('addresses')
        .select('street_address,city,state_province,latitude,longitude')
        .eq('id', order.delivery_address_id)
        .single(),
      order.courier_id
        ? supabase
            .from('profiles')
            .select('first_name,last_name')
            .eq('id', order.courier_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from('business_addresses')
        .select('street_address,city,state_province,latitude,longitude')
        .eq('business_id', order.business_id)
        .eq('is_primary', true)
        .maybeSingle(),
    ]);

  const customerName = profileResult.data
    ? [profileResult.data.first_name, profileResult.data.last_name].filter(Boolean).join(' ')
    : 'Cliente';
  const courierName = courierResult.data
    ? [courierResult.data.first_name, courierResult.data.last_name].filter(Boolean).join(' ')
    : null;

  const deliveryAddress = addrResult.data
    ? formatAddress(
        [addrResult.data.street_address, addrResult.data.city, addrResult.data.state_province],
        'Dirección de entrega no disponible',
      )
    : 'Dirección de entrega no disponible';

  const businessAddress = bizAddressResult.data
    ? formatAddress(
        [
          bizAddressResult.data.street_address,
          bizAddressResult.data.city,
          bizAddressResult.data.state_province,
        ],
        'Dirección del negocio no disponible',
      )
    : 'Dirección del negocio no disponible';

  return {
    id: order.id,
    order_number: order.order_number,
    customer_id: order.customer_id,
    customer_name: customerName || 'Cliente',
    customer_phone: profileResult.data?.phone ?? row.customer_phone ?? undefined,
    business_id: order.business_id,
    business_name: bizResult.data?.name ?? 'Negocio',
    courier_id: order.courier_id,
    courier_name: courierName,
    status: order.status,
    order_type: order.order_type ?? null,
    payment_status: row.payment_status ?? null,
    payment_method: row.payment_method ?? null,
    subtotal: Number(order.subtotal),
    delivery_fee: Number(order.delivery_fee),
    tax_amount: Number(order.tax_amount),
    total_amount: Number(order.total_amount),
    pickup_address: row.pickup_address || businessAddress,
    pickup_lat:
      row.pickup_lat == null
        ? bizAddressResult.data?.latitude == null
          ? null
          : Number(bizAddressResult.data.latitude)
        : Number(row.pickup_lat),
    pickup_lng:
      row.pickup_lng == null
        ? bizAddressResult.data?.longitude == null
          ? null
          : Number(bizAddressResult.data.longitude)
        : Number(row.pickup_lng),
    delivery_address: deliveryAddress,
    delivery_lat:
      addrResult.data?.latitude == null ? null : Number(addrResult.data.latitude),
    delivery_lng:
      addrResult.data?.longitude == null ? null : Number(addrResult.data.longitude),
    special_instructions: order.special_instructions,
    items: (itemsResult.data ?? []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products?.name ?? 'Producto',
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      item_total: Number(item.item_total),
      variant_selections: item.variant_selections,
      special_instructions: item.special_instructions,
    })),
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

async function fetchOrderWithDetails(orderId: string) {
  const supabase = await getClient();
  const { data } = await supabase.from('orders').select('*').eq('id', orderId).single();
  return data ? buildOrderData(data as Order) : null;
}

export const orderService = {
  createOrder: async (input: {
    customerId: string;
    customerName: string;
    businessId: string;
    businessName: string;
    items: CreateOrderItemInput[];
    subtotal: number;
    deliveryFee: number;
    taxAmount: number;
    totalAmount: number;
    deliveryAddress: string;
    instructions: string;
  }): Promise<OrderData> => {
    const supabase = await getClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', input.customerId)
      .single();
    if (!profile) throw new Error('Usuario no encontrado');

    let { data: address } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', input.customerId)
      .eq('is_primary', true)
      .maybeSingle();

    if (!address) {
      const result = await supabase
        .from('addresses')
        .insert({
          user_id: input.customerId,
          type: 'home',
          street_address: input.deliveryAddress,
          city: 'Santa Marta',
          state_province: 'Magdalena',
          country: 'Colombia',
          is_primary: true,
        })
        .select('id')
        .single();
      address = result.data;
    }

    if (!address) throw new Error('No se pudo crear la dirección');

    const orderNumber = `DOM-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: input.customerId,
        business_id: input.businessId,
        delivery_address_id: address.id,
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

    if (error || !order) throw new Error(error?.message ?? 'Error al crear orden');

    const { error: itemsError } = await supabase.from('order_items').insert(
      input.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        item_total: item.unitPrice * item.quantity,
        variant_selections: item.customization ?? null,
        special_instructions: item.specialInstructions || null,
      })) as any,
    );

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw new Error(itemsError.message);
    }

    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'pending',
      notes: 'Orden creada',
    });

    return (await fetchOrderWithDetails(order.id)) as OrderData;
  },

  getCustomerOrders: async (customerId: string) => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    return Promise.all((data ?? []).map((order) => buildOrderData(order as Order)));
  },

  getBusinessOrders: async (businessId?: string) => {
    const supabase = await getClient();
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (businessId) query = query.eq('business_id', businessId);
    const { data } = await query;
    return Promise.all((data ?? []).map((order) => buildOrderData(order as Order)));
  },

  getCourierOrders: async (courierId?: string) => {
    const supabase = await getClient();
    let query = supabase
      .from('orders')
      .select('*')
      .not('courier_id', 'is', null)
      .order('created_at', { ascending: false });
    if (courierId) query = query.eq('courier_id', courierId);
    const { data } = await query;
    return Promise.all((data ?? []).map((order) => buildOrderData(order as Order)));
  },

  getAvailableOrders: async () => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .is('courier_id', null)
      .or(
        'and(status.in.(confirmed,ready)),and(status.eq.pending,order_type.eq.manual_delivery)',
      )
      .order('created_at', { ascending: false });
    return Promise.all((data ?? []).map((order) => buildOrderData(order as Order)));
  },

  getOrderById: fetchOrderWithDetails,

  updateStatus: async (orderId: string, status: OrderStatus) => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (!data) return null;
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status,
      notes: `Estado actualizado a ${status}`,
    });
    const result = await fetchOrderWithDetails(orderId);
    if (result) listeners.forEach((fn) => fn(result));
    return result;
  },

  assignCourier: async (orderId: string, courierId: string, courierName: string) => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('orders')
      .update({
        courier_id: courierId,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .is('courier_id', null)
      .select()
      .single();
    if (!data) return null;
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'assigned',
      notes: `Asignado a ${courierName}`,
    });
    const result = await fetchOrderWithDetails(orderId);
    if (result) listeners.forEach((fn) => fn(result));
    return result;
  },

  acceptOrder: async (orderId: string) => orderService.updateStatus(orderId, 'confirmed'),
  rejectOrder: async (orderId: string) => orderService.updateStatus(orderId, 'cancelled'),

  getOrderEvents: async (orderId: string): Promise<OrderEvent[]> => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('order_tracking')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at');
    return (data ?? []).map((event: any) => ({
      order_id: event.order_id,
      status: event.status,
      timestamp: event.created_at,
      actor: 'system',
      note: event.notes ?? undefined,
    }));
  },

  subscribe: (listener: OrderListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  startPolling: (callback: () => void, intervalMs = 3000) => {
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  },
};
