import { getBrowserClient } from '@/lib/db/supabase';

export type CourierStatus = 'available' | 'busy' | 'offline';

export interface CourierProLevel {
  level: number;
  title: string;
  minDeliveries: number;
  color: string;
  icon: string;
  bonusMultiplier: number;
}

export const COURIER_LEVELS: CourierProLevel[] = [
  { level: 1, title: 'Novato', minDeliveries: 0, color: 'from-slate-400 to-slate-500', icon: '🌱', bonusMultiplier: 1.0 },
  { level: 2, title: 'Bronce', minDeliveries: 10, color: 'from-amber-600 to-amber-700', icon: '🥉', bonusMultiplier: 1.05 },
  { level: 3, title: 'Plata', minDeliveries: 50, color: 'from-slate-300 to-slate-400', icon: '🥈', bonusMultiplier: 1.1 },
  { level: 4, title: 'Oro', minDeliveries: 150, color: 'from-yellow-400 to-yellow-500', icon: '🥇', bonusMultiplier: 1.15 },
  { level: 5, title: 'Platino', minDeliveries: 350, color: 'from-emerald-400 to-emerald-500', icon: '💎', bonusMultiplier: 1.2 },
  { level: 6, title: 'Diamante', minDeliveries: 600, color: 'from-cyan-400 to-blue-500', icon: '🔷', bonusMultiplier: 1.3 },
  { level: 7, title: 'Élite', minDeliveries: 1000, color: 'from-purple-400 to-purple-600', icon: '👑', bonusMultiplier: 1.5 },
];

export function getCourierLevel(deliveries: number): CourierProLevel {
  let best = COURIER_LEVELS[0];
  for (const l of COURIER_LEVELS) {
    if (deliveries >= l.minDeliveries) best = l;
  }
  return best;
}

export function getNextLevel(deliveries: number): CourierProLevel | null {
  for (const l of COURIER_LEVELS) {
    if (deliveries < l.minDeliveries) return l;
  }
  return null;
}

export interface EarningsBreakdown {
  base: number;
  tips: number;
  bonuses: number;
  total: number;
}

export interface CourierEarningsPeriod {
  today: EarningsBreakdown;
  week: EarningsBreakdown;
  month: EarningsBreakdown;
  year: EarningsBreakdown;
  allTime: EarningsBreakdown;
}

export interface DailyEarningPoint {
  date: string;
  base: number;
  tips: number;
  bonuses: number;
  total: number;
}

export interface AIReadinessData {
  demandPrediction: {
    nextHourOrders: number;
    confidence: number;
    peakTimeToday: string;
    recommendedZone: string;
  };
  hotZones: { name: string; ordersPerHour: number; distanceKm: number }[];
  optimalRoute: {
    estimatedSavings: number;
    recommendedStops: string[];
  };
  estimatedEarnings: {
    todayProjection: number;
    weekProjection: number;
    monthlyProjection: number;
  };
}

export interface ActiveOrderDetail {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerPhoto: string | null;
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  businessPhoto: string | null;
  deliveryAddress: string;
  specialInstructions: string | null;
  distance: number;
  estimatedTime: number;
  commission: number;
  paymentMethod: string;
  totalAmount: number;
  tip: number;
  items: { name: string; quantity: number; price: number }[];
  status: string;
  businessLat: number;
  businessLng: number;
  customerLat: number;
  customerLng: number;
}

async function getClient() {
  return getBrowserClient();
}

