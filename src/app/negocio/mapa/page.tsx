'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike,
  Clock3,
  ExternalLink,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessOrder } from '@/services/business';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  OpenStreetLiveMap,
  type OpenStreetMapPoint,
  type OpenStreetSecondaryRoute,
} from '@/components/tracking/maps/OpenStreetLiveMap';

type Coordinates = { lat: number; lng: number };

type MapOrder = BusinessOrder & {
  customerPosition: Coordinates | null;
  pickupPosition: Coordinates | null;
  pickupAddress: string;
  courierPosition: Coordinates | null;
  gpsUpdatedAt: string | null;
  routeDistanceKm: number | null;
  routeDurationMinutes: number | null;
  hasIncident: boolean;
};

type FilterKey = 'active' | 'preparing' | 'ready' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'incidents';

const OPERATIONAL_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'accepted', 'picked_up', 'in_transit'];
const COURIER_STATUSES = ['assigned', 'accepted', 'picked_up', 'in_transit'];

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'active', label: 'Todos activos' },
  { key: 'preparing', label: 'Preparando' },
  { key: 'ready', label: 'Listos' },
  { key: 'assigned', label: 'Asignados' },
  { key: 'picked_up', label: 'Recogidos' },
  { key: 'in_transit', label: 'En camino' },
  { key: 'delivered', label: 'Entregados' },
  { key: 'incidents', label: 'Incidentes' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Buscando repartidor',
  assigned: 'Repartidor asignado',
  accepted: 'Repartidor confirmado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-cyan-100 text-cyan-700',
  ready: 'bg-purple-100 text-purple-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  accepted: 'bg-violet-100 text-violet-700',
  picked_up: 'bg-teal-100 text-teal-700',
  in_transit: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

function validPoint(lat: unknown, lng: unknown): Coordinates | null {
  if (lat == null || lng == null) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { lat: latitude, lng: longitude }
    : null;
}

function routeForOrder(order: MapOrder) {
  if (!order.customerPosition || !order.pickupPosition) return [];
  if (order.status === 'picked_up' || order.status === 'in_transit') {
    return [order.courierPosition || order.pickupPosition, order.customerPosition];
  }
  if (order.status === 'assigned' || order.status === 'accepted') {
    return order.courierPosition
      ? [order.courierPosition, order.pickupPosition]
      : [order.pickupPosition, order.customerPosition];
  }
  return [order.pickupPosition, order.customerPosition];
}

function navigationUrl(order: MapOrder) {
  const origin = order.courierPosition || order.pickupPosition;
  const destination =
    order.status === 'picked_up' || order.status === 'in_transit'
      ? order.customerPosition
      : order.pickupPosition;
  if (!origin || !destination) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}

function isGpsStale(value: string | null) {
  if (!value) return true;
  return Date.now() - new Date(value).getTime() > 45_000;
}

export default function BusinessLiveMapPage() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Mi negocio');
  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (showSpinner = false) => {
      if (!profile?.id) return;
      if (showSpinner) setRefreshing(true);
      try {
        const id = businessId || (await businessService.getBusinessId(profile.id));
        if (!id) throw new Error('No se encontró el negocio asociado a esta cuenta');
        if (!businessId) setBusinessId(id);

        const supabase = getBrowserClient();
        const [{ data: businessRow }, businessOrders] = await Promise.all([
          supabase.from('businesses').select('name').eq('id', id).maybeSingle(),
          businessService.getBusinessOrders(id),
        ]);
        setBusinessName(businessRow?.name || 'Mi negocio');

        const relevant = businessOrders.filter((order) =>
          [...OPERATIONAL_STATUSES, 'delivered'].includes(order.status),
        );
        const orderIds = relevant.map((order) => order.id);
        if (orderIds.length === 0) {
          setOrders([]);
          setSelectedOrderId(null);
          setError('');
          return;
        }

        const [{ data: snapshots, error: snapshotsError }, { data: locations, error: locationsError }] =
          await Promise.all([
            supabase
              .from('orders')
              .select('id,pickup_address,pickup_lat,pickup_lng,delivery_address,delivery_lat,delivery_lng,route_distance_km,route_duration_minutes,metadata')
              .in('id', orderIds),
            supabase
              .from('driver_locations')
              .select('order_id,latitude,longitude,updated_at,created_at')
              .in('order_id', orderIds)
              .order('updated_at', { ascending: false }),
          ]);
        if (snapshotsError) throw new Error(snapshotsError.message);
        if (locationsError) throw new Error(locationsError.message);

        const snapshotByOrder = new Map(
          (snapshots ?? []).map((row) => [String(row.id), row]),
        );
        const courierByOrder = new Map<
          string,
          { position: Coordinates; updatedAt: string | null }
        >();
        for (const row of locations || []) {
          const orderId = String(row.order_id || '');
          const coordinate = validPoint(row.latitude, row.longitude);
          if (orderId && coordinate && !courierByOrder.has(orderId)) {
            courierByOrder.set(orderId, {
              position: coordinate,
              updatedAt: String(row.updated_at || row.created_at || '') || null,
            });
          }
        }

        const enriched = relevant.map<MapOrder>((order) => {
          const snapshot = snapshotByOrder.get(order.id);
          const courier = courierByOrder.get(order.id);
          const metadata =
            snapshot?.metadata && typeof snapshot.metadata === 'object'
              ? (snapshot.metadata as Record<string, unknown>)
              : {};
          return {
            ...order,
            customerPosition:
              validPoint(snapshot?.delivery_lat, snapshot?.delivery_lng) ||
              validPoint(order.delivery_latitude, order.delivery_longitude),
            pickupPosition: validPoint(snapshot?.pickup_lat, snapshot?.pickup_lng),
            pickupAddress: String(snapshot?.pickup_address || 'Local de origen no disponible'),
            delivery_address: String(snapshot?.delivery_address || order.delivery_address),
            courierPosition: courier?.position || null,
            gpsUpdatedAt: courier?.updatedAt || null,
            routeDistanceKm:
              snapshot?.route_distance_km == null
                ? null
                : Number(snapshot.route_distance_km),
            routeDurationMinutes:
              snapshot?.route_duration_minutes == null
                ? null
                : Number(snapshot.route_duration_minutes),
            hasIncident: Boolean(metadata.problem_reported),
          };
        });

        setOrders(enriched);
        setSelectedOrderId((current) => {
          if (current && enriched.some((order) => order.id === current)) return current;
          return (
            enriched.find((order) => COURIER_STATUSES.includes(order.status))?.id ||
            enriched.find((order) => OPERATIONAL_STATUSES.includes(order.status))?.id ||
            enriched[0]?.id ||
            null
          );
        });
        setError('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el mapa operativo');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessId, profile?.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!businessId) return;
    const supabase = getBrowserClient();
    const ordersChannel = supabase
      .channel(`business-live-orders-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` },
        () => void load(),
      )
      .subscribe();
    const locationsChannel = supabase
      .channel(`business-live-locations-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => void load())
      .subscribe();
    const timer = window.setInterval(() => void load(), 7_000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(locationsChannel);
    };
  }, [businessId, load]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter =
        filter === 'active'
          ? OPERATIONAL_STATUSES.includes(order.status)
          : filter === 'incidents'
            ? order.hasIncident
            : filter === 'assigned'
              ? ['assigned', 'accepted'].includes(order.status)
              : order.status === filter;
      if (!matchesFilter) return false;
      if (!term) return true;
      return `${order.order_number} ${order.customer_name} ${order.delivery_address} ${order.courier_name || ''} ${order.pickupAddress}`
        .toLowerCase()
        .includes(term);
    });
  }, [filter, orders, search]);

  const selected =
    visibleOrders.find((order) => order.id === selectedOrderId) || visibleOrders[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedOrderId) setSelectedOrderId(selected.id);
  }, [selected, selectedOrderId]);

  const mapPoints = useMemo<OpenStreetMapPoint[]>(() => {
    const points: OpenStreetMapPoint[] = [];
    const pickupKeys = new Set<string>();
    for (const order of visibleOrders) {
      if (order.pickupPosition) {
        const key = `${order.pickupPosition.lat.toFixed(6)},${order.pickupPosition.lng.toFixed(6)}`;
        if (!pickupKeys.has(key)) {
          pickupKeys.add(key);
          points.push({
            id: `pickup-${order.id}`,
            ...order.pickupPosition,
            label: `${businessName} · ${order.pickupAddress}`,
            color: '#F59E0B',
            kind: 'business',
          });
        }
      }
      if (order.customerPosition) {
        points.push({
          id: order.id,
          ...order.customerPosition,
          label: `${order.order_number} · ${order.customer_name}`,
          color: selected?.id === order.id ? '#2563EB' : '#10B981',
          kind: 'customer',
        });
      }
      if (order.courierPosition) {
        points.push({
          id: `courier-${order.id}`,
          ...order.courierPosition,
          label: `${order.courier_name || 'Repartidor'} · ${order.order_number}`,
          color: isGpsStale(order.gpsUpdatedAt) ? '#64748B' : '#7C3AED',
          kind: 'courier',
        });
      }
    }
    return points;
  }, [businessName, selected?.id, visibleOrders]);

  const route = useMemo(() => (selected ? routeForOrder(selected) : []), [selected]);
  const secondaryRoutes = useMemo<OpenStreetSecondaryRoute[]>(
    () =>
      visibleOrders
        .filter((order) => order.id !== selected?.id)
        .map((order) => ({
          id: order.id,
          points: routeForOrder(order),
          color:
            order.status === 'in_transit' || order.status === 'picked_up'
              ? '#10B981'
              : '#7C3AED',
        }))
        .filter((item) => item.points.length >= 2),
    [selected?.id, visibleOrders],
  );

  const followPointId = selected?.courierPosition
    ? `courier-${selected.id}`
    : selected?.customerPosition
      ? selected.id
      : selected?.pickupPosition
        ? `pickup-${selected.id}`
        : undefined;
  const selectedNavigationUrl = selected ? navigationUrl(selected) : null;

  return (
    <div className="flex min-h-[720px] flex-col overflow-hidden rounded-2xl border bg-card lg:h-[calc(100vh-7rem)] lg:flex-row">
      <div className="relative min-h-[500px] flex-1">
        <OpenStreetLiveMap
          points={mapPoints}
          route={route}
          secondaryRoutes={secondaryRoutes}
          center={
            selected?.courierPosition ||
            selected?.customerPosition ||
            selected?.pickupPosition || { lat: 11.2408, lng: -74.199 }
          }
          zoom={14}
          className="h-full min-h-[500px] w-full rounded-none"
          followPointId={followPointId}
          onPointClick={(id) => {
            const orderId = id.startsWith('courier-')
              ? id.replace('courier-', '')
              : id.startsWith('pickup-')
                ? id.replace('pickup-', '')
                : id;
            if (visibleOrders.some((order) => order.id === orderId)) setSelectedOrderId(orderId);
          }}
        />

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-xl bg-background/95 px-3 py-2 text-xs font-medium shadow-lg"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
        </button>

        {selected && (
          <div className="absolute bottom-3 left-3 right-3 z-[500] rounded-2xl bg-background/95 p-3 shadow-xl backdrop-blur sm:left-auto sm:w-80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Ruta seleccionada</p>
                <p className="font-black">#{selected.order_number}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_COLORS[selected.status] || 'bg-muted'}`}>
                {STATUS_LABELS[selected.status] || selected.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-muted/60 p-2"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-1 font-black">{selected.routeDurationMinutes ? `${selected.routeDurationMinutes} min` : 'Calculando'}</p></div>
              <div className="rounded-xl bg-muted/60 p-2"><Filter className="h-4 w-4 text-primary" /><p className="mt-1 font-black">{selected.routeDistanceKm ? `${selected.routeDistanceKm.toFixed(2)} km` : 'Sin distancia'}</p></div>
            </div>
            {selectedNavigationUrl && (
              <a href={selectedNavigationUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir navegación
              </a>
            )}
          </div>
        )}
      </div>

      <aside className="w-full border-t lg:w-[410px] lg:border-l lg:border-t-0">
        <div className="border-b p-4">
          <h2 className="font-black">Operación en vivo</h2>
          <p className="text-xs text-muted-foreground">{visibleOrders.length} pedidos visibles en el filtro actual</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filter === item.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pedido, cliente, sede o repartidor…" className="h-10 w-full rounded-xl border bg-background pl-10 pr-3 text-sm" />
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="max-h-[560px] overflow-y-auto lg:h-[calc(100%-170px)] lg:max-h-none">
          {loading ? (
            <SkeletonList />
          ) : visibleOrders.length === 0 ? (
            <div className="p-10 text-center"><Package className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Sin pedidos para este filtro</p></div>
          ) : (
            visibleOrders.map((order) => {
              const stale = order.courierPosition && isGpsStale(order.gpsUpdatedAt);
              return (
                <button key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`w-full border-b p-4 text-left transition hover:bg-muted/40 ${selected?.id === order.id ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-sm font-black">#{order.order_number}</p><p className="mt-1 text-sm font-semibold">{order.customer_name}</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_COLORS[order.status] || 'bg-muted'}`}>{STATUS_LABELS[order.status] || order.status}</span>
                  </div>
                  <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground"><Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />{order.pickupAddress}</p>
                  <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />{order.delivery_address}</p>
                  {order.courier_name && <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${stale ? 'text-warning' : 'text-primary'}`}><Bike className="h-3.5 w-3.5" />{order.courier_name}{order.courierPosition ? stale ? ' · GPS sin actualizar' : ' · GPS activo' : ' · esperando GPS'}</p>}
                  {order.hasIncident && <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">Incidente reportado</p>}
                  <div className="mt-3 flex items-center justify-between"><p className="text-sm font-black">{formatCurrency(order.total_amount)}</p><p className="text-[10px] text-muted-foreground">{order.payment_method === 'cash' ? 'Efectivo' : order.payment_method === 'transfer' ? 'Transferencia' : 'Pago no definido'}</p></div>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
