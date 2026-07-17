'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { useMaps } from '@/contexts/MapsContext';
import { OpenStreetLiveMap } from '@/components/tracking/maps/OpenStreetLiveMap';

export type PickedLocation = {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  country?: string;
  postalCode?: string;
};

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  label?: string;
  onLocationChange: (location: PickedLocation) => void;
  className?: string;
}

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  target: PickedLocation,
) {
  for (const component of components || []) {
    if (component.types.includes('locality')) target.city = component.long_name;
    if (!target.city && component.types.includes('administrative_area_level_2')) target.city = component.long_name;
    if (component.types.includes('administrative_area_level_1')) target.state = component.long_name;
    if (
      component.types.includes('neighborhood') ||
      component.types.includes('sublocality') ||
      component.types.includes('sublocality_level_1')
    ) {
      target.neighborhood = component.long_name;
    }
    if (component.types.includes('country')) target.country = component.long_name;
    if (component.types.includes('postal_code')) target.postalCode = component.long_name;
  }
  return target;
}

export function LocationMapPicker({
  latitude,
  longitude,
  label = 'Ubicación seleccionada',
  onLocationChange,
  className = 'h-[320px]',
}: LocationMapPickerProps) {
  const { isReady } = useMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const dragListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onChangeRef = useRef(onLocationChange);
  onChangeRef.current = onLocationChange;

  const position = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [latitude, longitude]);

  useEffect(() => {
    if (!isReady || !window.google?.maps || !containerRef.current || !position) return;

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: position,
        zoom: 18,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      });
      markerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position,
        draggable: true,
        title: 'Arrastra para ajustar la ubicación exacta',
      });

      dragListenerRef.current = markerRef.current.addListener('dragend', async () => {
        const markerPosition = markerRef.current?.getPosition();
        if (!markerPosition) return;
        const next = { lat: markerPosition.lat(), lng: markerPosition.lng() };
        try {
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ location: next });
          const result = response.results?.[0];
          onChangeRef.current(
            parseAddressComponents(result?.address_components, {
              ...next,
              formattedAddress: result?.formatted_address,
              placeId: result?.place_id || undefined,
            }),
          );
        } catch {
          onChangeRef.current(next);
        }
      });
    } else {
      mapRef.current.setCenter(position);
      markerRef.current?.setPosition(position);
    }
  }, [isReady, position]);

  useEffect(() => {
    return () => {
      dragListenerRef.current?.remove();
      dragListenerRef.current = null;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  if (!position) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed bg-muted/30 ${className}`}>
        <div className="px-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">Selecciona una dirección o comparte tu GPS</p>
          <p className="mt-1 text-xs text-muted-foreground">El mapa aparecerá cuando existan coordenadas exactas.</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border ${className}`}>
        <OpenStreetLiveMap
          points={[{ id: 'picked-location', ...position, label, kind: 'delivery', color: '#4F46E5' }]}
          center={position}
          zoom={18}
          className="absolute inset-0 h-full w-full rounded-none"
        />
        <div className="absolute bottom-3 left-3 right-3 z-[500] flex items-start gap-2 rounded-xl bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
          <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Vista de respaldo activa. Puedes guardar estas coordenadas; para arrastrar el marcador se requiere Google Maps configurado.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl bg-background/95 p-3 text-xs font-semibold shadow-lg backdrop-blur">
        Arrastra el marcador hasta la entrada exacta del lugar y luego guarda.
      </div>
    </div>
  );
}
