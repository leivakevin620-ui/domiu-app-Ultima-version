'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapsProvider, useMaps } from '@/contexts/MapsContext';
import dynamic from 'next/dynamic';
const DynamicMapWrapper = dynamic(() => import('@/components/tracking/maps/DynamicMapWrapper').then(m => ({ default: m.DynamicMapWrapper })), {
  ssr: false,
  loading: () => <SkeletonMap className="h-[400px]" />,
});
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonMap } from '@/components/ui/skeleton';
import { PageTitle } from '@/components/ui/page-title';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Clock, Route } from 'lucide-react';

interface RawOrderData {
  id: string;
  order_number: string;
  status: string;
  business: { id: string; name: string; business_addresses: { latitude: number; longitude: number }[] } | null;
  customer: { id: string; first_name: string | null; last_name: string | null } | null;
  courier: { first_name: string | null; last_name: string | null } | null;
  driver_locations: { driver_id: string; latitude: number; longitude: number }[] | null;
}

interface MapOrder {
  id: string;
  order_number: string;
  business_name: string;
  customer_name: string;
  status: string;
  business_lat: number;
  business_lng: number;
  customer_lat?: number;
  customer_lng?: number;
  driver_lat?: number;
  driver_lng?: number;
  driver_id?: string;
  driver_name?: string;
  eta?: number;
}

type FilterStatus = 'all' | 'active' | 'delivering';

