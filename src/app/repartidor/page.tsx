'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CourierProvider, useCourier } from '@/contexts/CourierContext';
import { getCourierLevel, getNextLevel, COURIER_LEVELS } from '@/services/courier-pro';
import { SkeletonStats } from '@/components/ui/skeleton';
import { Bike, Star, TrendingUp, Zap, MapPin, ChevronRight, Package, Coffee, XCircle } from 'lucide-react';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

const STATUS_CYCLE: Record<string, string> = {
  available: 'busy',
  busy: 'offline',
  offline: 'available',
  on_break: 'available',
};

const STATUS_CONFIG: Record<string, { label: string; desc: string; color: string; bg: string; icon: React.ReactNode }> = {
  available: {
    label: 'Disponible',
    desc: 'Recibiendo solicitudes de pedidos',
    color: 'text-success',
    bg: 'border-success/50 bg-gradient-to-br from-success/10 to-success/5 shadow-lg shadow-success/10',
    icon: <Bike className="h-8 w-8 text-white" />,
  },
  busy: {
    label: 'Ocupado',
    desc: 'En un pedido activo',
    color: 'text-warning',
    bg: 'border-warning/50 bg-gradient-to-br from-warning/10 to-amber-500/5 shadow-lg shadow-warning/10',
    icon: <Zap className="h-8 w-8 text-white" />,
  },
  offline: {
    label: 'No disponible',
    desc: 'Actívate para recibir pedidos',
    color: 'text-muted-foreground',
    bg: 'border-muted/50 bg-gradient-to-br from-muted/10 to-muted/5',
    icon: <XCircle className="h-8 w-8 text-muted-foreground" />,
  },
  on_break: {
    label: 'En pausa',
    desc: 'Tomando un descanso',
    color: 'text-info',
    bg: 'border-info/50 bg-gradient-to-br from-info/10 to-blue-500/5 shadow-lg shadow-info/10',
    icon: <Coffee className="h-8 w-8 text-white" />,
  },
};

