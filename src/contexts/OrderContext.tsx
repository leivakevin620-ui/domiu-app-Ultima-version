'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { orderService, type OrderData, type OrderStatus } from '@/services/orders';

interface OrderContextValue {
  customerOrders: OrderData[];
  businessOrders: OrderData[];
  loading: boolean;
  refreshOrders: () => Promise<void>;
  getOrder: (id: string) => OrderData | undefined;
  createOrder: (input: {
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
  }) => Promise<OrderData>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  acceptOrder: (orderId: string) => Promise<void>;
  rejectOrder: (orderId: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({
  children,
  customerId,
  businessId,
}: {
  children: React.ReactNode;
  customerId?: string;
  businessId?: string;
}) {
  const [customerOrders, setCustomerOrders] = useState<OrderData[]>([]);
  const [businessOrders, setBusinessOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshOrders = useCallback(async () => {
    if (customerId) {
      const orders = await orderService.getCustomerOrders(customerId);
      setCustomerOrders(orders);
    }
    if (businessId) {
      const orders = await orderService.getBusinessOrders(businessId);
      setBusinessOrders(orders);
    }
    setLoading(false);
  }, [customerId, businessId]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    const unsub = orderService.subscribe((updated) => {
      setCustomerOrders((prev) => {
        const exists = prev.findIndex((o) => o.id === updated.id);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = updated;
          return next;
        }
        return [updated, ...prev];
      });
      setBusinessOrders((prev) => {
        const exists = prev.findIndex((o) => o.id === updated.id);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = updated;
          return next;
        }
        return [updated, ...prev];
      });
    });
    return unsub;
  }, []);

  const getOrder = useCallback(
    (id: string) => customerOrders.find((o) => o.id === id) ?? businessOrders.find((o) => o.id === id),
    [customerOrders, businessOrders],
  );

  const createOrderFn = useCallback(
    async (input: {
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
    }) => {
      const order = await orderService.createOrder(input);
      return order;
    },
    [],
  );

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    await orderService.updateStatus(orderId, status);
  }, []);

  const acceptOrder = useCallback(async (orderId: string) => {
    await orderService.acceptOrder(orderId);
  }, []);

  const rejectOrder = useCallback(async (orderId: string) => {
    await orderService.rejectOrder(orderId);
  }, []);

  const value = useMemo(
    () => ({
      customerOrders,
      businessOrders,
      loading,
      refreshOrders,
      getOrder,
      createOrder: createOrderFn,
      updateOrderStatus,
      acceptOrder,
      rejectOrder,
    }),
    [customerOrders, businessOrders, loading, refreshOrders, getOrder, createOrderFn, updateOrderStatus, acceptOrder, rejectOrder],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used within an OrderProvider');
  return ctx;
}
