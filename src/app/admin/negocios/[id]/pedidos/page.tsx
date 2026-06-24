'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart, ArrowLeft, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { getBusinessOrdersAdmin } from '@/app/actions/admin-business';

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
  pending: 'bg-warning/20 text-warning',
  confirmed: 'bg-info/20 text-info',
  preparing: 'bg-info/20 text-info',
  ready: 'bg-info/20 text-info',
  in_transit: 'bg-info/20 text-info',
  assigned: 'bg-info/20 text-info',
};

export default function BusinessPedidosPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getBusinessOrdersAdmin(id);
        setOrders(data);
      } catch { toast.error('Error al cargar pedidos'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const filtered = orders.filter(o =>
    !search || o.order_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/admin/negocios/${id}`)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50">
          <ShoppingCart className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">{orders.length} pedidos</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShoppingCart className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm">No hay pedidos</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(o => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-border transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <ShoppingCart className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{o.order_number}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status] || 'bg-muted text-muted-foreground'}`}>
                      {o.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    <span>Cliente: {o.customer_name}</span>
                    {o.courier_name && <span>Repartidor: {o.courier_name}</span>}
                    <span>Pago: {o.payment_status}</span>
                    <span>{new Date(o.created_at).toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-foreground">${(o.total_amount || 0).toLocaleString('es-CO')}</span>
                <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title="Ver detalle">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
