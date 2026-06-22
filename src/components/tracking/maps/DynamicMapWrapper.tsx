'use client';

import React, { useEffect, useRef, useState, memo, type ReactNode } from 'react';
import { useMaps } from '@/contexts/MapsContext';
import { SkeletonMap } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

export interface MapConfig {
  center: google.maps.LatLngLiteral;
  zoom?: number;
  styles?: google.maps.MapTypeStyle[];
  options?: google.maps.MapOptions;
}

interface MapWrapperProps {
  config: MapConfig;
  children?: (map: google.maps.Map) => ReactNode;
  className?: string;
  onLoad?: (map: google.maps.Map) => void;
}

function DynamicMapInner({ config, children, className = 'w-full h-full min-h-[300px]', onLoad }: MapWrapperProps) {
  const { isReady, maps, error, hasKey } = useMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    if (!isReady || !maps || !containerRef.current || map) return;

    const instance = new maps.Map(containerRef.current, {
      center: config.center,
      zoom: config.zoom ?? 14,
      styles: config.styles ?? defaultMapStyle,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
      ...config.options,
    });

    setMap(instance);
    onLoad?.(instance);
  }, [isReady, maps, config, map, onLoad]);

  if (!hasKey || error) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-muted/30 ${className}`}>
        <div className="text-center p-8">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {!hasKey ? 'Google Maps no configurado' : 'Error al cargar Google Maps'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local
          </p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={className}>
        <SkeletonMap />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="absolute inset-0 rounded-2xl" />
      {map && children?.(map)}
    </div>
  );
}

export const DynamicMapWrapper = memo(DynamicMapInner);

const defaultMapStyle = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
] as google.maps.MapTypeStyle[];