function StatusToggle() {
  const { courierStatus, refresh } = useCourier();
  const { profile } = useAuth();
  const [animating, setAnimating] = React.useState(false);
  const current = courierStatus && STATUS_CONFIG[courierStatus] ? courierStatus : 'offline';
  const cfg = STATUS_CONFIG[current];

  const handleToggle = async () => {
    setAnimating(true);
    const next = STATUS_CYCLE[current] || 'available';
    try {
      const { updateCourierStatusAction } = await import('@/app/actions/auth');
      await updateCourierStatusAction(profile!.id, next);
      await refresh();
    } catch (e) {
      console.error('Error cambiando estado:', e);
    }
    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={animating}
      className={`relative w-full overflow-hidden rounded-2xl border-2 p-6 text-center transition-all duration-500 ${cfg.bg} hover:scale-[1.01] active:scale-[0.98]`}
    >
      <div className={`absolute inset-0 rounded-2xl transition-opacity duration-700 ${current === 'available' ? 'bg-[radial-gradient(circle_at_50%_0%,hsl(var(--success)/0.15),transparent_70%)]' : ''}`} />
      <div className="relative">
        <div className={`mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-500 ${
          current === 'available'
            ? 'bg-success shadow-lg shadow-success/30 scale-100'
            : current === 'busy'
            ? 'bg-warning shadow-lg shadow-warning/30 scale-100'
            : 'bg-muted scale-90'
        }`}>
          <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
            current === 'available' ? 'animate-ping bg-success/30' : ''
          }`} />
          {cfg.icon}
        </div>
        <h2 className={`text-2xl font-bold transition-colors duration-500 ${cfg.color}`}>
          {cfg.label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{cfg.desc}</p>
      </div>
    </button>
  );
}

function DashboardContent() {
  const { courier, activeDeliveries, availableOrders, loading, todayEarnings, weekEarnings, monthEarnings, totalEarnings, acceptDelivery } = useCourier();

  const level = useMemo(() => courier ? getCourierLevel(courier.total_deliveries) : COURIER_LEVELS[0], [courier]);
  const nextLevel = useMemo(() => courier ? getNextLevel(courier.total_deliveries) : COURIER_LEVELS[1], [courier]);
  const progress = useMemo(() => {
    if (!nextLevel || !courier) return 100;
    const current = level.minDeliveries;
    const next = nextLevel.minDeliveries;
    const delta = next - current;
    const done = courier.total_deliveries - current;
    return Math.min(100, Math.round((done / delta) * 100));
  }, [courier, level, nextLevel]);

  const activeOrder = activeDeliveries[0];
  const displayOrders = availableOrders.slice(0, 5);

  if (loading) return <SkeletonStats />;

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <StatusToggle />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Hoy', value: formatCurrency(todayEarnings), icon: TrendingUp, gradient: 'from-warning/10 to-orange-500/5' },
              { label: 'Semana', value: formatCurrency(weekEarnings), icon: TrendingUp, gradient: 'from-info/10 to-blue-500/5' },
              { label: 'Mes', value: formatCurrency(monthEarnings), icon: TrendingUp, gradient: 'from-success/10 to-emerald-500/5' },
              { label: 'Total', value: formatCurrency(totalEarnings), icon: TrendingUp, gradient: 'from-primary/10 to-purple-500/5' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-2xl border border-border/50 bg-gradient-to-br ${stat.gradient} p-4 shadow-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
                <div className="flex items-center gap-2">
                  <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className="mt-2 text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Entregas', value: courier?.total_deliveries ?? 0, icon: Package, color: 'text-warning' },
              { label: 'Rating', value: courier?.rating ?? 0, icon: Star, color: 'text-warning', suffix: '' },
              { label: 'Activos', value: activeDeliveries.length, icon: Zap, color: 'text-info' },
              { label: 'Disponibles', value: availableOrders.length, icon: MapPin, color: 'text-success' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 shadow-card">
                <div className="flex items-center gap-2">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className={`mt-2 text-lg font-bold text-foreground ${stat.color}`}>
                  {typeof stat.value === 'number' && stat.label === 'Rating' ? stat.value.toFixed(1) : stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{level.icon}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Nivel {level.level} — {level.title}</p>
                  <p className="text-[10px] text-muted-foreground">{courier?.total_deliveries ?? 0} entregas completadas</p>
                </div>
              </div>
              {nextLevel && (
                <span className="text-[10px] text-muted-foreground">Próximo: {nextLevel.icon} {nextLevel.title}</span>
              )}
            </div>
            {nextLevel && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{level.title}</span>
                  <span>{nextLevel.title}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${level.color} transition-all duration-1000`} style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {nextLevel.minDeliveries - (courier?.total_deliveries ?? 0)} entregas para {nextLevel.title}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Bonus por Nivel</h3>
            </div>
            <div className="space-y-2">
              {COURIER_LEVELS.slice(0, 5).map((l) => (
                <div key={l.level} className={`flex items-center justify-between rounded-xl p-2.5 transition-all ${
                  l.level <= (courier ? getCourierLevel(courier.total_deliveries).level : 1) ? 'bg-success/5 border border-success/10' : 'opacity-40'
                }`}>
                  <div className="flex items-center gap-2">
                    <span>{l.icon}</span>
                    <span className="text-xs font-medium text-foreground">{l.title}</span>
                  </div>
                  <span className="text-xs font-bold text-success">+{Math.round((l.bonusMultiplier - 1) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeOrder && (
        <div className="rounded-2xl border-2 border-info/30 bg-gradient-to-br from-info/5 to-blue-500/5 p-5 shadow-card animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-info" />
              <h3 className="text-sm font-bold text-foreground">Pedido Activo</h3>
            </div>
            <span className="rounded-full bg-info/10 px-3 py-1 text-[10px] font-medium text-info">
              #{activeOrder.order_number}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</p>
              <p className="text-sm font-semibold text-foreground">{activeOrder.customer_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Negocio</p>
              <p className="text-sm font-semibold text-foreground">{activeOrder.business_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-foreground">{formatCurrency(activeOrder.total_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dirección</p>
              <p className="text-xs text-muted-foreground truncate">{activeOrder.delivery_address}</p>
            </div>
          </div>
          <a href="/repartidor/pedidos" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-info hover:text-info/80 transition-colors">
            Ver detalle completo <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      )}

      {displayOrders.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Pedidos Disponibles</h3>
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{displayOrders.length} nuevos</span>
          </div>
          <div className="space-y-3">
            {displayOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-3 transition-all hover:bg-background/80 hover:shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{order.business_name}</span>
                    <span className="text-[10px] text-muted-foreground">#{order.order_number}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{order.delivery_address}</p>
                  <p className="text-[10px] text-muted-foreground">{order.items.length} productos · {formatCurrency(order.total_amount)}</p>
                </div>
                <button
                  onClick={() => acceptDelivery(order.id)}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-warning to-orange-500 px-4 py-2 text-[10px] font-bold text-white shadow-lg shadow-warning/20 transition-all hover:shadow-xl hover:shadow-warning/30 hover:-translate-y-0.5 active:scale-95"
                >
                  Aceptar
                </button>
              </div>
            ))}
          </div>
          {availableOrders.length > 5 && (
            <a href="/repartidor/pedidos" className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Ver {availableOrders.length - 5} más <ChevronRight className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function RepartidorPage() {
  const { profile } = useAuth();
  return (
    <CourierProvider courierId={profile?.id}>
      <DashboardContent />
    </CourierProvider>
  );
}
