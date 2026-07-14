'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useChat } from '@/contexts/ChatContext';
import { orderService, type OrderData } from '@/services/orders';
import { reviewService } from '@/services/reviews';
import type { MarketplaceProduct } from '@/services/marketplace';
import { logger } from '@/lib/logger';
import { SkeletonCard } from '@/components/ui/skeleton';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ReviewModal } from '@/components/reviews/ReviewModal';
import { ArrowLeft, MessageCircle, RefreshCw, Star, Wallet } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

export default function ClientePedidoDetalle() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { clearCart, addItem } = useCart();
  const { openConversation, closeConversation } = useChat();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let active = true;
    void (async () => {
      try {
        const result = await orderService.getOrderById(params.id);
        if (active) setOrder(result);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (order?.status === 'delivered' && !reviewSubmitted && profile) {
      reviewService.hasOrderBeenReviewed(order.id).then((reviewed) => {
        if (!reviewed) setShowReview(true);
      });
    }
  }, [order?.status, order?.id, reviewSubmitted, profile]);

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
        addItem(product, order.business_id, order.business_name, {
          quantity: item.quantity,
          unitPrice: item.unit_price,
          customization: item.variant_selections || undefined,
        });
      }
      router.push('/cliente/cart');
    } catch (error) {
      logger.error('Error reordering', error);
    } finally {
      setReordering(false);
    }
  };

  const handleTip = async () => {
    setTipping(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTipSuccess(true);
      setTimeout(() => {
        setTipSuccess(false);
        setShowTip(false);
      }, 2000);
    } finally {
      setTipping(false);
    }
  };

  if (loading) return <SkeletonCard />;
  if (!order) {
    return <div className="p-12 text-center text-muted-foreground">Pedido no encontrado</div>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pedido</p>
            <h1 className="text-2xl font-bold">#{order.order_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{order.business_name}</p>
          </div>
          <p className="text-xl font-bold">{formatCurrency(order.total_amount)}</p>
        </div>
      </section>

      <OrderTimeline status={order.status} />

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Productos</h2>
        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <div key={`${item.product_id}-${item.product_name}`} className="flex justify-between gap-3 border-b pb-3 last:border-0">
              <div>
                <p className="font-medium">{item.quantity}x {item.product_name}</p>
                {item.special_instructions && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.special_instructions}</p>
                )}
              </div>
              <p className="font-semibold">{formatCurrency(item.item_total)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => void handleReorder()}
          disabled={reordering}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reordering ? 'animate-spin' : ''}`} /> Volver a pedir
        </button>
        {order.courier_id && (
          <button
            type="button"
            onClick={() => void handleOpenChat()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" /> Chat
          </button>
        )}
        {order.status === 'delivered' && (
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
          >
            <Star className="h-4 w-4" /> Calificar
          </button>
        )}
        {order.status === 'delivered' && order.courier_id && (
          <button
            type="button"
            onClick={() => setShowTip(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
          >
            <Wallet className="h-4 w-4" /> Dar propina
          </button>
        )}
      </div>

      {showChat && <ChatWindow userRole="customer" onClose={handleCloseChat} />}
      {showReview && profile && (
        <ReviewModal
          orderId={order.id}
          businessId={order.business_id}
          courierId={order.courier_id || undefined}
          onClose={() => setShowReview(false)}
          onSubmitted={() => {
            setReviewSubmitted(true);
            setShowReview(false);
          }}
        />
      )}
      {showTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <h2 className="text-lg font-bold">Propina para el repartidor</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta función quedará conectada al pago digital antes de habilitarse en producción.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleTip()}
                disabled={tipping}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {tipping ? 'Procesando…' : tipSuccess ? 'Registrada' : 'Aceptar'}
              </button>
              <button
                type="button"
                onClick={() => setShowTip(false)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
