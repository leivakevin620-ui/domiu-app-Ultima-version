'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { trackingService, type DriverLocation, type TrackingInfo, type RoutePoint } from '@/services/tracking';

interface TrackingContextValue {
  driverLocations: Record<string, DriverLocation>;
  trackingInfos: Record<string, TrackingInfo>;
  isSharingLocation: boolean;
  startTracking: (orderId: string, businessId: string, customerId: string) => Promise<void>;
  stopTracking: (orderId: string) => void;
  startSharing: (courierId: string, orderId: string, businessId: string, customerId: string) => void;
  stopSharing: () => void;
  getTrackingInfo: (orderId: string) => TrackingInfo | undefined;
  getDriverLocation: (orderId: string) => DriverLocation | undefined;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [driverLocations, setDriverLocations] = useState<Record<string, DriverLocation>>({});
  const [trackingInfos, setTrackingInfos] = useState<Record<string, TrackingInfo>>({});
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const sharingRef = useRef<{ stop: () => void } | null>(null);

  const updateInfo = useCallback(async (orderId: string, businessId: string, customerId: string, loc: DriverLocation | null = null) => {
    const info = await trackingService.getTrackingInfo(orderId, businessId, customerId, loc);
    setTrackingInfos((prev) => ({ ...prev, [orderId]: info }));
  }, []);

  // Subscribe to live location updates
  useEffect(() => {
    const unsub = trackingService.subscribeLocation((location) => {
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
    setTrackingInfos((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);

  const startSharing = useCallback((courierId: string, orderId: string, businessId: string, customerId: string) => {
    sharingRef.current?.stop();
    const { stop, initialLocation } = trackingService.startSharingLocation(courierId, orderId, businessId, customerId);
    sharingRef.current = { stop };
    setIsSharingLocation(true);
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

  const value = useMemo(
    () => ({
      driverLocations,
      trackingInfos,
      isSharingLocation,
      startTracking,
      stopTracking,
      startSharing,
      stopSharing,
      getTrackingInfo,
      getDriverLocation,
    }),
    [driverLocations, trackingInfos, isSharingLocation, startTracking, stopTracking, startSharing, stopSharing, getTrackingInfo, getDriverLocation],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within a TrackingProvider');
  return ctx;
}
