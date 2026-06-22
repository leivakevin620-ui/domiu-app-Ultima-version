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
  category_id: string;
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
  total_spent: number;
  last_order_at: string | null;
  avg_rating: number | null;
}

export interface BusinessOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  total_amount: number;
  items: { id: string; name: string; quantity: number; unit_price: number }[];
  created_at: string;
  updated_at: string;
  delivery_address: string;
  special_instructions: string | null;
  courier_name: string | null;
}

export interface BusinessReport {
  dailySales: { date: string; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; total: number; revenue: number }[];
  peakHours: { hour: number; orders: number }[];
  categoryDist: { name: string; count: number }[];
  monthlyComparison: { month: string; revenue: number; orders: number }[];
}

export const businessService = {
  async getBusinessId(ownerId: string): Promise<string | null> {
    const supabase = await getBrowserClient();
    const { data } = await supabase.from('businesses').select('id').eq('owner_id', ownerId).maybeSingle();
    return data?.id || null;
  },

  async getDashboardStats(businessId: string): Promise<BusinessDashboardStats> {
    const supabase = await getBrowserClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [{ data: biz }, { data: orders }, { data: todayOrders }, { data: products }, , { data: commissions }] = await Promise.all([
      supabase.from('businesses').select('id, rating, total_ratings').eq('id', businessId).single(),
      supabase.from('orders').select('total_amount, status, created_at').eq('business_id', businessId),
      supabase.from('orders').select('total_amount, status, created_at').eq('business_id', businessId).gte('created_at', today),
      supabase.from('products').select('id, name, image_url').eq('business_id', businessId).eq('status', 'available'),
      supabase.from('ratings').select('rating').eq('rated_entity_id', businessId),
      supabase.from('commission_transactions').select('commission_amount').eq('business_id', businessId),
    ]);

    const orderList = (orders || []) as Record<string, unknown>[];
    const todayOrdersList = (todayOrders || []) as Record<string, unknown>[];
    const weekOrders = orderList.filter((o) => (o.created_at as string) >= weekAgo);
    const monthOrders = orderList.filter((o) => (o.created_at as string) >= monthAgo);
    const delivered = orderList.filter((o) => o.status === 'delivered');
    const cancelled = orderList.filter((o) => o.status === 'cancelled');
    const active = orderList.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status as string));
    const sum = (arr: Record<string, unknown>[]) => arr.reduce((s, r) => s + Number((r.total_amount as number) || 0), 0);
    const sumComm = (arr: Record<string, unknown>[]) => arr.reduce((s, r) => s + Number((r.commission_amount as number) || 0), 0);
    const avgTicket = delivered.length > 0 ? sum(delivered) / delivered.length : 0;

    const productSales = new Map<string, { total: number; name: string; image_url: string | null }>();
    const items = orderList.flatMap((o) => (o.items as Record<string, unknown>[]) || []);
    for (const item of items) {
      const pid = (item.product_id as string) || (item.productId as string);
      const e = productSales.get(pid) || { total: 0, name: (item.product_name as string) || (item.name as string) || '', image_url: null };
      e.total += Number((item.quantity as number) || 1);
      productSales.set(pid, e);
    }
    const topProducts = Array.from(productSales.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const customerIds = [...new Set(delivered.map((o) => o.customer_id as string))];
    const { data: allProfiles } = await supabase.from('profiles').select('id, created_at').in('id', customerIds);
    const frequentCustomers = customerIds.filter((id: string) => {
      const customerOrders = delivered.filter((o) => o.customer_id === id);
      return customerOrders.length >= 3;
    });

    return {
      todayRevenue: sum(todayOrdersList),
      weekRevenue: sum(weekOrders),
      monthRevenue: sum(monthOrders),
      activeOrders: active.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      avgTicket,
      avgPrepTime: 0,
      topProducts,
      newCustomers: (allProfiles || []).filter((p) => (p.created_at as string) >= monthAgo).length,
      frequentCustomers: frequentCustomers.length,
      rating: biz?.rating || 0,
      totalRatings: biz?.total_ratings || 0,
      commissionPaid: sumComm(commissions || []),
      netProfit: sum(monthOrders) - sumComm(commissions || []),
      totalProducts: (products || []).length,
      totalOrders: orderList.length,
    };
  },

  async getProducts(businessId: string): Promise<BusinessProduct[]> {
    const supabase = await getBrowserClient();
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    return ((data || []) as (BusinessProduct & { categories?: { name: string } | null })[]).map((p) => ({
      ...p,
      category_name: p.categories?.name || 'Sin categoría',
      image_url: p.image_url,
    }));
  },

  async createProduct(businessId: string, product: Partial<BusinessProduct>): Promise<void> {
    const supabase = await getBrowserClient();
    await supabase.from('products').insert({
      business_id: businessId,
      name: product.name,
      slug: (product.name || '').toLowerCase().replace(/\s+/g, '-'),
      description: product.description || null,
      price: product.price || 0,
      category_id: product.category_id || null,
      cost_price: product.cost_price || null,
      discount_price: product.discount_price || null,
      quantity_available: product.quantity_available ?? 0,
      preparation_time_minutes: product.preparation_time_minutes || 0,
      image_url: product.image_url || null,
      status: product.status || 'available',
    });
  },

  async updateProduct(productId: string, updates: Partial<BusinessProduct>): Promise<void> {
    const supabase = await getBrowserClient();
    await supabase.from('products').update(updates).eq('id', productId);
  },

  async deleteProduct(productId: string): Promise<void> {
    const supabase = await getBrowserClient();
    await supabase.from('products').update({ deleted_at: new Date().toISOString(), status: 'discontinued' }).eq('id', productId);
  },

  async duplicateProduct(productId: string): Promise<void> {
    const supabase = await getBrowserClient();
    const { data: orig } = await supabase.from('products').select('*').eq('id', productId).single();
    if (!orig) return;
    const rest = { ...orig };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;
    delete rest.deleted_at;
    delete rest.slug;
    await supabase.from('products').insert({ ...rest, name: `${orig.name} (copia)`, slug: `${orig.slug}-copia-${Date.now()}` });
  },

  async getCustomers(businessId: string): Promise<BusinessCustomer[]> {
    const supabase = await getBrowserClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('customer_id, total_amount, created_at')
      .eq('business_id', businessId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false });
    const orderList = (orders || []) as Record<string, unknown>[];
    const custMap = new Map<string, { order_count: number; total_spent: number; last_order_at: string }>();
    for (const o of orderList) {
      const cid = o.customer_id as string;
      const e = custMap.get(cid) || { order_count: 0, total_spent: 0, last_order_at: '' };
      e.order_count += 1;
      e.total_spent += Number(o.total_amount);
      if (!e.last_order_at || (o.created_at as string) > e.last_order_at) e.last_order_at = o.created_at as string;
      custMap.set(cid, e);
    }
    const ids = [...custMap.keys()];
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email, phone, avatar_url').in('id', ids);
    const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.id as string, p]));
    const { data: ratings } = await supabase.from('ratings').select('rater_id, rating').eq('rated_entity_id', businessId);
    const ratingMap = new Map<string, number[]>();
    for (const r of (ratings || []) as Record<string, unknown>[]) {
      const arr = ratingMap.get(r.rater_id as string) || [];
      arr.push(r.rating as number);
      ratingMap.set(r.rater_id as string, arr);
    }
    return ids.map((id) => {
      const p: Record<string, unknown> = profileMap.get(id) || {};
      const stats = custMap.get(id)!;
      const custRatings = ratingMap.get(id) || [];
      const avgRating = custRatings.length > 0 ? custRatings.reduce((a, b) => a + b, 0) / custRatings.length : null;
      return {
        id,
        first_name: (p.first_name as string | null) || null,
        last_name: (p.last_name as string | null) || null,
        email: (p.email as string) || '',
        phone: (p.phone as string | null) || null,
        avatar_url: (p.avatar_url as string | null) || null,
        order_count: stats.order_count,
        total_spent: stats.total_spent,
        last_order_at: stats.last_order_at || null,
        avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      };
    }).sort((a, b) => b.total_spent - a.total_spent);
  },

  async getBusinessOrders(businessId: string): Promise<BusinessOrder[]> {
    const supabase = await getBrowserClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*), profiles!orders_customer_id_fkey(first_name, last_name), courier:drivers!orders_courier_id_fkey(id)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(100);
    type OrderRow = Record<string, unknown> & {
      profiles?: { first_name: string; last_name: string };
      order_items?: { id: string; product_name: string; quantity: number; unit_price: number }[];
      courier?: { id: string };
    };
    return ((orders || []) as OrderRow[]).map((o) => ({
      id: o.id as string,
      order_number: o.order_number as string,
      customer_id: o.customer_id as string,
      customer_name: o.profiles ? [o.profiles.first_name, o.profiles.last_name].filter(Boolean).join(' ') : 'Cliente',
      status: o.status as string,
      total_amount: o.total_amount as number,
      items: (o.order_items || []).map((i) => ({ id: i.id, name: i.product_name || 'Producto', quantity: i.quantity, unit_price: i.unit_price })),
      created_at: o.created_at as string,
      updated_at: o.updated_at as string,
      delivery_address: (o.delivery_address as string) || '',
      special_instructions: (o.special_instructions as string | null) || null,
      courier_name: o.courier?.id ? 'Asignado' : null,
    }));
  },

  async getCategories(businessId: string): Promise<Record<string, unknown>[]> {
    const supabase = await getBrowserClient();
    const { data } = await supabase.from('categories').select('*').eq('business_id', businessId).order('name');
    return data || [];
  },

  async getReport(businessId: string): Promise<BusinessReport> {
    const supabase = await getBrowserClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, status, created_at, items')
      .eq('business_id', businessId)
      .gte('created_at', thirtyDaysAgo);
    const orderList = (orders || []) as Record<string, unknown>[];
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    const hourCount = new Array(24).fill(0);
    
    const productMap = new Map<string, { name: string; total: number; revenue: number }>();
    for (const o of orderList) {
      const date = (o.created_at as string).slice(0, 10);
      const e = dailyMap.get(date) || { revenue: 0, orders: 0 };
      e.revenue += Number(o.total_amount);
      e.orders += 1;
      dailyMap.set(date, e);
      const h = new Date(o.created_at as string).getHours();
      hourCount[h] += 1;
      for (const item of (o.items as Record<string, unknown>[]) || []) {
        const pid = (item.product_id as string) || (item.productId as string);
        const pe = productMap.get(pid) || { name: (item.product_name as string) || (item.name as string) || '', total: 0, revenue: 0 };
        pe.total += Number((item.quantity as number) || 1);
        pe.revenue += Number((item.unit_price as number) || 0) * Number((item.quantity as number) || 1);
        productMap.set(pid, pe);
      }
    }
    const dailySales = Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
    const topProducts = Array.from(productMap.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 10);
    const peakHours = hourCount.map((count, hour) => ({ hour, orders: count })).filter(h => h.orders > 0).sort((a, b) => b.orders - a.orders);
    return { dailySales, topProducts, peakHours, categoryDist: [], monthlyComparison: [] };
  },
};
