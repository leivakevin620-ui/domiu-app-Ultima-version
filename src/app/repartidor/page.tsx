'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bike,
  Clock3,
  FileSpreadsheet,
  Loader2,
  MapPinned,
  Package,
  Power,
  ReceiptText,
  Route,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { dashboardFinanceService, type CourierFinancialSummary } from '@/services/dashboard-finance';
import { financeService } from '@/services/finance';
import { formatCOP } from '@/lib/formatters/currency';
import { SkeletonStats } from '@/components/ui/skeleton';
import { OpenStreetLiveMap, type OpenStreetMapPoint } from '@/components/tracking/maps/OpenStreetLiveMap';

export default function RepartidorDashboard() {
  const { profile } = useAuth();
  const { courier, activeDeliveries, availableOrders, refresh } = useCourier();
  const [finance, setFinance] = useState<CourierFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingShift, setChangingShift] = useState(false);
  const [error, setError] = useState('');

  const loadFinance = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      setFinance(await dashboardFinanceService.getCourierSummary(profile.id));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen financiero');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  const toggleShift = async () => {
    if (!profile?.id || changingShift) return;
    setChangingShift(true);
    setError('');
    try {
      if (finance?.currentShift) await financeService.closeCourierShift(profile.id, 'Cierre desde el panel del repartidor');
      else await financeService.openCourierShift(profile.id, 'Apertura desde el panel del repartidor');
      await Promise.all([loadFinance(), refresh()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado de la jornada');
    } finally {
      setChangingShift(false);
    }
  };

  const activeOrder = activeDeliveries[0] ?? null;
  const mapPoints = useMemo<OpenStreetMapPoint[]>(() => {
    if (!activeOrder) return [];
    const points: OpenStreetMapPoint[] = [];
    if (activeOrder.pickup_lat != null && activeOrder.pickup_lng != null) points.push({ id: 'pickup', lat: activeOrder.pickup_lat, lng: activeOrder.pickup_lng, label: activeOrder.business_name || 'Comercio', kind: 'business', color: '#F59E0B' });
    if (activeOrder.delivery_lat != null && activeOrder.delivery_lng != null) points.push({ id: 'delivery', lat: activeOrder.delivery_lat, lng: activeOrder.delivery_lng, label: activeOrder.customer_name || 'Cliente', kind: 'customer', color: '#16A34A' });
    return points;
  }, [activeOrder]);

  const mapRoute = useMemo(() => {
    if (!activeOrder) return [];
    if (['picked_up', 'in_transit'].includes(activeOrder.status) && activeOrder.pickup_lat != null && activeOrder.pickup_lng != null && activeOrder.delivery_lat != null && activeOrder.delivery_lng != null) {
      return [{ lat: activeOrder.pickup_lat, lng: activeOrder.pickup_lng }, { lat: activeOrder.delivery_lat, lng: activeOrder.delivery_lng }];
    }
    return activeOrder.pickup_lat != null && activeOrder.pickup_lng != null && activeOrder.delivery_lat != null && activeOrder.delivery_lng != null
      ? [{ lat: activeOrder.pickup_lat, lng: activeOrder.pickup_lng }, { lat: activeOrder.delivery_lat, lng: activeOrder.delivery_lng }]
      : [];
  }, [activeOrder]);

  if (loading) return <SkeletonStats />;

  const isOpen = Boolean(finance?.currentShift);
  const balance = finance?.balance.net_balance ?? 0;
  const balanceLabel = balance > 0
    ? `DomiU te debe ${formatCOP(balance)}`
    : balance < 0
      ? `Debes entregar a DomiU ${formatCOP(Math.abs(balance))}`
      : 'Estás al día con DomiU';
  const shiftSeconds = finance?.currentShift
    ? Math.max(0, Math.floor((Date.now() - new Date(finance.currentShift.opened_at).getTime()) / 1000))
    : 0;
  const shiftTime = isOpen ? `${Math.floor(shiftSeconds / 3600)} h ${Math.floor((shiftSeconds % 3600) / 60)} min` : 'Sin jornada';

  const cards = [
    { label: 'Ganancia neta hoy', value: formatCOP(finance?.todayEarnings ?? 0), help: 'Tu parte del domicilio después de la comisión DomiU', icon: TrendingUp },
    { label: 'Ganancia neta semana', value: formatCOP(finance?.weekEarnings ?? 0), help: 'Últimos 7 días', icon: Wallet },
    { label: 'Ganancia neta mes', value: formatCOP(finance?.monthEarnings ?? 0), help: 'Últimos 30 días', icon: ReceiptText },
    { label: 'Domicilios hoy', value: String(finance?.todayDeliveries ?? 0), help: `${finance?.totalDeliveries ?? 0} entregas históricas`, icon: Bike },
    { label: 'Saldo de liquidación', value: formatCOP(Math.abs(balance)), help: balanceLabel, icon: FileSpreadsheet },
    { label: 'Pedidos disponibles', value: String(availableOrders.length), help: isOpen ? 'Puedes aceptar solicitudes' : 'Abre tu jornada para trabajar', icon: Package },
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-[#17191F] via-[#24282E] to-[#101216] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD400]">Centro de trabajo del repartidor</p>
            <h1 className="mt-2 text-3xl font-black">Hola, {profile?.first_name || courier?.name || 'Repartidor'}</h1>
            <p className="mt-2 text-sm text-white/65">Abre tu jornada, recibe pedidos y revisa exactamente cuánto ganas y quién debe pagar.</p>
          </div>
          <button type="button" onClick={() => void toggleShift()} disabled={changingShift} className={`flex min-w-64 items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black shadow-lg transition disabled:opacity-60 ${isOpen ? 'bg-white text-[#17191F]' : 'bg-[#FFD400] text-[#17191F]'}`}>
            {changingShift ? <Loader2 className="h-5 w-5 animate-spin" /> : <Power className="h-5 w-5" />}
            {isOpen ? 'Cerrar jornada' : 'Iniciar jornada'}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${isOpen ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} /><span className="text-xs font-bold uppercase tracking-wide text-white/60">Estado</span></div><p className="mt-2 text-xl font-black">{isOpen ? 'En línea' : 'Fuera de línea'}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#FFD400]" /><span className="text-xs font-bold uppercase tracking-wide text-white/60">Tiempo de jornada</span></div><p className="mt-2 text-xl font-black">{shiftTime}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#FFD400]" /><span className="text-xs font-bold uppercase tracking-wide text-white/60">Saldo</span></div><p className="mt-2 text-sm font-black leading-snug">{balanceLabel}</p></div>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, help, icon: Icon }) => <article key={label} className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{help}</p></article>)}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Domicilio actual</p><h2 className="mt-1 text-xl font-black">Ruta operativa</h2></div><Link href="/repartidor/mapa" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><MapPinned className="h-4 w-4" />Abrir mapa completo</Link></div>
        {activeOrder && mapPoints.length ? <div className="grid lg:grid-cols-[1fr_320px]"><div className="h-[410px]"><OpenStreetLiveMap points={mapPoints} route={mapRoute} className="h-full w-full rounded-none" /></div><div className="border-t p-5 lg:border-l lg:border-t-0"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">#{activeOrder.order_number}</span><h3 className="mt-4 text-lg font-black">{activeOrder.business_name}</h3><p className="mt-1 text-sm text-muted-foreground">Entrega para {activeOrder.customer_name}</p><div className="mt-5 space-y-3 rounded-2xl bg-muted/50 p-4 text-sm"><div className="flex items-center justify-between"><span>Estado</span><strong className="capitalize">{activeOrder.status.replace('_', ' ')}</strong></div><div className="flex items-center justify-between"><span>Domicilio</span><strong>{formatCOP(activeOrder.delivery_fee)}</strong></div><div className="flex items-center justify-between"><span>Tu ganancia estimada</span><strong>{formatCOP(activeOrder.delivery_fee * 0.88)}</strong></div></div><Link href="/repartidor/pedidos" className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground"><Route className="h-4 w-4" />Gestionar entrega</Link></div></div> : <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><MapPinned className="h-10 w-10 text-muted-foreground" /><h3 className="mt-3 font-black">No tienes un domicilio activo</h3><p className="mt-1 text-sm text-muted-foreground">Cuando aceptes un pedido, la ruta aparecerá aquí.</p></div>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/repartidor/liquidaciones" className="group rounded-3xl bg-[#17191F] p-6 text-white shadow-xl transition hover:-translate-y-1"><FileSpreadsheet className="h-8 w-8 text-[#FFD400]" /><p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-[#FFD400]">Documentos</p><h2 className="mt-1 text-xl font-black">Liquidaciones y desprendibles</h2><p className="mt-2 text-sm text-white/65">Descarga PDF o Excel con horas, pedidos, ganancias y saldo.</p></Link>
        <Link href="/repartidor/ganancias" className="group rounded-3xl border bg-card p-6 shadow-sm transition hover:-translate-y-1"><Wallet className="h-8 w-8 text-primary" /><p className="mt-4 text-xs font-black uppercase tracking-[0.15em] text-primary">Histórico</p><h2 className="mt-1 text-xl font-black">Detalle de ganancias</h2><p className="mt-2 text-sm text-muted-foreground">Consulta cada domicilio y su valor neto.</p></Link>
      </section>
    </div>
  );
}
