'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DriverCard } from '@/components/delivery/DriverCard';
import { AssignmentCard } from '@/components/delivery/AssignmentCard';
import { DriverStatsCard } from '@/components/delivery/DriverStatsCard';
import { Truck, CheckCircle, DollarSign, Star, MapPin, ChevronRight, Bell, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';

function DashboardContent() {
  const router = useRouter();
  const {
    courier,
    availableOrders,
    activeDeliveries,
    deliveryHistory,
    pendingRequests,
    isAvailable,
    toggleAvailability,
    acceptDelivery,
    todayEarnings,
    weekEarnings,
    totalEarnings,
  } = useCourier();

  return (
    <PageContainer>
      <PageTitle
        title="Panel de Entregas"
        description={`Bienvenido, ${courier?.name ?? 'Repartidor'}`}
      />

      {/* Availability toggle */}
      {courier && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isAvailable ? 'bg-success/10' : 'bg-muted'}`}>
              {isAvailable ? (
                <ToggleRight className="h-5 w-5 text-success" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isAvailable ? 'Disponible para entregas' : 'No disponible'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAvailable ? 'Recibirás solicitudes de pedidos' : 'No recibirás solicitudes'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleAvailability}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isAvailable
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'bg-success/10 text-success hover:bg-success/20'
            }`}
          >
            {isAvailable ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      )}

      {/* Pending assignment requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            Solicitudes pendientes
          </h3>
          {pendingRequests.map((req) => {
            const order = availableOrders.find((o) => o.id === req.order_id) ?? activeDeliveries.find((o) => o.id === req.order_id);
            if (!order) return null;
            return (
              <AssignmentCard
                key={req.id}
                order={order}
                onAccept={acceptDelivery}
              />
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DriverStatsCard
          label="Pendientes"
          value={String(activeDeliveries.length)}
          subtitle="Entregas activas"
        />
        <DriverStatsCard
          label="Completadas"
          value={String(deliveryHistory.length)}
          subtitle="Total entregas"
          trend="up"
        />
        <DriverStatsCard
          label="Ganancias hoy"
          value={`$${todayEarnings.toFixed(2)}`}
          subtitle={`$${weekEarnings.toFixed(2)} esta semana`}
          trend="up"
        />
        <DriverStatsCard
          label="Rating"
          value={String(courier?.rating ?? '—')}
          subtitle={`${courier?.total_deliveries ?? 0} entregas`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active deliveries */}
        <DashboardCard title="Entregas Activas" action={{ label: 'Ver todas', onClick: () => router.push('/repartidor/pedidos') }}>
          {activeDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin entregas activas</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {isAvailable ? 'Esperando asignación...' : 'Activa tu disponibilidad para recibir pedidos'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeliveries.slice(0, 3).map((order) => (
                <Link
                  key={order.id}
                  href="/repartidor/pedidos"
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{order.business_name}</p>
                    <p className="text-xs text-muted-foreground">#{order.order_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">${order.total_amount.toFixed(2)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Available orders */}
        <DashboardCard title="Pedidos Disponibles" action={{ label: 'Ver más', onClick: () => router.push('/repartidor/pedidos') }}>
          {availableOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No hay pedidos disponibles</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Cuando haya pedidos sin repartidor, aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{order.business_name}</p>
                    <span className="text-sm font-semibold text-foreground">${order.total_amount.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{order.delivery_address}</p>
                  <button
                    onClick={() => acceptDelivery(order.id)}
                    className="mt-2 w-full rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Aceptar entrega
                  </button>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Driver profile card */}
      {courier && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Tu perfil</h3>
          <DriverCard driver={courier} />
        </div>
      )}
    </PageContainer>
  );
}

export default function RepartidorDashboard() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id ?? 'courier-1'}>
      <DashboardContent />
    </CourierProvider>
  );
}
