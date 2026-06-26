'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Truck, User, Ban, CheckCircle, XCircle,
  AlertTriangle, DollarSign, Calendar, Clock, Package, Star,
  Phone, Mail, Car, Bike, Loader2,
  Award, CreditCard, TrendingUp, Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { Profile, Driver, DriverEarnings, CourierIncident, DriverAvailability } from '@/types/database';
import {
  getCourierAdminDetail,
  verifyCourierAction,
  suspendCourierAction,
  resolveCourierIncidentAction,
} from '@/app/actions/admin-courier';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface AdminCourierDetail {
  profile: Profile | null;
  driver: Driver | null;
  earnings: DriverEarnings[];
  incidents: CourierIncident[];
  availability: DriverAvailability[];
  recentOrders: Record<string, unknown>[];
}

interface OrderBasic {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-info/15 text-info border-info/20',
  medium: 'bg-warning/15 text-warning border-warning/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  severe: 'bg-destructive/15 text-destructive border-destructive/20',
  critical: 'bg-destructive/25 text-destructive border-destructive/30',
};

function StatCard({ icon, label, value, gradient = 'from-emerald-500/20 to-emerald-600/10 text-emerald-400' }: {
  icon: React.ReactNode; label: string; value: string | number; gradient?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:border-white/[0.10] hover:-translate-y-0.5">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="relative flex items-center gap-4">
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110',
          gradient,
        )}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium tracking-wider uppercase text-white/50">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-white transition-all duration-300 group-hover:translate-x-0.5">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200',
        active
          ? 'border-emerald-400 text-emerald-400'
          : 'border-transparent text-white/40 hover:text-white/70 hover:border-white/10',
      )}
    >
      {icon} {label}
    </button>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-white/40">{icon}</span>}
        <span className="text-sm text-white/50">{label}</span>
      </div>
      <span className="text-sm font-medium text-white/90">{value}</span>
    </div>
  );
}

