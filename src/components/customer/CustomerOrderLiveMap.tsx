'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Clock3, MapPin, Navigation, Radio, Route } from 'lucide-react';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonMap } from '@/components/ui/skeleton';

const DynamicMapWrapper = dynamic(
  () => import('@/components/tracking/maps/DynamicMapWrapper').then((module) => module.DynamicMapWrapper),
  { ssr: false, loading: () => <SkeletonMap className="h-[360px]" /> },
);

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
  return lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)
    ? null
    : { lat, lng };
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
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [courierLocation, setCourierLocation] = useState<Point | null>(null);
  const [eta, setEta] = useState<{ distance: string; duration: string } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const pickup = useMemo(() => point(pickupLat, pickupLng), [pickupLat, pickupLng]);
  const delivery = useMemo(() => point(deliveryLat, deliveryLng), [deliveryLat, deliveryLng]);
  const goingToCustomer = status === 'picked_up' || status === 'in_transit';
  const destination: Point | string = goingToCustomer
    ? delivery || deliveryAddress
    : pickup || pickupAddress;
  const origin: Point | string = courierLocation || pickup || pickupAddress;

  useEffect(() => {
    if (!courierId) return;
    const supabase = getBrowserClient();

    const loadLatest = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('latitude,longitude,created_at')
        .eq('driver_id', courierId)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.latitude != null && data?.longitude != null) {
        setCourierLocation({ lat: Number(data.latitude), lng: Number(data.longitude) });
        setLocationUpdatedAt(String(data.created_at));
      }
    };

    void loadLatest();
    const channel = supabase
      .channel(`customer-order-location-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.latitude != null && row.longitude != null) {
            setCourierLocation({ lat: Number(row.latitude), lng: Number(row.longitude) });
            setLocationUpdatedAt(String(row.created_at || new Date().toISOString()));
          }
        },
      )
      .subscribe();

    const polling = window.setInterval(() => void loadLatest(), 12_000);
    return () => {
      window.clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [courierId, orderId]);

  useEffect(() => {
    if (!map || !window.google?.maps || !pickupAddress || !deliveryAddress) return;
    directionsRef.current?.setMap(null);

    const renderer = new google.maps.DirectionsRenderer({
      map,
      preserveViewport: false,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: goingToCustomer ? '#4F46E5' : '#F97316',
        strokeWeight: 6,
        strokeOpacity: 0.9,
      },
    });
    const service = new google.maps.DirectionsService();
    let active = true;

    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date() },
      },
      (result, routeStatus) => {
        if (!active) return;
        if (routeStatus === 'OK' && result) {
          renderer.setDirections(result);
          directionsRef.current = renderer;
          const leg = result.routes?.[0]?.legs?.[0];
          setEta({
            distance: leg?.distance?.text || '',
            duration: leg?.duration_in_traffic?.text || leg?.duration?.text || 'Calculando',
          });
        } else {
          renderer.setMap(null);
          setEta(null);
        }
      },
    );

    return () => {
      active = false;
      renderer.setMap(null);
    };
  }, [destination, goingToCustomer, map, origin, pickupAddress, deliveryAddress]);

  const fallbackMinutes = estimatedDeliveryTime
    ? Math.max(0, Math.ceil((new Date(estimatedDeliveryTime).getTime() - Date.now()) / 60_000))
    : null;

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="border-b p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Seguimiento en vivo</p>
            <h2 className="mt-1 text-lg font-black">
              {courierId
                ? goingToCustomer
                  ? 'Tu pedido va hacia ti'
                  : 'El repartidor va a recoger tu pedido'
                : 'Buscando repartidor'}
            </h2>
          </div>
          {courierLocation && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> GPS activo
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <Route className="h-4 w-4 text-primary" />
            <p className="mt-1 text-sm font-black">{eta?.distance || (storedDistanceKm ? `${storedDistanceKm.toFixed(2)} km` : 'Calculando')}</p>
            <p className="text-[10px] text-muted-foreground">Distancia</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <Clock3 className="h-4 w-4 text-primary" />
            <p className="mt-1 text-sm font-black">{eta?.duration || (fallbackMinutes != null ? `${fallbackMinutes} min` : 'Calculando')}</p>
            <p className="text-[10px] text-muted-foreground">Tiempo estimado</p>
          </div>
          <div className="col-span-2 rounded-xl bg-muted/60 p-3 sm:col-span-1">
            <Navigation className="h-4 w-4 text-primary" />
            <p className="mt-1 text-sm font-black">{goingToCustomer ? 'Entrega' : courierId ? 'Recogida' : 'Asignación'}</p>
            <p className="text-[10px] text-muted-foreground">Etapa actual</p>
          </div>
        </div>
      </div>

      <div className="relative h-[360px] bg-muted">
        <DynamicMapWrapper
          config={{
            center: courierLocation || pickup || delivery || SANTA_MARTA,
            zoom: 14,
            options: {
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
            },
          }}
          className="absolute inset-0 h-full w-full"
          onLoad={setMap}
        >
          {() => null}
        </DynamicMapWrapper>
      </div>

      <div className="grid gap-3 border-t p-4 sm:grid-cols-2">
        <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 text-orange-500" /><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Recogida</p><p className="text-xs font-semibold">{pickupAddress}</p></div></div>
        <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 text-indigo-600" /><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Entrega</p><p className="text-xs font-semibold">{deliveryAddress}</p></div></div>
      </div>

      {locationUpdatedAt && <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">Última ubicación recibida: {new Date(locationUpdatedAt).toLocaleTimeString('es-CO')}</p>}
    </section>
  );
}
