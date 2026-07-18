'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, MapPin, PackageSearch, RefreshCw } from 'lucide-react';
import { getBrowserClient } from '@/lib/db/supabase';
import {
  OpenStreetLiveMap,
  type OpenStreetMapPoint,
  type OpenStreetSecondaryRoute,
} from '@/components/tracking/maps/OpenStreetLiveMap';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'accepted', 'picked_up', 'in_transit'];

type LiveOrder = {
  id: string;
  order_number: string;
  status: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  courier_id: string | null;
  courier_lat: number | null;
  courier_lng: number | null;
  courier_updated_at: string | null;
};

export function BusinessLiveOperationsMap({ businessId }: { businessId: string }) {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const supabase = getBrowserClient();
    try {
      const { data: orderRows, error: ordersError } = await supabase
        .from('orders')
        .select('id,order_number,status,pickup_lat,pickup_lng,delivery_lat,delivery_lng,courier_id')
        .eq('business_id', businessId)
        .in('status', ACTIVE_STATUSES)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (ordersError) throw new Error(ordersError.message);

      const ids = (orderRows ?? []).map((order) => order.id);
      const locationsResult = ids.length
        ? await supabase
            .from('driver_locations')
            .select('order_id,latitude,longitude,updated_at,created_at')
            .in('order_id', ids)
            .order('updated_at', { ascending: false })
        : { data: [], error: null };
      if (locationsResult.error) throw new Error(locationsResult.error.message);

      const latest = new Map<string, { latitude: number; longitude: number; updated_at: string | null }>();
      for (const location of locationsResult.data ?? []) {
        if (!location.order_id || latest.has(location.order_id)) continue;
        latest.set(location.order_id, {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          updated_at: location.updated_at || location.created_at || null,
        });
      }

      const normalized: LiveOrder[] = (orderRows ?? []).map((order) => {
        const location = latest.get(order.id);
        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          pickup_lat: order.pickup_lat == null ? null : Number(order.pickup_lat),
          pickup_lng: order.pickup_lng == null ? null : Number(order.pickup_lng),
          delivery_lat: order.delivery_lat == null ? null : Number(order.delivery_lat),
          delivery_lng: order.delivery_lng == null ? null : Number(order.delivery_lng),
          courier_id: order.courier_id,
          courier_lat: location?.latitude ?? null,
          courier_lng: location?.longitude ?? null,
          courier_updated_at: location?.updated_at ?? null,
        };
      });
      setOrders(normalized);
      setSelectedId((current) => normalized.some((order) => order.id === current) ? current : normalized[0]?.id ?? null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el mapa');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`business-dashboard-map-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => void load())
      .subscribe();
    const interval = window.setInterval(() => void load(), 7000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [businessId, load]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  const points = useMemo<OpenStreetMapPoint[]>(() => {
    if (!selected) return [];
    const result: OpenStreetMapPoint[] = [];
    if (selected.pickup_lat != null && selected.pickup_lng != null) result.push({ id: `pickup-${selected.id}`, lat: selected.pickup_lat, lng: selected.pickup_lng, label: 'Comercio', kind: 'business', color: '#F59E0B' });
    if (selected.delivery_lat != null && selected.delivery_lng != null) result.push({ id: `delivery-${selected.id}`, lat: selected.delivery_lat, lng: selected.delivery_lng, label: 'Cliente', kind: 'customer', color: '#16A34A' });
    if (selected.courier_lat != null && selected.courier_lng != null) result.push({ id: `courier-${selected.id}`, lat: selected.courier_lat, lng: selected.courier_lng, label: 'Repartidor en vivo', kind: 'courier', color: '#2563EB' });
    return result;
  }, [selected]);

  const route = useMemo(() => {
    if (!selected) return [];
    const start = selected.courier_lat != null && selected.courier_lng != null
      ? { lat: selected.courier_lat, lng: selected.courier_lng }
      : selected.pickup_lat != null && selected.pickup_lng != null
        ? { lat: selected.pickup_lat, lng: selected.pickup_lng }
        : null;
    const end = ['picked_up', 'in_transit'].includes(selected.status)
      ? selected.delivery_lat != null && selected.delivery_lng != null ? { lat: selected.delivery_lat, lng: selected.delivery_lng } : null
      : selected.pickup_lat != null && selected.pickup_lng != null ? { lat: selected.pickup_lat, lng: selected.pickup_lng } : null;
    return start && end ? [start, end] : [];
  }, [selected]);

  const secondaryRoutes = useMemo<OpenStreetSecondaryRoute[]>(() => orders
    .filter((order) => order.id !== selectedId)
    .map((order) => {
      const start = order.courier_lat != null && order.courier_lng != null
        ? { lat: order.courier_lat, lng: order.courier_lng }
        : order.pickup_lat != null && order.pickup_lng != null
          ? { lat: order.pickup_lat, lng: order.pickup_lng }
          : null;
      const end = ['picked_up', 'in_transit'].includes(order.status)
        ? order.delivery_lat != null && order.delivery_lng != null ? { lat: order.delivery_lat, lng: order.delivery_lng } : null
        : order.pickup_lat != null && order.pickup_lng != null ? { lat: order.pickup_lat, lng: order.pickup_lng } : null;
      return { id: order.id, points: start && end ? [start, end] : [], color: '#64748B' };
    })
    .filter((item) => item.points.length >= 2), [orders, selectedId]);

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Seguimiento operativo</p>
          <h2 className="mt-1 text-xl font-black">Mapa en vivo de tus pedidos</h2>
          <p className="mt-1 text-xs text-muted-foreground">Actualización automática por GPS y eventos de pedido.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</button>
      </div>

      {error && <p className="m-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="h-[420px] min-h-[420px] bg-muted/30">
          {loading ? <div className="h-full animate-pulse bg-muted" /> : points.length ? <OpenStreetLiveMap points={points} route={route} secondaryRoutes={secondaryRoutes} followPointId={selected?.courier_lat != null ? `courier-${selected.id}` : undefined} className="h-full w-full rounded-none" /> : <div className="flex h-full flex-col items-center justify-center p-8 text-center"><MapPin className="h-10 w-10 text-muted-foreground" /><h3 className="mt-3 font-bold">Sin pedidos activos en el mapa</h3><p className="mt-1 text-sm text-muted-foreground">Los nuevos pedidos aparecerán al abrir la operación.</p></div>}
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto border-t p-3 lg:border-l lg:border-t-0">
          {orders.length === 0 ? <div className="flex h-full flex-col items-center justify-center p-6 text-center"><PackageSearch className="h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">No hay pedidos activos.</p></div> : orders.map((order) => <button key={order.id} type="button" onClick={() => setSelectedId(order.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === order.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">#{order.order_number}</strong><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold capitalize">{order.status.replace('_', ' ')}</span></div><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Bike className="h-3.5 w-3.5" />{order.courier_id ? order.courier_lat != null ? 'GPS conectado' : 'Repartidor asignado' : 'Esperando repartidor'}</div>{order.courier_updated_at && <p className="mt-1 text-[10px] text-muted-foreground">Última señal: {new Date(order.courier_updated_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>}</button>)}
        </div>
      </div>
    </section>
  );
}
