'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock3,
  Coffee,
  MapPinned,
  Package,
  Power,
  RefreshCw,
  Scale,
  Star,
  TrendingUp,
  WalletCards,
  Zap,
} from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { useAuth } from '@/contexts/AuthContext';
import { operationsService, type CourierShiftState } from '@/services/operations';
import { financeService, type CourierFinancialSummary } from '@/services/finance';
import { getCourierLevel, getNextLevel } from '@/services/courier-pro';
import { formatCOP } from '@/lib/money';
import { SkeletonStats } from '@/components/ui/skeleton';

const EMPTY_SUMMARY: CourierFinancialSummary = {
  courier_id: '',
  delivered_orders: 0,
  gross_delivery_value: 0,
  platform_commission: 0,
  net_earnings: 0,
  company_owes_courier: 0,
  courier_owes_company: 0,
  net_balance: 0,
};

function readLocation(): Promise<{ latitude?: number; longitude?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 },
    );
  });
}

export default function RepartidorDashboard() {
  const { profile } = useAuth();
  const {
    courier,
    courierStatus,
    activeDeliveries,
    availableOrders,
    loading: courierLoading,
    refresh,
  } = useCourier();
  const [shift, setShift] = useState<CourierShiftState>({ isOpen: false, shiftId: null, startedAt: null });
  const [finance, setFinance] = useState<CourierFinancialSummary>(EMPTY_SUMMARY);
  const [working, setWorking] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [shiftState, summary] = await Promise.all([
        operationsService.getCourierShift(profile.id),
        financeService.getCourierSummary(profile.id),
      ]);
      setShift(shiftState);
      setFinance(summary);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la información financiera');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { void load(); }, [load]);

  const startShift = async () => {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      const location = await readLocation();
      await operationsService.startCourier(location.latitude, location.longitude);
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la jornada');
    } finally {
      setWorking(false);
    }
  };

  const closeShift = async () => {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      const location = await readLocation();
      await operationsService.closeCourier(location.latitude, location.longitude);
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la jornada');
    } finally {
      setWorking(false);
    }
  };

  const toggleBreak = async () => {
    if (!shift.isOpen || working) return;
    setWorking(true);
    setError('');
    try {
      await operationsService.setCourierBreak(courierStatus !== 'on_break');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar la pausa');
    } finally {
      setWorking(false);
    }
  };

  const acceptOrder = async (orderId: string) => {
    if (!shift.isOpen) return setError('Inicia tu jornada antes de aceptar un domicilio');
    if (accepting) return;
    setAccepting(orderId);
    setError('');
    try {
      const { acceptOrderByCourierAction } = await import('@/app/actions/courier-orders');
      const result = await acceptOrderByCourierAction(orderId);
      if (!result.success) throw new Error(result.error);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aceptar el domicilio');
    } finally {
      setAccepting(null);
    }
  };

  const level = useMemo(() => courier ? getCourierLevel(courier.total_deliveries) : null, [courier]);
  const nextLevel = useMemo(() => courier ? getNextLevel(courier.total_deliveries) : null, [courier]);
  const progress = useMemo(() => {
    if (!courier || !level || !nextLevel) return 100;
    const range = Math.max(1, nextLevel.minDeliveries - level.minDeliveries);
    return Math.min(100, Math.round(((courier.total_deliveries - level.minDeliveries) / range) * 100));
  }, [courier, level, nextLevel]);
  const activeOrder = activeDeliveries[0];
  const statusLabel = !shift.isOpen ? 'Fuera de jornada' : courierStatus === 'on_break' ? 'En pausa' : courierStatus === 'busy' ? 'En domicilio' : 'Disponible';
  const balanceMessage = finance.net_balance > 0
    ? `DomiU te debe ${formatCOP(finance.net_balance)}`
    : finance.net_balance < 0
      ? `Debes entregar ${formatCOP(Math.abs(finance.net_balance))} a DomiU`
      : 'Saldo conciliado';

  if (courierLoading || loading) return <SkeletonStats />;

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] bg-[#17191F] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#FFD400]">Panel del repartidor</p>
            <h1 className="mt-2 text-3xl font-black">Hola, {profile?.first_name || 'repartidor'}</h1>
            <p className="mt-2 max-w-xl text-sm text-white/65">Controla tu jornada, domicilios, ubicación, ganancias netas y liquidación con DomiU.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className={`rounded-full px-3 py-2 font-black ${shift.isOpen ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/70'}`}>{statusLabel}</span>
              {shift.startedAt && shift.isOpen && <span className="inline-flex items-center gap-1 text-white/60"><Clock3 className="h-3.5 w-3.5" />Desde {new Date(shift.startedAt).toLocaleString('es-CO')}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void Promise.all([load(), refresh()])} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />Actualizar</button>
            {shift.isOpen && <button type="button" onClick={() => void toggleBreak()} disabled={working || courierStatus === 'busy'} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold disabled:opacity-40"><Coffee className="h-4 w-4" />{courierStatus === 'on_break' ? 'Volver disponible' : 'Tomar pausa'}</button>}
            <button type="button" onClick={() => void (shift.isOpen ? closeShift() : startShift())} disabled={working} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black disabled:opacity-50 ${shift.isOpen ? 'bg-red-500 text-white' : 'bg-[#FFD400] text-[#17191F]'}`}><Power className="h-4 w-4" />{working ? 'Procesando…' : shift.isOpen ? 'Cerrar jornada' : 'Iniciar jornada'}</button>
          </div>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border bg-card p-5 shadow-sm"><TrendingUp className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-xs font-bold uppercase text-muted-foreground">Ganancia neta</p><p className="mt-1 text-2xl font-black">{formatCOP(finance.net_earnings)}</p><p className="mt-2 text-xs text-muted-foreground">Domicilio menos comisión DomiU</p></article>
        <article className="rounded-3xl border bg-card p-5 shadow-sm"><WalletCards className="h-5 w-5 text-blue-600" /><p className="mt-4 text-xs font-bold uppercase text-muted-foreground">Valor bruto domicilios</p><p className="mt-1 text-2xl font-black">{formatCOP(finance.gross_delivery_value)}</p><p className="mt-2 text-xs text-muted-foreground">Antes de comisión</p></article>
        <article className="rounded-3xl border bg-card p-5 shadow-sm"><Scale className="h-5 w-5 text-amber-600" /><p className="mt-4 text-xs font-bold uppercase text-muted-foreground">Saldo de liquidación</p><p className={`mt-1 text-2xl font-black ${finance.net_balance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatCOP(finance.net_balance)}</p><p className="mt-2 text-xs text-muted-foreground">{balanceMessage}</p></article>
        <article className="rounded-3xl border bg-card p-5 shadow-sm"><Package className="h-5 w-5 text-violet-600" /><p className="mt-4 text-xs font-bold uppercase text-muted-foreground">Entregas liquidadas</p><p className="mt-1 text-2xl font-black">{finance.delivered_orders}</p><p className="mt-2 text-xs text-muted-foreground">Pedidos entregados registrados</p></article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <article className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b px-5 py-4"><div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /><h2 className="font-black">Ruta y operación</h2></div><Link href="/repartidor/mapa" className="inline-flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-black text-background">Abrir mapa <ArrowRight className="h-3.5 w-3.5" /></Link></header>
          {activeOrder ? <div className="p-5"><div className="rounded-2xl bg-blue-50 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase text-blue-700">Pedido activo</p><h3 className="mt-1 font-black">#{activeOrder.order_number}</h3></div><span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{activeOrder.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] uppercase text-muted-foreground">Comercio</p><p className="text-sm font-bold">{activeOrder.business_name}</p></div><div><p className="text-[10px] uppercase text-muted-foreground">Entrega</p><p className="truncate text-sm">{activeOrder.delivery_address}</p></div></div><Link href="/repartidor/pedidos" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-blue-700">Gestionar pedido <ArrowRight className="h-4 w-4" /></Link></div></div> : <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center"><Bike className="h-10 w-10 text-muted-foreground" /><p className="mt-3 font-black">No tienes un domicilio activo</p><p className="mt-1 text-sm text-muted-foreground">Los pedidos disponibles aparecen debajo cuando tu jornada está abierta.</p></div>}
        </article>

        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Progreso</p><h2 className="mt-1 font-black">{level ? `${level.icon} ${level.title}` : 'Nivel inicial'}</h2></div><Star className="h-6 w-6 text-amber-500" /></div>
          <p className="mt-3 text-sm text-muted-foreground">{courier?.total_deliveries ?? 0} entregas totales · calificación {Number(courier?.rating ?? 0).toFixed(1)}</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-[#FFD400] to-orange-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{nextLevel ? `${Math.max(0, nextLevel.minDeliveries - (courier?.total_deliveries ?? 0))} entregas para ${nextLevel.title}` : 'Nivel máximo alcanzado'}</p>
          <Link href="/repartidor/ganancias" className="mt-6 flex items-center justify-between rounded-2xl bg-muted/50 p-4 text-sm font-black"><span className="inline-flex items-center gap-2"><Scale className="h-4 w-4" />Ver ganancias y liquidación</span><ArrowRight className="h-4 w-4" /></Link>
        </article>
      </section>

      <section className="rounded-3xl border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-black">Domicilios disponibles</h2><p className="text-xs text-muted-foreground">Solo puedes aceptar con la jornada abierta y estado Disponible.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{availableOrders.length}</span></header>
        <div className="divide-y">
          {availableOrders.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No hay domicilios disponibles en este momento.</p> : availableOrders.slice(0, 8).map((order) => <article key={order.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-xs font-bold text-primary">#{order.order_number}</p><h3 className="mt-1 font-black">{order.business_name}</h3><p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{order.delivery_address}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-[10px] uppercase text-muted-foreground">Domicilio</p><p className="font-black">{formatCOP(order.delivery_fee)}</p></div><button type="button" onClick={() => void acceptOrder(order.id)} disabled={!shift.isOpen || courierStatus !== 'available' || Boolean(accepting)} className="rounded-xl bg-primary px-4 py-3 text-xs font-black text-primary-foreground disabled:opacity-40">{accepting === order.id ? 'Aceptando…' : 'Aceptar'}</button></div></article>)}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-card p-5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="mt-4 text-sm text-muted-foreground">DomiU te debe</p><p className="mt-1 text-xl font-black">{formatCOP(finance.company_owes_courier)}</p></div>
        <div className="rounded-3xl border bg-card p-5"><Zap className="h-5 w-5 text-amber-600" /><p className="mt-4 text-sm text-muted-foreground">Debes entregar a DomiU</p><p className="mt-1 text-xl font-black">{formatCOP(finance.courier_owes_company)}</p></div>
        <div className="rounded-3xl border bg-card p-5"><WalletCards className="h-5 w-5 text-primary" /><p className="mt-4 text-sm text-muted-foreground">Comisión operativa DomiU</p><p className="mt-1 text-xl font-black">{formatCOP(finance.platform_commission)}</p></div>
      </section>
    </div>
  );
}
