'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { orderService, type OrderData, type OrderStatus } from '@/services/orders';
import { assignmentService, type AssignmentRequest, type CourierDriver } from '@/services/assignment';
import type { DriverStatus } from '@/types/database';
import { getBrowserClient } from '@/lib/db/supabase';

export interface DeliveryEarning {
  id: string;
  order_id: string;
  order_number: string;
  amount: number;
  date: string;
  business_name: string;
}

interface CourierContextValue {
  courier: CourierDriver | null;
  availableOrders: OrderData[];
  activeDeliveries: OrderData[];
  deliveryHistory: OrderData[];
  earnings: DeliveryEarning[];
  loading: boolean;
  isAvailable: boolean;
  courierStatus: DriverStatus | null;
  pendingRequests: AssignmentRequest[];
  toggleAvailability: () => Promise<void>;
  setCourierStatus: (status: DriverStatus) => Promise<void>;
  acceptDelivery: (orderId: string) => Promise<void>;
  updateDeliveryStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  refresh: () => Promise<void>;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  totalEarnings: number;
}

const CourierContext = createContext<CourierContextValue | null>(null);

export function CourierProvider({ children, courierId }: { children: React.ReactNode; courierId?: string }) {
  const [courier, setCourier] = useState<CourierDriver | null>(null);
  const [availableOrders, setAvailableOrders] = useState<OrderData[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<OrderData[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<OrderData[]>([]);
  const [earnings, setEarnings] = useState<DeliveryEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<AssignmentRequest[]>([]);

  const refresh = useCallback(async () => {
    if (!courierId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = getBrowserClient();
      const [driver, available, courierOrders, requests, earningsResult] = await Promise.all([
        assignmentService.getCourierById(courierId),
        orderService.getAvailableOrders(),
        orderService.getCourierOrders(courierId),
        assignmentService.getPendingRequests(courierId),
        supabase
          .from('orders')
          .select('id,order_number,courier_earnings,actual_delivery_time,updated_at,businesses(name)')
          .eq('courier_id', courierId)
          .eq('status', 'delivered')
          .is('deleted_at', null)
          .order('actual_delivery_time', { ascending: false }),
      ]);

      if (earningsResult.error) throw new Error(earningsResult.error.message);
      setCourier(driver ?? null);
      setAvailableOrders(available);
      setActiveDeliveries(courierOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)));
      setDeliveryHistory(courierOrders.filter((order) => ['delivered', 'cancelled'].includes(order.status)));
      setPendingRequests(requests);
      setEarnings((earningsResult.data ?? []).map((row: any) => ({
        id: `earn-${row.id}`,
        order_id: row.id,
        order_number: row.order_number,
        amount: Number(row.courier_earnings ?? 0),
        date: row.actual_delivery_time || row.updated_at,
        business_name: row.businesses?.name || 'Comercio',
      })));
    } catch (cause) {
      console.error('[CourierContext] refresh error:', cause);
    } finally {
      setLoading(false);
    }
  }, [courierId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribeOrders = orderService.subscribe((order) => {
      setActiveDeliveries((previous) => {
        const withoutOrder = previous.filter((item) => item.id !== order.id);
        if (order.courier_id === courierId && !['delivered', 'cancelled'].includes(order.status)) return [order, ...withoutOrder];
        return withoutOrder;
      });
      setDeliveryHistory((previous) => {
        const withoutOrder = previous.filter((item) => item.id !== order.id);
        if (order.courier_id === courierId && ['delivered', 'cancelled'].includes(order.status)) return [order, ...withoutOrder];
        return withoutOrder;
      });
      setAvailableOrders((previous) => {
        const withoutOrder = previous.filter((item) => item.id !== order.id);
        const available = (
          (['confirmed', 'ready'].includes(order.status) && !order.courier_id)
          || (order.status === 'pending' && order.order_type === 'manual_delivery' && !order.courier_id)
        );
        return available ? [order, ...withoutOrder] : withoutOrder;
      });
      if (order.courier_id === courierId && ['delivered', 'cancelled'].includes(order.status)) void refresh();
    });

    const unsubscribeRequests = assignmentService.subscribeRequests((request) => {
      if (request.courier_id !== courierId) return;
      setPendingRequests((previous) => {
        const withoutRequest = previous.filter((item) => item.id !== request.id);
        return [request, ...withoutRequest];
      });
    });

    let channel: ReturnType<ReturnType<typeof getBrowserClient>['channel']> | null = null;
    if (courierId) {
      const supabase = getBrowserClient();
      channel = supabase
        .channel(`courier-orders-realtime-${courierId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `courier_id=eq.${courierId}` }, () => void refresh())
        .subscribe();
    }

    return () => {
      unsubscribeOrders();
      unsubscribeRequests();
      if (channel) void getBrowserClient().removeChannel(channel);
    };
  }, [courierId, refresh]);

  const toggleAvailability = useCallback(async () => {
    if (!courierId) return;
    const updated = await assignmentService.toggleAvailability(courierId);
    if (updated) setCourier(updated);
  }, [courierId]);

  const setCourierStatus = useCallback(async (status: DriverStatus) => {
    if (!courierId) return;
    const updated = await assignmentService.setCourierStatus(courierId, status);
    if (updated) setCourier(updated);
  }, [courierId]);

  const acceptDelivery = useCallback(async (orderId: string) => {
    if (!courierId || !courier) return;
    await orderService.assignCourier(orderId, courierId, courier.name);
    await orderService.updateStatus(orderId, 'assigned');
    await refresh();
  }, [courier, courierId, refresh]);

  const updateDeliveryStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    await orderService.updateStatus(orderId, status);
    await refresh();
  }, [refresh]);

  const todayEarnings = useMemo(() => earnings
    .filter((earning) => new Date(earning.date).toDateString() === new Date().toDateString())
    .reduce((total, earning) => total + earning.amount, 0), [earnings]);

  const weekEarnings = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return earnings.filter((earning) => new Date(earning.date) >= start).reduce((total, earning) => total + earning.amount, 0);
  }, [earnings]);

  const monthEarnings = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return earnings.filter((earning) => new Date(earning.date) >= start).reduce((total, earning) => total + earning.amount, 0);
  }, [earnings]);

  const totalEarnings = useMemo(() => earnings.reduce((total, earning) => total + earning.amount, 0), [earnings]);

  const value = useMemo<CourierContextValue>(() => ({
    courier,
    availableOrders,
    activeDeliveries,
    deliveryHistory,
    earnings,
    loading,
    isAvailable: courier?.is_available ?? false,
    courierStatus: courier?.status ?? null,
    pendingRequests,
    toggleAvailability,
    setCourierStatus,
    acceptDelivery,
    updateDeliveryStatus,
    refresh,
    todayEarnings,
    weekEarnings,
    monthEarnings,
    totalEarnings,
  }), [
    courier,
    availableOrders,
    activeDeliveries,
    deliveryHistory,
    earnings,
    loading,
    pendingRequests,
    toggleAvailability,
    setCourierStatus,
    acceptDelivery,
    updateDeliveryStatus,
    refresh,
    todayEarnings,
    weekEarnings,
    monthEarnings,
    totalEarnings,
  ]);

  return <CourierContext.Provider value={value}>{children}</CourierContext.Provider>;
}

export function useCourier(): CourierContextValue {
  const context = useContext(CourierContext);
  if (!context) throw new Error('useCourier must be used within a CourierProvider');
  return context;
}
