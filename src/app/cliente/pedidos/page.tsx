'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, OrderProvider } from '@/contexts/OrderContext';
import { Clock, ClipboardList, ChevronRight } from 'lucide-react';

function PedidosContent() {
  const { profile } = useAuth();
  const { customerOrders, loading } = useOrders();

  if (loading) return <LoadingState />;

  if (customerOrders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="No tienes pedidos"
        description="Los pedidos que realices aparecerán aquí. Explora restaurantes cercanos para comenzar."
      />
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-purple-100 text-purple-800',
    ready: 'bg-green-100 text-green-800',
    delivered: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    preparing: 'Preparando',
    ready: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };

  return (
    <div className="space-y-3">
      {customerOrders.map((order) => (
        <Link
          key={order.id}
          href={`/cliente/pedidos/${order.id}`}
          className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{order.business_name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusColors[order.status] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{order.order_number}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(order.created_at).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span>{order.items.length} artículos</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">${order.total_amount.toFixed(2)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ClientePedidos() {
  const { profile } = useAuth();
  return (
    <PageContainer>
      <PageTitle title="Mis Pedidos" description="Historial de todos tus pedidos" />
      <OrderProvider customerId={profile?.id}>
        <PedidosContent />
      </OrderProvider>
    </PageContainer>
  );
}
