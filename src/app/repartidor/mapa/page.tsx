'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapsProvider } from '@/contexts/MapsContext';
import dynamic from 'next/dynamic';
const DynamicMapWrapper = dynamic(() => import('@/components/tracking/maps/DynamicMapWrapper').then(m => ({ default: m.DynamicMapWrapper })), {
  ssr: false,
  loading: () => <SkeletonMap className="h-[400px]" />,
});
import { trackingService } from '@/services/tracking';
import { orderService } from '@/services/orders';
import { SkeletonMap } from '@/components/ui/skeleton';
import type { OrderData } from '@/services/orders';
import { useRouter } from 'next/navigation';
import { Navigation, ArrowLeft, Store, MapPin, Truck, Clock } from 'lucide-react';

interface ActiveDelivery {
  orderId: string;
  orderNumber: string;
  businessName: string;
  customerName: string;
  status: string;
  businessLoc: { lat: number; lng: number };
  customerLoc: { lat: number; lng: number };
}

function CourierMapContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [eta, setEta] = useState<{ text: string; distance: string } | null>(null);
  const [step, setStep] = useState<'to_business' | 'to_customer'>('to_business');

  useEffect(() => {
    if (!profile?.id) return;
    orderService.getCourierOrders(profile.id).then(data => {
      setOrders(data);
      setLoading(false);
    });
  }, [profile?.id]);

  const activeOrder = orders.find((o: OrderData) => ['assigned', 'picked_up', 'in_transit'].includes(o.status));

  useEffect(() => {
    if (!activeOrder || !profile?.id) return;
    const loadLocations = async () => {
      const bizLoc = await trackingService.getBusinessLocation(activeOrder.business_id);
      const custLoc = await trackingService.getCustomerLocation(activeOrder.customer_id);
      setActiveDelivery({
        orderId: activeOrder.id,
        orderNumber: activeOrder.order_number,
        businessName: activeOrder.business_name,
        customerName: activeOrder.customer_name,
        status: activeOrder.status,
        businessLoc: bizLoc,
        customerLoc: custLoc,
      });
    };
    loadLocations();
  }, [activeOrder, profile?.id]);

  useEffect(() => {
    if (!map || !activeDelivery || !window.google?.maps) return;
    if (directionsRef.current) { directionsRef.current.setMap(null); }

    const origin = step === 'to_business'
      ? { lat: 11.240, lng: -74.211 }
      : activeDelivery.businessLoc;
    const destination = step === 'to_business'
      ? activeDelivery.businessLoc
      : activeDelivery.customerLoc;

    const svc = new google.maps.DirectionsService();
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: step === 'to_business' ? '#F97316' : '#6366F1',
        strokeWeight: 6,
        strokeOpacity: 0.9,
      },
    });

    svc.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date() },
      },
      (result, status) => {
        if (status === 'OK' && result) {
          renderer.setDirections(result);
          directionsRef.current = renderer;
          const leg = result.routes[0].legs[0];
          setEta({ text: leg.duration?.text ?? '', distance: leg.distance?.text ?? '' });
        }
      },
    );

    new google.maps.Marker({
      position: origin,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#6366F1',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
    });

    return () => { renderer.setMap(null); };
  }, [map, activeDelivery, step, directionsRef]);

  if (loading) return <SkeletonMap />;

  if (!activeOrder || !activeDelivery) {
    return (
      <div className="min-h-screen bg-background pb-16 lg:pb-0">
        <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
            <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="ml-3 text-base font-bold text-foreground">Mapa de Navegación</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center p-8">
            <Navigation className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Sin pedido activo</p>
            <p className="text-xs text-muted-foreground mt-1">Acepta un pedido para ver la ruta de navegación</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{activeOrder.order_number}</h1>
            <p className="text-[10px] text-muted-foreground">{activeDelivery.businessName} → {activeDelivery.customerName}</p>
          </div>
          {eta && (
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{eta.text}</p>
              <p className="text-[10px] text-muted-foreground">{eta.distance}</p>
            </div>
          )}
        </div>
      </div>

      <div className="h-[calc(100vh-120px)] relative">
        <DynamicMapWrapper
          config={{
            center: activeDelivery.businessLoc,
            zoom: 14,
            options: { zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: false },
          }}
          className="w-full h-full"
          onLoad={setMap}
        >
          {() => null}
        </DynamicMapWrapper>

        <div className="absolute bottom-6 left-4 right-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setStep('to_business')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold transition-all ${
                step === 'to_business'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-card/90 text-muted-foreground backdrop-blur-sm'
              }`}
            >
              <Store className="h-4 w-4" /> Al negocio
            </button>
            <button
              onClick={() => setStep('to_customer')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold transition-all ${
                step === 'to_customer'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-card/90 text-muted-foreground backdrop-blur-sm'
              }`}
            >
              <MapPin className="h-4 w-4" /> Al cliente
            </button>
          </div>

          <div className="rounded-2xl bg-card/95 backdrop-blur-xl p-4 shadow-xl border border-border/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <Truck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {step === 'to_business' ? activeDelivery.businessName : activeDelivery.customerName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step === 'to_business' ? 'Recoger pedido' : 'Entregar pedido'}
                </p>
              </div>
              {eta && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">{eta.text}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-1">
              <button className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground flex items-center justify-center gap-1.5">
                <Navigation className="h-3.5 w-3.5" /> Iniciar navegación
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CourierMapPage() {
  return (
    <MapsProvider>
      <CourierMapContent />
    </MapsProvider>
  );
}
