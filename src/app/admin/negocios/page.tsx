'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Plus, RefreshCw, Search, ExternalLink, MoreHorizontal, CheckCircle, XCircle, AlertTriangle, Power, UserRoundCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAllBusinessesAdmin, updateBusinessAction, deleteBusinessAction } from '@/app/actions/admin-business';
import { assignBusinessOwnerAction, getAssignableBusinessOwnersAction, setBusinessActiveStateAction } from '@/app/actions/admin-business-lifecycle';

interface BusinessRow {
  id: string; name: string; slug: string; owner_name: string | null;
  owner_email: string; cuisine_type: string | null; business_type: string;
  phone: string | null; is_verified: boolean; is_active: boolean;
  rating: number; total_ratings: number; total_orders: number;
  created_at: string; updated_at: string;
}

type OwnerOption = { id: string; name: string; email: string; role: string };
type LifecycleModal = { type: 'status' | 'owner'; business: BusinessRow } | null;

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState<BusinessRow | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [lifecycleModal, setLifecycleModal] = useState<LifecycleModal>(null);
  const [reason, setReason] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllBusinessesAdmin(search || undefined, filter);
      setBusinesses(data);
    } catch { toast.error('Error al cargar negocios'); }
    finally { setLoading(false); }
  }, [search, filter]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const closeLifecycleModal = () => {
    setLifecycleModal(null);
    setReason('');
    setOwnerId('');
    setOwners([]);
  };

  const openStatusModal = (business: BusinessRow) => {
    setReason('');
    setLifecycleModal({ type: 'status', business });
  };

  const openOwnerModal = async (business: BusinessRow) => {
    setReason('');
    setOwnerId('');
    setLifecycleModal({ type: 'owner', business });
    const data = await getAssignableBusinessOwnersAction();
    setOwners(data);
  };

  const handleToggleVerify = async (b: BusinessRow) => {
    const res = await updateBusinessAction(b.id, { isVerified: !b.is_verified });
    if (res.error) { toast.error(res.error); return; }
    toast.success(`${b.name} ${b.is_verified ? 'desmarcado como verificado' : 'verificado'}`);
    load();
  };

  const handleLifecycleStatus = async () => {
    if (!lifecycleModal || lifecycleModal.type !== 'status') return;
    setProcessing(true);
    try {
      const business = lifecycleModal.business;
      const res = await setBusinessActiveStateAction({
        businessId: business.id,
        isActive: !business.is_active,
        reason,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`${business.name} ${business.is_active ? 'suspendido' : 'reactivado'} correctamente`);
      closeLifecycleModal();
      await load();
    } finally {
      setProcessing(false);
    }
  };

  const handleAssignOwner = async () => {
    if (!lifecycleModal || lifecycleModal.type !== 'owner') return;
    setProcessing(true);
    try {
      const res = await assignBusinessOwnerAction({
        businessId: lifecycleModal.business.id,
        ownerId,
        reason,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Propietario asignado a ${lifecycleModal.business.name}`);
      closeLifecycleModal();
      await load();
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteBusinessAction(id);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Negocio eliminado');
    setShowDeleteConfirm(null);
    load();
  };

  const loadDetail = async (b: BusinessRow) => {
    setSelectedBiz(b);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const { getBusinessFullDetail } = await import('@/app/actions/admin-business');
      const data = await getBusinessFullDetail(b.id);
      setDetailData(data);
    } catch { toast.error('Error al cargar detalle'); }
    finally { setDetailLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gestión de Negocios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administra, verifica y controla todos los negocios</p>
        </div>
        <button onClick={() => router.push('/admin/negocios/crear')} className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 border-0 transition-all">
          <Plus className="h-4 w-4" /> Nuevo Negocio
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, propietario..." className="h-10 w-full rounded-xl border border-border bg-input-bg pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none focus:ring-2 focus:ring-ring/20" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-input-bg px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none">
          <option value="all">Todos</option>
          <option value="verified">Verificados</option>
          <option value="pending">Pendientes</option>
          <option value="suspended">Suspendidos</option>
        </select>
        <button onClick={load} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {businesses.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Store className="mb-3 h-12 w-12 text-slate-600" />
          <p className="text-lg font-medium">No hay negocios</p>
          <p className="text-sm">Crea el primer negocio para empezar</p>
        </div>
      )}

      <div className="grid gap-3">
        {businesses.map(b => (
          <div key={b.id} className="group rounded-xl border border-border bg-card p-4 hover:border-border transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/15"><Store className="h-5 w-5 text-success" /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">{b.name}</h3>
                    {b.is_verified ? <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success"><CheckCircle className="h-3 w-3" /> Verificado</span> : <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning"><AlertTriangle className="h-3 w-3" /> Pendiente</span>}
                    {!b.is_active && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive"><XCircle className="h-3 w-3" /> Suspendido</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{b.slug}</span>
                    {b.owner_name && <span>Dueño: {b.owner_name}</span>}
                    {b.cuisine_type && <span>{b.cuisine_type}</span>}
                    <span>{b.total_orders} pedidos</span>
                    <span>{b.rating} ⭐ ({b.total_ratings})</span>
                    <span>Creado {new Date(b.created_at).toLocaleDateString('es-CO')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => loadDetail(b)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title="Ver detalle"><ExternalLink className="h-4 w-4" /></button>
                <div className="relative group/menu">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"><MoreHorizontal className="h-4 w-4" /></button>
                  <div className="absolute right-0 top-full z-50 mt-1 hidden group-hover/menu:block">
                    <div className="min-w-[210px] rounded-xl border border-border bg-slate-800 p-1.5 shadow-lg">
                      <button onClick={() => handleToggleVerify(b)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground/80 hover:bg-muted">
                        {b.is_verified ? <XCircle className="h-3.5 w-3.5 text-warning" /> : <CheckCircle className="h-3.5 w-3.5 text-success" />}
                        {b.is_verified ? 'Desmarcar verificado' : 'Verificar negocio'}
                      </button>
                      <button onClick={() => openStatusModal(b)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground/80 hover:bg-muted">
                        <Power className={`h-3.5 w-3.5 ${b.is_active ? 'text-destructive' : 'text-success'}`} />
                        {b.is_active ? 'Suspender negocio' : 'Reactivar negocio'}
                      </button>
                      <button onClick={() => openOwnerModal(b)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground/80 hover:bg-muted">
                        <UserRoundCog className="h-3.5 w-3.5 text-sky-400" /> Cambiar propietario
                      </button>
                      <button onClick={() => setShowDeleteConfirm(b.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/20"><XCircle className="h-3.5 w-3.5" /> Eliminar negocio</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {lifecycleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={closeLifecycleModal}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-slate-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground">
              {lifecycleModal.type === 'status'
                ? `${lifecycleModal.business.is_active ? 'Suspender' : 'Reactivar'} negocio`
                : 'Asignar propietario'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{lifecycleModal.business.name}</p>

            {lifecycleModal.type === 'owner' && (
              <div className="mt-5">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nuevo propietario</label>
                <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-input-bg px-3 text-sm text-foreground">
                  <option value="">Seleccionar usuario...</option>
                  {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} — {owner.email}</option>)}
                </select>
                {owners.length === 0 && <p className="mt-2 text-xs text-warning">No hay usuarios activos disponibles con rol cliente o negocio.</p>}
              </div>
            )}

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Motivo obligatorio</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={4} placeholder="Describe el motivo de esta acción..." className="w-full resize-none rounded-xl border border-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring/50 focus:ring-2 focus:ring-ring/20" />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{reason.length}/500</p>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={closeLifecycleModal} disabled={processing} className="flex-1 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50">Cancelar</button>
              <button
                onClick={lifecycleModal.type === 'status' ? handleLifecycleStatus : handleAssignOwner}
                disabled={processing || reason.trim().length < 3 || (lifecycleModal.type === 'owner' && !ownerId)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                {lifecycleModal.type === 'status' ? (lifecycleModal.business.is_active ? 'Suspender' : 'Reactivar') : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (() => {
        const b = businesses.find(x => x.id === showDeleteConfirm);
        if (!b) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
            <div className="w-full max-w-sm rounded-xl border border-border bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-foreground">Eliminar negocio</h3>
              <p className="mt-2 text-sm text-muted-foreground">¿Eliminar &quot;{b.name}&quot;? Esta acción realizará un borrado lógico y lo dejará inactivo.</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleDelete(b.id)} className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90">Eliminar</button>
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80">Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8" onClick={() => { setSelectedBiz(null); setDetailData(null); }}>
          <div className="relative w-full max-w-3xl rounded-xl border border-border bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3"><Store className="h-6 w-6 text-success" /><h2 className="text-xl font-bold text-foreground">{selectedBiz.name}</h2></div>
              <button onClick={() => { setSelectedBiz(null); setDetailData(null); }} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            {detailLoading && <div className="py-12 text-center text-muted-foreground">Cargando detalle...</div>}
            {detailData && !detailLoading && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Estado', value: detailData.business.is_active ? 'Activo' : 'Suspendido', color: detailData.business.is_active ? 'text-success' : 'text-destructive' },
                    { label: 'Verificado', value: detailData.business.is_verified ? 'Sí' : 'No', color: detailData.business.is_verified ? 'text-success' : 'text-warning' },
                    { label: 'Total Pedidos', value: detailData.totalOrders },
                    { label: 'Productos', value: detailData.products?.length || 0 },
                  ].map(s => <div key={s.label} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-lg font-bold ${s.color || 'text-foreground'}`}>{s.value}</p></div>)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información</h4>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="text-muted-foreground">Slug:</span> <span className="text-foreground">{detailData.business.slug}</span></p>
                      <p><span className="text-muted-foreground">Tipo:</span> <span className="text-foreground">{detailData.business.cuisine_type || '—'}</span></p>
                      <p><span className="text-muted-foreground">Teléfono:</span> <span className="text-foreground">{detailData.business.phone || '—'}</span></p>
                      <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{detailData.business.email || '—'}</span></p>
                      <p><span className="text-muted-foreground">Rating:</span> <span className="text-foreground">{detailData.business.rating} ⭐ ({detailData.business.total_ratings})</span></p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Propietario</h4>
                    {detailData.owner ? <div className="space-y-1.5 text-sm">
                      <p><span className="text-muted-foreground">Nombre:</span> <span className="text-foreground">{[detailData.owner.first_name, detailData.owner.last_name].filter(Boolean).join(' ') || '—'}</span></p>
                      <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{detailData.owner.email}</span></p>
                      <p><span className="text-muted-foreground">Teléfono:</span> <span className="text-foreground">{detailData.owner.phone || '—'}</span></p>
                      <p><span className="text-muted-foreground">Rol:</span> <span className="text-foreground">{detailData.owner.role}</span></p>
                    </div> : <p className="text-sm text-muted-foreground">Sin datos</p>}
                  </div>
                </div>
                {detailData.hours && detailData.hours.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Horarios</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{detailData.hours.map((h: any) => <div key={h.day_of_week} className="rounded-lg bg-muted/50 p-2 text-xs"><p className="text-muted-foreground font-medium">{DAYS[h.day_of_week]}</p>{h.is_closed ? <p className="text-destructive">Cerrado</p> : <p className="text-foreground/80">{h.opens_at?.slice(0, 5)} - {h.closes_at?.slice(0, 5)}</p>}</div>)}</div></div>}
                {detailData.addresses && detailData.addresses.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Direcciones</h4>{detailData.addresses.map((a: any) => <div key={a.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p className="text-foreground">{a.street_address}</p><p className="text-xs text-muted-foreground">{a.city}, {a.country} {a.is_primary ? '(Principal)' : ''}</p>{a.latitude && a.longitude && <p className="text-xs text-muted-foreground">Coord: {a.latitude}, {a.longitude}</p>}</div>)}</div>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => router.push(`/admin/negocios/${selectedBiz.id}/productos`)} className="rounded-lg bg-muted px-4 py-2 text-sm text-foreground hover:bg-muted/80 border border-border">Gestionar Productos</button>
                  <button onClick={() => router.push(`/admin/negocios/${selectedBiz.id}`)} className="rounded-lg bg-success/20 px-4 py-2 text-sm font-medium text-success hover:bg-success/30 border border-success/30">Panel completo</button>
                  <button onClick={() => { setSelectedBiz(null); openOwnerModal(selectedBiz); }} className="rounded-lg bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/25 border border-sky-500/30">Cambiar propietario</button>
                  <button onClick={() => { setSelectedBiz(null); openStatusModal(selectedBiz); }} className="rounded-lg bg-warning/15 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/25 border border-warning/30">{selectedBiz.is_active ? 'Suspender' : 'Reactivar'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
