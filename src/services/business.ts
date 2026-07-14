import { getBrowserClient } from '@/lib/db/supabase';

export interface BusinessDashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  activeOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  avgTicket: number;
  avgPrepTime: number;
  topProducts: { id: string; name: string; total: number; image_url: string | null }[];
  newCustomers: number;
  frequentCustomers: number;
  rating: number;
  totalRatings: number;
  commissionPaid: number;
  netProfit: number;
  totalProducts: number;
  totalOrders: number;
}

export interface BusinessProduct {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  discount_price: number | null;
  status: string;
  quantity_available: number;
  preparation_time_minutes: number;
  is_featured: boolean;
  image_url: string | null;
  category_name?: string;
  variant_count?: number;
  created_at: string;
}

export interface BusinessCustomer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  order_count: number;
  active_orders: number;
  delivered_orders: number;
  total_spent: number;
  last_order_at: string | null;
  avg_rating: number | null;
}

export interface BusinessOrderItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  variant_selections: Record<string, unknown> | null;
  special_instructions: string | null;
}

export interface BusinessOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  items: BusinessOrderItem[];
  created_at: string;
  updated_at: string;
  delivery_address: string;
  delivery_instructions: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  special_instructions: string | null;
  courier_id: string | null;
  courier_name: string | null;
}

export interface BusinessReport {
  dailySales: { date: string; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; total: number; revenue: number }[];
  peakHours: { hour: number; orders: number }[];
  categoryDist: { name: string; count: number }[];
  monthlyComparison: { month: string; revenue: number; orders: number }[];
  summary: {
    totalOrderValue: number;
    collectedRevenue: number;
    pendingRevenue: number;
    activeOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
  };
}

type UnknownRow = Record<string, unknown>;

function asNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function buildFullName(profile?: UnknownRow): string {
  if (!profile) return 'Cliente';
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return name || String(profile.email || 'Cliente');
}

function buildAddress(address?: UnknownRow): string {
  if (!address) return 'Dirección no disponible';
  return [address.street_address, address.city, address.state_province]
    .filter(Boolean)
    .join(', ');
}

