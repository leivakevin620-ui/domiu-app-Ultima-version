'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  orderService,
  type CreateOrderItemInput,
  type OrderData,
  type OrderStatus,
} from '@/services/orders';

interface CreateOrderInput {
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
}

interface OrderContextValue {
  customerOrders: OrderData[];
  businessOrders: OrderData[];
  loading: boolean;
  refreshOrders: () => Promise<void>;
  getOrder: (id: string) => OrderData | undefined;
  createOrder: (input: CreateOrderInput) => Promise<OrderData>;
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
    try {
      const [nextCustomerOrders, nextBusinessOrders] = await Promise.all([
        customerId ? orderService.getCustomerOrders(customerId) : Promise.resolve([]),
        businessId ? orderService.getBusinessOrders(businessId) : Promise.resolve([]),
      ]);

      setCustomerOrders(nextCustomerOrders);
      setBusinessOrders(nextBusinessOrders);
    } finally {
      setLoading(false);
    }
  }, [customerId, businessId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshOrders();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshOrders]);

  useEffect(
    () =>
      orderService.subscribe((updated) => {
        setCustomerOrders((previous) => {
          const index = previous.findIndex((order) => order.id === updated.id);
          if (index < 0) return [updated, ...previous];
          const next = [...previous];
          next[index] = updated;
          return next;
        });

        setBusinessOrders((previous) => {
          const index = previous.findIndex((order) => order.id === updated.id);
          if (index < 0) return [updated, ...previous];
          const next = [...previous];
          next[index] = updated;
          return next;
        });
      }),
    [],
  );

  const getOrder = useCallback(
    (id: string) =>
      customerOrders.find((order) => order.id === id) ??
      businessOrders.find((order) => order.id === id),
    [customerOrders, businessOrders],
  );

  const createOrder = useCallback(async (_input: CreateOrderInput) => {
    return orderService.createOrder();
  }, []);

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await orderService.updateStatus(orderId, status);
    },
    [],
  );

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
      createOrder,
      updateOrderStatus,
      acceptOrder,
      rejectOrder,
    }),
    [
      customerOrders,
      businessOrders,
      loading,
      refreshOrders,
      getOrder,
      createOrder,
      updateOrderStatus,
      acceptOrder,
      rejectOrder,
    ],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders(): OrderContextValue {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used within an OrderProvider');
  return context;
}
