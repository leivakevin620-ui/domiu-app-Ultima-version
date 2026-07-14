'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Store,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCourier } from '@/contexts/CourierContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonMap } from '@/components/ui/skeleton';

const DynamicMapWrapper = dynamic(
  () =>
    import('@/components/tracking/maps/DynamicMapWrapper').then((module) => ({
      default: module.DynamicMapWrapper,
    })),
  {
    ssr: false,
    loading: () => <SkeletonMap className="h-[400px]" />,
  },
);

type LatLng = { lat: number; lng: number };
type RouteStep = 'to_business' | 'to_customer';

const SANTA_MARTA_CENTER: LatLng = { lat: 11.2408, lng: -74.199 };

function validCoordinate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value);
}

function pointOrNull(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  if (!validCoordinate(lat) || !validCoordinate(lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function routeValue(value: LatLng | string) {
  return typeof value === 'string' ? value : `${value.lat},${value.lng}`;
}

function externalRouteUrl(origin: LatLng | string, destination: LatLng | string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    routeValue(origin),
  )}&destination=${encodeURIComponent(routeValue(destination))}&travelmode=driving`;
}

export default function CourierMapPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { activeDeliveries, loading, refresh } = useCourier();
  const activeOrder = activeDeliveries[0] ?? null;

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [step, setStep] = useState<RouteStep>('to_business');
  const [eta, setEta] = useState<{ duration: string; distance: string } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);

  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const locationWriteAtRef = useRef(0);

  const pickupPoint = useMemo(
    () => pointOrNull(activeOrder?.pickup_lat, activeOrder?.pickup_lng),
    [activeOrder?.pickup_lat, activeOrder?.pickup_lng],
  );
  const deliveryPoint = useMemo(
    () => pointOrNull(activeOrder?.delivery_lat, activeOrder?.delivery_lng),
    [activeOrder?.delivery_lat, activeOrder?.delivery_lng],
  );

  useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === 'picked_up' || activeOrder.status === 'in_transit') {
      setStep('to_customer');
    } else {
      setStep('to_business');
    }
  }, [activeOrder?.id, activeOrder?.status]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setDriverLocation(SANTA_MARTA_CENTER);
      setLocating(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setDriverLocation(current);
        setLocating(false);

        if (!profile?.id || !activeOrder?.id) return;
        const now = Date.now();
        if (now - locationWriteAtRef.current < 7_000) return;
        locationWriteAtRef.current = now;

        const supabase = getBrowserClient();
        void supabase.from('driver_locations').upsert(
          {
            driver_id: profile.id,
            order_id: activeOrder.id,
            latitude: current.lat,
            longitude: current.lng,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || 0,
            speed: position.coords.speed || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id,order_id' },
        );
      },
      () => {
        setDriverLocation(SANTA_MARTA_CENTER);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 15_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder?.id, profile?.id]);

  const origin = useMemo<LatLng | string>(() => {
    if (!activeOrder) return SANTA_MARTA_CENTER;
    if (step === 'to_business') return driverLocation || SANTA_MARTA_CENTER;
    return pickupPoint || activeOrder.pickup_address;
  }, [activeOrder, driverLocation, pickupPoint, step]);

  const destination = useMemo<LatLng | string>(() => {
    if (!activeOrder) return SANTA_MARTA_CENTER;
    if (step === 'to_business') return pickupPoint || activeOrder.pickup_address;
    return deliveryPoint || activeOrder.delivery_address;
  }, [activeOrder, deliveryPoint, pickupPoint, step]);

  useEffect(() => {
    if (!map || !activeOrder || !window.google?.maps) return;

    if (directionsRef.current) {
      directionsRef.current.setMap(null);
      directionsRef.current = null;
    }

    const service = new google.maps.DirectionsService();
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      preserveViewport: false,
      polylineOptions: {
        strokeColor: step === 'to_business' ? '#F97316' : '#4F46E5',
        strokeWeight: 6,
        strokeOpacity: 0.92,
      },
    });

    let disposed = false;
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date() },
      },
      (result, status) => {
        if (disposed) return;

        if (status === 'OK' && result) {
          renderer.setDirections(result);
          directionsRef.current = renderer;
          const leg = result.routes?.[0]?.legs?.[0];
          setEta({
            duration: leg?.duration?.text || 'Calculando',
            distance: leg?.distance?.text || '',
          });
          setRouteError(null);
          return;
        }

        renderer.setMap(null);
        setEta(null);
        setRouteError(
          'No se pudo dibujar la ruta dentro de la app. Puedes abrirla directamente en Google Maps.',
        );
      },
    );

    return () => {
      disposed = true;
      renderer.setMap(null);
    };
  }, [activeOrder, destination, map, origin, step]);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`courier-map-order-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, refresh]);

  if (loading) return <SkeletonMap />;

  if (!activeOrder) {
    return (
      <section className="flex min-h-[65vh] items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <div>
          <Navigation className="mx-auto h-14 w-14 text-muted-foreground/50" />
          <h1 className="mt-4 text-xl font-bold">Sin pedido activo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acepta un domicilio para ver primero la ruta al negocio y luego la ruta al cliente.
          </p>
          <button
            type="button"
            onClick={() => router.push('/repartidor/pedidos')}
            className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Ver pedidos disponibles
          </button>
        </div>
      </section>
    );
  }

  const routeUrl = externalRouteUrl(origin, destination);

  return (
    <div className="min-h-[calc(100vh-7rem)] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pedido activo
            </p>
            <h1 className="text-xl font-black">#{activeOrder.order_number}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse text-warning' : 'text-success'}`} />
          <span className="text-xs font-semibold">
            {locating ? 'Buscando tu ubicación' : 'Ubicación activa'}
          </span>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="relative min-h-[520px] overflow-hidden rounded-3xl border border-border bg-muted">
          <DynamicMapWrapper
            config={{
              center: driverLocation || pickupPoint || SANTA_MARTA_CENTER,
              zoom: 14,
              options: {
                zoomControl: true,
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

          {routeError && (
            <div className="absolute left-4 right-4 top-4 rounded-2xl border border-orange-300 bg-orange-500/95 p-4 text-white shadow-xl">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Ruta interna no disponible</p>
                  <p className="mt-1 text-xs text-white/90">{routeError}</p>
                </div>
              </div>
            </div>
          )}

          {eta && (
            <div className="absolute right-4 top-4 rounded-2xl border border-white/30 bg-slate-950/80 px-4 py-3 text-white shadow-xl backdrop-blur">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <div>
                  <p className="text-sm font-black">{eta.duration}</p>
                  <p className="text-[11px] text-white/70">{eta.distance}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2">
            <button
              type="button"
              onClick={() => setStep('to_business')}
              className={`rounded-xl px-3 py-3 text-xs font-bold transition ${
                step === 'to_business'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Store className="mx-auto mb-1 h-4 w-4" />
              1. Recoger
            </button>
            <button
              type="button"
              onClick={() => setStep('to_customer')}
              className={`rounded-xl px-3 py-3 text-xs font-bold transition ${
                step === 'to_customer'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <MapPin className="mx-auto mb-1 h-4 w-4" />
              2. Entregar
            </button>
          </div>

          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Recoger primero
                </p>
                <h2 className="font-bold">{activeOrder.business_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{activeOrder.pickup_address}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Entregar después
                </p>
                <h2 className="font-bold">{activeOrder.customer_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{activeOrder.delivery_address}</p>
                {activeOrder.customer_phone && (
                  <a
                    href={`tel:${activeOrder.customer_phone}`}
                    className="mt-2 inline-flex text-sm font-bold text-indigo-600"
                  >
                    {activeOrder.customer_phone}
                  </a>
                )}
              </div>
            </div>
          </article>

          <a
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-black text-primary-foreground shadow-lg"
          >
            <ExternalLink className="h-5 w-5" />
            Abrir navegación en Google Maps
          </a>

          <button
            type="button"
            onClick={() => router.push('/repartidor/pedidos')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold"
          >
            <Truck className="h-4 w-4" />
            Ver información completa del pedido
          </button>
        </aside>
      </div>
    </div>
  );
}
