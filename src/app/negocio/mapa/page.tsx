'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapsProvider, useMaps } from '@/contexts/MapsContext';
import { businessService, type BusinessOrder } from '@/services/business';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonMap, SkeletonList } from '@/components/ui/skeleton';
import { Bike, MapPin, Navigation, Package, RefreshCw, Search } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface MapOrder extends BusinessOrder {
  customerPosition: Coordinates | null;
  courierPosition: Coordinates | null;
}

const ACTIVE_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Publicado',
  assigned: 'Asignado',
  accepted: 'Aceptado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
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
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (!window.google?.maps || !address || address === 'Dirección no disponible') return null;
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      const location = results?.[0]?.geometry.location;
      if (status === 'OK' && location) {
        resolve({ lat: location.lat(), lng: location.lng() });
      } else {
        resolve(null);
      }
    });
  });
}

function BusinessMapInner() {
  const { isReady } = useMaps();
  const { profile } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessPosition, setBusinessPosition] = useState<Coordinates | null>(null);
  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (showSpinner = false) => {
    if (!profile?.id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const id = businessId || (await businessService.getBusinessId(profile.id));
      if (!id) {
        setOrders([]);
        setError('No se encontró el negocio asociado a esta cuenta.');
        return;
      }
      if (!businessId) setBusinessId(id);

      const supabase = getBrowserClient();
      const [{ data: businessAddress }, allOrders] = await Promise.all([
        supabase
          .from('business_addresses')
          .select('street_address,city,state_province,latitude,longitude')
          .eq('business_id', id)
          .eq('is_primary', true)
          .is('deleted_at', null)
          .maybeSingle(),
        businessService.getBusinessOrders(id),
      ]);

      let localBusinessPosition: Coordinates | null = null;
      if (businessAddress?.latitude != null && businessAddress?.longitude != null) {
        localBusinessPosition = {
          lat: Number(businessAddress.latitude),
          lng: Number(businessAddress.longitude),
        };
      } else if (isReady && businessAddress) {
        localBusinessPosition = await geocodeAddress(
          [businessAddress.street_address, businessAddress.city, businessAddress.state_province]
            .filter(Boolean)
            .join(', '),
        );
      }
      setBusinessPosition(localBusinessPosition);

      const activeOrders = allOrders.filter((order) => ACTIVE_STATUSES.includes(order.status));
      const courierIds = [
        ...new Set(activeOrders.map((order) => order.courier_id).filter((id): id is string => Boolean(id))),
      ];
      const courierLocationMap = new Map<string, Coordinates>();
      if (courierIds.length > 0) {
        const { data: driverRows } = await supabase
          .from('driver_locations')
          .select('driver_id,latitude,longitude,created_at')
          .in('driver_id', courierIds)
          .order('created_at', { ascending: false });
        for (const row of driverRows || []) {
          const driverId = String(row.driver_id);
          if (!courierLocationMap.has(driverId)) {
            courierLocationMap.set(driverId, {
              lat: Number(row.latitude),
              lng: Number(row.longitude),
            });
          }
        }
      }

      const enriched: MapOrder[] = [];
      for (const order of activeOrders) {
        let customerPosition: Coordinates | null = null;
        if (order.delivery_latitude != null && order.delivery_longitude != null) {
          customerPosition = {
            lat: order.delivery_latitude,
            lng: order.delivery_longitude,
          };
        } else if (isReady) {
          customerPosition = await geocodeAddress(order.delivery_address);
        }
        enriched.push({
          ...order,
          customerPosition,
          courierPosition: order.courier_id
            ? courierLocationMap.get(order.courier_id) || null
            : null,
        });
      }

      setOrders(enriched);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el mapa operativo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, isReady, profile?.id]);

  useEffect(() => {
    if (!isReady) return;
    void loadOrders();
  }, [isReady, loadOrders]);

  useEffect(() => {
    if (!businessId) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`business-map-orders-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${businessId}`,
        },
        () => void loadOrders(),
      )
      .subscribe();
    const timer = window.setInterval(() => void loadOrders(), 20000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [businessId, loadOrders]);

  useEffect(() => {
    if (!isReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 11.2408, lng: -74.199 },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    directionsRef.current = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#2563EB', strokeWeight: 5 },
    });
  }, [isReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    directionsRef.current?.set('directions', null);
    const bounds = new google.maps.LatLngBounds();
    let points = 0;

    if (businessPosition) {
      const marker = new google.maps.Marker({
        position: businessPosition,
        map,
        title: 'Olma Wings and Smokehouse',
        label: { text: 'O', color: '#ffffff', fontWeight: '700' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(marker);
      bounds.extend(businessPosition);
      points += 1;
    }

    for (const order of orders) {
      if (order.customerPosition) {
        const marker = new google.maps.Marker({
          position: order.customerPosition,
          map,
          title: `Ticket ${order.order_number} · ${order.customer_name}`,
          label: { text: order.order_number.slice(-4), color: '#ffffff', fontSize: '10px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: selectedOrder === order.id ? 18 : 15,
            fillColor: selectedOrder === order.id ? '#2563EB' : '#10B981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
        marker.addListener('click', () => setSelectedOrder(order.id));
        markersRef.current.push(marker);
        bounds.extend(order.customerPosition);
        points += 1;
      }

      if (order.courierPosition) {
        const marker = new google.maps.Marker({
          position: order.courierPosition,
          map,
          title: `${order.courier_name || 'Repartidor'} · ${order.order_number}`,
          label: { text: 'R', color: '#ffffff', fontWeight: '700' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#7C3AED',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
        markersRef.current.push(marker);
        bounds.extend(order.courierPosition);
        points += 1;
      }
    }

    const selected = orders.find((order) => order.id === selectedOrder);
    if (selected?.customerPosition && businessPosition) {
      const origin = selected.courierPosition || businessPosition;
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin,
          destination: selected.customerPosition,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result) directionsRef.current?.setDirections(result);
        },
      );
      map.panTo(selected.customerPosition);
      map.setZoom(15);
    } else if (points > 0) {
      map.fitBounds(bounds, 70);
    }
  }, [businessPosition, orders, selectedOrder]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      `${order.order_number} ${order.customer_name} ${order.delivery_address}`
        .toLowerCase()
        .includes(term),
    );
  }, [orders, search]);

  return (
    <div className="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border bg-card lg:h-[calc(100vh-7rem)] lg:flex-row">
      <div className="relative min-h-[480px] flex-1">
        {!isReady && <SkeletonMap />}
        <div ref={mapRef} className={`h-full min-h-[480px] w-full ${!isReady ? 'hidden' : ''}`} />
        <button
          type="button"
          onClick={() => void loadOrders(true)}
          disabled={refreshing}
          className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-xl bg-background/90 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
        </button>
        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
          <span className="rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow">🟠 Negocio</span>
          <span className="rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow">🟢 Cliente</span>
          <span className="rounded-lg bg-background/90 px-2 py-1 text-[10px] shadow">🟣 Repartidor</span>
        </div>
      </div>

      <aside className="w-full border-t lg:w-[390px] lg:border-l lg:border-t-0">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Tickets activos</h2>
              <p className="text-xs text-muted-foreground">{orders.length} pedidos en operación</p>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ticket, cliente o dirección..."
              className="h-10 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"
            />
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="max-h-[520px] overflow-y-auto lg:h-[calc(100%-116px)] lg:max-h-none">
          {loading ? (
            <SkeletonList />
          ) : filteredOrders.length === 0 ? (
            <div className="p-10 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Sin tickets activos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Los pedidos nuevos aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                className={`w-full border-b p-4 text-left transition-colors hover:bg-muted/40 ${
                  selectedOrder === order.id ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">#{order.order_number}</p>
                    <p className="mt-1 text-sm font-medium">{order.customer_name}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_COLORS[order.status] || 'bg-muted'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold">{formatCurrency(order.total_amount)}</p>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  <MapPin className="mr-1 inline h-3 w-3" /> {order.delivery_address}
                </p>
                {order.courier_name ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Bike className="mr-1 inline h-3 w-3 text-primary" /> {order.courier_name}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-warning">Esperando repartidor</p>
                )}
                {selectedOrder === order.id && order.customerPosition && businessPosition && (
                  <a
                    href={`https://www.google.com/maps/dir/${businessPosition.lat},${businessPosition.lng}/${order.customerPosition.lat},${order.customerPosition.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                  >
                    <Navigation className="h-3 w-3" /> Abrir ruta
                  </a>
                )}
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

export default function NegocioMapaPage() {
  return (
    <MapsProvider>
      <BusinessMapInner />
    </MapsProvider>
  );
}
