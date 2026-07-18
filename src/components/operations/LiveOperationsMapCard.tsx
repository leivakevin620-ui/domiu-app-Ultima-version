'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Expand, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { businessService } from '@/services/business';
import {
  OpenStreetLiveMap,
  type OpenStreetMapPoint,
} from '@/components/tracking/maps/OpenStreetLiveMap';

type Mode = 'admin' | 'business';

type Coordinates = { lat: number; lng: number };

type OrderRow = {
  id: string;
  order_number: string;
  business_id: string;
  courier_id: string | null;
  status: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
};

function point(lat: unknown, lng: unknown): Coordinates | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
}

export function LiveOperationsMapCard({ mode }: { mode: Mode }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [courierLocations, setCourierLocations] = useState<
    Array<{ courierId: string; orderId: string | null; position: Coordinates; updatedAt: string }>
  >([]);
  const [businessNames, setBusinessNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (manual = false) => {
      if (!profile?.id) return;
      if (manual) setRefreshing(true);
      try {
        const supabase = getBrowserClient();
        const businessId =
          mode === 'business' ? await businessService.getBusinessId(profile.id) : null;
        if (mode === 'business' && !businessId) {
          throw new Error('No se encontró el comercio asociado');
        }

        let orderQuery = supabase
          .from('orders')
          .select(
            'id,order_number,business_id,courier_id,status,pickup_lat,pickup_lng,delivery_lat,delivery_lng',
          )
          .in('status', [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'assigned',
            'accepted',
            'picked_up',
            'in_transit',
          ])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(mode === 'admin' ? 100 : 40);
        if (businessId) orderQuery = orderQuery.eq('business_id', businessId);
        const orderResult = await orderQuery;
        if (orderResult.error) throw new Error(orderResult.error.message);

        const activeOrders = (orderResult.data ?? []) as OrderRow[];
        const businessIds = [...new Set(activeOrders.map((order) => order.business_id))];
        const orderIds = activeOrders.map((order) => order.id);
        const [businessResult, locationResult] = await Promise.all([
          businessIds.length
            ? supabase.from('businesses').select('id,name').in('id', businessIds)
            : Promise.resolve({ data: [], error: null }),
          orderIds.length
            ? supabase
                .from('driver_locations')
                .select('courier_id,order_id,latitude,longitude,updated_at,created_at')
                .in('order_id', orderIds)
                .order('updated_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (businessResult.error) throw new Error(businessResult.error.message);
        if (locationResult.error) throw new Error(locationResult.error.message);

        setOrders(activeOrders);
        setBusinessNames(
          Object.fromEntries(
            (businessResult.data ?? []).map((business) => [String(business.id), String(business.name)]),
          ),
        );

        const seen = new Set<string>();
        const normalizedLocations: Array<{
          courierId: string;
          orderId: string | null;
          position: Coordinates;
          updatedAt: string;
        }> = [];
        for (const row of locationResult.data ?? []) {
          const courierId = String(row.courier_id || '');
          const orderId = row.order_id ? String(row.order_id) : null;
          const position = point(row.latitude, row.longitude);
          const key = orderId || courierId;
          if (!key || !position || seen.has(key)) continue;
          seen.add(key);
          normalizedLocations.push({
            courierId,
            orderId,
            position,
            updatedAt: String(row.updated_at || row.created_at || ''),
          });
        }
        setCourierLocations(normalizedLocations);
        setError('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el mapa operativo');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, profile?.id],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const points = useMemo<OpenStreetMapPoint[]>(() => {
    const mapPoints: OpenStreetMapPoint[] = [];
    const pickupKeys = new Set<string>();
    for (const order of orders) {
      const pickup = point(order.pickup_lat, order.pickup_lng);
      const delivery = point(order.delivery_lat, order.delivery_lng);
      if (pickup) {
        const key = `${order.business_id}:${pickup.lat.toFixed(5)}:${pickup.lng.toFixed(5)}`;
        if (!pickupKeys.has(key)) {
          pickupKeys.add(key);
          mapPoints.push({
            id: `business-${order.business_id}`,
            ...pickup,
            label: businessNames[order.business_id] || 'Comercio',
            kind: 'business',
            color: '#F59E0B',
          });
        }
      }
      if (delivery) {
        mapPoints.push({
          id: `delivery-${order.id}`,
          ...delivery,
          label: `${order.order_number} · ${order.status}`,
          kind: 'delivery',
          color: '#2563EB',
        });
      }
    }
    for (const location of courierLocations) {
      const order = location.orderId
        ? orders.find((candidate) => candidate.id === location.orderId)
        : null;
      mapPoints.push({
        id: `courier-${location.courierId || location.orderId}`,
        ...location.position,
        label: order ? `Repartidor · ${order.order_number}` : 'Repartidor en línea',
        kind: 'courier',
        color: '#10B981',
      });
    }
    return mapPoints;
  }, [businessNames, courierLocations, orders]);

  const href = mode === 'admin' ? '/admin/mapa' : '/negocio/mapa';

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-black">Mapa operativo en vivo</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {orders.length} pedidos activos · {courierLocations.length} repartidores con ubicación reciente
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            <Expand className="h-3.5 w-3.5" /> Vista completa
          </Link>
        </div>
      </div>

      {error && (
        <p className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </p>
      )}
      {loading ? (
        <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Cargando posiciones…
        </div>
      ) : (
        <OpenStreetLiveMap points={points} zoom={13} className="h-[380px] w-full" />
      )}
    </section>
  );
}
