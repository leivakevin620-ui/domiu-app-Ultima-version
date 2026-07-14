'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Clock, DollarSign, MapPin, Plus, RefreshCw, Truck, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService } from '@/services/business';
import { getBrowserClient } from '@/lib/db/supabase';
import { SkeletonList } from '@/components/ui/skeleton';

const STATUS_CONFIG: Record<string, { label: string; text: string; border: string }> = {
  pending: { label: 'Pendiente', text: 'text-warning', border: 'border-l-warning' },
  assigned: { label: 'Asignado', text: 'text-info', border: 'border-l-info' },
  accepted: { label: 'Aceptado', text: 'text-info', border: 'border-l-info' },
  picked_up: { label: 'Recogido', text: 'text-primary', border: 'border-l-primary' },
  in_transit: { label: 'En camino', text: 'text-primary', border: 'border-l-primary' },
  delivered: { label: 'Entregado', text: 'text-success', border: 'border-l-success' },
  cancelled: { label: 'Cancelado', text: 'text-destructive', border: 'border-l-destructive' },
};

interface ManualDelivery {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  deliveryFee: number;
  courierEarnings: number | null;
  platformEarnings: number | null;
  deliveryAddress: string;
  customerPhone: string | null;
  specialInstructions: string | null;
  createdAt: string;
  courierName: string | null;
  customerName: string;
  pickupAddress: string | null;
  distanceKm: number | null;
}

type RelationName = { first_name?: string | null; last_name?: string | null };
type DeliveryRelation = { street_address?: string | null; city?: string | null };
type DeliveryRow = Record<string, unknown>;

function firstRelation<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  return value && typeof value === 'object' ? (value as T) : null;
}

function fullName(value: unknown, fallback: string) {
  const relation = firstRelation<RelationName>(value);
  return relation
    ? [relation.first_name, relation.last_name].filter(Boolean).join(' ') || fallback
    : fallback;
}

function currency(value: number | null | undefined) {
  if (value == null) return '-';
  return Number(value).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NegocioDomiciliosPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ManualDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    if (!silent) setRefreshing(true);
    setError(null);

    try {
      const businessId = await businessService.getBusinessId(profile.id);
      if (!businessId) {
        setOrders([]);
        setError('No encontramos un negocio asociado a tu cuenta.');
        return;
      }

      const client = await getBrowserClient();
      const { data, error: queryError } = await client
        .from('orders')
        .select(`
          id, order_number, order_code, status, total_amount, delivery_fee,
          courier_earnings, platform_earnings, customer_phone,
          special_instructions, created_at, pickup_address, delivery_distance_km,
          customer:profiles!orders_customer_id_fkey(first_name, last_name),
          courier:profiles!orders_courier_id_fkey(first_name, last_name),
          delivery:addresses!orders_delivery_address_id_fkey(street_address, city)
        `)
        .eq('business_id', businessId)
        .eq('order_type', 'manual_delivery')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) throw new Error(queryError.message);

      setOrders(((data || []) as DeliveryRow[]).map((row) => {
        const delivery = firstRelation<DeliveryRelation>(row.delivery);
        const deliveryAddress = [delivery?.street_address, delivery?.city].filter(Boolean).join(', ');
        return {
          id: String(row.id),
          orderNumber: String(row.order_code || row.order_number || '').replace(/^#/, ''),
          status: String(row.status || 'pending'),
          totalAmount: Number(row.total_amount || 0),
          deliveryFee: Number(row.delivery_fee || 0),
          courierEarnings: row.courier_earnings == null ? null : Number(row.courier_earnings),
          platformEarnings: row.platform_earnings == null ? null : Number(row.platform_earnings),
          deliveryAddress: deliveryAddress || 'Dirección no disponible',
          customerPhone: row.customer_phone ? String(row.customer_phone) : null,
          specialInstructions: row.special_instructions ? String(row.special_instructions) : null,
          createdAt: String(row.created_at),
          courierName: firstRelation<RelationName>(row.courier) ? fullName(row.courier, 'Repartidor') : null,
          customerName: fullName(row.customer, 'Cliente'),
          pickupAddress: row.pickup_address ? String(row.pickup_address) : null,
          distanceKm: row.delivery_distance_km == null ? null : Number(row.delivery_distance_km),
        };
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los domicilios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const interval = window.setInterval(() => void loadOrders(true), 15000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
            <Truck className="h-5 w-5 text-info" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Domicilios</h1>
            <p className="mt-1 text-sm text-muted-foreground">Envíos manuales creados por tu negocio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <Link
            href="/negocio/domicilios/crear"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Nuevo domicilio
          </Link>
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
          <Truck className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <p className="mt-3 font-medium text-foreground">Todavía no hay domicilios</p>
          <p className="mt-1 text-sm text-muted-foreground">Crea el primer envío recibido por WhatsApp, llamada o directamente en el local.</p>
          <Link href="/negocio/domicilios/crear" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Crear domicilio
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status] || {
              label: order.status,
              text: 'text-muted-foreground',
              border: 'border-l-muted',
            };
            const expanded = selectedId === order.id;

            return (
              <article
                key={order.id}
                className={`overflow-hidden rounded-2xl border border-border/60 border-l-4 bg-card shadow-sm transition hover:shadow-md ${config.border}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(expanded ? null : order.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground">{order.orderNumber || order.id.slice(0, 8)}</span>
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${config.text}`}>{config.label}</span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{order.deliveryAddress}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{order.customerName}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{currency(order.totalAmount)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{dateTime(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border/50 bg-muted/20 px-4 py-4">
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <p><span className="text-muted-foreground">Teléfono:</span> {order.customerPhone || 'No registrado'}</p>
                      <p><span className="text-muted-foreground">Repartidor:</span> {order.courierName || 'Pendiente por aceptar'}</p>
                      <p><span className="text-muted-foreground">Recoger en:</span> {order.pickupAddress || 'Dirección del negocio'}</p>
                      <p><span className="text-muted-foreground">Distancia:</span> {order.distanceKm == null ? 'No registrada' : `${order.distanceKm.toFixed(2)} km`}</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Tarifa</p><p className="mt-1 font-semibold">{currency(order.deliveryFee)}</p></div>
                      <div className="rounded-xl bg-success/5 p-3"><p className="text-xs text-muted-foreground">Repartidor</p><p className="mt-1 font-semibold text-success">{currency(order.courierEarnings)}</p></div>
                      <div className="rounded-xl bg-primary/5 p-3"><p className="text-xs text-muted-foreground">DomiU</p><p className="mt-1 font-semibold text-primary">{currency(order.platformEarnings)}</p></div>
                    </div>
                    {order.specialInstructions && <p className="mt-3 rounded-xl bg-background p-3 text-sm text-muted-foreground">📝 {order.specialInstructions}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
