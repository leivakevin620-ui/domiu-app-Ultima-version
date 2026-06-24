'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { orderService, type OrderData, type OrderStatus } from '@/services/orders';
import { assignmentService, type CourierDriver, type AssignmentRequest } from '@/services/assignment';
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

export function CourierProvider({
  children,
  courierId,
}: {
  children: React.ReactNode;
  courierId?: string;
}) {
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
      const [c, avail, courierOrders, reqs] = await Promise.all([
        assignmentService.getCourierById(courierId),
        orderService.getAvailableOrders(),
        orderService.getCourierOrders(courierId),
        assignmentService.getPendingRequests(courierId),
      ]);

      setCourier(c ?? null);
      setAvailableOrders(avail);
      setActiveDeliveries(courierOrders.filter((o) => !['delivered', 'cancelled'].includes(o.status)));
      setDeliveryHistory(courierOrders.filter((o) => ['delivered', 'cancelled'].includes(o.status)));
      setPendingRequests(reqs);

      const earned: DeliveryEarning[] = courierOrders
        .filter((o) => o.status === 'delivered')
        .map((o) => ({
          id: `earn-${o.id}`,
          order_id: o.id,
          order_number: o.order_number,
          amount: assignmentService.calculateEarnings(3.0, 2.5),
          date: o.updated_at,
          business_name: o.business_name,
        }));
      setEarnings(earned);
    } catch (err) {
      console.error('[CourierContext] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [courierId]);

  useEffect(() => {
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [courierId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    const unsub = orderService.subscribe((order) => {
      setActiveDeliveries((prev) => {
        const exists = prev.findIndex((o) => o.id === order.id);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = order;
          return next;
        }
        if (order.courier_id === courierId && !['delivered', 'cancelled'].includes(order.status)) {
          return [...prev, order];
        }
        return prev;
      });

      setDeliveryHistory((prev) => {
        if (['delivered', 'cancelled'].includes(order.status) && order.courier_id === courierId) {
          const exists = prev.findIndex((o) => o.id === order.id);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = order;
            return next;
          }
          return [...prev, order];
        }
        return prev;
      });

      setAvailableOrders((prev) => {
        if (['confirmed', 'ready'].includes(order.status) && !order.courier_id) {
          const exists = prev.findIndex((o) => o.id === order.id);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = order;
            return next;
          }
          return [order, ...prev];
        }
        if (order.courier_id || ['delivered', 'cancelled'].includes(order.status)) {
          return prev.filter((o) => o.id !== order.id);
        }
        return prev;
      });
    });

    const unsubReq = assignmentService.subscribeRequests((req) => {
      if (req.courier_id === courierId) {
        setPendingRequests((prev) => {
          const exists = prev.findIndex((r) => r.id === req.id);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = req;
            return next;
          }
          return [...prev, req];
        });
      }
    });

    // Supabase realtime subscription — picks up any INSERT/UPDATE/DELETE on orders
    const supabase = getBrowserClient();
    const channel = supabase
      .channel('courier-orders-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => { refresh(); }
      )
      .subscribe();

    return () => {
      unsub();
      unsubReq();
      supabase.removeChannel(channel);
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
  }, [courierId, courier, refresh]);

  const updateDeliveryStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    await orderService.updateStatus(orderId, status);
    await refresh();
  }, [refresh]);

  const todayEarnings = useMemo(
    () =>
      earnings
        .filter((e) => new Date(e.date).toDateString() === new Date().toDateString())
        .reduce((sum, e) => sum + e.amount, 0),
    [earnings],
  );

  const weekEarnings = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return earnings
      .filter((e) => new Date(e.date) >= weekStart)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [earnings]);

  const monthEarnings = useMemo(() => {
    const now = new Date();
    return earnings
      .filter((e) => new Date(e.date).getMonth() === now.getMonth() && new Date(e.date).getFullYear() === now.getFullYear())
      .reduce((sum, e) => sum + e.amount, 0);
  }, [earnings]);

  const totalEarnings = useMemo(() => earnings.reduce((sum, e) => sum + e.amount, 0), [earnings]);

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  return <CourierContext.Provider value={value}>{children}</CourierContext.Provider>;
}

export function useCourier(): CourierContextValue {
  const ctx = useContext(CourierContext);
  if (!ctx) throw new Error('useCourier must be used within a CourierProvider');
  return ctx;
}
