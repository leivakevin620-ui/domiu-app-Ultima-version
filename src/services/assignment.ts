import { getBrowserClient } from '@/lib/db/supabase';
import type { Driver, DriverStatus } from '@/types/database';
import { orderService, type OrderData } from './orders';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CourierDriver {
  id: string;
  name: string;
  phone: string;
  vehicle_type: 'motorcycle' | 'bicycle' | 'car';
  status: DriverStatus;
  is_available: boolean;
  is_active: boolean;
  rating: number;
  total_deliveries: number;
  current_lat?: number;
  current_lng?: number;
}

export interface AssignmentRequest {
  id: string;
  order_id: string;
  courier_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at: string | null;
}

const VEHICLE_TYPE_MAP: Record<string, CourierDriver['vehicle_type']> = {
  motorcycle: 'motorcycle',
  bike: 'bicycle',
  car: 'car',
  van: 'car',
};

const assignmentRequests: AssignmentRequest[] = [];
let requestIdCounter = 0;

type RequestListener = (request: AssignmentRequest) => void;
const requestListeners: Set<RequestListener> = new Set();

function now(): string {
  return new Date().toISOString();
}

async function getClient() {
  return getBrowserClient();
}

function mapDriverToCourier(driver: Driver, firstName?: string | null, lastName?: string | null): CourierDriver {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Repartidor';
  return {
    id: driver.id,
    name,
    phone: '',
    vehicle_type: VEHICLE_TYPE_MAP[driver.vehicle_type] ?? 'motorcycle',
    status: driver.status,
    is_available: driver.status === 'available',
    is_active: driver.is_active,
    rating: driver.avg_rating,
    total_deliveries: driver.total_deliveries,
  };
}

export const assignmentService = {
  getCouriers: async (): Promise<CourierDriver[]> => {
    const supabase = await getClient();
    const { data: drivers } = await supabase
      .from('drivers')
      .select('*')
      .order('total_deliveries', { ascending: false });
    if (!drivers || (drivers as any[]).length === 0) return [];

    const driversArr = drivers as any[];
    const ids = driversArr.map((d: any) => d.id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', ids);

    const profileMap = new Map((profiles as any[])?.map((p: any) => [p.id, p]) ?? []);
    return driversArr.map((d: any) => {
      const profile = profileMap.get(d.id) as any;
      return mapDriverToCourier(d, profile?.first_name, profile?.last_name);
    });
  },

  getAvailableCouriers: async (): Promise<CourierDriver[]> => {
    const couriers = await assignmentService.getCouriers();
    return couriers.filter((c) => c.is_active && c.is_available);
  },

  getCourierById: async (id: string): Promise<CourierDriver | undefined> => {
    const supabase = await getClient();
    const { data: driver } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (!driver) return undefined;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', id)
      .single();

    return mapDriverToCourier(driver, profile?.first_name, profile?.last_name);
  },

  toggleAvailability: async (courierId: string): Promise<CourierDriver | undefined> => {
    const supabase = await getClient();
    const { data: driver } = await supabase.from('drivers').select('*').eq('id', courierId).single();
    if (!driver) return undefined;

    const newStatus = driver.is_active ? 'offline' as const : 'available' as const;

    const { data: updated } = await supabase
      .from('drivers')
      .update({ is_active: !driver.is_active, status: newStatus })
      .eq('id', courierId)
      .select()
      .single();

    if (!updated) return undefined;
    return mapDriverToCourier(updated);
  },

  setCourierStatus: async (courierId: string, status: DriverStatus): Promise<CourierDriver | undefined> => {
    const supabase = await getClient();
    const isActive = status !== 'offline';
    const { data: updated } = await supabase
      .from('drivers')
      .update({ status, is_active: isActive })
      .eq('id', courierId)
      .select()
      .single();
    if (!updated) return undefined;
    return mapDriverToCourier(updated);
  },

  setAvailability: async (courierId: string, available: boolean): Promise<CourierDriver | undefined> => {
    const supabase = await getClient();
    const status = available ? 'available' as const : 'offline' as const;
    const { data: updated } = await supabase
      .from('drivers')
      .update({ is_active: available, status })
      .eq('id', courierId)
      .select()
      .single();

    if (!updated) return undefined;
    return mapDriverToCourier(updated);
  },

  assignOrder: async (orderId: string): Promise<{ order: OrderData | null; courier: CourierDriver | null }> => {
    const order = await orderService.getOrderById(orderId);
    if (!order) return { order: null, courier: null };
    if (order.courier_id) {
      const courier = await assignmentService.getCourierById(order.courier_id);
      return { order, courier: courier ?? null };
    }

    const available = await assignmentService.getAvailableCouriers();

    if (available.length === 0) return { order, courier: null };

    // Pick the first courier without an active non-delivered order
    let assigned: CourierDriver | null = null;
    for (const c of available) {
      const activeOrders = await orderService.getCourierOrders(c.id);
      const hasActive = activeOrders.some(
        (o) => !['delivered', 'cancelled'].includes(o.status) && o.id !== orderId,
      );
      if (!hasActive) {
        assigned = c;
        break;
      }
    }

    if (!assigned) return { order, courier: null };

    const updated = await orderService.assignCourier(orderId, assigned.id, assigned.name);
    return { order: updated, courier: assigned };
  },

  sendRequest: async (orderId: string, courierId: string): Promise<AssignmentRequest> => {
    requestIdCounter++;
    const request: AssignmentRequest = {
      id: `req-${requestIdCounter}`,
      order_id: orderId,
      courier_id: courierId,
      status: 'pending',
      created_at: now(),
      responded_at: null,
    };
    assignmentRequests.push(request);
    requestListeners.forEach((fn) => fn(request));
    return request;
  },

  respondToRequest: async (requestId: string, accept: boolean): Promise<AssignmentRequest | null> => {
    const idx = assignmentRequests.findIndex((r) => r.id === requestId);
    if (idx === -1) return null;
    const request = assignmentRequests[idx];
    const updated: AssignmentRequest = {
      ...request,
      status: accept ? 'accepted' : 'rejected',
      responded_at: now(),
    };
    assignmentRequests[idx] = updated;
    requestListeners.forEach((fn) => fn(updated));

    if (accept) {
      const req = assignmentRequests.find((r) => r.id === requestId);
      if (req) {
        const order = await orderService.getOrderById(req.order_id);
        if (order && !order.courier_id) {
          const courier = await assignmentService.getCourierById(req.courier_id);
          if (courier) {
            await orderService.assignCourier(req.order_id, courier.id, courier.name);
          }
        }
      }
    }

    return updated;
  },

  getPendingRequests: async (courierId: string): Promise<AssignmentRequest[]> => {
    return assignmentRequests.filter((r) => r.courier_id === courierId && r.status === 'pending');
  },

  subscribeRequests: (listener: RequestListener): (() => void) => {
    requestListeners.add(listener);
    return () => requestListeners.delete(listener);
  },

  calculateEarnings: (baseAmount: number, distanceKm: number): number => {
    return baseAmount + distanceKm * 0.5;
  },
};
