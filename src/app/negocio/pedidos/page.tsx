'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessOrder } from '@/services/business';
import { SkeletonList } from '@/components/ui/skeleton';
import { OrderCustomizationDetails } from '@/components/business/order-customization-details';
import { BusinessPaymentVerification } from '@/components/business/BusinessPaymentVerification';
import { getBrowserClient } from '@/lib/db/supabase';
import {
  ClipboardList,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  Package,
  PackagePlus,
  Phone,
  RefreshCw,
  Send,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

const COLUMNS = [
  { key: 'pending', label: 'Pendiente' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'preparing', label: 'Preparando' },
  { key: 'ready', label: 'Publicado' },
  { key: 'assigned', label: 'Asignado' },
  { key: 'accepted', label: 'Aceptado' },
  { key: 'picked_up', label: 'Recogido' },
  { key: 'in_transit', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'cancelled', label: 'Cancelado' },
] as const;

const STATUS_ACTION: Record<string, { next: string; label: string }> = {
  pending: { next: 'confirmed', label: 'Confirmar pedido' },
  confirmed: { next: 'preparing', label: 'Iniciar preparación' },
  preparing: { next: 'ready', label: 'Marcar listo y publicar' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const paymentLabel: Record<string, string> = {
  pending: 'Pago pendiente',
  pending_verification: 'Verificar transferencia',
  completed: 'Pago completado',
  paid: 'Pagado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
};

const paymentMethodLabel: Record<string, string> = {
  cash: 'Efectivo contra entrega',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta débito',
  wallet: 'Billetera digital',
};

const salesChannelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Llamada',
  in_person: 'Presencial',
  instagram: 'Instagram',
  facebook: 'Facebook',
  direct_message: 'Mensaje directo',
  other: 'Otro canal',
};

const getPaymentLabel = (value: string | null | undefined) =>
  paymentLabel[String(value || '')] || value || 'Pago pendiente';

const getPaymentMethodLabel = (value: string | null | undefined) =>
  paymentMethodLabel[String(value || '')] || value || 'Método no definido';

export default function NegocioPedidos() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadOrders = useCallback(
    async (showSpinner = false) => {
      if (!profile?.id) return;
      if (showSpinner) setRefreshing(true);
      try {
        const id = businessId || (await businessService.getBusinessId(profile.id));
        if (!id) {
          setOrders([]);
          setError('No se encontró un negocio asociado a esta cuenta.');
          return;
        }
        if (!businessId) setBusinessId(id);
        const result = await businessService.getBusinessOrders(id);
        setOrders(result);
        setError('');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'No se pudieron cargar los pedidos.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessId, profile?.id],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!businessId) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`business-orders-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` }, () => void loadOrders())
      .subscribe();
    const paymentChannel = supabase
      .channel(`business-payments-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions' }, () => void loadOrders())
      .subscribe();
    const timer = window.setInterval(() => void loadOrders(), 15_000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
      void supabase.removeChannel(paymentChannel);
    };
  }, [businessId, loadOrders]);

  const changeStatus = async (order: BusinessOrder, status: string) => {
    setUpdating(order.id);
    try {
      await businessService.updateOrderStatus(order.id, status);
      await loadOrders();
      toast.success(status === 'ready' ? `Pedido #${order.order_number} publicado para los repartidores` : 'Estado actualizado correctamente');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo actualizar el pedido');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Pedidos de la app y canales externos, integrados en el mismo flujo operativo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/negocio/pedidos/crear" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
            <PackagePlus className="h-4 w-4" /> Crear pedido manual
          </Link>
          <button onClick={() => void loadOrders(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.key);
          return (
            <section key={column.key} className="min-w-[330px] rounded-2xl border bg-card">
              <header className="flex items-center justify-between border-b p-3"><h2 className="font-semibold">{column.label}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{columnOrders.length}</span></header>
              <div className="space-y-3 p-3">
                {columnOrders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-5 w-5" />Vacío</div>
                ) : columnOrders.map((order) => {
                  const action = STATUS_ACTION[order.status];
                  const isSelected = selected === order.id;
                  const paymentCompleted = order.payment_status === 'completed';
                  return (
                    <article key={order.id} className="rounded-xl border bg-background p-3 shadow-sm">
                      <button type="button" onClick={() => setSelected(isSelected ? null : order.id)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ticket</p><strong className="text-sm">#{order.order_number}</strong></div>
                          <strong className="text-sm">{formatCurrency(order.total_amount)}</strong>
                        </div>
                        {order.created_manually && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary"><PackagePlus className="h-3 w-3" />Manual · {salesChannelLabel[order.sales_channel || ''] || 'Canal externo'}</div>}
                        <p className="mt-2 text-sm font-medium">{order.customer_name}</p>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" /> {formatDateTime(order.created_at)}</div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="rounded-full bg-muted px-2 py-1">{order.items.reduce((total, item) => total + item.quantity, 0)} productos</span><span className={paymentCompleted ? 'font-bold text-success' : order.payment_status === 'failed' ? 'font-bold text-destructive' : 'font-bold text-warning'}>{getPaymentLabel(order.payment_status)}</span></div>
                      </button>

                      {order.status === 'ready' && !order.courier_id && <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 p-2 text-xs font-medium text-primary"><Send className="h-3.5 w-3.5" /> Publicado: esperando repartidor</div>}
                      <div className="mt-3 flex gap-2">
                        {action && <button type="button" disabled={updating === order.id} onClick={() => void changeStatus(order, action.next)} className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{updating === order.id ? 'Actualizando…' : action.label}</button>}
                        {order.status === 'pending' && <button type="button" disabled={updating === order.id} onClick={() => void changeStatus(order, 'cancelled')} className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50">Rechazar</button>}
                      </div>

                      {isSelected && <div className="mt-3 space-y-3 border-t pt-3">
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p><User className="mr-1 inline h-3 w-3" />{order.customer_name}</p>
                          {order.customer_email && <p><Mail className="mr-1 inline h-3 w-3" />{order.customer_email}</p>}
                          <p><Phone className="mr-1 inline h-3 w-3" />{order.customer_phone || 'Teléfono no registrado'}</p>
                          <p><MapPin className="mr-1 inline h-3 w-3" />{order.delivery_address}</p>
                          {order.delivery_instructions && <p>Referencia: {order.delivery_instructions}</p>}
                          <p><CreditCard className="mr-1 inline h-3 w-3" />{getPaymentMethodLabel(order.payment_method)} · {getPaymentLabel(order.payment_status)}</p>
                          {order.courier_name && <p>Repartidor: {order.courier_name}</p>}
                        </div>
                        <BusinessPaymentVerification orderId={order.id} onUpdated={() => void loadOrders()} />
                        <div className="space-y-2 rounded-lg bg-muted/40 p-2">{order.items.map((item) => <div key={item.id} className="text-xs"><div className="flex justify-between gap-2 font-medium"><span>{item.quantity}x {item.name}</span><span>{formatCurrency(item.item_total)}</span></div>{item.special_instructions && <p className="mt-1 text-muted-foreground">Nota: {item.special_instructions}</p>}</div>)}</div>
                        {order.special_instructions && <p className="text-xs text-muted-foreground"><Package className="mr-1 inline h-3 w-3" />Instrucción general: {order.special_instructions}</p>}
                        <OrderCustomizationDetails orderId={order.id} />
                      </div>}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
