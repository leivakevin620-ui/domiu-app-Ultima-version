export interface NavigationParams {
  origin?: { lat?: number; lng?: number; address?: string };
  destination: { lat?: number; lng?: number; address?: string };
}

export function buildNavigationUrl(params: NavigationParams): string {
  const { origin, destination } = params;

  if (!destination) return '';

  const destParam = destination.lat && destination.lng
    ? `${destination.lat},${destination.lng}`
    : destination.address
    ? encodeURIComponent(destination.address)
    : '';

  if (!destParam) return '';

  const baseUrl = 'https://www.google.com/maps/dir/?api=1';

  if (origin?.lat && origin?.lng) {
    return `${baseUrl}&origin=${origin.lat},${origin.lng}&destination=${destParam}`;
  }

  if (origin?.address) {
    return `${baseUrl}&origin=${encodeURIComponent(origin.address)}&destination=${destParam}`;
  }

  return `${baseUrl}&destination=${destParam}`;
}

export function buildDirectionsUrl(local: { lat?: number; lng?: number; address?: string }, customer: { lat?: number; lng?: number; address?: string }): string {
  return buildNavigationUrl({ origin: local, destination: customer });
}

export function openExternalNavigation(params: NavigationParams): void {
  const url = buildNavigationUrl(params);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export const mapsConfigured = Boolean(
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
);
