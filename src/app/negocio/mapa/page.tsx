'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { MapsProvider, useMaps } from '@/contexts/MapsContext';
import { SkeletonMap, SkeletonCard, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { getBrowserClient } from '@/lib/db/supabase';
import { MapPin, Navigation, Bike, Package, RefreshCw } from 'lucide-react';

interface RawOrder {
  id: string;
  status: string;
  created_at: string;
  total_amount: number;
  customer: { id: string; full_name: string | null } | null;
  courier: { id: string; full_name: string | null } | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
}

interface OrderItem {
  id: string;
  status: string;
  created_at: string;
  total_amount: number;
  customer: { id: string; full_name?: string };
  courier?: { id: string; full_name?: string };
  delivery_lat?: number;
  delivery_lng?: number;
  business_lat?: number;
  business_lng?: number;
  courier_lat?: number;
  courier_lng?: number;
}

function BusinessMapInner() {
  const { isReady } = useMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const { profile } = useAuth();

  const fetchOrders = useCallback(async (businessId: string) => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, created_at, total_amount,
        customer:customer_id ( id, full_name ),
        courier:courier_id ( id, full_name ),
        delivery_latitude, delivery_longitude
      `)
      .eq('business_id', businessId)
      .in('status', ['confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: false });
    const rawData = (data || []) as unknown as RawOrder[];
    const items: OrderItem[] = rawData.map((o) => ({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      total_amount: o.total_amount,
      customer: o.customer ? { id: o.customer.id, full_name: o.customer.full_name ?? undefined } : { id: '' },
      courier: o.courier ? { id: o.courier.id, full_name: o.courier.full_name ?? undefined } : undefined,
      delivery_lat: o.delivery_latitude ?? undefined,
      delivery_lng: o.delivery_longitude ?? undefined,
    }));
    if (items.some(o => o.courier?.id)) {
      const courierIds = [...new Set(items.filter(o => o.courier?.id).map(o => o.courier!.id))];
      const { data: locs } = await supabase
        .from('driver_locations')
        .select('profile_id, latitude, longitude')
        .in('profile_id', courierIds);
      const locMap = new Map<string, { latitude: number; longitude: number }>();
      for (const l of locs || []) {
        const r = l as { profile_id: string; latitude: number; longitude: number };
        locMap.set(r.profile_id, { latitude: r.latitude, longitude: r.longitude });
      }
      for (const o of items) {
        if (o.courier?.id) {
          const loc = locMap.get(o.courier.id);
          if (loc) { o.courier_lat = loc.latitude; o.courier_lng = loc.longitude; }
        }
      }
    }
    const addrRow = await supabase
      .from('business_addresses')
      .select('latitude, longitude')
      .eq('business_id', businessId)
      .eq('is_primary', true)
      .maybeSingle() as unknown as { data: { latitude: number; longitude: number } | null };
    const businessData = addrRow.data;
    if (businessData) {
      for (const o of items) { o.business_lat = businessData.latitude; o.business_lng = businessData.longitude; }
    }
    return items;
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getBrowserClient();
    (async () => {
      const raw = await supabase.from('businesses').select('id').eq('owner_id', profile.id).single() as unknown as { data: { id: string } | null };
      const business = raw.data;
      if (!business) { setOrders([]); setLoading(false); return; }
      const items = await fetchOrders(business.id);
      setOrders(items);
      setLoading(false);
    })();
  }, [profile?.id, fetchOrders]);

  const handleReload = async () => {
    setLoading(true);
    if (!profile?.id) { setOrders([]); setLoading(false); return; }
    const supabase = getBrowserClient();
    const raw = await supabase.from('businesses').select('id').eq('owner_id', profile.id).single() as unknown as { data: { id: string } | null };
    const business = raw.data;
    if (!business) { setOrders([]); setLoading(false); return; }
    const items = await fetchOrders(business.id);
    setOrders(items);
    setLoading(false);
  };

  const initMap = useCallback(() => {
    if (!isReady || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 11.0045, lng: -74.8280 },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
    });

    directionsRef.current = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#6366F1', strokeWeight: 4 },
    });
  }, [isReady]);

  useEffect(() => { initMap(); }, [initMap]);

  useEffect(() => {
    if (!mapInstanceRef.current || orders.length === 0) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    for (const order of orders) {
      if (order.business_lat && order.business_lng) {
        const bMarker = new google.maps.Marker({
          position: { lat: order.business_lat, lng: order.business_lng },
          map: mapInstanceRef.current,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#F59E0B', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          title: 'Mi negocio',
        });
        markersRef.current.push(bMarker);
        bounds.extend({ lat: order.business_lat, lng: order.business_lng });
      }

      if (order.delivery_lat && order.delivery_lng) {
        const cMarker = new google.maps.Marker({
          position: { lat: order.delivery_lat, lng: order.delivery_lng },
          map: mapInstanceRef.current,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#10B981', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          title: order.customer?.full_name || 'Cliente',
        });
        markersRef.current.push(cMarker);
        bounds.extend({ lat: order.delivery_lat, lng: order.delivery_lng });
      }

      if (order.courier_lat && order.courier_lng) {
        const dMarker = new google.maps.Marker({
          position: { lat: order.courier_lat, lng: order.courier_lng },
          map: mapInstanceRef.current,
          icon: { url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366F1" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#6366F1" stroke="white" stroke-width="2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">R</text></svg>') },
          title: order.courier?.full_name || 'Repartidor',
        });
        markersRef.current.push(dMarker);
        bounds.extend({ lat: order.courier_lat, lng: order.courier_lng });

        if (selectedOrder === order.id && order.delivery_lat && order.delivery_lng) {
          const svc = new google.maps.DirectionsService();
          svc.route({
            origin: { lat: order.courier_lat, lng: order.courier_lng },
            destination: { lat: order.delivery_lat, lng: order.delivery_lng },
            travelMode: google.maps.TravelMode.DRIVING,
          }, (result, status) => {
            if (status === 'OK' && result && directionsRef.current) {
              directionsRef.current.setDirections(result);
            }
          });
        }
      }
    }

    if (!selectedOrder) mapInstanceRef.current.fitBounds(bounds);
  }, [orders, selectedOrder]);

  const statusColors: Record<string, string> = {
    confirmed: 'bg-amber-100 text-amber-700', preparing: 'bg-blue-100 text-blue-700',
    ready: 'bg-purple-100 text-purple-700', assigned: 'bg-indigo-100 text-indigo-700',
    in_transit: 'bg-emerald-100 text-emerald-700', picked_up: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <div className="relative flex-1">
        {!isReady && (
          <div className="flex h-full items-center justify-center bg-muted/20">
            <SkeletonMap />
          </div>
        )}
        <div ref={mapRef} className={`h-full w-full ${!isReady ? 'hidden' : ''}`} />
        <button onClick={handleReload} className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-xl bg-background/80 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm hover:bg-background">
          <RefreshCw className="h-3 w-3" /> Actualizar
        </button>
        <div className="absolute bottom-3 left-3 z-10 flex gap-2">
          <span className="flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-[10px] shadow-lg backdrop-blur-sm"><span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Negocio</span>
          <span className="flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-[10px] shadow-lg backdrop-blur-sm"><span className="h-2 w-2 rounded-full bg-[#10B981]" /> Cliente</span>
          <span className="flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-[10px] shadow-lg backdrop-blur-sm"><span className="h-2 w-2 rounded-full bg-[#6366F1]" /> Repartidor</span>
        </div>
      </div>

      <div className="w-full border-t border-border lg:w-80 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">Pedidos activos ({orders.length})</h2>
        </div>
        <div className="h-[40vh] overflow-y-auto lg:h-[calc(100vh-9rem)]">
          {loading ? <SkeletonList /> : orders.length === 0 ? (
            <EmptyState icon={<Package className="h-5 w-5" />} title="Sin pedidos activos" description="No hay pedidos en curso." />
          ) : orders.map(order => (
            <button key={order.id} onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
              className={`w-full border-b border-border/30 p-4 text-left transition-colors hover:bg-muted/30 ${selectedOrder === order.id ? 'bg-primary/5' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">#{order.id.slice(0, 8)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>
                  {order.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">${order.total_amount.toLocaleString()}</p>
              {order.courier && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Bike className="h-3 w-3 text-primary" />
                  {order.courier.full_name || 'Repartidor'}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 text-emerald-500" />
                {order.customer.full_name || 'Cliente'}
              </div>
              {selectedOrder === order.id && order.delivery_lat && order.business_lat && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Navigation className="h-3 w-3 text-primary" />
                  <a
                    href={`https://www.google.com/maps/dir/${order.business_lat},${order.business_lng}/${order.delivery_lat},${order.delivery_lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Ver ruta en Maps
                  </a>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BusinessMapPage() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.role !== 'merchant') router.push('/login');
  }, [profile, router]);

  if (!profile) return <SkeletonCard />;

  return (
    <MapsProvider>
      <BusinessMapInner />
    </MapsProvider>
  );
}
