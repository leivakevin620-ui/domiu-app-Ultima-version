import { getBrowserClient } from '@/lib/db/supabase';
import type { OrderStatus, UserRole } from '@/types/database';

export interface DashboardStats {
  todayOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  activeBusinesses: number;
  onlineCouriers: number;
  totalCustomers: number;
  todayRevenue: number;
  monthRevenue: number;
}

export interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: UserRole;
  status: string;
  phone: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string;
  cuisine_type: string | null;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  rating: number;
  total_ratings: number;
  created_at: string;
}

export interface AdminCourier {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  status: string;
  is_verified: boolean;
  total_deliveries: number;
  rating: number;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  business_name: string;
  status: OrderStatus;
  payment_status: string;
  total_amount: number;
  courier_name: string | null;
  created_at: string;
}

export interface SalesReport {
  date: string;
  orders: number;
  revenue: number;
}

export interface TopBusiness {
  id: string;
  name: string;
  order_count: number;
  total_revenue: number;
  avg_rating: number;
}

export interface TopCourier {
  id: string;
  name: string;
  deliveries: number;
  rating: number;
  earnings: number;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

async function getClient() {
  return getBrowserClient();
}

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const supabase = await getClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [ordersRes, activeRes, completedRes, cancelledRes,
      bizRes, courierRes, customerRes, todayRevRes, monthRevRes] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStr),
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'preparing', 'ready', 'in_transit']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('created_at', todayStr),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').gte('created_at', todayStr),
      supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('orders').select('total_amount').gte('created_at', todayStr).eq('status', 'delivered'),
      supabase.from('orders').select('total_amount').gte('created_at', monthStart).eq('status', 'delivered'),
    ]);

    const todayRev = ((todayRevRes.data || []) as any[]).reduce((s: number, r: any) => s + Number(r.total_amount), 0);
    const monthRev = ((monthRevRes.data || []) as any[]).reduce((s: number, r: any) => s + Number(r.total_amount), 0);

    return {
      todayOrders: ordersRes.count || 0,
      activeOrders: activeRes.count || 0,
      completedOrders: completedRes.count || 0,
      cancelledOrders: cancelledRes.count || 0,
      activeBusinesses: bizRes.count || 0,
      onlineCouriers: courierRes.count || 0,
      totalCustomers: customerRes.count || 0,
      todayRevenue: todayRev,
      monthRevenue: monthRev,
    };
  },

  async getUsers(search?: string, roleFilter?: string): Promise<AdminUser[]> {
    const supabase = await getClient();
    let query = supabase.from('profiles').select('id, first_name, last_name, email, role, status, phone, created_at, last_login_at').order('created_at', { ascending: false });

    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data } = await query;
    return (data || []) as AdminUser[];
  },

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    const supabase = await getClient();
    await supabase.from('profiles').update({ role }).eq('id', userId);
  },

  async updateUserStatus(userId: string, status: string): Promise<void> {
    const supabase = await getClient();
    const payload = status === 'active' ? { status, deleted_at: null } : { status, deleted_at: new Date().toISOString() };
    await supabase.from('profiles').update(payload).eq('id', userId);
  },

  async getBusinesses(search?: string, filter?: string): Promise<AdminBusiness[]> {
    const supabase = await getClient();
    const { data } = await supabase
      .from('businesses')
      .select('id, name, slug, owner_id, cuisine_type, phone, is_verified, is_active, rating, total_ratings, created_at');
    const list = (data || []) as any[];

    const ownerIds = [...new Set(list.map(b => b.owner_id))];
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', ownerIds);
    const ownerMap = new Map<string, any>((owners || []).map((o: any) => [o.id, o]));

    let result: AdminBusiness[] = list.map(b => {
      const owner = ownerMap.get(b.owner_id);
      return {
        id: b.id, name: b.name, slug: b.slug,
        owner_name: owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') : null,
        owner_email: owner?.email || '',
        cuisine_type: b.cuisine_type, phone: b.phone,
        is_verified: b.is_verified, is_active: b.is_active,
        rating: Number(b.rating) || 0, total_ratings: b.total_ratings || 0,
        created_at: b.created_at,
      };
    });

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(b => b.name.toLowerCase().includes(s) || (b.owner_name || '').toLowerCase().includes(s));
    }
    if (filter && filter !== 'all') {
      if (filter === 'pending') result = result.filter(b => !b.is_verified && b.is_active);
      else if (filter === 'verified') result = result.filter(b => b.is_verified);
      else if (filter === 'suspended') result = result.filter(b => !b.is_active);
    }

    return result;
  },

  async updateBusinessStatus(businessId: string, isActive: boolean): Promise<void> {
    const supabase = await getClient();
    await supabase.from('businesses').update({ is_active: isActive }).eq('id', businessId);
  },

  async verifyBusiness(businessId: string): Promise<void> {
    const supabase = await getClient();
    await supabase.from('businesses').update({ is_verified: true }).eq('id', businessId);
  },

  async getCouriers(search?: string, filter?: string): Promise<AdminCourier[]> {
    const supabase = await getClient();
    const { data } = await supabase
      .from('drivers')
      .select('id, vehicle_type, vehicle_plate, status, is_verified, total_deliveries, rating, is_active, created_at');
    const list = (data || []) as any[];

    const driverIds = list.map(d => d.id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', driverIds);
    const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

    let result: AdminCourier[] = list.map(d => {
      const p = profileMap.get(d.id);
      return {
        id: d.id,
        first_name: p?.first_name, last_name: p?.last_name, email: p?.email || '',
        vehicle_type: d.vehicle_type, vehicle_plate: d.vehicle_plate,
        status: d.status, is_verified: d.is_verified,
        total_deliveries: d.total_deliveries || 0, rating: Number(d.rating) || 0,
        created_at: d.created_at,
      };
    });

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        (c.first_name || '').toLowerCase().includes(s) ||
        (c.last_name || '').toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s)
      );
    }
    if (filter && filter !== 'all') {
      if (filter === 'verified') result = result.filter(c => c.is_verified);
      else if (filter === 'pending') result = result.filter(c => !c.is_verified && c.status !== 'offline');
      else if (filter === 'offline') result = result.filter(c => c.status === 'offline');
    }

    return result;
  },

  async updateCourierStatus(driverId: string, isActive: boolean): Promise<void> {
    const supabase = await getClient();
    await supabase.from('drivers').update({
      is_active: isActive,
      status: isActive ? 'available' : 'offline',
    }).eq('id', driverId);
  },

  async verifyCourier(driverId: string): Promise<void> {
    const supabase = await getClient();
    await supabase.from('drivers').update({ is_verified: true }).eq('id', driverId);
  },

  async getOrders(search?: string, statusFilter?: string): Promise<AdminOrder[]> {
    const supabase = await getClient();
    let query = supabase
      .from('orders')
      .select('id, order_number, customer_id, business_id, status, payment_status, total_amount, courier_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    const orders = (data || []) as any[];

    const customerIds = [...new Set(orders.map(o => o.customer_id))];
    const businessIds = [...new Set(orders.map(o => o.business_id))];
    const courierIds = [...new Set(orders.map(o => o.courier_id).filter(Boolean))];

    const [custRes, bizRes, courRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name').in('id', customerIds),
      supabase.from('businesses').select('id, name').in('id', businessIds),
      courierIds.length > 0
        ? supabase.from('profiles').select('id, first_name, last_name').in('id', courierIds)
        : { data: [] },
    ]);

    const custMap = new Map<string, string>((custRes.data || []).map((c: any) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')]));
    const bizMap = new Map<string, string>((bizRes.data || []).map((b: any) => [b.id, b.name]));
    const courMap = new Map<string, string>((courRes.data || []).map((c: any) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')]));

    let result: AdminOrder[] = orders.map(o => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: custMap.get(o.customer_id) ?? null,
      business_name: bizMap.get(o.business_id) ?? 'Unknown',
      status: o.status as OrderStatus,
      payment_status: o.payment_status,
      total_amount: Number(o.total_amount),
      courier_name: o.courier_id ? courMap.get(o.courier_id) ?? null : null,
      created_at: o.created_at,
    }));

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(s) ||
        (o.customer_name || '').toLowerCase().includes(s) ||
        o.business_name.toLowerCase().includes(s)
      );
    }

    return result;
  },

  async updateOrderStatusAdmin(orderId: string, status: OrderStatus): Promise<void> {
    const supabase = await getClient();
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: status,
    });
    if (error) {
      await supabase.from('orders').update({ status }).eq('id', orderId);
      await supabase.from('order_tracking').insert({ order_id: orderId, status, notes: 'Actualizado por administrador' });
    }
  },

  async getSalesReport(days = 30): Promise<SalesReport[]> {
    const supabase = await getClient();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const { data } = await supabase
      .from('orders')
      .select('total_amount, created_at')
      .eq('status', 'delivered')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true });

    const dailyMap = new Map<string, { orders: number; revenue: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), { orders: 0, revenue: 0 });
    }

    for (const row of (data || []) as any[]) {
      const date = row.created_at.slice(0, 10);
      const entry = dailyMap.get(date);
      if (entry) {
        entry.orders += 1;
        entry.revenue += Number(row.total_amount);
      }
    }

    return Array.from(dailyMap.entries()).map(([date, val]) => ({
      date,
      orders: val.orders,
      revenue: val.revenue,
    }));
  },

  async getTopBusinesses(limit = 5): Promise<TopBusiness[]> {
    const supabase = await getClient();
    const { data } = await supabase
      .from('orders')
      .select('business_id, total_amount')
      .eq('status', 'delivered');
    const orders = (data || []) as any[];

    const bizMap = new Map<string, { order_count: number; total_revenue: number }>();
    for (const o of orders) {
      const entry = bizMap.get(o.business_id) || { order_count: 0, total_revenue: 0 };
      entry.order_count += 1;
      entry.total_revenue += Number(o.total_amount);
      bizMap.set(o.business_id, entry);
    }

    const bizIds = [...bizMap.keys()];
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name, rating')
      .in('id', bizIds);

    const bizInfoMap = new Map<string, any>((businesses || []).map((b: any) => [b.id, b]));

    return Array.from(bizMap.entries())
      .map(([id, stats]) => {
        const biz = bizInfoMap.get(id);
        return { id, name: biz?.name || 'Unknown', ...stats, avg_rating: Number(biz?.rating) || 0 };
      })
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);
  },

  async getTopCouriers(limit = 5): Promise<TopCourier[]> {
    const supabase = await getClient();
    const { data } = await supabase
      .from('drivers')
      .select('id, rating, total_deliveries, completed_deliveries')
      .order('completed_deliveries', { ascending: false })
      .limit(limit);
    const drivers = (data || []) as any[];

    const driverIds = drivers.map(d => d.id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', driverIds);
    const nameMap = new Map<string, string>((profiles || []).map((p: any) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown']));

    const { data: earnings } = await supabase
      .from('driver_earnings')
      .select('driver_id, total_earned')
      .in('driver_id', driverIds);
    const earnMap = new Map<string, number>();
    for (const e of (earnings || []) as any[]) {
      earnMap.set(e.driver_id, (earnMap.get(e.driver_id) || 0) + Number(e.total_earned));
    }

    return drivers.map(d => ({
      id: d.id,
      name: nameMap.get(d.id) || 'Unknown',
      deliveries: d.completed_deliveries || 0,
      rating: Number(d.rating) || 0,
      earnings: earnMap.get(d.id) || 0,
    }));
  },

  async getStatusDistribution(): Promise<{ status: string; count: number }[]> {
    const supabase = await getClient();
    const { data } = await supabase.from('orders').select('status');
    const countMap = new Map<string, number>();
    for (const row of (data || []) as any[]) {
      countMap.set(row.status, (countMap.get(row.status) || 0) + 1);
    }
    return Array.from(countMap.entries()).map(([status, count]) => ({ status, count }));
  },

  async getUserRegistrationStats(): Promise<{ date: string; count: number }[]> {
    const supabase = await getClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const dailyMap = new Map<string, number>();
    for (const row of (data || []) as any[]) {
      const date = row.created_at.slice(0, 10);
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    }
    return Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));
  },

  async getRecentActivity(limit = 10): Promise<AuditLog[]> {
    const supabase = await getClient();
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as AuditLog[];
  },

  async logAudit(adminId: string, adminName: string | null, action: string, entityType: string, entityId: string | null, details: string | null): Promise<void> {
    const supabase = await getClient();
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId, admin_name: adminName, action,
      entity_type: entityType, entity_id: entityId, details,
    });
  },

};
