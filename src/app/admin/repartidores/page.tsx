'use client';

import React, { useEffect, useState } from 'react';
import { SkeletonTable } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import type { EnterpriseColumn, EnterpriseTableProps } from '@/components/admin/enterprise-table';
const EnterpriseTable = dynamic(() => import('@/components/admin/enterprise-table').then(m => ({ default: m.EnterpriseTable })), {
  ssr: false,
  loading: () => <SkeletonTable columns={5} rows={8} />,
}) as <T>(props: EnterpriseTableProps<T>) => React.JSX.Element;
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { adminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminCourier } from '@/services/admin';
import { RefreshCw, CheckCircle, Truck } from 'lucide-react';

const vehicleIcon: Record<string, string> = { motorcycle: '🏍️', bike: '🚲', car: '🚗', van: '🚐' };

export default function AdminCouriers() {
  const { profile } = useAuth();
  const [couriers, setCouriers] = useState<AdminCourier[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminCourier | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const reloadCouriers = async () => {
    try { setCouriers(await adminService.getCouriers(search || undefined, filter)); }
    catch {}
  };

  useEffect(() => { (async () => { await reloadCouriers(); setLoading(false); })(); }, [search, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (c: AdminCourier) => {
    try {
      await adminService.verifyCourier(c.id);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'verificar_repartidor', 'driver', c.id, `${c.first_name} ${c.last_name}`);
      setAlert({ type: 'success', msg: 'Repartidor verificado' });
      reloadCouriers();
    } catch { setAlert({ type: 'error', msg: 'Error al verificar' }); }
  };

  const handleToggleActive = async (c: AdminCourier) => {
    try {
      const isActive = c.status !== 'offline';
      await adminService.updateCourierStatus(c.id, !isActive);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, isActive ? 'suspender_repartidor' : 'reactivar_repartidor', 'driver', c.id, `${c.first_name} ${c.last_name}`);
      setAlert({ type: 'success', msg: `Repartidor ${isActive ? 'suspendido' : 'reactivado'}` });
      reloadCouriers();
    } catch { setAlert({ type: 'error', msg: 'Error' }); }
  };

  const getName = (c: AdminCourier) => [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';

  const columns: EnterpriseColumn<AdminCourier>[] = [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-info/10 to-info/5">
            <Truck className="h-4 w-4 text-info" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{getName(c)}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (c) => c.email },
    { key: 'vehicle_type', header: 'Vehículo', render: (c) => `${vehicleIcon[c.vehicle_type] || ''} ${c.vehicle_type}` },
    { key: 'vehicle_plate', header: 'Placa', render: (c) => c.vehicle_plate || '—' },
    { key: 'status', header: 'Estado', render: (c) => {
      const v = c.status === 'available' ? 'success' : c.status === 'busy' ? 'warning' : 'outline';
      return <Badge variant={v}>{c.status}</Badge>;
    }},
    { key: 'is_verified', header: 'Verificado', render: (c) => c.is_verified ? <Badge variant="success">Sí</Badge> : <Badge variant="warning">No</Badge> },
    { key: 'total_deliveries', header: 'Entregas', sortable: true },
    { key: 'rating', header: 'Rating', render: (c) => `${c.rating} ⭐` },
    { key: 'actions', header: 'Acciones', render: (c) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setSelected(c)}>Detalles</Button>
        {!c.is_verified && <Button variant="ghost" size="sm" className="text-success" onClick={() => handleVerify(c)}><CheckCircle className="mr-1 h-3.5 w-3.5" />Verificar</Button>}
        <Button variant="ghost" size="sm" className={c.status !== 'offline' ? 'text-destructive' : 'text-success'} onClick={() => handleToggleActive(c)}>
          {c.status !== 'offline' ? 'Suspender' : 'Reactivar'}
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestión de Repartidores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administra y verifica los repartidores registrados</p>
        </div>
      </div>

      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <EnterpriseTable
        columns={columns}
        data={couriers}
        keyExtractor={c => c.id}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar repartidores..."
        loading={loading}
        emptyMessage="No hay repartidores"
        exportable
        exportFilename="repartidores"
        actions={
          <>
            <Select value={filter} onChange={e => setFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos' },
              { value: 'verified', label: 'Verificados' },
              { value: 'pending', label: 'Pendientes' },
              { value: 'offline', label: 'Desconectados' },
            ]} className="w-40" />
            <Button variant="outline" size="sm" onClick={reloadCouriers}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
          </>
        }
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? getName(selected) : ''}>
        {selected && (
          <div className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Email:</span> <span className="font-medium">{selected.email}</span></div>
            <div><span className="text-sm text-muted-foreground">Vehículo:</span> {vehicleIcon[selected.vehicle_type]} {selected.vehicle_type} ({selected.vehicle_plate || 'sin placa'})</div>
            <div><span className="text-sm text-muted-foreground">Estado:</span> <Badge variant={selected.status === 'available' ? 'success' : selected.status === 'busy' ? 'warning' : 'outline'}>{selected.status}</Badge></div>
            <div><span className="text-sm text-muted-foreground">Entregas completadas:</span> {selected.total_deliveries}</div>
            <div><span className="text-sm text-muted-foreground">Rating:</span> {selected.rating} ⭐</div>
            <div className="space-y-2 pt-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Cambiar estado</label>
                <select
                  defaultValue=""
                  onChange={async (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    try {
                      const { updateCourierStatusAction } = await import('@/app/actions/auth');
                      await updateCourierStatusAction(selected.id, val);
                      setAlert({ type: 'success', msg: `Estado cambiado a "${val}"` });
                      reloadCouriers();
                    } catch { setAlert({ type: 'error', msg: 'Error al cambiar estado' }); }
                    e.target.value = '';
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  <option value="available">Disponible</option>
                  <option value="busy">Ocupado</option>
                  <option value="offline">No disponible</option>
                  <option value="on_break">En pausa</option>
                </select>
              </div>
              <div className="flex gap-2">
                {!selected.is_verified && <Button variant="outline" onClick={() => handleVerify(selected)}>Verificar</Button>}
                <Button variant="outline" className={selected.status !== 'offline' ? 'text-destructive' : 'text-success'} onClick={() => handleToggleActive(selected)}>
                  {selected.status !== 'offline' ? 'Suspender' : 'Reactivar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