function AdminMapContent() {
  const { isReady } = useMaps();
  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedOrder, setSelectedOrder] = useState<MapOrder | null>(null);
  const [search, setSearch] = useState('');
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [showRoute, setShowRoute] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();

    const fetchOrders = () => supabase.from('orders')
      .select(`
        id, order_number, status,
        business:businesses(id, name, business_addresses!inner(latitude, longitude)),
        customer:profiles!customer_id(id, first_name, last_name),
        courier:profiles!courier_id(first_name, last_name),
        driver_locations(driver_id, latitude, longitude)
      `)
      .in('status', ['confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data: ordersData }) => {
        const mapped: MapOrder[] = ((ordersData ?? []) as unknown as RawOrderData[]).map(o => ({
          id: o.id,
          order_number: o.order_number,
          business_name: o.business?.name ?? '',
          customer_name: o.customer ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim() : '',
          status: o.status,
          business_lat: o.business?.business_addresses?.[0]?.latitude ?? 11.240,
          business_lng: o.business?.business_addresses?.[0]?.longitude ?? -74.211,
          driver_lat: o.driver_locations?.[0]?.latitude,
          driver_lng: o.driver_locations?.[0]?.longitude,
          driver_id: o.driver_locations?.[0]?.driver_id,
          driver_name: o.courier ? `${o.courier.first_name ?? ''} ${o.courier.last_name ?? ''}`.trim() : undefined,
        }));
        setOrders(mapped);
        setLoading(false);
      });

    fetchOrders();

    const channel = supabase.channel('admin-mapa-drivers')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        () => { fetchOrders(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    let result = orders;
    if (filter === 'active') result = result.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status));
    if (filter === 'delivering') result = result.filter(o => ['assigned', 'picked_up', 'in_transit'].includes(o.status));
    if (search) result = result.filter(o =>
      o.business_name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toLowerCase().includes(search.toLowerCase()),
    );
    return result;
  }, [orders, filter, search]);

  useEffect(() => {
    if (!mapRef.current || !isReady || filtered.length === 0) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    const maps = window.google.maps;
    const bounds = new maps.LatLngBounds();

    filtered.forEach(o => {
      const bizPos = { lat: o.business_lat, lng: o.business_lng };
      const bizMarker = new maps.Marker({
        position: bizPos,
        map: mapRef.current,
        icon: {
          url: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#F97316" stroke="white" stroke-width="2"/><text x="14" y="18" font-size="10" text-anchor="middle" fill="white" font-weight="bold">N</text></svg>`),
          scaledSize: new maps.Size(28, 28),
        },
        title: o.business_name,
      });
      bizMarker.addListener('click', () => setSelectedOrder(o));
      markersRef.current.push(bizMarker);
      bounds.extend(bizPos);

      if (o.driver_lat && o.driver_lng) {
        const driverPos = { lat: o.driver_lat, lng: o.driver_lng };
        const driverMarker = new maps.Marker({
          position: driverPos,
          map: mapRef.current,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#6366F1',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2.5,
          },
          title: o.driver_name ?? 'Repartidor',
        });
        markersRef.current.push(driverMarker);
        bounds.extend(driverPos);
      }
    });

    mapRef.current.fitBounds(bounds, 60);
  }, [filtered, isReady]);

  // Draw route polyline when routePoints change
  useEffect(() => {
    if (!mapRef.current || !isReady || routePoints.length < 2 || !showRoute) {
      if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
      return;
    }
    const maps = window.google.maps;
    if (polylineRef.current) polylineRef.current.setMap(null);
    polylineRef.current = new maps.Polyline({
      path: routePoints,
      geodesic: true,
      strokeColor: '#6366F1',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map: mapRef.current,
    });
    const bounds = new maps.LatLngBounds();
    routePoints.forEach(p => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 60);
  }, [routePoints, showRoute, isReady]);

  const handleShowRoute = useCallback(async (driverId: string) => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from('driver_locations')
      .select('latitude, longitude')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data && data.length >= 2) {
      setRoutePoints(data.map(d => ({ lat: d.latitude, lng: d.longitude })));
      setShowRoute(true);
    }
  }, []);

  const statusColors: Record<string, string> = {
    confirmed: 'bg-blue-500', preparing: 'bg-purple-500', ready: 'bg-green-500',
    assigned: 'bg-indigo-500', picked_up: 'bg-cyan-500', in_transit: 'bg-amber-500',
  };

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'delivering', label: 'En reparto' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <PageTitle title="Mapa en Vivo" description="Monitorea todos los pedidos, repartidores y negocios en tiempo real" />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  filter === f.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {f.label} ({f.key === 'all' ? orders.length : orders.filter(o => f.key === 'active' ? ['confirmed', 'preparing', 'ready'].includes(o.status) : ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length})
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar negocio, cliente o pedido..."
              className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Negocio</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Repartidor</span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-[500px] lg:h-[600px] rounded-2xl overflow-hidden border border-border/30">
              <DynamicMapWrapper
                config={{ center: { lat: 11.240, lng: -74.211 }, zoom: 12 }}
                className="w-full h-full"
                onLoad={m => { mapRef.current = m; }}
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {loading ? (
              <SkeletonMap />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Globe className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hay pedidos activos</p>
              </div>
            ) : (
              <AnimatePresence>
                {filtered.map((o, i) => (
                  <motion.button
                    key={o.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => {
                      setSelectedOrder(o);
                      if (mapRef.current) {
                        mapRef.current.panTo({ lat: o.business_lat, lng: o.business_lng });
                        mapRef.current.setZoom(15);
                      }
                    }}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      selectedOrder?.id === o.id
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border/20 bg-card/30 hover:border-border/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{o.business_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.order_number}</p>
                        {o.driver_name && <p className="text-xs text-muted-foreground">🛵 {o.driver_name}</p>}
                      </div>
                      <span className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${statusColors[o.status] ?? 'bg-muted'}`} />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground capitalize">
                      <Clock className="h-3 w-3" /> {o.status}
                    </div>
                    {o.driver_id && o.driver_lat && o.driver_lng && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowRoute(o.driver_id!); }}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-100"
                      >
                        <Route className="h-3 w-3" /> Ver ruta
                      </button>
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminMapPage() {
  return (
    <MapsProvider>
      <AdminMapContent />
    </MapsProvider>
  );
}