export default function CourierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<AdminCourierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'earnings' | 'incidents' | 'orders' | 'availability'>('info');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchData = async () => {
    const d = await getCourierAdminDetail(id);
    setData(d);
    return d;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchData();
      } catch {
        if (!cancelled) toast.error('Error al cargar detalle del repartidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleVerify = async () => {
    setActionLoading('verify');
    try {
      const res = await verifyCourierAction(id, !data!.driver!.is_verified);
      if (res.error) { toast.error(res.error); return; }
      toast.success(data!.driver!.is_verified ? 'Repartidor desverificado' : 'Repartidor verificado');
      await fetchData();
    } catch { toast.error('Error al actualizar verificación'); }
    finally { setActionLoading(null); }
  };

  const handleSuspend = async () => {
    setActionLoading('suspend');
    try {
      const suspended = data!.driver!.is_active === false;
      const res = await suspendCourierAction(id, !suspended);
      if (res.error) { toast.error(res.error); return; }
      toast.success(suspended ? 'Repartidor reactivado' : 'Repartidor suspendido');
      await fetchData();
    } catch { toast.error('Error al cambiar estado'); }
    finally { setActionLoading(null); }
  };

  const handleResolve = async (incidentId: string) => {
    setActionLoading(`resolve-${incidentId}`);
    try {
      const res = await resolveCourierIncidentAction(incidentId, resolveNote || 'Resuelto por administrador');
      if (res.error) { toast.error(res.error); return; }
      toast.success('Incidencia resuelta');
      setResolvingId(null);
      setResolveNote('');
      await fetchData();
    } catch { toast.error('Error al resolver incidencia'); }
    finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <span className="text-sm text-white/50">Cargando datos del repartidor...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 mb-4">
          <Truck className="h-7 w-7 text-destructive" />
        </div>
        <p className="text-lg font-medium text-white/70">Repartidor no encontrado</p>
        <p className="mt-1 text-sm text-white/40">El repartidor que buscas no existe o ha sido eliminado</p>
        <button onClick={() => router.push('/admin/repartidores')} className="mt-6 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Volver a repartidores
        </button>
      </div>
    );
  }

  const profile = data!.profile!;
  const driver = data!.driver as Driver;
  const earnings = data!.earnings as DriverEarnings[];
  const incidents = data!.incidents as CourierIncident[];
  const availability = data!.availability as DriverAvailability[];
  const recentOrders = data!.recentOrders as unknown as OrderBasic[];
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—';
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('') || '?';
  const totalEarned = earnings?.reduce((s: number, e: DriverEarnings) => s + Number(e.total_earned || 0), 0) || 0;
  const pendingIncidents = incidents?.filter((i: CourierIncident) => !i.resolved_at) || [];
  const resolvedIncidents = incidents?.filter((i: CourierIncident) => i.resolved_at) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-blue-500/[0.03] pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex items-start gap-5">
          <button onClick={() => router.push('/admin/repartidores')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>

          <Avatar src={profile?.avatar_url ?? undefined} initials={initials} size="xl" className="ring-2 ring-emerald-500/30 shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-white truncate">{fullName}</h1>
              <Badge variant={driver.is_verified ? 'success' : 'warning'} className="text-[10px]">
                {driver.is_verified ? 'Verificado' : 'No verificado'}
              </Badge>
              <Badge variant={driver.is_active ? 'success' : 'destructive'} className="text-[10px]">
                {driver.is_active ? 'Activo' : 'Suspendido'}
              </Badge>
              <Badge variant={driver.status === 'available' ? 'success' : driver.status === 'busy' ? 'warning' : 'outline'} className="text-[10px]">
                {driver.status === 'available' ? 'Disponible' : driver.status === 'busy' ? 'Ocupado' : driver.status === 'on_break' ? 'En pausa' : 'Desconectado'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-white/50">
              {profile?.email} {profile?.phone ? `· ${profile.phone}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={driver.is_verified ? 'outline' : 'default'}
                onClick={handleVerify}
                disabled={actionLoading === 'verify'}
                className={cn(
                  driver.is_verified
                    ? 'border-warning/30 text-warning hover:bg-warning/10 hover:border-warning/50'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
                )}
              >
                {actionLoading === 'verify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : driver.is_verified ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {driver.is_verified ? 'Desverificar' : 'Verificar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSuspend}
                disabled={actionLoading === 'suspend'}
                className={cn(
                  driver.is_active
                    ? 'border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50'
                    : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50',
                )}
              >
                {actionLoading === 'suspend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : driver.is_active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {driver.is_active ? 'Suspender' : 'Reactivar'}
              </Button>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-emerald-400">
              <Award className="h-4 w-4" />
              <span className="text-lg font-bold">{driver.avg_rating?.toFixed(1) || '—'}</span>
            </div>
            <span className="text-[10px] text-white/40">{driver.total_ratings || 0} reseñas</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Ganancias totales"
          value={`$${(totalEarned || 0).toLocaleString('es-CO')}`}
          gradient="from-emerald-500/20 to-emerald-600/10 text-emerald-400"
        />
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Entregas completadas"
          value={driver.completed_deliveries || 0}
          gradient="from-blue-500/20 to-blue-600/10 text-blue-400"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Incidencias pendientes"
          value={pendingIncidents.length}
          gradient={pendingIncidents.length > 0 ? 'from-orange-500/20 to-red-500/10 text-orange-400' : 'from-white/10 to-white/5 text-white/40'}
        />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Rating promedio"
          value={driver.avg_rating ? `${driver.avg_rating.toFixed(1)} ⭐` : '—'}
          gradient="from-amber-500/20 to-amber-600/10 text-amber-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.06] gap-0 -mx-1 px-1">
        <TabButton active={tab === 'info'} icon={<User className="h-4 w-4" />} label="Información" onClick={() => setTab('info')} />
        <TabButton active={tab === 'earnings'} icon={<DollarSign className="h-4 w-4" />} label="Ganancias" onClick={() => setTab('earnings')} />
        <TabButton active={tab === 'incidents'} icon={<AlertTriangle className="h-4 w-4" />} label={`Incidencias (${pendingIncidents.length})`} onClick={() => setTab('incidents')} />
        <TabButton active={tab === 'orders'} icon={<Package className="h-4 w-4" />} label="Pedidos recientes" onClick={() => setTab('orders')} />
        <TabButton active={tab === 'availability'} icon={<Calendar className="h-4 w-4" />} label="Disponibilidad" onClick={() => setTab('availability')} />
      </div>

      {/* Tab: Info */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Perfil */}
          <Card variant="glass" className="overflow-hidden">
            <div className="border-b border-white/[0.06] bg-gradient-to-r from-transparent via-emerald-500/[0.03] to-transparent px-6 py-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Datos del Perfil</h3>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <InfoRow label="Nombre completo" value={fullName} icon={<User className="h-3.5 w-3.5" />} />
              <InfoRow label="Email" value={profile?.email || '—'} icon={<Mail className="h-3.5 w-3.5" />} />
              <InfoRow label="Teléfono" value={profile?.phone || '—'} icon={<Phone className="h-3.5 w-3.5" />} />
              <InfoRow label="Estado del perfil" value={
                <Badge variant={profile?.status === 'active' ? 'success' : 'outline'} className="text-[10px]">
                  {profile?.status || '—'}
                </Badge>
              } />
              <InfoRow label="Miembro desde" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-CO') : '—'} icon={<Calendar className="h-3.5 w-3.5" />} />
            </div>
          </Card>

          {/* Conductor */}
          <Card variant="glass" className="overflow-hidden">
            <div className="border-b border-white/[0.06] bg-gradient-to-r from-transparent via-blue-500/[0.03] to-transparent px-6 py-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Información del Conductor</h3>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <InfoRow label="Vehículo" value={
                <div className="flex items-center gap-1.5">
                  {driver.vehicle_type === 'motorcycle' ? <Car className="h-3.5 w-3.5" /> : driver.vehicle_type === 'bike' ? <Bike className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                  <span>{driver.vehicle_type || '—'}</span>
                </div>
              } />
              <InfoRow label="Placa" value={driver.vehicle_plate || '—'} icon={<CreditCard className="h-3.5 w-3.5" />} />
              <InfoRow label="Estado" value={
                <Badge variant={driver.status === 'available' ? 'success' : driver.status === 'busy' ? 'warning' : driver.status === 'on_break' ? 'info' : 'outline'} className="text-[10px]">
                  {driver.status}
                </Badge>
              } />
              <InfoRow label="Disponible" value={driver.is_available ? <Badge variant="success" className="text-[10px]">Sí</Badge> : <Badge variant="outline" className="text-[10px]">No</Badge>} />
              <InfoRow label="Activo" value={driver.is_active ? <Badge variant="success" className="text-[10px]">Sí</Badge> : <Badge variant="destructive" className="text-[10px]">No</Badge>} />
              <InfoRow label="Verificado" value={driver.is_verified ? <Badge variant="success" className="text-[10px]">Sí</Badge> : <Badge variant="warning" className="text-[10px]">No</Badge>} />
              <InfoRow label="Entregas totales" value={driver.total_deliveries || 0} icon={<Package className="h-3.5 w-3.5" />} />
              <InfoRow label="Completadas" value={driver.completed_deliveries || 0} icon={<CheckCircle className="h-3.5 w-3.5" />} />
              <InfoRow label="Rating" value={`${driver.avg_rating?.toFixed(1) || '—'} ⭐ (${driver.total_ratings || 0} reseñas)`} icon={<Star className="h-3.5 w-3.5" />} />
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Earnings */}
      {tab === 'earnings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5">
              <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
              <p className="text-xs text-emerald-300/70 uppercase tracking-wider">Total ganado</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">${(totalEarned || 0).toLocaleString('es-CO')}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-5">
              <TrendingUp className="h-5 w-5 text-blue-400 mb-2" />
              <p className="text-xs text-blue-300/70 uppercase tracking-wider">Transacciones</p>
              <p className="mt-1 text-2xl font-bold text-blue-300">{earnings?.length || 0}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5">
              <Percent className="h-5 w-5 text-amber-400 mb-2" />
              <p className="text-xs text-amber-300/70 uppercase tracking-wider">Promedio por entrega</p>
              <p className="mt-1 text-2xl font-bold text-amber-300">
                ${driver.completed_deliveries ? ((totalEarned || 0) / driver.completed_deliveries).toFixed(0) : '0'}
              </p>
            </div>
          </div>

          <Card variant="glass" className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Historial de Ganancias</h3>
              </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {earnings?.length > 0 ? earnings.slice(0, 20).map((e: DriverEarnings) => (
                <div key={e.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{`Ganancia #${e.id?.slice(0, 8)}`}</p>
                      <p className="text-xs text-white/40">{e.created_at ? new Date(e.created_at).toLocaleString('es-CO') : '—'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400">+${Number(e.total_earned || 0).toLocaleString('es-CO')}</span>
                </div>
              )) : (
                <div className="px-6 py-12 text-center">
                  <DollarSign className="mx-auto h-8 w-8 text-white/20 mb-2" />
                  <p className="text-sm text-white/40">No hay registros de ganancias</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Incidents */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          {pendingIncidents.length > 0 && (
            <Alert
              variant="warning"
              title={`${pendingIncidents.length} incidencia(s) pendiente(s)`}
              description="Requieren revisión y resolución por parte del administrador."
            />
          )}

          <Card variant="glass" className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-white">Incidencias</h3>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-orange-400">{pendingIncidents.length} pendientes</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/40">{resolvedIncidents.length} resueltas</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {incidents?.length > 0 ? incidents.map((inc: CourierIncident) => (
                <div key={inc.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        inc.resolved_at ? 'bg-emerald-500/10' : 'bg-orange-500/10',
                      )}>
                        {inc.resolved_at
                          ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                          : <AlertTriangle className="h-4 w-4 text-orange-400" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white/80">{inc.description || 'Incidencia'}</span>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', SEVERITY_STYLES[inc.severity] || 'bg-white/10 text-white/60 border-white/10')}>
                            {inc.severity || 'unknown'}
                          </span>
                          {inc.resolved_at && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              Resuelta
                            </span>
                          )}
                        </div>
                        {inc.description && (
                          <p className="mt-1 text-xs text-white/50">{inc.description}</p>
                        )}
                        <p className="mt-1 text-[10px] text-white/30">
                          {inc.created_at ? new Date(inc.created_at).toLocaleString('es-CO') : '—'}
                          {inc.resolved_at ? ` · Resuelto: ${new Date(inc.resolved_at).toLocaleString('es-CO')}` : ''}
                        </p>
                        {inc.resolution_notes && (
                          <p className="mt-1 text-[10px] text-white/40 italic">Nota: {inc.resolution_notes}</p>
                        )}
                      </div>
                    </div>
                    {!inc.resolved_at && (
                      <div className="shrink-0">
                        {resolvingId === inc.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={resolveNote}
                              onChange={(e) => setResolveNote(e.target.value)}
                              placeholder="Nota de resolución..."
                              className="w-36 rounded-lg border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                            />
                            <Button
                              size="xs"
                              onClick={() => handleResolve(inc.id)}
                              disabled={actionLoading === `resolve-${inc.id}`}
                              className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                            >
                              {actionLoading === `resolve-${inc.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => { setResolvingId(null); setResolveNote(''); }}
                              className="text-white/40 hover:text-white/70"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setResolvingId(inc.id)}
                            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          >
                            Resolver
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="px-6 py-12 text-center">
                  <CheckCircle className="mx-auto h-8 w-8 text-emerald-500/50 mb-2" />
                  <p className="text-sm text-white/40">No hay incidencias registradas</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Recent Orders */}
      {tab === 'orders' && (
        <Card variant="glass" className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Pedidos Recientes</h3>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentOrders?.length > 0 ? recentOrders.map((ord) => (
              <div key={ord.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <Package className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/80">{ord.order_number || ord.id?.slice(0, 12)}</p>
                    <p className="text-xs text-white/40">{ord.created_at ? new Date(ord.created_at).toLocaleString('es-CO') : '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-white/80">${(ord.total_amount || 0).toLocaleString('es-CO')}</span>
                  <Badge variant={
                    ord.status === 'delivered' ? 'success' :
                    ord.status === 'cancelled' ? 'destructive' :
                    ord.status === 'pending' ? 'warning' :
                    ord.status === 'preparing' ? 'info' :
                    'outline'
                  } className="text-[10px]">
                    {ord.status || '—'}
                  </Badge>
                </div>
              </div>
            )) : (
              <div className="px-6 py-12 text-center">
                <Package className="mx-auto h-8 w-8 text-white/20 mb-2" />
                <p className="text-sm text-white/40">No hay pedidos recientes</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab: Availability */}
      {tab === 'availability' && (
        <Card variant="glass" className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Horario de Disponibilidad</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {availability?.length > 0 ? availability.map((a: DriverAvailability) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-all hover:bg-white/[0.05] hover:border-white/[0.10]"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      a.is_working ? 'bg-emerald-500/10' : 'bg-white/5',
                    )}>
                      <Clock className={cn('h-4 w-4', a.is_working ? 'text-emerald-400' : 'text-white/30')} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{DAY_NAMES[a.day_of_week] || `Día ${a.day_of_week}`}</p>
                      {a.is_working && a.starts_at && a.ends_at ? (
                        <p className="text-xs text-white/40">{a.starts_at.slice(0, 5)} — {a.ends_at.slice(0, 5)}</p>
                      ) : (
                        <p className="text-xs text-destructive/70">No disponible</p>
                      )}
                    </div>
                  </div>
                  {a.is_working ? (
                    <Badge variant="success" className="text-[9px] px-1.5">Disponible</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1.5">No</Badge>
                  )}
                </div>
              )) : (
                <div className="col-span-full px-6 py-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-white/20 mb-2" />
                  <p className="text-sm text-white/40">No hay horarios de disponibilidad configurados</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
