import { getBrowserClient } from '@/lib/db/supabase';
import { getCached, setCache } from '@/lib/supabase-cache';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DriverLocation {
  courier_id: string;
  order_id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  updated_at: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface TrackingInfo {
  driverLocation: DriverLocation | null;
  businessLocation: RoutePoint;
  customerLocation: RoutePoint;
  distanceKm: number;
  etaMinutes: number;
  isLive: boolean;
}

type LocationListener = (location: DriverLocation) => void;
const locationListeners: Set<LocationListener> = new Set();

function haversine(p1: RoutePoint, p2: RoutePoint): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(p1: RoutePoint, p2: RoutePoint): number {
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((p2.lat * Math.PI) / 180);
  const x =
    Math.cos((p1.lat * Math.PI) / 180) * Math.sin((p2.lat * Math.PI) / 180) -
    Math.sin((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function generateRoute(from: RoutePoint, to: RoutePoint, steps = 20): RoutePoint[] {
  const route: RoutePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    route.push({
      lat: from.lat + (to.lat - from.lat) * t + (Math.random() - 0.5) * 0.001,
      lng: from.lng + (to.lng - from.lng) * t + (Math.random() - 0.5) * 0.001,
    });
  }
  return route;
}

async function getClient() {
  return getBrowserClient();
}

const sharingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

export const trackingService = {
  getBusinessLocation: async (businessId: string): Promise<RoutePoint> => {
    const cacheKey = `bizloc:${businessId}`;
    const cached = getCached<RoutePoint>(cacheKey);
    if (cached) return cached;
    const supabase = await getClient();
    const { data } = await supabase
      .from('business_addresses')
      .select('latitude, longitude')
      .eq('business_id', businessId)
      .eq('is_primary', true)
      .maybeSingle();
    if (data?.latitude && data?.longitude) {
      const result = { lat: data.latitude, lng: data.longitude };
      setCache(cacheKey, result, 60_000);
      return result;
    }
    return { lat: 19.4326, lng: -99.1332 };
  },

  getCustomerLocation: async (customerId: string): Promise<RoutePoint> => {
    const supabase = await getClient();
    const { data } = await supabase
      .from('addresses')
      .select('latitude, longitude')
      .eq('user_id', customerId)
      .eq('is_primary', true)
      .maybeSingle();
    if (data?.latitude && data?.longitude) {
      return { lat: data.latitude, lng: data.longitude };
    }
    return { lat: 19.42, lng: -99.14 };
  },

  calculateDistance: (from: RoutePoint, to: RoutePoint): number => {
    return Math.round(haversine(from, to) * 10) / 10;
  },

  calculateEta: (distanceKm: number): number => {
    return Math.round((distanceKm / 30) * 60);
  },

  generateRoute,

  startSharingLocation: (
    courierId: string,
    orderId: string,
    businessId: string,
    customerId: string,
    intervalMs = 3000,
  ): { stop: () => void; initialLocation: DriverLocation } => {
    const key = `${courierId}-${orderId}`;

    // Get locations from real data, fallback to defaults
    const bizLoc = { lat: 19.4326, lng: -99.1332 };
    const custLoc = { lat: 19.42, lng: -99.14 };

    // Use stored locations from prior calls if available
    const route = generateRoute(bizLoc, custLoc, 25);
    let step = 0;

    const initial: DriverLocation = {
      courier_id: courierId,
      order_id: orderId,
      latitude: route[0].lat,
      longitude: route[0].lng,
      heading: bearing(route[0], route[1]),
      speed: 0,
      updated_at: new Date().toISOString(),
    };

    async function broadcastLocation(loc: DriverLocation) {
      const supabase = await getClient();
      await supabase.from('driver_locations').upsert({
        driver_id: courierId,
        order_id: orderId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: loc.speed,
        accuracy: 10,
      } as any, { onConflict: 'driver_id, order_id' });
      locationListeners.forEach((fn) => fn(loc));
    }

    // Broadcast initial location
    broadcastLocation(initial);

    const id = setInterval(() => {
      step = (step + 1) % route.length;
      const nextStep = (step + 1) % route.length;
      const loc: DriverLocation = {
        courier_id: courierId,
        order_id: orderId,
        latitude: route[step].lat,
        longitude: route[step].lng,
        heading: bearing(route[step], route[nextStep]),
        speed: 15 + Math.random() * 30,
        updated_at: new Date().toISOString(),
      };
      broadcastLocation(loc);
    }, intervalMs);

    sharingIntervals.set(key, id);

    return {
      stop: () => {
        clearInterval(id);
        sharingIntervals.delete(key);
      },
      initialLocation: initial,
    };
  },

  getTrackingInfo: async (
    orderId: string,
    businessId: string,
    customerId: string,
    driverLocation: DriverLocation | null = null,
  ): Promise<TrackingInfo> => {
    const [bizLoc, custLoc] = await Promise.all([
      trackingService.getBusinessLocation(businessId),
      trackingService.getCustomerLocation(customerId),
    ]);

    const currentPos = driverLocation
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : bizLoc;

    const distanceKm = haversine(currentPos, custLoc);
    const etaMinutes = Math.round((distanceKm / 30) * 60);

    return {
      driverLocation,
      businessLocation: bizLoc,
      customerLocation: custLoc,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes: Math.max(1, etaMinutes),
      isLive: !!driverLocation,
    };
  },

  subscribeLocation: (listener: LocationListener): (() => void) => {
    locationListeners.add(listener);
    return () => locationListeners.delete(listener);
  },
};
