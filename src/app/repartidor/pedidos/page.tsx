'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { SkeletonList } from '@/components/ui/skeleton';
import { ClipboardList, Navigation, MapPin, Store, User, Package, DollarSign, MessageSquare, CheckCircle2, Circle, ArrowRight, Phone } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

const STAGE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  assigned: { label: 'Asignado', icon: Circle, desc: 'Pedido asignado' },
  picked_up: { label: 'Recogido', icon: Package, desc: 'Producto recogido' },
  in_transit: { label: 'En camino', icon: Navigation, desc: 'Dirección del cliente' },
  delivered: { label: 'Entregado', icon: CheckCircle2, desc: 'Pedido entregado' },
};

const STAGE_ORDER = ['assigned', 'picked_up', 'in_transit', 'delivered'];

function DeliveryTimeline({ status }: { status: string }) {
  const currentIdx = STAGE_ORDER.indexOf(status);
  return (
    <div className="space-y-3">
      {STAGE_ORDER.map((stage, i) => {
        const s = STAGE_LABELS[stage];
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-500 ${
                done ? 'bg-success text-white shadow-sm shadow-success/30' : 'bg-muted text-muted-foreground'
              } ${active ? 'scale-110 ring-2 ring-success/30' : ''}`}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <div className={`mt-1 h-6 w-0.5 ${i < currentIdx ? 'bg-success' : 'bg-muted'}`} />
              )}
            </div>
            <div className={`pb-4 ${active ? '' : ''}`}>
              <p className={`text-xs font-semibold ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PedidosContent() {
  const { availableOrders, activeDeliveries, deliveryHistory, loading, acceptDelivery, updateDeliveryStatus } = useCourier();
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'history'>('active');
  const activeOrder = activeDeliveries[0];

  const mapsUrl = activeOrder
    ? `https://www.google.com/maps/dir//${encodeURIComponent(activeOrder.delivery_address)}`
    : '';

  const getNextAction = () => {
    if (!activeOrder) return null;
    if (activeOrder.status === 'assigned') return { label: 'Marcar como Recogido', nextStatus: 'picked_up' as const, color: 'from-info to-blue-500' };
    if (activeOrder.status === 'picked_up') return { label: 'En Camino', nextStatus: 'in_transit' as const, color: 'from-warning to-orange-500' };
    if (activeOrder.status === 'in_transit') return { label: 'Marcar como Entregado', nextStatus: 'delivered' as const, color: 'from-success to-emerald-500' };
    return null;
  };

  const nextAction = getNextAction();

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-warning/5">
            <ClipboardList className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeDeliveries.length} activos · {availableOrders.length} disponibles
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-background/50 p-1 w-fit">
        {([
          { key: 'active' as const, label: 'Activo', count: activeDeliveries.length },
          { key: 'available' as const, label: 'Disponibles', count: availableOrders.length },
          { key: 'history' as const, label: 'Historial', count: deliveryHistory.length },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}>
            {tab.label}
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'active' && (
        <div className="space-y-4">
          {!activeOrder ? (
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-12 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No tienes pedidos activos</p>
              <p className="text-xs text-muted-foreground/70">Los pedidos aparecerán aquí cuando los aceptes</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border-2 border-info/20 bg-gradient-to-br from-card to-info/5 p-5 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                      <Package className="h-4 w-4 text-info" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Pedido en Curso</h3>
                      <p className="text-[10px] text-muted-foreground">#{activeOrder.order_number}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-info/10 px-3 py-1 text-[10px] font-medium text-info uppercase">
                    {activeOrder.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="h-3.5 w-3.5 text-warning" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Negocio</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{activeOrder.business_name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activeOrder.delivery_address}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-3.5 w-3.5 text-info" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Cliente</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{activeOrder.customer_name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      <Phone className="inline h-3 w-3 mr-1" />{activeOrder.customer_phone || 'Sin teléfono'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-3.5 w-3.5 text-success" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Pago</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(activeOrder.total_amount)}</p>
                    <p className="text-[10px] text-muted-foreground">Tarjeta · {activeOrder.items.length} productos</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {nextAction && (
                    <button
                      onClick={() => updateDeliveryStatus(activeOrder.id, nextAction.nextStatus)}
                      className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${nextAction.color} px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95`}
                    >
                      <ArrowRight className="h-4 w-4" />
                      {nextAction.label}
                    </button>
                  )}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Navigation className="h-4 w-4" />
                    Navegar
                  </a>
                  <button onClick={() => toast.info('Función en preparación: chat con cliente')} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Progreso de Entrega</h3>
                  <DeliveryTimeline status={activeOrder.status} />
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Artículos</h3>
                  {activeOrder.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin detalles de artículos</p>
                  ) : (
                    <div className="space-y-2">
                      {activeOrder.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">{item.quantity}</span>
                            <span className="text-xs font-medium text-foreground">{item.product_name}</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground">{formatCurrency(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'available' && (
        <div className="space-y-3">
          {availableOrders.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-12 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No hay pedidos disponibles</p>
              <p className="text-xs text-muted-foreground/70">Nuevos pedidos aparecerán automáticamente</p>
            </div>
          ) : (
            availableOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 shadow-card hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm font-semibold text-foreground">{order.business_name}</span>
                      <span className="text-[10px] text-muted-foreground">#{order.order_number}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {order.delivery_address}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{order.items.length} productos</span>
                      <span>{formatCurrency(order.total_amount)}</span>
                      {order.special_instructions && <span className="text-info">📍 Nota: {order.special_instructions}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => acceptDelivery(order.id)}
                    className="flex-1 rounded-xl bg-gradient-to-r from-warning to-orange-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-warning/20 transition-all hover:shadow-xl hover:shadow-warning/30 hover:-translate-y-0.5 active:scale-95"
                  >
                    Aceptar Pedido
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {deliveryHistory.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-12 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">Sin historial de entregas</p>
            </div>
          ) : (
            deliveryHistory.slice(0, 20).map((order) => (
              <div key={order.id} className="rounded-xl border border-border/50 bg-card/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{order.business_name}</span>
                      <span className="text-[10px] text-muted-foreground">#{order.order_number}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(order.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${order.status === 'delivered' ? 'text-success' : 'text-destructive'}`}>
                      {order.status === 'delivered' ? '✓ Entregado' : '✗ Cancelado'}
                    </span>
                    <p className="text-xs font-semibold text-foreground">{formatCurrency(order.total_amount)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function RepartidorPedidos() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id}>
      <PedidosContent />
    </CourierProvider>
  );
}
