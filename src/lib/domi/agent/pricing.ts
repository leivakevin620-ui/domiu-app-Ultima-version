import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

interface Coordinates {
  latitude: number | null;
  longitude: number | null;
}

export interface DomiPricingEstimate {
  distanceKm: number | null;
  deliveryFee: number;
  serviceFee: number;
  estimatedMinutes: number;
  source: 'coordinates' | 'base_rate' | 'unavailable';
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUp(value: number, increment: number) {
  if (increment <= 0) return Math.round(value);
  return Math.ceil(value / increment) * increment;
}

function distanceKm(origin: Coordinates, destination: Coordinates) {
  if (
    origin.latitude === null || origin.longitude === null
    || destination.latitude === null || destination.longitude === null
  ) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earth = 6371;
  const dLat = radians(destination.latitude - origin.latitude);
  const dLng = radians(destination.longitude - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(destination.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function estimateDomiPricing(args: {
  supabase: SupabaseClient;
  userId: string;
  business: Coordinates;
  subtotal: number;
}): Promise<DomiPricingEstimate> {
  const [addressResult, deliveryResult, financeResult] = await Promise.all([
    args.supabase
      .from('addresses')
      .select('latitude,longitude')
      .eq('user_id', args.userId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle(),
    args.supabase
      .from('delivery_pricing_settings')
      .select('base_distance_km,base_fee,extra_per_km,rounding_increment,minimum_duration_minutes')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    args.supabase
      .from('platform_financial_settings')
      .select('service_fee_rate,service_fee_min,service_fee_max,service_fee_rounding')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const delivery = deliveryResult.data;
  const finance = financeResult.data;
  const baseDistance = numeric(delivery?.base_distance_km, 2);
  const baseFee = numeric(delivery?.base_fee, 0);
  const extraPerKm = numeric(delivery?.extra_per_km, 0);
  const rounding = numeric(delivery?.rounding_increment, 500);
  const minimumMinutes = Math.max(5, numeric(delivery?.minimum_duration_minutes, 15));
  const distance = distanceKm(
    {
      latitude: addressResult.data?.latitude === null || addressResult.data?.latitude === undefined
        ? null : numeric(addressResult.data.latitude),
      longitude: addressResult.data?.longitude === null || addressResult.data?.longitude === undefined
        ? null : numeric(addressResult.data.longitude),
    },
    args.business,
  );

  const deliveryFee = distance === null
    ? baseFee
    : roundUp(baseFee + Math.max(0, distance - baseDistance) * extraPerKm, rounding);
  const serviceRate = numeric(finance?.service_fee_rate, 0) / 100;
  const serviceMin = numeric(finance?.service_fee_min, 0);
  const serviceMax = numeric(finance?.service_fee_max, Number.MAX_SAFE_INTEGER);
  const serviceRounding = numeric(finance?.service_fee_rounding, 100);
  const rawService = Math.min(serviceMax, Math.max(serviceMin, args.subtotal * serviceRate));
  const serviceFee = roundUp(rawService, serviceRounding);

  return {
    distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
    deliveryFee,
    serviceFee,
    estimatedMinutes: distance === null
      ? Math.max(25, minimumMinutes)
      : Math.max(minimumMinutes, Math.round(minimumMinutes + distance * 4)),
    source: distance === null ? (delivery ? 'base_rate' : 'unavailable') : 'coordinates',
  };
}
