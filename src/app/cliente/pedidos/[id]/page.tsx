'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PageContainer } from '@/components/ui/page-container';
import { SkeletonCard, SkeletonMap } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, OrderProvider } from '@/contexts/OrderContext';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { TrackingProvider, useTracking } from '@/contexts/TrackingContext';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline';
import dynamic from 'next/dynamic';
const GoogleTrackingMap = dynamic(() => import('@/components/tracking/maps/GoogleTrackingMap').then(m => ({ default: m.GoogleTrackingMap })), {
  ssr: false,
  loading: () => <SkeletonMap className="h-[300px]" />,
});
import { ReviewModal } from '@/components/reviews/ReviewModal';
import { reviewService } from '@/services/reviews';
import type { MarketplaceProduct } from '@/services/marketplace';
import { useCart } from '@/contexts/CartContext';
import { MapsProvider } from '@/contexts/MapsContext';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { EtaCard as TrackingInfo } from '@/components/tracking/EtaCard';
import { DeliveryProgress } from '@/components/tracking/DeliveryProgress';
import { logger } from '@/lib/logger';
import {
  ArrowLeft, ClipboardList, Clock, MapPin, Truck, MessageCircle, Store,
  RotateCcw, Download, DollarSign, Star, Receipt
} from 'lucide-react';

