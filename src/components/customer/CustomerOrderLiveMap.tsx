'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin, Navigation, Radio, Route } from 'lucide-react';
import { getBrowserClient } from '@/lib/db/supabase';
import {
  OpenStreetLiveMap,
  type OpenStreetMapPoint,
  type ResolvedRoute,
} from '@/components/tracking/maps/OpenStreetLiveMap';

type Point = { lat: number; lng: number };

interface CustomerOrderLiveMapProps {
  orderId: string;
  courierId: string | null;
  status: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  storedDistanceKm?: number | null;
  estimatedDeliveryTime?: string | null;
}

const SANTA_MARTA: Point = { lat: 11.2408, lng: -74.199 };

function point(lat: number | null, lng: number | null): Point | null {
  if (lat == null || lng == null) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : null;
}

function haversineKm(a: Point, b: Point) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function CustomerOrderLiveMap({
  orderId,
  courierId,
  status,
  pickupAddress,
  pickupLat,
  pickupLng,
  deliveryAddress,
  deliveryLat,
  deliveryLng,
  storedDistanceKm,
  estimatedDeliveryTime,
}: CustomerOrderLiveMapProps) {
  const [courierLocation, setCourierLocation] = useState<Point | null>(null);
  const [resolvedRoute, setResolvedRoute] = useState<ResolvedRoute | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);

  const pickup = useMemo(() => point(pickupLat, pickupLng), [pickupLat, pickupLng]);
  const delivery = useMemo(() => point(deliveryLat, deliveryLng), [deliveryLat, deliveryLng]);
  const goingToCustomer = status === 'picked_up' || status === 'in_transit';
  const destinationPoint = goingToCustomer ? delivery : pickup;
  const originPoint = courierLocation || (goingToCustomer ? pickup : null);

  useEffect(() => {
    if (!courierId) {
      setCourierLocation(null);
      setLocationUpdatedAt(null);
      return;
    }
    const supabase = getBrowserClient();

    const loadLatest = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('latitude,longitude,updated_at,created_at')
        .eq('driver_id', courierId)
        .eq('order_id', orderId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.latitude != null && data?.longitude != null) {
        setCourierLocation({ lat: Number(data.latitude), lng: Number(data.longitude) });
        setLocationUpdatedAt(String(data.updated_at || data.created_at));
      }
    };

    void loadLatest();
    const channel = supabase
      .channel(`customer-order-location-${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.latitude != null && row.longitude != null) {
            setCourierLocation({ lat: Number(row.latitude), lng: Number(row.longitude) });
            setLocationUpdatedAt(String(row.updated_at || row.created_at || new Date().toISOString()));
          }
        },
      )
      .subscribe();

    const polling = window.setInterval(() => void loadLatest(), 7_000);
    return () => {
      window.clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [courierId, orderId]);

  const mapPoints = useMemo<OpenStreetMapPoint[]>(
    () => [
      ...(pickup
        ? [{ id: 'pickup', ...pickup, label: `Recogida: ${pickupAddress}`, color: '#F97316', kind: 'pickup' as const }]
        : []),
      ...(delivery
        ? [{ id: 'delivery', ...delivery, label: `Entrega: ${deliveryAddress}`, color: '#4F46E5', kind: 'delivery' as const }]
        : []),
      ...(courierLocation
        ? [{ id: 'courier', ...courierLocation, label: 'Tu pedido se mueve aquí', color: '#7C3AED', kind: 'courier' as const }]
        : []),
    ],
    [courierLocation, delivery, deliveryAddress, pickup, pickupAddress],
  );

  const liveRoute = useMemo(
    () => (originPoint && destinationPoint ? [originPoint, destinationPoint] : []),
    [destinationPoint, originPoint],
  );

  const handleRouteResolved = useCallback((nextRoute: ResolvedRoute) => {
    setResolvedRoute(nextRoute);
  }, []);

  const fallbackDistance = originPoint && destinationPoint
    ? haversineKm(originPoint, destinationPoint)
    : storedDistanceKm ?? null;
  const distanceKm = resolvedRoute?.distanceKm ?? fallbackDistance;
  const routeMinutes = resolvedRoute?.durationMinutes;
  const fallbackDuration = distanceKm == null ? null : Math.max(2, Math.ceil((distanceKm / 25) * 60));
  const storedMinutes = estimatedDeliveryTime
    ? Math.max(0, Math.ceil((new Date(estimatedDeliveryTime).getTime() - Date.now()) / 60_000))
    : null;
  const durationMinutes = routeMinutes ?? fallbackDuration ?? storedMinutes;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:rounded-3xl">
      <div className="border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Seguimiento en vivo</p>
            <h2 className="mt-1 text-lg font-black">
              {courierId ? (goingToCustomer ? 'Tu pedido va hacia ti' : 'El repartidor va a recoger tu pedido') : 'Buscando repartidor'}
            </h2>
          </div>
          {courierLocation && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> GPS activo
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
            <Route className="h-4 w-4 text-primary" />
            <p className="mt-1 truncate text-sm font-black">{distanceKm != null ? `${distanceKm.toFixed(2)} km` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Restante</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
            <Clock3 className="h-4 w-4 text-primary" />
            <p className="mt-1 text-sm font-black">{durationMinutes != null ? `${durationMinutes} min` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Estimado</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
            <Navigation className="h-4 w-4 text-primary" />
            <p className="mt-1 truncate text-sm font-black">{goingToCustomer ? 'Entrega' : courierId ? 'Recogida' : 'Asignando'}</p>
            <p className="text-[10px] text-muted-foreground">Etapa</p>
          </div>
        </div>
      </div>

      <div className="relative h-[330px] bg-muted sm:h-[420px]">
        <OpenStreetLiveMap
          points={mapPoints}
          route={liveRoute}
          center={courierLocation || pickup || delivery || SANTA_MARTA}
          zoom={15}
          className="absolute inset-0 h-full w-full rounded-none"
          followPointId={courierLocation ? 'courier' : undefined}
          onRouteResolved={handleRouteResolved}
        />
      </div>

      <div className="grid gap-3 border-t p-4 sm:grid-cols-2">
        <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Recogida</p><p className="text-xs font-semibold">{pickupAddress}</p></div></div>
        <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" /><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Entrega</p><p className="text-xs font-semibold">{deliveryAddress}</p></div></div>
      </div>

      {locationUpdatedAt && <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">Última ubicación: {new Date(locationUpdatedAt).toLocaleTimeString('es-CO')}</p>}
    </section>
  );
}
