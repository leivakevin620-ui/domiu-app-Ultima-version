import { getBrowserClient } from '@/lib/db/supabase';

export type GeofenceEventType =
  | 'arrived_at_business'
  | 'picked_up_order'
  | 'departed_business'
  | 'arrived_at_customer'
  | 'delivered_order'
  | 'departed_customer'
  | 'entered_zone'
  | 'exited_zone';

export interface GeofenceEvent {
  id: string;
  order_id: string;
  driver_id: string | null;
  event_type: GeofenceEventType;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CoveragePolygon {
  id: string;
  zone_id: string | null;
  name: string;
  polygon_json: { paths: { lat: number; lng: number }[] };
  color: string;
  is_active: boolean;
}

export interface Zone {
  id: string;
  name: string;
  city: string;
  polygon_json?: { paths: { lat: number; lng: number }[] } | null;
  radius_km?: number | null;
  base_delivery_fee?: number;
  estimated_minutes?: number;
  is_active: boolean;
}

class GeofencingService {
  private client = getBrowserClient();

  async getActiveZones(): Promise<Zone[]> {
    const { data } = await this.client
      .from('zones')
      .select('*')
      .eq('is_active', true)
      .order('name');
    return (data || []) as Zone[];
  }

  async getCoveragePolygons(): Promise<CoveragePolygon[]> {
    const { data } = await this.client
      .from('coverage_polygons')
      .select('*')
      .eq('is_active', true);
    return (data || []) as CoveragePolygon[];
  }

  async getZonePolygons(zoneId: string): Promise<CoveragePolygon[]> {
    const { data } = await this.client
      .from('coverage_polygons')
      .select('*')
      .eq('zone_id', zoneId)
      .eq('is_active', true);
    return (data || []) as CoveragePolygon[];
  }

  async insertGeofenceEvent(event: {
    order_id: string;
    driver_id: string;
    event_type: GeofenceEventType;
    latitude: number;
    longitude: number;
    accuracy?: number;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const { error } = await this.client.from('geofence_events').insert({
      order_id: event.order_id,
      driver_id: event.driver_id,
      event_type: event.event_type,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy || null,
      metadata: event.metadata || {},
    });
    return !error;
  }

  async getOrderGeofenceEvents(orderId: string): Promise<GeofenceEvent[]> {
    const { data } = await this.client
      .from('geofence_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    return (data || []) as GeofenceEvent[];
  }

  async getDriverGeofenceEvents(driverId: string, limit = 50): Promise<GeofenceEvent[]> {
    const { data } = await this.client
      .from('geofence_events')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as GeofenceEvent[];
  }

  isPointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      if ((yi > lng) !== (yj > lng) && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  findZoneForLocation(lat: number, lng: number, zones: Zone[]): Zone | null {
    for (const zone of zones) {
      if (zone.polygon_json?.paths) {
        if (this.isPointInPolygon(lat, lng, zone.polygon_json.paths)) return zone;
      }
      if (zone.radius_km) {
        for (const [zlat, zlng] of [[11.0045, -74.8280]]) {
          const dist = this.haversineDistance(lat, lng, zlat, zlng);
          if (dist <= zone.radius_km) return zone;
        }
      }
    }
    return null;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async updateDriverLocation(driverId: string, orderId: string, lat: number, lng: number, accuracy?: number): Promise<boolean> {
    const { error: upsertError } = await this.client.from('driver_locations').upsert({
      profile_id: driverId,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });

    if (upsertError) return false;

    const zones = await this.getActiveZones();
    const zone = this.findZoneForLocation(lat, lng, zones);
    if (zone) {
      await this.insertGeofenceEvent({
        order_id: orderId,
        driver_id: driverId,
        event_type: 'entered_zone',
        latitude: lat,
        longitude: lng,
        accuracy,
        metadata: { zone_id: zone.id, zone_name: zone.name },
      });
    }
    return true;
  }
}

export const geofencingService = new GeofencingService();
