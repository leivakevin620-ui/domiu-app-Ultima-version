'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessOrder } from '@/services/business';
import { SkeletonList } from '@/components/ui/skeleton';
import { ClipboardList, MapPin, User, Package } from 'lucide-react';

const COLUMNS = [
  { key: 'pending', label: 'Pendiente', color: 'border-l-warning', bg: 'bg-warning/5' },
  { key: 'confirmed', label: 'Confirmado', color: 'border-l-info', bg: 'bg-info/5' },
  { key: 'preparing', label: 'Preparando', color: 'border-l-primary', bg: 'bg-primary/5' },
  { key: 'ready', label: 'Listo', color: 'border-l-success', bg: 'bg-success/5' },
  { key: 'assigned', label: 'Asignado', color: 'border-l-info', bg: 'bg-info/5' },
  { key: 'in_transit', label: 'En camino', color: 'border-l-primary', bg: 'bg-primary/5' },
  { key: 'delivered', label: 'Entregado', color: 'border-l-success', bg: 'bg-success/5' },
];

const STATUS_FLOW: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'assigned',
  assigned: 'in_transit',
  in_transit: 'delivered',
};

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
const formatTime = (s: string) => { const d = new Date(s); return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); };

export default function NegocioPedidos() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BusinessOrder | null>(null);

  const loadOrders = async () => {
    if (!profile?.id) return;
    const bizId = await businessService.getBusinessId(profile.id);
    if (bizId) setOrders(await businessService.getBusinessOrders(bizId));
  };

  useEffect(() => { (async () => { await loadOrders(); setLoading(false); })(); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => { loadOrders(); }, 10000);
    return () => clearInterval(id);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceStatus = async (orderId: string, currentStatus: string) => {
    const next = STATUS_FLOW[currentStatus];
    if (!next) return;
    const supabase = (await import('@/lib/db/supabase')).getBrowserClient;
    const client = await supabase();
    await client.from('orders').update({ status: next } as never).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: next } : o));
  };

  const rejectOrder = async (orderId: string) => {
    const supabase = (await import('@/lib/db/supabase')).getBrowserClient;
    const client = await supabase();
    await client.from('orders').update({ status: 'cancelled' } as never).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled' } : o));
  };

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-warning/5">
            <ClipboardList className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestiona los pedidos en tiempo real</p>
          </div>
        </div>
        <button onClick={loadOrders} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">Actualizar</button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className={`min-w-[260px] flex-shrink-0 rounded-2xl border border-border bg-card ${col.bg}`}>
              <div className={`border-b border-border/50 px-4 py-3 border-l-4 ${col.color} rounded-t-2xl`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">{colOrders.length}</span>
                </div>
              </div>
              <div className="p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {colOrders.length === 0 ? (
                  <div className="py-6 text-center">
                    <ClipboardList className="mx-auto h-5 w-5 text-muted-foreground/40" />
                    <p className="mt-1 text-xs text-muted-foreground/60">Vacío</p>
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelected(selected?.id === order.id ? null : order)}
                      className="rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">#{order.order_number}</span>
                        <span className="text-xs font-semibold text-foreground">{formatCurrency(order.total_amount)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{order.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground/60">{order.items?.length || 0} productos · {formatTime(order.created_at)}</p>
                      <div className="mt-2 flex gap-1">
                        {STATUS_FLOW[order.status] && (
                          <button onClick={(e) => { e.stopPropagation(); advanceStatus(order.id, order.status); }} className="flex-1 rounded-lg bg-primary/10 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors">
                            {order.status === 'pending' ? 'Confirmar' : order.status === 'confirmed' ? 'Preparar' : order.status === 'preparing' ? 'Listo' : order.status === 'ready' ? 'Asignar' : 'Avanzar'}
                          </button>
                        )}
                        {order.status === 'pending' && (
                          <button onClick={(e) => { e.stopPropagation(); rejectOrder(order.id); }} className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[10px] font-medium text-destructive hover:bg-destructive/20 transition-colors">Rechazar</button>
                        )}
                      </div>
                      {selected?.id === order.id && (
                        <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5 animate-in slide-in-from-top-1">
                          <p className="text-[10px] text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />{order.delivery_address || 'Dirección no disponible'}</p>
                          {order.special_instructions && <p className="text-[10px] text-muted-foreground"><Package className="inline h-3 w-3 mr-1" />{order.special_instructions}</p>}
                          {order.courier_name && <p className="text-[10px] text-muted-foreground"><User className="inline h-3 w-3 mr-1" />{order.courier_name}</p>}
                          <div className="mt-1 space-y-1">
                            {order.items?.map((item) => (
                              <div key={item.id} className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                                <span className="text-foreground font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