const TIP_AMOUNTS = [1, 2, 3, 5];

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { getOrder, loading: orderLoading } = useOrders();
  const { getTrackingInfo, getDriverLocation, startTracking, stopTracking } = useTracking();
  const { openConversation, closeConversation } = useChat();
  const [showChat, setShowChat] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [reordering, setReordering] = useState(false);
  const { addItem, clearCart } = useCart();

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
  }, [order, isDeliveryPhase, startTracking, stopTracking]);

  useEffect(() => {
    if (order?.status === 'delivered' && !reviewSubmitted && profile) {
      reviewService.hasOrderBeenReviewed(order.id).then((reviewed) => {
        if (!reviewed) setShowReview(true);
      });
    }
  }, [order?.status, order?.id, reviewSubmitted, profile]);

  const handleOpenChat = async () => {
    if (!order?.courier_id || !order?.courier_name) return;
    await openConversation(order.id, order.customer_id, order.customer_name, order.courier_id, order.courier_name);
    setShowChat(true);
  };

  const handleCloseChat = () => { closeConversation(); setShowChat(false); };

  const handleReorder = async () => {
    if (!order || reordering) return;
    setReordering(true);
    try {
      clearCart();
      for (const item of order.items) {
        const product: MarketplaceProduct = {
          id: item.product_id,
          business_id: order.business_id,
          name: item.product_name,
          price: item.unit_price,
          description: '',
          image_url: null,
          is_available: true,
        };
        addItem(
          product,
          order.business_id,
          order.business_name,
          item.quantity,
        );
      }
      router.push('/cliente/cart');
    } catch (e) {
      logger.error('Error reordering', e);
    } finally {
      setReordering(false);
    }
  };

  const handleTip = async () => {
    setTipping(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      setTipSuccess(true);
      setTimeout(() => { setTipSuccess(false); setShowTip(false); }, 2000);
    } catch {
    } finally {
      setTipping(false);
    }
  };

  const handleDownloadInvoice = () => {
    setShowInvoice(true);
  };

  if (orderLoading) return <SkeletonCard />;

  if (!order) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Pedido no encontrado"
        description="Este pedido no existe o ha sido eliminado."
        action={
          <button onClick={() => router.push('/cliente/pedidos')} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            Ver mis pedidos
          </button>
        }
      />
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    preparing: 'bg-purple-50 text-purple-700 border-purple-200',
    ready: 'bg-green-50 text-green-700 border-green-200',
    assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    picked_up: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    in_transit: 'bg-amber-50 text-amber-700 border-amber-200',
    delivered: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendiente', confirmed: 'Confirmado', preparing: 'Preparando',
    ready: 'Listo', assigned: 'Asignado', picked_up: 'Recogido',
    in_transit: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado',
  };

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground truncate">{order.order_number}</span>
          <span className={`ml-auto shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[order.status] ?? 'bg-muted text-muted-foreground'}`}>
            {statusLabels[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <PageContainer>
        <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{order.business_name}</h1>
              <p className="text-xs text-muted-foreground">{order.order_number}</p>
            </div>
          </div>

          {order.courier_id && !showChat && (
            <motion.button
              onClick={handleOpenChat}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 py-3.5 text-sm font-semibold text-primary transition-all hover:from-primary/20 hover:to-primary/10 border border-primary/10"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <MessageCircle className="h-5 w-5" />
              Chat con repartidor
            </motion.button>
          )}

          {showChat && (
            <div className="h-[400px] md:h-[480px] rounded-2xl overflow-hidden border border-border/30">
              <ChatWindow userRole="customer" onClose={handleCloseChat} />
            </div>
          )}

          {isDeliveryPhase && !showChat && trackingInfo && (
            <div className="space-y-4">
              <div className="h-[350px] md:h-[420px] rounded-2xl overflow-hidden border border-border/30">
                <GoogleTrackingMap
                  data={{
                    business: {
                      lat: trackingInfo.businessLocation.lat,
                      lng: trackingInfo.businessLocation.lng,
                      name: order.business_name,
                    },
                    customer: {
                      lat: trackingInfo.customerLocation.lat,
                      lng: trackingInfo.customerLocation.lng,
                      name: 'Tu ubicación',
                    },
                    driver: driverLocation ? {
                      lat: driverLocation.latitude,
                      lng: driverLocation.longitude,
                      name: order.courier_name ?? 'Repartidor',
                      heading: driverLocation.heading,
                    } : null,
                    route: {
                      origin: trackingInfo.businessLocation,
                      destination: trackingInfo.customerLocation,
                    },
                    etaMinutes: trackingInfo.etaMinutes,
                    distanceKm: trackingInfo.distanceKm,
                  }}
                  showTraffic
                  className="h-full"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TrackingInfo trackingInfo={trackingInfo} isLive={!!driverLocation} />
                <DeliveryProgress trackingInfo={trackingInfo} currentStatus={order.status} />
              </div>
            </div>
          )}

          {!isDeliveryPhase && !showChat && (
            <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
              <h2 className="mb-4 text-sm font-bold text-foreground">Estado del pedido</h2>
              <OrderTimeline status={order.status} />
            </div>
          )}

          {order.courier_id && !isDeliveryPhase && !showChat && (
            <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Truck className="h-4 w-4 text-primary" />
                Repartidor asignado
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-base font-bold text-primary">
                  {order.courier_name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.courier_name}</p>
                  <p className="text-xs text-muted-foreground">Pronto compartirá su ubicación</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-muted/30 p-4">
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado de entrega</h3>
                <DeliveryStatusTimeline status={order.status} />
              </div>
            </div>
          )}

          {isDeliveryPhase && order.courier_name && !showChat && (
            <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Truck className="h-4 w-4 text-primary" />
                Repartidor
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-base font-bold text-primary">
                  {order.courier_name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.courier_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.status === 'in_transit' ? 'En camino a entregar tu pedido' : 'Preparando tu entrega'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {order.status === 'delivered' && (
            <div className="flex gap-2">
              <button
                onClick={handleReorder}
                disabled={reordering}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                {reordering ? 'Reordenando...' : 'Repetir pedido'}
              </button>
              <button
                onClick={() => setShowTip(true)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100 border border-amber-200"
              >
                <DollarSign className="h-4 w-4" />
                Propina
              </button>
              <button
                onClick={handleDownloadInvoice}
                className="flex items-center justify-center gap-2 rounded-2xl bg-muted/50 px-5 py-3 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}

          {showTip && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-amber-800">Agregar propina</h3>
                <button onClick={() => { if (!tipping) setShowTip(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              </div>
              {tipSuccess ? (
                <div className="text-center py-4">
                  <Star className="mx-auto h-8 w-8 text-amber-500 mb-2 fill-current" />
                  <p className="text-sm font-semibold text-amber-800">¡Propina agregada!</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  {TIP_AMOUNTS.map(a => (
                    <button
                      key={a}
                      onClick={handleTip}
                      disabled={tipping}
                      className="flex-1 rounded-xl bg-white py-3 text-center text-sm font-bold text-amber-700 shadow-sm transition-all hover:shadow-md hover:bg-amber-50 border border-amber-200 disabled:opacity-50"
                    >
                      ${a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
            <h2 className="mb-4 text-base font-bold text-foreground">Artículos</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{item.quantity}x</span> {item.product_name}
                  </span>
                  <span className="text-foreground font-medium">${item.item_total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-border/20 pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-foreground">${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span className="text-foreground">${order.delivery_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Impuestos</span>
                <span className="text-foreground">${order.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border/20 pt-3 text-base font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">${order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {showInvoice && (
            <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
              <h2 className="mb-4 text-base font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Factura
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Pedido No.</span>
                  <span className="text-foreground font-medium">{order.order_number}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Fecha</span>
                  <span className="text-foreground font-medium">
                    {new Date(order.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Negocio</span>
                  <span className="text-foreground font-medium">{order.business_name}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Dirección</span>
                  <span className="text-foreground font-medium text-right max-w-[200px] truncate">{order.delivery_address}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Total</span>
                    <span>${order.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <button className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary">
                <Download className="h-4 w-4" /> Descargar PDF
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Dirección de entrega
            </h2>
            <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
            {order.special_instructions && (
              <>
                <h3 className="mb-1 mt-4 text-sm font-semibold text-foreground">Instrucciones especiales</h3>
                <p className="text-sm text-muted-foreground">{order.special_instructions}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Pedido realizado el{' '}
            {new Date(order.created_at).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>

          <ReviewModal
            open={showReview}
            onClose={() => setShowReview(false)}
            orderId={order.id}
            customerId={profile?.id ?? ''}
            businessId={order.business_id}
            businessName={order.business_name}
            courierId={order.courier_id}
            courierName={order.courier_name}
            onSubmitted={() => setReviewSubmitted(true)}
          />
        </motion.div>
      </PageContainer>
    </div>
  );
}

export default function OrderDetailPage() {
  const { profile } = useAuth();
  return (
    <MapsProvider>
      <TrackingProvider>
        <ChatProvider userId={profile?.id ?? ''} userRole="customer">
          <OrderProvider customerId={profile?.id}>
            <OrderDetailContent />
          </OrderProvider>
        </ChatProvider>
      </TrackingProvider>
    </MapsProvider>
  );
}
