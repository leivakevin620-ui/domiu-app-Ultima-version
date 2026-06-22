'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { DynamicMapWrapper } from './DynamicMapWrapper';

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface TrackingMapRoute {
  origin: MapPoint;
  destination: MapPoint;
  waypoints?: MapPoint[];
}

export interface TrackingMapData {
  business: MapPoint & { name: string };
  customer: MapPoint & { name: string };
  driver?: MapPoint & { name: string; heading?: number } | null;
  route?: TrackingMapRoute;
  etaMinutes?: number;
  distanceKm?: number;
}

interface Props {
  data: TrackingMapData;
  showTraffic?: boolean;
  interactive?: boolean;
  className?: string;
  height?: string;
}

const MARKER_SVG = {
  business: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="#F97316"/><text x="18" y="20" font-size="14" text-anchor="middle" fill="white" font-weight="bold">N</text></svg>'),
  customer: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="#10B981"/><text x="18" y="20" font-size="14" text-anchor="middle" fill="white" font-weight="bold">T</text></svg>'),
  courier: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="#6366F1"/><text x="18" y="20" font-size="14" text-anchor="middle" fill="white" font-weight="bold">R</text></svg>'),
};

function useGoogleMapRenderer(map: google.maps.Map | null, data: TrackingMapData, showTraffic: boolean) {
  const markersRef = useRef<google.maps.Marker[]>([]);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();

    const bizPos = { lat: data.business.lat, lng: data.business.lng };
    const custPos = { lat: data.customer.lat, lng: data.customer.lng };

    const bizMarker = new maps.Marker({
      position: bizPos,
      map,
      icon: { url: MARKER_SVG.business, scaledSize: new maps.Size(32, 40) },
      title: data.business.name,
    });
    markersRef.current.push(bizMarker);
    bounds.extend(bizPos);

    const custMarker = new maps.Marker({
      position: custPos,
      map,
      icon: { url: MARKER_SVG.customer, scaledSize: new maps.Size(32, 40) },
      title: data.customer.name,
    });
    markersRef.current.push(custMarker);
    bounds.extend(custPos);

    if (data.driver) {
      const driverPos = { lat: data.driver.lat, lng: data.driver.lng };
      const driverMarker = new maps.Marker({
        position: driverPos,
        map,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#6366F1',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        title: data.driver.name,
      });
      markersRef.current.push(driverMarker);
      bounds.extend(driverPos);

      const pulse = document.createElement('div');
      pulse.className = 'w-4 h-4 rounded-full bg-indigo-500 animate-ping absolute -left-1 -top-1';
      driverMarker.setMap(map);
    }

    if (routesRef.current && data.route) {
      routesRef.current.setMap(null);
      routesRef.current = null;
    }

    if (data.route) {
      const directionsService = new maps.DirectionsService();
      const directionsRenderer = new maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#6366F1',
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });

      const waypoints = data.route.waypoints?.map(w => ({
        location: { lat: w.lat, lng: w.lng },
        stopover: false,
      })) || [];

      directionsService.route(
        {
          origin: data.route.origin,
          destination: data.route.destination,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: { departureTime: new Date() },
        },
        (result, status) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result);
          }
        },
      );
      routesRef.current = directionsRenderer;
    }

    map.fitBounds(bounds, 80);
  }, [map, data.business.lat, data.business.lng, data.business.name, data.customer.lat, data.customer.lng, data.customer.name, data.driver, data.route]);

  const routesRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!map) return;
    if (showTraffic) {
      if (!trafficRef.current) {
        trafficRef.current = new google.maps.TrafficLayer();
      }
      trafficRef.current.setMap(map);
    } else {
      trafficRef.current?.setMap(null);
    }
  }, [map, showTraffic]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      routesRef.current?.setMap(null);
      trafficRef.current?.setMap(null);
    };
  }, []);
}

function GoogleTrackingMapInner({ data, showTraffic = false, className = '' }: Props) {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  useGoogleMapRenderer(mapInstance, data, showTraffic);

  if (!data.business && !data.customer) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-muted/30 ${className}`} style={{ minHeight: '300px' }}>
        <p className="text-sm text-muted-foreground">Ubicaciones no disponibles</p>
      </div>
    );
  }

  return (
    <DynamicMapWrapper
      config={{
        center: { lat: data.business.lat, lng: data.business.lng },
        zoom: 14,
      }}
      className={className}
      onLoad={setMapInstance}
    />
  );
}

export const GoogleTrackingMap = memo(GoogleTrackingMapInner);
