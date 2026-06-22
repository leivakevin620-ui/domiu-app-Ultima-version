'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { businessService, type BusinessCustomer } from '@/services/business';
import { SkeletonList } from '@/components/ui/skeleton';
import { Users, Search, Star } from 'lucide-react';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
const formatDate = (s: string | null) => s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function NegocioClientes() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<BusinessCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'recent'>('spent');

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const bizId = await businessService.getBusinessId(profile.id);
      if (bizId) setCustomers(await businessService.getCustomers(bizId));
      setLoading(false);
    })();
  }, [profile?.id]);

  const filtered = [...customers]
    .filter((c) => `${c.first_name || ''} ${c.last_name || ''} ${c.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'orders') return b.order_count - a.order_count;
      if (sortBy === 'recent') return new Date(b.last_order_at || 0).getTime() - new Date(a.last_order_at || 0).getTime();
      return b.total_spent - a.total_spent;
    });

  const totalSpent = customers.reduce((s, c) => s + c.total_spent, 0);

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning/10 to-warning/5">
            <Users className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">{customers.length} clientes · {formatCurrency(totalSpent)} en pedidos</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clientes..." className="h-10 w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" />
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-background/50 p-1">
          {[
            { key: 'spent', label: 'Gasto' },
            { key: 'orders', label: 'Pedidos' },
            { key: 'recent', label: 'Reciente' },
          ].map((opt) => (
            <button key={opt.key} onClick={() => setSortBy(opt.key as 'spent' | 'orders' | 'recent')} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${sortBy === opt.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{opt.label}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No hay clientes con pedidos entregados aún.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => (
            <div key={customer.id} className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-warning/20 to-orange-200/20 text-sm font-bold text-warning">
                  {customer.first_name?.[0] || customer.email[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{customer.first_name || customer.last_name ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : customer.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.email} {customer.phone ? `· ${customer.phone}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="text-right">
                    <p className="text-muted-foreground">Pedidos</p>
                    <p className="font-semibold text-foreground">{customer.order_count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-foreground">{formatCurrency(customer.total_spent)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Val. Medio</p>
                    <p className="font-semibold text-foreground">{customer.order_count > 0 ? formatCurrency(Math.round(customer.total_spent / customer.order_count)) : '—'}</p>
                  </div>
                  {customer.avg_rating && (
                    <div className="text-right">
                      <p className="text-muted-foreground">Rating</p>
                      <p className="flex items-center gap-0.5 font-semibold text-warning"><Star className="h-3 w-3 fill-current" />{customer.avg_rating}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-muted-foreground">Último</p>
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
