'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessCustomer } from '@/services/business';
import { SkeletonList } from '@/components/ui/skeleton';
import { getBrowserClient } from '@/lib/db/supabase';
import { Users, Search, Star, RefreshCw } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export default function NegocioClientes() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<BusinessCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'recent'>('recent');
  const [error, setError] = useState('');

  const loadCustomers = useCallback(async (showSpinner = false) => {
    if (!profile?.id) return;
    if (showSpinner) setRefreshing(true);
    try {
      const id = businessId || (await businessService.getBusinessId(profile.id));
      if (!id) {
        setCustomers([]);
        setError('No se encontró un negocio asociado a esta cuenta.');
        return;
      }
      if (!businessId) setBusinessId(id);
      setCustomers(await businessService.getCustomers(id));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, profile?.id]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!businessId) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`business-customers-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${businessId}`,
        },
        () => void loadCustomers(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, loadCustomers]);

  const filtered = [...customers]
    .filter((customer) =>
      `${customer.first_name || ''} ${customer.last_name || ''} ${customer.email} ${customer.phone || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === 'orders') return b.order_count - a.order_count;
      if (sortBy === 'recent') {
        return new Date(b.last_order_at || 0).getTime() - new Date(a.last_order_at || 0).getTime();
      }
      return b.total_spent - a.total_spent;
    });

  const totalSpent = customers.reduce((total, customer) => total + customer.total_spent, 0);
  const activeOrders = customers.reduce((total, customer) => total + customer.active_orders, 0);

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
            <Users className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {customers.length} clientes · {activeOrders} pedidos activos · {formatCurrency(totalSpent)} cobrados
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadCustomers(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o teléfono..."
            className="h-10 w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-background/50 p-1">
          {[
            { key: 'recent', label: 'Reciente' },
            { key: 'orders', label: 'Pedidos' },
            { key: 'spent', label: 'Cobrado' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSortBy(option.key as 'spent' | 'orders' | 'recent')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                sortBy === option.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no hay clientes con pedidos para este negocio.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => (
            <div key={customer.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/20 text-sm font-bold text-warning">
                  {customer.first_name?.[0] || customer.email[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {customer.first_name || customer.last_name
                      ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                      : customer.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer.phone || 'Teléfono no registrado'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-5 text-xs">
                  <div className="text-right">
                    <p className="text-muted-foreground">Pedidos</p>
                    <p className="font-semibold text-foreground">{customer.order_count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Activos</p>
                    <p className="font-semibold text-primary">{customer.active_orders}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Entregados</p>
                    <p className="font-semibold text-foreground">{customer.delivered_orders}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Total cobrado</p>
                    <p className="font-semibold text-foreground">{formatCurrency(customer.total_spent)}</p>
                  </div>
                  {customer.avg_rating !== null && (
                    <div className="text-right">
                      <p className="text-muted-foreground">Rating</p>
                      <p className="flex items-center gap-0.5 font-semibold text-warning">
                        <Star className="h-3 w-3 fill-current" /> {customer.avg_rating}
                      </p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-muted-foreground">Último pedido</p>
                    <p className="font-medium text-foreground">{formatDate(customer.last_order_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
