'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, CheckCircle, XCircle, Clock, UserCheck, Store, Truck, MapPin, Calendar, Info, Car, Hash, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import {
  getCourierApplications,
  getBusinessApplications,
  approveCourierApplication,
  rejectCourierApplication,
  approveBusinessApplication,
  rejectBusinessApplication,
  type CourierApplication,
  type BusinessApplication,
} from '@/app/actions/admin-applications';
import {
  approveBusinessApplicationSafe,
  rejectBusinessApplicationSafe,
} from '@/app/actions/admin-business-applications';

const statusBadge: Record<string, 'warning' | 'success' | 'destructive' | 'outline'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  approved: <CheckCircle className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
};

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const filterOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'rejected', label: 'Rechazados' },
];

export default function AdminSolicitudesPage() {
  const [activeTab, setActiveTab] = useState('couriers');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [courierApps, setCourierApps] = useState<CourierApplication[]>([]);
  const [businessApps, setBusinessApps] = useState<BusinessApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<CourierApplication | BusinessApplication | null>(null);
  const [detailApp, setDetailApp] = useState<CourierApplication | BusinessApplication | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; app: CourierApplication | BusinessApplication } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'couriers') {
        const data = await getCourierApplications(search || undefined, filter);
        setCourierApps(data);
      } else {
        const data = await getBusinessApplications(search || undefined, filter);
        setBusinessApps(data);
      }
    } catch {
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, filter]);

  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      load();
    }
  }, [load]);

  const handleApprove = async (app: CourierApplication | BusinessApplication) => {
    setProcessing(true);
    try {
      let res;
      if (activeTab === 'couriers') {
        res = await approveCourierApplication(app.id, reviewNote.trim() || undefined);
      } else {
        res = await approveBusinessApplicationSafe(app.id, reviewNote.trim() || undefined);
      }
      if (res.error) { toast.error(res.error); return; }
      toast.success('Solicitud aprobada correctamente');
      setConfirmAction(null);
      setSelectedApp(null);
      setDetailApp(null);
      setReviewConfirmed(false);
      setReviewNote('');
      load();
    } catch { toast.error('Error al aprobar solicitud'); }
    finally { setProcessing(false); }
  };

  const handleReject = async (app: CourierApplication | BusinessApplication) => {
    if (!rejectReason.trim()) { toast.error('Debes indicar un motivo de rechazo'); return; }
    setProcessing(true);
    try {
      let res;
      if (activeTab === 'couriers') {
        res = await rejectCourierApplication(app.id, rejectReason.trim());
      } else {
        res = await rejectBusinessApplicationSafe(app.id, rejectReason.trim());
      }
      if (res.error) { toast.error(res.error); return; }
      toast.success('Solicitud rechazada');
      setConfirmAction(null);
      setRejectReason('');
      setSelectedApp(null);
      setDetailApp(null);
      setReviewConfirmed(false);
      setReviewNote('');
      load();
    } catch { toast.error('Error al rechazar solicitud'); }
    finally { setProcessing(false); }
  };

  const openDetail = (app: CourierApplication | BusinessApplication) => {
    setSelectedApp(app);
    setDetailApp(app);
    setConfirmAction(null);
    setRejectReason('');
    setReviewConfirmed(false);
    setReviewNote('');
  };

  const applications = activeTab === 'couriers' ? courierApps : businessApps;
  const isCourierTab = activeTab === 'couriers';

  const courierPending = courierApps.filter(a => a.status === 'pending').length;
  const businessPending = businessApps.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Solicitudes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona las solicitudes de registro de repartidores y negocios</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'couriers', label: 'Solicitudes de Repartidores', badge: courierPending },
          { id: 'businesses', label: 'Solicitudes de Negocios', badge: businessPending },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isCourierTab ? 'Buscar por nombre, email, vehículo...' : 'Buscar por negocio, propietario...'}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-ring/50 focus:outline-none"
        >
          {filterOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-3/4 rounded bg-muted" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-8 flex-1 rounded-lg bg-muted" />
                  <div className="h-8 flex-1 rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : applications.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          >
            {isCourierTab ? (
              <Truck className="mb-3 h-12 w-12 text-slate-600" />
            ) : (
              <Store className="mb-3 h-12 w-12 text-slate-600" />
            )}
            <p className="text-lg font-medium">No hay solicitudes</p>
            <p className="text-sm">
              {filter !== 'all' ? 'No hay solicitudes con ese filtro' : 'No hay solicitudes pendientes'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={`${activeTab}-${filter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {applications.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => openDetail(app)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      isCourierTab ? 'bg-info/15' : 'bg-success/15'
                    }`}>
                      {isCourierTab ? (
                        <Truck className="h-6 w-6 text-info" />
                      ) : (
                        <Store className="h-6 w-6 text-success" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {isCourierTab
                          ? [(app as CourierApplication).first_name, (app as CourierApplication).last_name].filter(Boolean).join(' ')
                          : (app as BusinessApplication).business_name
                        }
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {isCourierTab ? (app as CourierApplication).email : (app as BusinessApplication).owner_email}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusBadge[app.status] || 'outline'} className="shrink-0 ml-2">
                    <span className="flex items-center gap-1">
                      {statusIcon[app.status]}
                      {statusLabel[app.status]}
                    </span>
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5">
                  {isCourierTab ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Car className="h-3 w-3" />
                        <span>{(app as CourierApplication).vehicle_type}</span>
                        {(app as CourierApplication).vehicle_plate && (
                          <><Hash className="h-3 w-3" /><span>{(app as CourierApplication).vehicle_plate}</span></>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(app.created_at).toLocaleDateString('es-CO')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserCheck className="h-3 w-3" />
                        <span>{(app as BusinessApplication).owner_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{(app as BusinessApplication).address}</span>
                      </div>
                    </>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="mt-4" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openDetail(app)}
                    >
                      <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Revisar datos
                    </Button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!selectedApp} onClose={() => { setSelectedApp(null); setDetailApp(null); }} title="Detalle de Solicitud">
        {detailApp && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
                isCourierTab ? 'bg-info/15' : 'bg-success/15'
              }`}>
                {isCourierTab ? (
                  <Truck className="h-7 w-7 text-info" />
                ) : (
                  <Store className="h-7 w-7 text-success" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isCourierTab
                    ? [(detailApp as CourierApplication).first_name, (detailApp as CourierApplication).last_name].filter(Boolean).join(' ')
                    : (detailApp as BusinessApplication).business_name
                  }
                </h3>
                <Badge variant={statusBadge[detailApp.status] || 'outline'} className="mt-1">
                  <span className="flex items-center gap-1">
                    {statusIcon[detailApp.status]}
                    {statusLabel[detailApp.status]}
                  </span>
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {isCourierTab ? (detailApp as CourierApplication).email : (detailApp as BusinessApplication).owner_email}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Teléfono</p>
                <p className="text-sm font-medium text-foreground">
                  {isCourierTab
                    ? (detailApp as CourierApplication).phone || '—'
                    : (detailApp as BusinessApplication).owner_phone || '—'
                  }
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Fecha solicitud</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(detailApp.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="text-sm font-medium text-foreground">{statusLabel[detailApp.status]}</p>
              </div>
            </div>

            {isCourierTab ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información del Repartidor</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Vehículo</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as CourierApplication).vehicle_type}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Placa</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as CourierApplication).vehicle_plate || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Licencia</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as CourierApplication).license_number || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Años experiencia</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as CourierApplication).experience_years ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Tiene vehículo</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as CourierApplication).has_vehicle ? 'Sí' : 'No'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Fecha nacimiento</p>
                    <p className="text-sm font-medium text-foreground">
                      {(detailApp as CourierApplication).birth_date
                        ? new Date((detailApp as CourierApplication).birth_date!).toLocaleDateString('es-CO')
                        : '—'
                      }
                    </p>
                  </div>
                </div>
                {(detailApp as CourierApplication).address && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as CourierApplication).address}</p>
                  </div>
                )}
                {(detailApp as CourierApplication).references && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Referencias</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{(detailApp as CourierApplication).references}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información del Negocio</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Tipo de negocio</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as BusinessApplication).business_type}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Tipo de cocina</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as BusinessApplication).cuisine_type || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Propietario</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as BusinessApplication).owner_name}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Teléfono negocio</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as BusinessApplication).phone || '—'}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="text-sm font-medium text-foreground">{(detailApp as BusinessApplication).address}, {(detailApp as BusinessApplication).city}</p>
                </div>
                {(detailApp as BusinessApplication).description && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Descripción</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{(detailApp as BusinessApplication).description}</p>
                  </div>
                )}
                {(detailApp as BusinessApplication).website && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Sitio web</p>
                    <p className="text-sm font-medium text-foreground">{(detailApp as BusinessApplication).website}</p>
                  </div>
                )}
                {(detailApp as BusinessApplication).references && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Referencias</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{(detailApp as BusinessApplication).references}</p>
                  </div>
                )}
              </div>
            )}

            {detailApp.admin_note && (
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider">Nota del administrador</p>
                </div>
                <p className="text-sm text-foreground">{detailApp.admin_note}</p>
              </div>
            )}

            {detailApp.status === 'pending' && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="mt-0.5 h-5 w-5 text-warning" />
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Revisión obligatoria antes de decidir</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Revisa los datos enviados, valida que coincidan y solo después aprueba o rechaza la solicitud.
                      </p>
                    </div>

                    <label className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reviewConfirmed}
                        onChange={e => setReviewConfirmed(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        Confirmo que revisé los datos de esta solicitud y que puedo tomar una decisión.
                      </span>
                    </label>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Nota interna opcional</label>
                      <Textarea
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        placeholder="Ejemplo: documentos revisados, placa verificada, datos correctos..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailApp.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-success text-white hover:bg-success/90"
                  onClick={() => setConfirmAction({ type: 'approve', app: detailApp })}
                  disabled={!reviewConfirmed || processing}
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" /> Aprobar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setConfirmAction({ type: 'reject', app: detailApp })}
                  disabled={!reviewConfirmed || processing}
                >
                  <XCircle className="mr-1.5 h-4 w-4" /> Rechazar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { setConfirmAction(null); setRejectReason(''); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              {confirmAction.type === 'approve' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Confirmar aprobación</h3>
                      <p className="text-sm text-muted-foreground">
                        {isCourierTab
                          ? `¿Aprobar solicitud de ${(confirmAction.app as CourierApplication).first_name} ${(confirmAction.app as CourierApplication).last_name}?`
                          : `¿Aprobar solicitud de "${(confirmAction.app as BusinessApplication).business_name}"?`
                        }
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {isCourierTab
                      ? 'El usuario será registrado como repartidor con perfil verificado.'
                      : 'El negocio será creado y el usuario será registrado como comerciante.'
                    }
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-success text-white hover:bg-success/90"
                      onClick={() => handleApprove(confirmAction.app)}
                      disabled={processing}
                    >
                      {processing ? 'Procesando...' : 'Confirmar aprobación'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setConfirmAction(null); setRejectReason(''); }}
                      disabled={processing}
                    >
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Confirmar rechazo</h3>
                      <p className="text-sm text-muted-foreground">
                        {isCourierTab
                          ? `Rechazar solicitud de ${(confirmAction.app as CourierApplication).first_name} ${(confirmAction.app as CourierApplication).last_name}`
                          : `Rechazar solicitud de "${(confirmAction.app as BusinessApplication).business_name}"`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo de rechazo</label>
                    <Textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Indica el motivo del rechazo..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => handleReject(confirmAction.app)}
                      disabled={processing || !rejectReason.trim()}
                    >
                      {processing ? 'Procesando...' : 'Rechazar solicitud'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setConfirmAction(null); setRejectReason(''); }}
                      disabled={processing}
                    >
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
