'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { trackingService, type DriverLocation, type TrackingInfo } from '@/services/tracking';

interface SmoothLocation {
  actual: DriverLocation;
  display: { latitude: number; longitude: number };
}

interface TrackingContextValue {
  driverLocations: Record<string, DriverLocation>;
  smoothLocations: Record<string, { latitude: number; longitude: number }>;
  trackingInfos: Record<string, TrackingInfo>;
  isSharingLocation: boolean;
  startTracking: (orderId: string, businessId: string, customerId: string) => Promise<void>;
  stopTracking: (orderId: string) => void;
  startSharing: (courierId: string, orderId: string, businessId: string, customerId: string) => void;
  stopSharing: () => void;
  getTrackingInfo: (orderId: string) => TrackingInfo | undefined;
  getDriverLocation: (orderId: string) => DriverLocation | undefined;
  getSmoothLocation: (orderId: string) => { latitude: number; longitude: number } | undefined;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [driverLocations, setDriverLocations] = useState<Record<string, DriverLocation>>({});
  const [smoothLocations, setSmoothLocations] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [trackingInfos, setTrackingInfos] = useState<Record<string, TrackingInfo>>({});
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const sharingRef = useRef<{ stop: () => void } | null>(null);
  const animRef = useRef<number>(0);
  const smoothDataRef = useRef<Record<string, SmoothLocation>>({});
  const targetDataRef = useRef<Record<string, DriverLocation>>({});

  const updateInfo = useCallback(async (orderId: string, businessId: string, customerId: string, loc: DriverLocation | null = null) => {
    const info = await trackingService.getTrackingInfo(orderId, businessId, customerId, loc);
    setTrackingInfos((prev) => ({ ...prev, [orderId]: info }));
  }, []);

  // Smooth interpolation animation loop
  useEffect(() => {
    let running = true;
    let idleTimeout: ReturnType<typeof setTimeout> | null = null;

    function animate() {
      if (!running) return;
      const targets = targetDataRef.current;
      const keys = Object.keys(targets);

      if (keys.length === 0) {
        idleTimeout = setTimeout(() => {
          if (running) animRef.current = requestAnimationFrame(animate);
        }, 500);
        return;
      }

      const smooth = smoothDataRef.current;
      let changed = false;

      for (const [orderId, target] of Object.entries(targets)) {
        const current = smooth[orderId];
        if (!current) {
          smooth[orderId] = {
            actual: target,
            display: { latitude: target.latitude, longitude: target.longitude },
          };
          changed = true;
          continue;
        }
        const disp = current.display;
        disp.latitude = lerp(disp.latitude, target.latitude, 0.15);
        disp.longitude = lerp(disp.longitude, target.longitude, 0.15);
        smooth[orderId] = { actual: target, display: disp };
        changed = true;
      }

      if (changed) {
        setSmoothLocations(prev => {
          const next = { ...prev };
          for (const [orderId, s] of Object.entries(smooth)) {
            next[orderId] = s.display;
          }
          return next;
        });
      }

      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => { running = false; if (idleTimeout) clearTimeout(idleTimeout); cancelAnimationFrame(animRef.current); };
  }, []);

  // Subscribe to live location updates
  useEffect(() => {
    const unsub = trackingService.subscribeLocation((location) => {
      targetDataRef.current[location.order_id] = location;
      setDriverLocations((prev) => ({ ...prev, [location.order_id]: location }));

      setTrackingInfos((prev) => {
        const current = prev[location.order_id];
        if (!current) return prev;
        const dist = trackingService.calculateDistance(
          { lat: location.latitude, lng: location.longitude },
          current.customerLocation,
        );
        return {
          ...prev,
          [location.order_id]: {
            ...current,
            driverLocation: location,
            distanceKm: dist,
            etaMinutes: trackingService.calculateEta(dist),
            isLive: true,
          },
        };
      });
    });
    return unsub;
  }, []);

  const startTracking = useCallback(async (orderId: string, businessId: string, customerId: string) => {
    await updateInfo(orderId, businessId, customerId, null);
  }, [updateInfo]);

  const stopTracking = useCallback((orderId: string) => {
    setDriverLocations((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setSmoothLocations((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setTrackingInfos((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    delete targetDataRef.current[orderId];
    delete smoothDataRef.current[orderId];
  }, []);

  const startSharing = useCallback((courierId: string, orderId: string, businessId: string, customerId: string) => {
    sharingRef.current?.stop();
    const { stop, initialLocation } = trackingService.startSharingLocation(courierId, orderId, businessId, customerId);
    sharingRef.current = { stop };
    setIsSharingLocation(true);
    targetDataRef.current[orderId] = initialLocation;
    smoothDataRef.current[orderId] = {
      actual: initialLocation,
      display: { latitude: initialLocation.latitude, longitude: initialLocation.longitude },
    };
    setDriverLocations((prev) => ({ ...prev, [orderId]: initialLocation }));
    updateInfo(orderId, businessId, customerId, initialLocation);
  }, [updateInfo]);

  const stopSharing = useCallback(() => {
    sharingRef.current?.stop();
    sharingRef.current = null;
    setIsSharingLocation(false);
  }, []);

  const getTrackingInfo = useCallback((orderId: string) => trackingInfos[orderId], [trackingInfos]);
  const getDriverLocation = useCallback((orderId: string) => driverLocations[orderId], [driverLocations]);
  const getSmoothLocation = useCallback((orderId: string) => smoothLocations[orderId], [smoothLocations]);

  const value = useMemo(
    () => ({
      driverLocations,
      smoothLocations,
      trackingInfos,
      isSharingLocation,
      startTracking,
      stopTracking,
      startSharing,
      stopSharing,
      getTrackingInfo,
      getDriverLocation,
      getSmoothLocation,
    }),
    [driverLocations, smoothLocations, trackingInfos, isSharingLocation, startTracking, stopTracking, startSharing, stopSharing, getTrackingInfo, getDriverLocation, getSmoothLocation],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within a TrackingProvider');
  return ctx;
}
