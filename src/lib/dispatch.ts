export interface Coordinate {
  lat: number;
  lng: number;
}

export interface RiderLocation {
  repartidor_id: string;
  latitud: number | string | null;
  longitud: number | string | null;
  estado?: string | null;
  ultima_actualizacion?: string | null;
}

export function asCoordinate(lat: unknown, lng: unknown): Coordinate | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { lat: latitude, lng: longitude };
}

export function haversineDistanceKm(a: Coordinate, b: Coordinate): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isFreshLocation(value: string | null | undefined, maxAgeMinutes = 15): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= maxAgeMinutes * 60_000;
}

export function rankRidersByDistance(origin: Coordinate | null, locations: RiderLocation[]) {
  return locations
    .map((location) => {
      const coords = asCoordinate(location.latitud, location.longitud);
      const distanceKm = origin && coords ? haversineDistanceKm(origin, coords) : Number.POSITIVE_INFINITY;
      return { ...location, coords, distanceKm };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function eligibleRiderIdsForOffer(
  origin: Coordinate | null,
  locations: RiderLocation[],
  createdAt: string | null | undefined,
) {
  const ranked = rankRidersByDistance(origin, locations);
  const created = createdAt ? new Date(createdAt).getTime() : Date.now();
  const ageSeconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
  const tierSize = ageSeconds < 20 ? 3 : ageSeconds < 45 ? 6 : ranked.length;
  return ranked.slice(0, Math.max(1, tierSize)).map((item) => item.repartidor_id);
}
