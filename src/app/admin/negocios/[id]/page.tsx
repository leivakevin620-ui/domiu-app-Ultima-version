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
        <div className="text-slate-500">Cargando...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Store className="mb-3 h-12 w-12 text-slate-600" />
        <p className="text-lg text-slate-400">Negocio no encontrado</p>
        <button onClick={() => router.push('/admin/negocios')} className="mt-4 text-sm text-emerald-400 hover:underline">Volver</button>
      </div>
    );
  }

  const b = data.business;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/negocios')} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50">
          <Store className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{b.name}</h1>
            {b.is_verified && <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Verificado</span>}
            {!b.is_active && <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-medium text-red-400">Suspendido</span>}
          </div>
          <p className="text-sm text-slate-500">{b.slug} · {b.cuisine_type || 'Sin tipo'}</p>
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
              ? 'border-red-800/50 text-red-400 hover:bg-red-900/30'
              : 'border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/30'
          }`}
        >
          {b.is_active ? 'Suspender' : 'Reactivar'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Productos', value: data.products?.length || 0, icon: Package, color: 'text-blue-400' },
          { label: 'Pedidos totales', value: data.totalOrders, icon: ShoppingCart, color: 'text-emerald-400' },
          { label: 'Rating', value: `${b.rating} ⭐`, icon: Star, color: 'text-amber-400' },
          { label: 'Categorías', value: data.categories?.length || 0, icon: FileText, color: 'text-purple-400' },
          { label: 'Creado', value: new Date(b.created_at).toLocaleDateString('es-CO'), icon: Clock, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{s.label}</p>
            </div>
            <p className="mt-1 text-lg font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex border-b border-slate-700/50">
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
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase">Datos del Negocio</h3>
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
                <div key={label} className="flex justify-between rounded-lg bg-slate-800/30 px-3 py-2">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-white font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase">Propietario</h3>
            {data.owner && (
              <div className="space-y-2 text-sm">
                {[
                  ['Nombre', [data.owner.first_name, data.owner.last_name].filter(Boolean).join(' ') || '—'],
                  ['Email', data.owner.email],
                  ['Teléfono', data.owner.phone || '—'],
                  ['Rol', data.owner.role],
                  ['Estado', data.owner.status],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between rounded-lg bg-slate-800/30 px-3 py-2">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-white font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="mt-6 text-sm font-semibold text-slate-400 uppercase">Direcciones</h3>
            {data.addresses?.map((a: any) => (
              <div key={a.id} className="rounded-lg bg-slate-800/30 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  <span className="text-white">{a.street_address}</span>
                  {a.is_primary && <span className="text-[10px] text-emerald-400">PRINCIPAL</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{a.city}, {a.country}</p>
                {a.latitude && <p className="text-xs text-slate-500">Coord: {a.latitude}, {a.longitude}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{data.products?.length || 0} productos</p>
            <button onClick={() => router.push(`/admin/negocios/${id}/productos`)} className="rounded-lg bg-emerald-900/50 px-3 py-2 text-xs font-medium text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/70">
              Gestionar Productos
            </button>
          </div>
          <div className="grid gap-2">
            {data.products?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/50">
                    <Package className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.category_name} · ${p.price?.toLocaleString('es-CO')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    p.status === 'available' ? 'bg-emerald-900/40 text-emerald-400' :
                    p.status === 'unavailable' ? 'bg-amber-900/40 text-amber-400' :
                    'bg-red-900/40 text-red-400'
                  }`}>
                    {p.status === 'available' ? 'Disponible' : p.status === 'unavailable' ? 'No disponible' : 'Descontinuado'}
                  </span>
                </div>
              </div>
            ))}
            {(!data.products || data.products.length === 0) && (
              <p className="text-sm text-slate-500 py-8 text-center">Este negocio no tiene productos aún</p>
            )}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div>
          <p className="text-sm text-slate-400 mb-4">{data.totalOrders} pedidos totales</p>
          <div className="grid gap-2">
            {data.recentOrders?.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-white">{o.order_number}</p>
                    <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString('es-CO')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">${o.total_amount?.toLocaleString('es-CO')}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    o.status === 'delivered' ? 'bg-emerald-900/40 text-emerald-400' :
                    o.status === 'cancelled' ? 'bg-red-900/40 text-red-400' :
                    o.status === 'pending' ? 'bg-amber-900/40 text-amber-400' :
                    'bg-blue-900/40 text-blue-400'
                  }`}>{o.status}</span>
                </div>
              </div>
            ))}
            {(!data.recentOrders || data.recentOrders.length === 0) && (
              <p className="text-sm text-slate-500 py-8 text-center">No hay pedidos</p>
            )}
          </div>
        </div>
      )}

      {tab === 'hours' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.hours?.map((h: any) => (
            <div key={h.day_of_week} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
              <span className="text-sm font-medium text-white">{DAYS[h.day_of_week]}</span>
              {h.is_closed ? (
                <span className="text-xs text-red-400">Cerrado</span>
              ) : (
                <span className="text-xs text-slate-400">
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
