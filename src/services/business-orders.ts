import { getBrowserClient } from '@/lib/db/supabase';

export interface BusinessOrderItemView {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  variant_selections: Record<string, unknown> | null;
  special_instructions: string | null;
  is_custom_product: boolean;
}

export interface BusinessOrderView {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  items: BusinessOrderItemView[];
  created_at: string;
  updated_at: string;
  delivery_address: string;
  delivery_instructions: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  special_instructions: string | null;
  courier_id: string | null;
  courier_name: string | null;
  created_manually: boolean;
  sales_channel: string | null;
  delivery_type: string;
}

type Row = Record<string, unknown>;

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function object(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function fullName(profile: Row, snapshot: Row) {
  const profileName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return profileName || String(snapshot.name || profile.email || 'Cliente invitado');
}

function addressText(address: Row, snapshot: Row, deliveryType: string) {
  if (deliveryType === 'pickup') return String(snapshot.street || 'Recoger en el local');
  const stored = [address.street_address, address.city, address.state_province].filter(Boolean).join(', ');
  return stored || String(snapshot.formattedAddress || snapshot.street || 'Dirección registrada manualmente');
}

export const businessOrdersService = {
  async getBusinessId(ownerId: string): Promise<string | null> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message || 'No se pudo identificar el negocio');
    return data?.id || null;
  },

  async list(businessId: string): Promise<BusinessOrderView[]> {
    const supabase = getBrowserClient();
    const { data: rows, error } = await supabase
      .from('orders')
      .select('id,order_number,customer_id,business_id,courier_id,delivery_address_id,status,payment_status,payment_method,subtotal,delivery_fee,total_amount,special_instructions,created_at,updated_at,created_manually,sales_channel,delivery_type,customer_snapshot,guest_customer,delivery_address_snapshot')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message || 'No se pudieron cargar los pedidos');
    const orders = (rows || []) as Row[];
    if (!orders.length) return [];

    const orderIds = orders.map((order) => String(order.id));
    const customerIds = [...new Set(orders.map((order) => order.customer_id ? String(order.customer_id) : '').filter(Boolean))];
    const courierIds = [...new Set(orders.map((order) => order.courier_id ? String(order.courier_id) : '').filter(Boolean))];
    const addressIds = [...new Set(orders.map((order) => order.delivery_address_id ? String(order.delivery_address_id) : '').filter(Boolean))];

    const [customersResult, couriersResult, addressesResult, itemsResult] = await Promise.all([
      customerIds.length
        ? supabase.from('profiles').select('id,first_name,last_name,email,phone').in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      courierIds.length
        ? supabase.from('profiles').select('id,first_name,last_name,email,phone').in('id', courierIds)
        : Promise.resolve({ data: [], error: null }),
      addressIds.length
        ? supabase.from('addresses').select('id,street_address,city,state_province,latitude,longitude,instructions').in('id', addressIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('order_items')
        .select('id,order_id,product_id,quantity,unit_price,item_total,variant_selections,special_instructions,product_name_snapshot,is_custom_product,products(name)')
        .in('order_id', orderIds),
    ]);

    for (const result of [customersResult, couriersResult, addressesResult, itemsResult]) {
      if (result.error) throw new Error(result.error.message || 'No se pudo completar la consulta de pedidos');
    }

    const customerMap = new Map((customersResult.data || []).map((row) => [String(row.id), row as Row]));
    const courierMap = new Map((couriersResult.data || []).map((row) => [String(row.id), row as Row]));
    const addressMap = new Map((addressesResult.data || []).map((row) => [String(row.id), row as Row]));
    const itemMap = new Map<string, BusinessOrderItemView[]>();

    for (const raw of (itemsResult.data || []) as unknown as Row[]) {
      const orderId = String(raw.order_id);
      const product = object(raw.products);
      const items = itemMap.get(orderId) || [];
      items.push({
        id: String(raw.id),
        product_id: raw.product_id ? String(raw.product_id) : null,
        name: String(raw.product_name_snapshot || product.name || 'Artículo personalizado'),
        quantity: asNumber(raw.quantity),
        unit_price: asNumber(raw.unit_price),
        item_total: asNumber(raw.item_total),
        variant_selections: Object.keys(object(raw.variant_selections)).length ? object(raw.variant_selections) : null,
        special_instructions: raw.special_instructions ? String(raw.special_instructions) : null,
        is_custom_product: Boolean(raw.is_custom_product),
      });
      itemMap.set(orderId, items);
    }

    return orders.map((order) => {
      const customer = order.customer_id ? customerMap.get(String(order.customer_id)) || {} : {};
      const courier = order.courier_id ? courierMap.get(String(order.courier_id)) || {} : {};
      const address = order.delivery_address_id ? addressMap.get(String(order.delivery_address_id)) || {} : {};
      const customerSnapshot = {
        ...object(order.guest_customer),
        ...object(order.customer_snapshot),
      };
      const addressSnapshot = object(order.delivery_address_snapshot);
      const deliveryType = String(order.delivery_type || 'delivery');
      return {
        id: String(order.id),
        order_number: String(order.order_number),
        customer_id: order.customer_id ? String(order.customer_id) : null,
        customer_name: fullName(customer, customerSnapshot),
        customer_email: String(customer.email || customerSnapshot.email || ''),
        customer_phone: customer.phone || customerSnapshot.phone ? String(customer.phone || customerSnapshot.phone) : null,
        status: String(order.status),
        payment_status: String(order.payment_status || 'pending'),
        payment_method: order.payment_method ? String(order.payment_method) : null,
        subtotal: asNumber(order.subtotal),
        delivery_fee: asNumber(order.delivery_fee),
        total_amount: asNumber(order.total_amount),
        items: itemMap.get(String(order.id)) || [],
        created_at: String(order.created_at),
        updated_at: String(order.updated_at),
        delivery_address: addressText(address, addressSnapshot, deliveryType),
        delivery_instructions: address.instructions || addressSnapshot.instructions ? String(address.instructions || addressSnapshot.instructions) : null,
        delivery_latitude: address.latitude == null && addressSnapshot.latitude == null ? null : asNumber(address.latitude ?? addressSnapshot.latitude),
        delivery_longitude: address.longitude == null && addressSnapshot.longitude == null ? null : asNumber(address.longitude ?? addressSnapshot.longitude),
        special_instructions: order.special_instructions ? String(order.special_instructions) : null,
        courier_id: order.courier_id ? String(order.courier_id) : null,
        courier_name: Object.keys(courier).length ? fullName(courier, {}) : null,
        created_manually: Boolean(order.created_manually),
        sales_channel: order.sales_channel ? String(order.sales_channel) : null,
        delivery_type: deliveryType,
      };
    });
  },

  async updateStatus(orderId: string, status: string): Promise<void> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message || 'No se pudo actualizar el pedido');
  },
};
