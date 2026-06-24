'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Store, ArrowLeft, Package, Clock, MapPin, Star, ShoppingCart, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getBusinessFullDetail, updateBusinessAction } from '@/app/actions/admin-business';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'products' | 'orders' | 'hours'>('info');

  useEffect(() => {
    (async () => {
      try {
        const d = await getBusinessFullDetail(id);
        setData(d);
      } catch { toast.error('Error al cargar detalle'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Store className="mb-3 h-12 w-12 text-slate-600" />
        <p className="text-lg text-muted-foreground">Negocio no encontrado</p>
        <button onClick={() => router.push('/admin/negocios')} className="mt-4 text-sm text-success hover:underline">Volver</button>
      </div>
    );
  }

  const b = data.business;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/negocios')} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
          <Store className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{b.name}</h1>
            {b.is_verified && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">Verificado</span>}
            {!b.is_active && <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive">Suspendido</span>}
          </div>
          <p className="text-sm text-muted-foreground">{b.slug} · {b.cuisine_type || 'Sin tipo'}</p>
        </div>
        <button
          onClick={async () => {
            const res = await updateBusinessAction(id, { isActive: !b.is_active });
            if (res.error) { toast.error(res.error); return; }
            toast.success(b.is_active ? 'Suspendido' : 'Reactivado');
            const d = await getBusinessFullDetail(id);
            setData(d);
          }}
          className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all ${
            b.is_active
              ? 'border-destructive/30 text-destructive hover:bg-destructive/20'
              : 'border-success/30 text-success hover:bg-success/20'
          }`}
        >
          {b.is_active ? 'Suspender' : 'Reactivar'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Productos', value: data.products?.length || 0, icon: Package, color: 'text-info' },
          { label: 'Pedidos totales', value: data.totalOrders, icon: ShoppingCart, color: 'text-success' },
          { label: 'Rating', value: `${b.rating} ⭐`, icon: Star, color: 'text-warning' },
          { label: 'Categorías', value: data.categories?.length || 0, icon: FileText, color: 'text-info' },
          { label: 'Creado', value: new Date(b.created_at).toLocaleDateString('es-CO'), icon: Clock, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex border-b border-border">
        {[
          { key: 'info' as const, label: 'Información', icon: FileText },
          { key: 'products' as const, label: 'Productos', icon: Package },
          { key: 'orders' as const, label: 'Pedidos', icon: ShoppingCart },
          { key: 'hours' as const, label: 'Horarios', icon: Clock },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              tab === t.key
                ? 'border-emerald-500 text-success'
                : 'border-transparent text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Datos del Negocio</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Nombre', b.name],
                ['Slug', b.slug],
                ['Tipo', b.cuisine_type || '—'],
                ['Tipo negocio', b.business_type || '—'],
                ['Teléfono', b.phone || '—'],
                ['Email', b.email || '—'],
                ['Website', b.website || '—'],
                ['Rating', `${b.rating} (${b.total_ratings} reseñas)`],
                ['Verificado', b.is_verified ? 'Sí' : 'No'],
                ['Activo', b.is_active ? 'Sí' : 'No'],
                ['Creado', new Date(b.created_at).toLocaleString('es-CO')],
                ['Actualizado', b.updated_at ? new Date(b.updated_at).toLocaleString('es-CO') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between rounded-lg bg-card px-3 py-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Propietario</h3>
            {data.owner && (
              <div className="space-y-2 text-sm">
                {[
                  ['Nombre', [data.owner.first_name, data.owner.last_name].filter(Boolean).join(' ') || '—'],
                  ['Email', data.owner.email],
                  ['Teléfono', data.owner.phone || '—'],
                  ['Rol', data.owner.role],
                  ['Estado', data.owner.status],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between rounded-lg bg-card px-3 py-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="mt-6 text-sm font-semibold text-muted-foreground uppercase">Direcciones</h3>
            {data.addresses?.map((a: any) => (
              <div key={a.id} className="rounded-lg bg-card p-3 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-success" />
                  <span className="text-foreground">{a.street_address}</span>
                  {a.is_primary && <span className="text-[10px] text-success">PRINCIPAL</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.city}, {a.country}</p>
                {a.latitude && <p className="text-xs text-muted-foreground">Coord: {a.latitude}, {a.longitude}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{data.products?.length || 0} productos</p>
            <button onClick={() => router.push(`/admin/negocios/${id}/productos`)} className="rounded-lg bg-success/20 px-3 py-2 text-xs font-medium text-success border border-success/30 hover:bg-emerald-900/70">
              Gestionar Productos
            </button>
          </div>
          <div className="grid gap-2">
            {data.products?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category_name} · ${p.price?.toLocaleString('es-CO')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    p.status === 'available' ? 'bg-success/15 text-success' :
                    p.status === 'unavailable' ? 'bg-warning/20 text-warning' :
                    'bg-destructive/20 text-destructive'
                  }`}>
                    {p.status === 'available' ? 'Disponible' : p.status === 'unavailable' ? 'No disponible' : 'Descontinuado'}
                  </span>
                </div>
              </div>
            ))}
            {(!data.products || data.products.length === 0) && (
              <p className="text-sm text-muted-foreground py-8 text-center">Este negocio no tiene productos aún</p>
            )}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">{data.totalOrders} pedidos totales</p>
          <div className="grid gap-2">
            {data.recentOrders?.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString('es-CO')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">${o.total_amount?.toLocaleString('es-CO')}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    o.status === 'delivered' ? 'bg-success/15 text-success' :
                    o.status === 'cancelled' ? 'bg-destructive/20 text-destructive' :
                    o.status === 'pending' ? 'bg-warning/20 text-warning' :
                    'bg-info/20 text-info'
                  }`}>{o.status}</span>
                </div>
              </div>
            ))}
            {(!data.recentOrders || data.recentOrders.length === 0) && (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay pedidos</p>
            )}
          </div>
        </div>
      )}

      {tab === 'hours' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.hours?.map((h: any) => (
            <div key={h.day_of_week} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <span className="text-sm font-medium text-foreground">{DAYS[h.day_of_week]}</span>
              {h.is_closed ? (
                <span className="text-xs text-destructive">Cerrado</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {h.opens_at?.slice(0, 5)} — {h.closes_at?.slice(0, 5)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