export const courierProService = {
  async getEarningsHistory(courierId: string, days = 90): Promise<DailyEarningPoint[]> {
    const supabase = await getClient();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const { data: earnings } = await supabase
      .from('driver_earnings')
      .select('*')
      .eq('driver_id', courierId)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true });
    const list = (earnings || []) as Record<string, unknown>[];
    const dailyMap = new Map<string, DailyEarningPoint>();
    for (const e of list) {
      const date = (e.created_at as string).slice(0, 10);
      const existing = dailyMap.get(date) || { date, base: 0, tips: 0, bonuses: 0, total: 0 };
      existing.base += Number((e.base_amount as number) || 0);
      existing.tips += Number((e.tip_amount as number) || 0);
      existing.bonuses += Number((e.bonus_amount as number) || 0);
      existing.total += Number((e.total_earned as number) || 0);
      dailyMap.set(date, existing);
    }
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getEarningsBreakdown(courierId: string): Promise<CourierEarningsPeriod> {
    const supabase = await getClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - now.getDay() * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

    const { data: all } = await supabase
      .from('driver_earnings')
      .select('*')
      .eq('driver_id', courierId)
      .order('created_at', { ascending: false });

    const list = (all || []) as Record<string, unknown>[];
    const sum = (arr: Record<string, unknown>[]) => ({
      base: arr.reduce((s, e) => s + Number((e.base_amount as number) || 0), 0),
      tips: arr.reduce((s, e) => s + Number((e.tip_amount as number) || 0), 0),
      bonuses: arr.reduce((s, e) => s + Number((e.bonus_amount as number) || 0), 0),
      total: arr.reduce((s, e) => s + Number((e.total_earned as number) || 0), 0),
    });

    return {
      today: sum(list.filter((e) => (e.created_at as string) >= todayStart)),
      week: sum(list.filter((e) => (e.created_at as string) >= weekStart)),
      month: sum(list.filter((e) => (e.created_at as string) >= monthStart)),
      year: sum(list.filter((e) => (e.created_at as string) >= yearStart)),
      allTime: sum(list),
    };
  },

  async getHoursConnected(): Promise<{ today: number; week: number; month: number }> {
    return { today: 0, week: 0, month: 0 };
  },

  async getActiveOrderDetail(courierId: string): Promise<ActiveOrderDetail | null> {
    const supabase = await getClient();
    const { data: order } = await supabase
      .from('orders')
      .select('*, businesses(name, phone, address, logo_url), profiles!orders_customer_id_fkey(first_name, last_name, phone, avatar_url)')
      .eq('courier_id', courierId)
      .not('status', 'in', '("delivered","cancelled")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return null;
    type OrderRow = Record<string, unknown> & {
      profiles?: { first_name: string; last_name: string; phone: string; avatar_url: string | null };
      businesses?: { name: string; phone: string; address: string; logo_url: string | null; latitude: number; longitude: number };
    };
    const o = order as OrderRow;
    const cust = o.profiles ?? { first_name: '', last_name: '', phone: '', avatar_url: null };
    const biz = o.businesses ?? { name: '', phone: '', address: '', logo_url: null, latitude: 0, longitude: 0 };
    return {
      id: o.id as string,
      orderNumber: o.order_number as string,
      customerName: [cust.first_name, cust.last_name].filter(Boolean).join(' ') || 'Cliente',
      customerPhone: cust.phone || '',
      customerPhoto: cust.avatar_url || null,
      businessName: biz.name || 'Negocio',
      businessPhone: biz.phone || '',
      businessAddress: biz.address || '',
      businessPhoto: biz.logo_url || null,
      deliveryAddress: (o.delivery_address as string) || '',
      specialInstructions: (o.special_instructions as string | null) || null,
      distance: 0,
      estimatedTime: 0,
      commission: 0,
      paymentMethod: (o.payment_method as string) || 'Efectivo',
      totalAmount: (o.total_amount as number) || 0,
      tip: 0,
      items: [],
      status: o.status as string,
      businessLat: biz.latitude || 19.4326,
      businessLng: biz.longitude || -99.1332,
      customerLat: 19.42,
      customerLng: -99.14,
    };
  },

  getAIReadiness(): AIReadinessData {
    return {
      demandPrediction: {
        nextHourOrders: 3,
        confidence: 0.78,
        peakTimeToday: '13:00 - 15:00',
        recommendedZone: 'Zona Centro',
      },
      hotZones: [
        { name: 'Zona Centro', ordersPerHour: 12, distanceKm: 0.5 },
        { name: 'Polanco', ordersPerHour: 8, distanceKm: 2.3 },
        { name: 'Condesa', ordersPerHour: 7, distanceKm: 3.1 },
      ],
      optimalRoute: {
        estimatedSavings: 15,
        recommendedStops: ['Zona Centro', 'Roma Norte'],
      },
      estimatedEarnings: {
        todayProjection: 85000,
        weekProjection: 580000,
        monthlyProjection: 2500000,
      },
    };
  },

  async updateVehicle(courierId: string, vehicle: { type: string; plate: string; model: string }): Promise<void> {
    const supabase = await getClient();
    await supabase.from('drivers').update({
      vehicle_type: vehicle.type,
      vehicle_plate: vehicle.plate,
      vehicle_model: vehicle.model,
    }).eq('id', courierId);
  },

  async updateDocuments(courierId: string, docs: { licenseNumber?: string; licenseExpiry?: string }): Promise<void> {
    const supabase = await getClient();
    await supabase.from('drivers').update({
      license_number: docs.licenseNumber,
      license_expiry: docs.licenseExpiry,
    }).eq('id', courierId);
  },

  async updateCourierStatus(courierId: string, status: CourierStatus): Promise<void> {
    const supabase = await getClient();
    const isActive = status !== 'offline';
    const isAvailable = status === 'available';
    await supabase.from('drivers').update({
      status,
      is_active: isActive,
      is_available: isAvailable,
    }).eq('id', courierId);
  },
};
