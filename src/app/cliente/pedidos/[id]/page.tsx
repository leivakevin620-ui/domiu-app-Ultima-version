'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page-container';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, OrderProvider } from '@/contexts/OrderContext';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { TrackingProvider, useTracking } from '@/contexts/TrackingContext';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline';
import { TrackingMap } from '@/components/tracking/TrackingMap';
import { EtaCard } from '@/components/tracking/EtaCard';
import { DeliveryProgress } from '@/components/tracking/DeliveryProgress';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ArrowLeft, ClipboardList, Clock, MapPin, Truck, MessageCircle, X } from 'lucide-react';

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { getOrder, loading: orderLoading } = useOrders();
  const { getTrackingInfo, getDriverLocation, startTracking, stopTracking } = useTracking();
  const { openConversation, closeConversation, currentConversation } = useChat();
  const [showChat, setShowChat] = useState(false);
  const orderId = params.id as string;
  const order = getOrder(orderId);

  const isDeliveryPhase = order && ['assigned', 'picked_up', 'in_transit', 'delivered'].includes(order.status);
  const trackingInfo = order ? getTrackingInfo(order.id) : undefined;
  const driverLocation = order ? getDriverLocation(order.id) : undefined;

  useEffect(() => {
    if (order && isDeliveryPhase) {
      startTracking(order.id, order.business_id, order.customer_id);
    }
    return () => {
      if (order) stopTracking(order.id);
    };
  }, [order?.id, order?.status]);

  const handleOpenChat = async () => {
    if (!order?.courier_id || !order?.courier_name) return;
    await openConversation(
      order.id,
      order.customer_id,
      order.customer_name,
      order.courier_id,
      order.courier_name,
    );
    setShowChat(true);
  };

  const handleCloseChat = () => {
    closeConversation();
    setShowChat(false);
  };

  if (orderLoading) return <LoadingState />;

  if (!order) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Pedido no encontrado"
        description="Este pedido no existe o ha sido eliminado."
        action={
          <button
            onClick={() => router.push('/cliente/pedidos')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ver mis pedidos
          </button>
        }
      />
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-purple-100 text-purple-800',
    ready: 'bg-green-100 text-green-800',
    assigned: 'bg-indigo-100 text-indigo-800',
    picked_up: 'bg-purple-100 text-purple-800',
    in_transit: 'bg-amber-100 text-amber-800',
    delivered: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{order.business_name}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
            statusColors[order.status] ?? 'bg-muted text-muted-foreground'
          }`}
        >
          {order.status}
        </span>
      </div>

      {/* Chat button */}
      {order.courier_id && !showChat && (
        <button
          onClick={handleOpenChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <MessageCircle className="h-4 w-4" />
          Chat con repartidor
        </button>
      )}

      {/* Chat window */}
      {showChat && (
        <div className="h-[400px] md:h-[480px]">
          <ChatWindow userRole="customer" onClose={handleCloseChat} />
        </div>
      )}

      {/* Live tracking map */}
      {isDeliveryPhase && !showChat && (
        <div className="space-y-4">
          <TrackingMap trackingInfo={trackingInfo ?? null} driverLocation={driverLocation ?? null} />
          <EtaCard trackingInfo={trackingInfo ?? null} isLive={!!driverLocation} />
          <DeliveryProgress trackingInfo={trackingInfo ?? null} currentStatus={order.status} />
        </div>
      )}

      {/* Order timeline (pre-delivery) */}
      {!isDeliveryPhase && !showChat && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Estado del pedido</h2>
          <OrderTimeline status={order.status} />
        </div>
      )}

      {/* Driver info */}
      {order.courier_id && !isDeliveryPhase && !showChat && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4 text-primary" />
            Repartidor asignado
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {order.courier_name?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{order.courier_name}</p>
              <p className="text-xs text-muted-foreground">Pronto compartirá su ubicación</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-muted/50 p-3">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Estado de entrega</h3>
            <DeliveryStatusTimeline status={order.status} />
          </div>
        </div>
      )}

      {isDeliveryPhase && order.courier_name && !showChat && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4 text-primary" />
            Repartidor
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {order.courier_name?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{order.courier_name}</p>
              <p className="text-xs text-muted-foreground">
                {order.status === 'in_transit' ? 'En camino a entregar tu pedido' : 'Preparando tu entrega'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">Artículos</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.product_id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}x {item.product_name}
              </span>
              <span className="text-foreground">${item.item_total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Envío</span>
            <span>${order.delivery_fee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Impuestos</span>
            <span>${order.tax_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">${order.total_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Dirección de entrega
        </h2>
        <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
        {order.special_instructions && (
          <>
            <h3 className="mb-1 mt-3 text-sm font-medium text-foreground">Instrucciones especiales</h3>
            <p className="text-sm text-muted-foreground">{order.special_instructions}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Pedido realizado el{' '}
        {new Date(order.created_at).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { profile } = useAuth();
  return (
    <PageContainer>
      <TrackingProvider>
        <ChatProvider userId={profile?.id ?? ''} userRole="customer">
          <OrderProvider customerId={profile?.id}>
            <OrderDetailContent />
          </OrderProvider>
        </ChatProvider>
      </TrackingProvider>
    </PageContainer>
  );
}
