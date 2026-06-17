'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { TrackingProvider, useTracking } from '@/contexts/TrackingContext';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { AssignmentCard } from '@/components/delivery/AssignmentCard';
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline';
import { EtaCard } from '@/components/tracking/EtaCard';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ClipboardList, Clock, MapPin, Navigation, NavigationOff, MessageCircle, X } from 'lucide-react';

type Tab = 'disponibles' | 'activos' | 'historial';

const statusLabels: Record<string, string> = {
  assigned: 'Asignado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-amber-100 text-amber-800',
  delivered: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

function PedidosContent() {
  const [tab, setTab] = useState<Tab>('disponibles');
  const {
    availableOrders,
    activeDeliveries,
    deliveryHistory,
    loading,
    acceptDelivery,
    updateDeliveryStatus,
    courier,
  } = useCourier();
  const { startSharing, stopSharing, isSharingLocation, getTrackingInfo } = useTracking();
  const { openConversation, closeConversation, currentConversation } = useChat();
  const [sharingOrderId, setSharingOrderId] = useState<string | null>(null);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);

  if (loading) return <LoadingState />;

  const handleToggleSharing = (order: typeof activeDeliveries[0]) => {
    if (isSharingLocation && sharingOrderId === order.id) {
      stopSharing();
      setSharingOrderId(null);
    } else {
      startSharing(courier?.id ?? 'courier-1', order.id, order.business_id, order.customer_id);
      setSharingOrderId(order.id);
    }
  };

  const handleOpenChat = async (order: typeof activeDeliveries[0]) => {
    await openConversation(
      order.id,
      order.customer_id,
      order.customer_name,
      courier?.id ?? 'courier-1',
      courier?.name ?? 'Repartidor',
    );
    setChatOrderId(order.id);
  };

  const handleCloseChat = () => {
    closeConversation();
    setChatOrderId(null);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'disponibles', label: 'Disponibles' },
    { key: 'activos', label: 'Activos' },
    { key: 'historial', label: 'Historial' },
  ];

  const content = () => {
    switch (tab) {
      case 'disponibles':
        return availableOrders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Sin pedidos disponibles"
            description="No hay pedidos esperando repartidor en este momento."
          />
        ) : (
          <div className="space-y-3">
            {availableOrders.map((order) => (
              <AssignmentCard key={order.id} order={order} onAccept={acceptDelivery} />
            ))}
          </div>
        );

      case 'activos':
        return activeDeliveries.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Sin entregas activas"
            description="Acepta pedidos disponibles para comenzar una entrega."
          />
        ) : (
          <div className="space-y-4">
            {activeDeliveries.map((order) => {
              const trackingInfo = getTrackingInfo(order.id);
              const isChatOpen = chatOrderId === order.id;

              return (
                <div key={order.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{order.business_name}</h3>
                      <p className="text-sm text-muted-foreground">#{order.order_number}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </div>

                  <div className="mb-3 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {order.delivery_address}
                    </p>
                    <p className="mt-1">{order.items.length} artículos · ${order.total_amount.toFixed(2)}</p>
                    <p className="mt-1">Cliente: {order.customer_name}</p>
                  </div>

                  <div className="mb-4 rounded-lg bg-muted/50 p-3">
                    <DeliveryStatusTimeline status={order.status} />
                  </div>

                  {/* Chat toggle */}
                  {['assigned', 'picked_up', 'in_transit'].includes(order.status) && (
                    <div className="mb-3">
                      {isChatOpen ? (
                        <div className="h-[360px]">
                          <ChatWindow userRole="courier" showQuickReplies onClose={handleCloseChat} />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenChat(order)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Chat con cliente
                        </button>
                      )}
                    </div>
                  )}

                  {/* Location sharing */}
                  {['assigned', 'picked_up', 'in_transit'].includes(order.status) && !isChatOpen && (
                    <div className="mb-4">
                      <button
                        onClick={() => handleToggleSharing(order)}
                        className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                          isSharingLocation && sharingOrderId === order.id
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                      >
                        {isSharingLocation && sharingOrderId === order.id ? (
                          <>
                            <NavigationOff className="h-4 w-4" />
                            Detener ubicación en vivo
                          </>
                        ) : (
                          <>
                            <Navigation className="h-4 w-4" />
                            Compartir ubicación en vivo
                          </>
                        )}
                      </button>

                      {isSharingLocation && sharingOrderId === order.id && trackingInfo && (
                        <div className="mt-3">
                          <EtaCard trackingInfo={trackingInfo} isLive />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {order.status === 'assigned' && (
                      <button
                        onClick={() => updateDeliveryStatus(order.id, 'picked_up')}
                        className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Marcar como recogido
                      </button>
                    )}
                    {order.status === 'picked_up' && (
                      <button
                        onClick={() => updateDeliveryStatus(order.id, 'in_transit')}
                        className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        En camino
                      </button>
                    )}
                    {order.status === 'in_transit' && (
                      <button
                        onClick={() => updateDeliveryStatus(order.id, 'delivered')}
                        className="flex-1 rounded-lg bg-success py-2 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90"
                      >
                        Marcar como entregado
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'historial':
        return deliveryHistory.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Sin historial"
            description="Completa entregas para ver tu historial."
          />
        ) : (
          <div className="space-y-2">
            {deliveryHistory.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{order.business_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(order.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                    <span>#{order.order_number}</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">${order.total_amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <PageContainer>
      <PageTitle title="Pedidos" description="Gestiona tus entregas" />

      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {content()}
    </PageContainer>
  );
}

export default function RepartidorPedidos() {
  const { profile } = useAuth();
  return (
    <TrackingProvider>
      <ChatProvider userId={profile?.id ?? 'courier-1'} userRole="courier">
        <CourierProvider courierId={profile?.id ?? 'courier-1'}>
          <PedidosContent />
        </CourierProvider>
      </ChatProvider>
    </TrackingProvider>
  );
}