function ensureNoError(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

export const businessService = {
  async getBusinessId(ownerId: string): Promise<string | null> {
    const supabase = await getBrowserClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .maybeSingle();
    ensureNoError(error, 'No se pudo identificar el negocio');
    return data?.id || null;
  },

  async getDashboardStats(businessId: string): Promise<BusinessDashboardStats> {
    const supabase = await getBrowserClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [bizResult, ordersResult, productsResult, commissionsResult] = await Promise.all([
      supabase.from('businesses').select('rating,total_ratings').eq('id', businessId).single(),
      supabase
        .from('orders')
        .select('id,customer_id,total_amount,status,payment_status,created_at')
        .eq('business_id', businessId)
        .is('deleted_at', null),
      supabase
        .from('products')
        .select('id,name,image_url,status')
        .eq('business_id', businessId)
        .is('deleted_at', null),
      supabase
        .from('commission_transactions')
        .select('commission_amount')
        .eq('business_id', businessId),
    ]);

    ensureNoError(bizResult.error, 'No se pudieron consultar los datos del negocio');
    ensureNoError(ordersResult.error, 'No se pudieron consultar los pedidos');
    ensureNoError(productsResult.error, 'No se pudieron consultar los productos');

    const orders = (ordersResult.data || []) as UnknownRow[];
    const validOrders = orders.filter((order) => !['cancelled', 'refunded'].includes(String(order.status)));
    const delivered = orders.filter((order) => order.status === 'delivered');
    const cancelled = orders.filter((order) => ['cancelled', 'refunded'].includes(String(order.status)));
    const active = validOrders.filter((order) => order.status !== 'delivered');
    const sum = (rows: UnknownRow[]) => rows.reduce((total, row) => total + asNumber(row.total_amount), 0);
    const revenueRows = (rows: UnknownRow[]) => rows.filter((row) => row.status === 'delivered' || row.payment_status === 'paid');

    const orderIds = validOrders.map((order) => String(order.id));
    const productSales = new Map<string, { total: number; name: string; image_url: string | null }>();
    if (orderIds.length > 0) {
      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id,quantity,products(name,image_url)')
        .in('order_id', orderIds);
      ensureNoError(itemsError, 'No se pudieron consultar los productos vendidos');
      for (const raw of (itemRows || []) as unknown as UnknownRow[]) {
        const productId = String(raw.product_id || '');
        const product = (raw.products || {}) as UnknownRow;
        const current = productSales.get(productId) || {
          total: 0,
          name: String(product.name || 'Producto'),
          image_url: product.image_url ? String(product.image_url) : null,
        };
        current.total += asNumber(raw.quantity);
        productSales.set(productId, current);
      }
    }

    const customerIds = [...new Set(validOrders.map((order) => String(order.customer_id)))];
    const frequentCustomers = customerIds.filter(
      (customerId) => validOrders.filter((order) => order.customer_id === customerId).length >= 3,
    );
    let newCustomers = 0;
    if (customerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,created_at')
        .in('id', customerIds);
      newCustomers = (profiles || []).filter((profile) => String(profile.created_at) >= monthAgo).length;
    }

    const commissionPaid = (commissionsResult.data || []).reduce(
      (total, row) => total + asNumber(row.commission_amount),
      0,
    );
    const monthRevenue = sum(revenueRows(validOrders.filter((order) => String(order.created_at) >= monthAgo)));

    return {
      todayRevenue: sum(revenueRows(validOrders.filter((order) => String(order.created_at) >= today))),
      weekRevenue: sum(revenueRows(validOrders.filter((order) => String(order.created_at) >= weekAgo))),
      monthRevenue,
      activeOrders: active.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      avgTicket: delivered.length > 0 ? sum(delivered) / delivered.length : 0,
      avgPrepTime: 0,
      topProducts: Array.from(productSales.entries())
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      newCustomers,
      frequentCustomers: frequentCustomers.length,
      rating: asNumber(bizResult.data?.rating),
      totalRatings: asNumber(bizResult.data?.total_ratings),
      commissionPaid,
      netProfit: monthRevenue - commissionPaid,
      totalProducts: (productsResult.data || []).length,
      totalOrders: orders.length,
    };
  },

  async getProducts(businessId: string): Promise<BusinessProduct[]> {
    const supabase = await getBrowserClient();
    const { data, error } = await supabase
      .from('products')
      .select('*,categories(name)')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    ensureNoError(error, 'No se pudieron cargar los productos');

    return ((data || []) as unknown as (BusinessProduct & { categories?: { name: string } | null })[]).map(
      (product) => ({
        ...product,
        price: asNumber(product.price),
        cost_price: product.cost_price == null ? null : asNumber(product.cost_price),
        discount_price: product.discount_price == null ? null : asNumber(product.discount_price),
        quantity_available: asNumber(product.quantity_available),
        preparation_time_minutes: asNumber(product.preparation_time_minutes),
        category_name: product.categories?.name || 'Sin categoría',
      }),
    );
  },

  async createProduct(businessId: string, product: Partial<BusinessProduct>): Promise<void> {
    const supabase = await getBrowserClient();
    const sku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const name = String(product.name || '').trim();
    if (!name) throw new Error('El nombre del producto es obligatorio');
    if (asNumber(product.price) < 0) throw new Error('El precio no puede ser negativo');

    const { error } = await supabase.from('products').insert({
      business_id: businessId,
      sku,
      name,
      slug: `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`,
      description: product.description?.trim() || null,
      price: asNumber(product.price),
      category_id: product.category_id || null,
      cost_price: product.cost_price == null ? null : asNumber(product.cost_price),
      discount_price: product.discount_price == null ? null : asNumber(product.discount_price),
      quantity_available: Math.max(0, Math.trunc(asNumber(product.quantity_available))),
      preparation_time_minutes: Math.max(0, Math.trunc(asNumber(product.preparation_time_minutes))),
      image_url: product.image_url || null,
      status: product.status || 'available',
    } as never);
    ensureNoError(error, 'No se pudo crear el producto');
  },

  async updateProduct(productId: string, updates: Partial<BusinessProduct>): Promise<void> {
    const supabase = await getBrowserClient();
    const allowed: (keyof BusinessProduct)[] = [
      'name',
      'description',
      'price',
      'category_id',
      'cost_price',
      'discount_price',
      'quantity_available',
      'preparation_time_minutes',
      'image_url',
      'status',
      'is_featured',
    ];
    const clean: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) clean[key] = updates[key];
    }
    if ('category_id' in clean && !clean.category_id) clean.category_id = null;
    if ('price' in clean) clean.price = asNumber(clean.price);
    if ('quantity_available' in clean) clean.quantity_available = Math.max(0, Math.trunc(asNumber(clean.quantity_available)));
    if ('preparation_time_minutes' in clean) clean.preparation_time_minutes = Math.max(0, Math.trunc(asNumber(clean.preparation_time_minutes)));
    clean.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(clean as never)
      .eq('id', productId)
      .select('id')
      .single();
    ensureNoError(error, 'No se pudo actualizar el producto');
    if (!data) throw new Error('El producto no fue actualizado');
  },

  async deleteProduct(productId: string): Promise<void> {
    await this.updateProduct(productId, {
      status: 'discontinued',
    });
    const supabase = await getBrowserClient();
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq('id', productId);
    ensureNoError(error, 'No se pudo eliminar el producto');
  },

  async duplicateProduct(productId: string): Promise<void> {
    const supabase = await getBrowserClient();
    const { data: original, error: readError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    ensureNoError(readError, 'No se pudo leer el producto');
    if (!original) throw new Error('Producto no encontrado');

    await this.createProduct(String(original.business_id), {
      name: `${original.name} (copia)`,
      description: original.description,
      price: asNumber(original.price),
      category_id: original.category_id,
      cost_price: original.cost_price == null ? null : asNumber(original.cost_price),
      discount_price: original.discount_price == null ? null : asNumber(original.discount_price),
      quantity_available: asNumber(original.quantity_available),
      preparation_time_minutes: asNumber(original.preparation_time_minutes),
      image_url: original.image_url,
      status: String(original.status),
    });
  },

  async getCustomers(businessId: string): Promise<BusinessCustomer[]> {
    const supabase = await getBrowserClient();
    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select('customer_id,total_amount,status,payment_status,created_at')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    ensureNoError(ordersError, 'No se pudieron cargar los clientes');

    const orders = ((orderRows || []) as UnknownRow[]).filter(
      (order) => !['cancelled', 'refunded'].includes(String(order.status)),
    );
    const customerMap = new Map<
      string,
      { order_count: number; active_orders: number; delivered_orders: number; total_spent: number; last_order_at: string }
    >();

    for (const order of orders) {
      const customerId = String(order.customer_id);
      const current = customerMap.get(customerId) || {
        order_count: 0,
        active_orders: 0,
        delivered_orders: 0,
        total_spent: 0,
        last_order_at: '',
      };
      current.order_count += 1;
      if (order.status === 'delivered') current.delivered_orders += 1;
      else current.active_orders += 1;
      if (order.status === 'delivered' || order.payment_status === 'paid') {
        current.total_spent += asNumber(order.total_amount);
      }
      const createdAt = String(order.created_at || '');
      if (!current.last_order_at || createdAt > current.last_order_at) current.last_order_at = createdAt;
      customerMap.set(customerId, current);
    }

    const customerIds = [...customerMap.keys()];
    if (customerIds.length === 0) return [];

    const [{ data: profiles, error: profileError }, { data: ratings }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,first_name,last_name,email,phone,avatar_url')
        .in('id', customerIds),
      supabase.from('ratings').select('rater_id,rating').eq('rated_entity_id', businessId),
    ]);
    ensureNoError(profileError, 'No se pudo cargar la información de los clientes');

    const profileMap = new Map((profiles || []).map((profile) => [String(profile.id), profile as UnknownRow]));
    const ratingMap = new Map<string, number[]>();
    for (const rating of (ratings || []) as UnknownRow[]) {
      const id = String(rating.rater_id);
      const values = ratingMap.get(id) || [];
      values.push(asNumber(rating.rating));
      ratingMap.set(id, values);
    }

    return customerIds
      .map((id) => {
        const profile = profileMap.get(id) || {};
        const stats = customerMap.get(id)!;
        const ratingValues = ratingMap.get(id) || [];
        return {
          id,
          first_name: profile.first_name ? String(profile.first_name) : null,
          last_name: profile.last_name ? String(profile.last_name) : null,
          email: String(profile.email || ''),
          phone: profile.phone ? String(profile.phone) : null,
          avatar_url: profile.avatar_url ? String(profile.avatar_url) : null,
          order_count: stats.order_count,
          active_orders: stats.active_orders,
          delivered_orders: stats.delivered_orders,
          total_spent: stats.total_spent,
          last_order_at: stats.last_order_at || null,
          avg_rating:
            ratingValues.length > 0
              ? Math.round((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length) * 10) / 10
              : null,
        };
      })
      .sort((a, b) => new Date(b.last_order_at || 0).getTime() - new Date(a.last_order_at || 0).getTime());
  },

  async getBusinessOrders(businessId: string): Promise<BusinessOrder[]> {
    const supabase = await getBrowserClient();
    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select(
        'id,order_number,customer_id,business_id,courier_id,delivery_address_id,status,payment_status,payment_method,subtotal,delivery_fee,total_amount,special_instructions,created_at,updated_at',
      )
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    ensureNoError(ordersError, 'No se pudieron cargar los pedidos del negocio');

    const orders = (orderRows || []) as UnknownRow[];
    if (orders.length === 0) return [];

    const orderIds = orders.map((order) => String(order.id));
    const customerIds = [...new Set(orders.map((order) => String(order.customer_id)))];
    const courierIds = [
      ...new Set(orders.map((order) => (order.courier_id ? String(order.courier_id) : '')).filter(Boolean)),
    ];
    const addressIds = [...new Set(orders.map((order) => String(order.delivery_address_id)))];

    const [profilesResult, courierResult, addressResult, itemsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,first_name,last_name,email,phone')
        .in('id', customerIds),
      courierIds.length > 0
        ? supabase.from('profiles').select('id,first_name,last_name,email,phone').in('id', courierIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('addresses')
        .select('id,street_address,city,state_province,latitude,longitude,instructions')
        .in('id', addressIds),
      supabase
        .from('order_items')
        .select(
          'id,order_id,product_id,quantity,unit_price,item_total,variant_selections,special_instructions,products(name)',
        )
        .in('order_id', orderIds),
    ]);

    ensureNoError(profilesResult.error, 'No se pudieron cargar los datos del cliente');
    ensureNoError(addressResult.error, 'No se pudieron cargar las direcciones de entrega');
    ensureNoError(itemsResult.error, 'No se pudieron cargar los productos del pedido');

    const profileMap = new Map(
      (profilesResult.data || []).map((profile) => [String(profile.id), profile as UnknownRow]),
    );
    const courierMap = new Map(
      (courierResult.data || []).map((profile) => [String(profile.id), profile as UnknownRow]),
    );
    const addressMap = new Map(
      (addressResult.data || []).map((address) => [String(address.id), address as UnknownRow]),
    );
    const itemMap = new Map<string, BusinessOrderItem[]>();

    for (const rawItem of (itemsResult.data || []) as unknown as UnknownRow[]) {
      const orderId = String(rawItem.order_id);
      const product = (rawItem.products || {}) as UnknownRow;
      const items = itemMap.get(orderId) || [];
      items.push({
        id: String(rawItem.id),
        product_id: String(rawItem.product_id),
        name: String(product.name || 'Producto'),
        quantity: asNumber(rawItem.quantity),
        unit_price: asNumber(rawItem.unit_price),
        item_total: asNumber(rawItem.item_total),
        variant_selections: (rawItem.variant_selections as Record<string, unknown> | null) || null,
        special_instructions: rawItem.special_instructions ? String(rawItem.special_instructions) : null,
      });
      itemMap.set(orderId, items);
    }

    return orders.map((order) => {
      const customer = profileMap.get(String(order.customer_id));
      const courier = order.courier_id ? courierMap.get(String(order.courier_id)) : undefined;
      const address = addressMap.get(String(order.delivery_address_id));
      return {
        id: String(order.id),
        order_number: String(order.order_number),
        customer_id: String(order.customer_id),
        customer_name: buildFullName(customer),
        customer_email: String(customer?.email || ''),
        customer_phone: customer?.phone ? String(customer.phone) : null,
        status: String(order.status),
        payment_status: String(order.payment_status || 'pending'),
        payment_method: order.payment_method ? String(order.payment_method) : null,
        subtotal: asNumber(order.subtotal),
        delivery_fee: asNumber(order.delivery_fee),
        total_amount: asNumber(order.total_amount),
        items: itemMap.get(String(order.id)) || [],
        created_at: String(order.created_at),
        updated_at: String(order.updated_at),
        delivery_address: buildAddress(address),
        delivery_instructions: address?.instructions ? String(address.instructions) : null,
        delivery_latitude: address?.latitude == null ? null : asNumber(address.latitude),
        delivery_longitude: address?.longitude == null ? null : asNumber(address.longitude),
        special_instructions: order.special_instructions ? String(order.special_instructions) : null,
        courier_id: order.courier_id ? String(order.courier_id) : null,
        courier_name: courier ? buildFullName(courier) : null,
      };
    });
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const supabase = await getBrowserClient();
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq('id', orderId)
      .select('id,status')
      .single();
    ensureNoError(error, 'No se pudo actualizar el estado del pedido');
    if (!data) throw new Error('El pedido no fue actualizado');
  },

  async getCategories(businessId: string): Promise<Record<string, unknown>[]> {
    const supabase = await getBrowserClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('name');
    ensureNoError(error, 'No se pudieron cargar las categorías');
    return data || [];
  },

  async getReport(businessId: string): Promise<BusinessReport> {
    const supabase = await getBrowserClient();
    const now = new Date();
    const start = new Date(now.getTime() - 29 * 86400000);
    start.setHours(0, 0, 0, 0);

    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select('id,total_amount,status,payment_status,created_at')
      .eq('business_id', businessId)
      .gte('created_at', start.toISOString())
      .is('deleted_at', null)
      .order('created_at');
    ensureNoError(ordersError, 'No se pudo generar el reporte de pedidos');

    const orders = (orderRows || []) as UnknownRow[];
    const validOrders = orders.filter((order) => !['cancelled', 'refunded'].includes(String(order.status)));
    const orderIds = validOrders.map((order) => String(order.id));
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    const hourCount = new Array<number>(24).fill(0);

    for (let index = 0; index < 30; index += 1) {
      const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
      dailyMap.set(date, { revenue: 0, orders: 0 });
    }

    for (const order of validOrders) {
      const date = String(order.created_at).slice(0, 10);
      const current = dailyMap.get(date) || { revenue: 0, orders: 0 };
      current.revenue += asNumber(order.total_amount);
      current.orders += 1;
      dailyMap.set(date, current);
      hourCount[new Date(String(order.created_at)).getHours()] += 1;
    }

    const productMap = new Map<string, { name: string; total: number; revenue: number }>();
    if (orderIds.length > 0) {
      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id,product_id,quantity,unit_price,products(name)')
        .in('order_id', orderIds);
      ensureNoError(itemsError, 'No se pudieron calcular los productos vendidos');
      for (const rawItem of (itemRows || []) as unknown as UnknownRow[]) {
        const productId = String(rawItem.product_id);
        const product = (rawItem.products || {}) as UnknownRow;
        const current = productMap.get(productId) || {
          name: String(product.name || 'Producto'),
          total: 0,
          revenue: 0,
        };
        current.total += asNumber(rawItem.quantity);
        current.revenue += asNumber(rawItem.quantity) * asNumber(rawItem.unit_price);
        productMap.set(productId, current);
      }
    }

    const collectedRevenue = validOrders
      .filter((order) => order.payment_status === 'paid' || order.status === 'delivered')
      .reduce((total, order) => total + asNumber(order.total_amount), 0);
    const totalOrderValue = validOrders.reduce((total, order) => total + asNumber(order.total_amount), 0);

    return {
      dailySales: Array.from(dailyMap.entries())
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topProducts: Array.from(productMap.entries())
        .map(([id, values]) => ({ id, ...values }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      peakHours: hourCount
        .map((ordersCount, hour) => ({ hour, orders: ordersCount }))
        .filter((entry) => entry.orders > 0)
        .sort((a, b) => b.orders - a.orders),
      categoryDist: [],
      monthlyComparison: [],
      summary: {
        totalOrderValue,
        collectedRevenue,
        pendingRevenue: Math.max(0, totalOrderValue - collectedRevenue),
        activeOrders: validOrders.filter((order) => order.status !== 'delivered').length,
        deliveredOrders: validOrders.filter((order) => order.status === 'delivered').length,
        cancelledOrders: orders.filter((order) => ['cancelled', 'refunded'].includes(String(order.status))).length,
      },
    };
  },
};
