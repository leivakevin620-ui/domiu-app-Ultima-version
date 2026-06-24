export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface RouteDistanceResult {
  originAddress: string;
  destinationAddress: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  distanceKm: number;
  durationMinutes: number;
  calculationSource: 'google_maps' | 'fallback' | 'manual';
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function geocodeAddressServer(address: string, city = 'Santa Marta'): Promise<GeocodeResult | null> {
  if (!address || address.length < 5) return null;

  const hasMapsKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (hasMapsKey) {
    try {
      const params = new URLSearchParams({
        address: `${address}, ${city}, Colombia`,
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        const cityComp = data.results[0].address_components?.find(
          (c: { types: string[]; long_name: string }) => c.types.includes('locality') || c.types.includes('sublocality'),
        );
        return {
          lat: loc.lat,
          lng: loc.lng,
          formattedAddress: data.results[0].formatted_address,
          city: cityComp?.long_name || city,
          confidence: data.results[0].geometry.location_type === 'ROOFTOP' ? 'high' : 'medium',
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function calculateRouteDistance(
  originAddress: string,
  destinationAddress: string,
  originLat?: number,
  originLng?: number,
  destinationLat?: number,
  destinationLng?: number,
): Promise<RouteDistanceResult> {
  const warnings: string[] = [];
  const hasMapsKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (hasMapsKey && originLat && originLng && destinationLat && destinationLng) {
    try {
      const params = new URLSearchParams({
        origins: `${originLat},${originLng}`,
        destinations: `${destinationLat},${destinationLng}`,
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = data.rows[0].elements[0];
          return {
            originAddress,
            destinationAddress,
            originLat,
            originLng,
            destinationLat,
            destinationLng,
            distanceKm: Math.round((element.distance.value / 1000) * 100) / 100,
            durationMinutes: Math.ceil(element.duration.value / 60),
            calculationSource: 'google_maps',
            confidence: 'high',
            warnings: [],
          };
        }
      }
    } catch {
      warnings.push('Error al calcular ruta con Google Maps');
    }
  }

  if (originLat && originLng && destinationLat && destinationLng) {
    const distanceKm = haversineKm(originLat, originLng, destinationLat, destinationLng);
    warnings.push('Distancia calculada en línea recta (no ruta real). Verifica manualmente.');
    return {
      originAddress,
      destinationAddress,
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes: Math.round((distanceKm / 25) * 60),
      calculationSource: 'fallback',
      confidence: 'medium',
      warnings,
    };
  }

  warnings.push('No hay coordenadas disponibles. Ingresa los kilómetros manualmente.');
  return {
    originAddress,
    destinationAddress,
    distanceKm: 0,
    durationMinutes: 0,
    calculationSource: 'manual',
    confidence: 'low',
    warnings,
  };
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
