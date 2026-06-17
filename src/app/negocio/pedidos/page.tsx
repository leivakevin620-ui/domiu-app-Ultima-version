'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, OrderProvider } from '@/contexts/OrderContext';
import { TrackingProvider, useTracking } from '@/contexts/TrackingContext';
import { NegocioOrderCard } from '@/components/orders/negocio-order-card';
import { ClipboardList } from 'lucide-react';

type Tab = 'nuevos' | 'activos' | 'finalizados';

function PedidosContent() {
  const { businessOrders, loading, acceptOrder, rejectOrder, updateOrderStatus } = useOrders();
  const { startTracking, stopTracking } = useTracking();
  const [tab, setTab] = useState<Tab>('nuevos');

  useEffect(() => {
    const deliveryOrders = businessOrders.filter((o) =>
      ['assigned', 'picked_up', 'in_transit'].includes(o.status),
    );
    deliveryOrders.forEach((o) => startTracking(o.id, o.business_id, o.customer_id));
    return () => {
      deliveryOrders.forEach((o) => stopTracking(o.id));
    };
  }, [businessOrders]);

  if (loading) return <LoadingState />;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'nuevos', label: 'Nuevos' },
    { key: 'activos', label: 'Activos' },
    { key: 'finalizados', label: 'Finalizados' },
  ];

  const filtered = businessOrders.filter((o) => {
    if (tab === 'nuevos') return o.status === 'pending';
    if (tab === 'activos') return ['confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit'].includes(o.status);
    return ['delivered', 'cancelled'].includes(o.status);
  });

  const handleAccept = async (id: string) => {
    await acceptOrder(id);
  };

  const handleReject = async (id: string) => {
    await rejectOrder(id);
  };

  const handleNextStatus = async (id: string) => {
    const order = businessOrders.find((o) => o.id === id);
    if (!order) return;
    const flow: Record<string, string> = {
      confirmed: 'preparing',
      preparing: 'ready',
    };
    const next = flow[order.status];
    if (next) await updateOrderStatus(id, next as any);
  };

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No hay pedidos"
          description={
            tab === 'nuevos'
              ? 'No hay pedidos nuevos pendientes por aceptar.'
              : tab === 'activos'
                ? 'No hay pedidos activos en este momento.'
                : 'No hay pedidos finalizados.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((order) => (
            <NegocioOrderCard
              key={order.id}
              order={order}
              onAccept={handleAccept}
              onReject={handleReject}
              onNextStatus={handleNextStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NegocioPedidos() {
  const { profile } = useAuth();
  const businessId = profile?.role === 'merchant' ? profile.id : undefined;
  return (
    <PageContainer>
      <PageTitle title="Pedidos" description="Gestiona los pedidos de tus clientes" />
      <TrackingProvider>
        <OrderProvider businessId={businessId}>
          <PedidosContent />
        </OrderProvider>
      </TrackingProvider>
    </PageContainer>
  );
}
