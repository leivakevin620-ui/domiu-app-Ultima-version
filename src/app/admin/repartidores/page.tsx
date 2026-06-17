'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DataTable } from '@/components/dashboard/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { adminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminCourier } from '@/services/admin';
import { Search, RefreshCw, CheckCircle } from 'lucide-react';

const vehicleIcon: Record<string, string> = { motorcycle: '🏍️', bike: '🚲', car: '🚗', van: '🚐' };

export default function AdminCouriers() {
  const { profile } = useAuth();
  const [couriers, setCouriers] = useState<AdminCourier[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminCourier | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setCouriers(await adminService.getCouriers(search || undefined, filter)); }
    catch {}
    setLoading(false);
  }, [search, filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleVerify = async (c: AdminCourier) => {
    try {
      await adminService.verifyCourier(c.id);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'verificar_repartidor', 'driver', c.id, `${c.first_name} ${c.last_name}`);
      setAlert({ type: 'success', msg: 'Repartidor verificado' });
      fetch();
    } catch { setAlert({ type: 'error', msg: 'Error al verificar' }); }
  };

  const handleToggleActive = async (c: AdminCourier) => {
    try {
      const isActive = c.status !== 'offline';
      await adminService.updateCourierStatus(c.id, !isActive);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, isActive ? 'suspender_repartidor' : 'reactivar_repartidor', 'driver', c.id, `${c.first_name} ${c.last_name}`);
      setAlert({ type: 'success', msg: `Repartidor ${isActive ? 'suspendido' : 'reactivado'}` });
      fetch();
    } catch { setAlert({ type: 'error', msg: 'Error' }); }
  };

  const getName = (c: AdminCourier) => [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';

  return (
    <PageContainer>
      <PageTitle title="Gestión de Repartidores" description="Administra y verifica los repartidores registrados" />
      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar repartidores..." className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" />
        </div>
        <Select value={filter} onChange={e => setFilter(e.target.value)} options={[
          { value: 'all', label: 'Todos' },
          { value: 'verified', label: 'Verificados' },
          { value: 'pending', label: 'Pendientes' },
          { value: 'offline', label: 'Desconectados' },
        ]} className="w-44" />
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Nombre', render: getName, sortable: true },
          { key: 'email', header: 'Email' },
          { key: 'vehicle_type', header: 'Vehículo', render: (c: AdminCourier) => `${vehicleIcon[c.vehicle_type] || ''} ${c.vehicle_type}` },
          { key: 'vehicle_plate', header: 'Placa', render: (c: AdminCourier) => c.vehicle_plate || '—' },
          { key: 'status', header: 'Estado', render: (c: AdminCourier) => {
            const v = c.status === 'available' ? 'success' : c.status === 'busy' ? 'warning' : 'outline';
            return <Badge variant={v}>{c.status}</Badge>;
          }},
          { key: 'is_verified', header: 'Verificado', render: (c: AdminCourier) => c.is_verified ? <Badge variant="success">Sí</Badge> : <Badge variant="warning">No</Badge> },
          { key: 'total_deliveries', header: 'Entregas', sortable: true },
          { key: 'rating', header: 'Rating', render: (c: AdminCourier) => `${c.rating} ⭐` },
          { key: 'actions', header: 'Acciones', render: (c: AdminCourier) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSelected(c)}>Detalles</Button>
              {!c.is_verified && <Button variant="ghost" size="sm" className="text-success" onClick={() => handleVerify(c)}><CheckCircle className="mr-1 h-3.5 w-3.5" />Verificar</Button>}
              <Button variant="ghost" size="sm" className={c.status !== 'offline' ? 'text-destructive' : 'text-success'} onClick={() => handleToggleActive(c)}>
                {c.status !== 'offline' ? 'Suspender' : 'Reactivar'}
              </Button>
            </div>
          )},
        ]}
        data={couriers}
        keyExtractor={c => c.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay repartidores'}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? getName(selected) : ''}>
        {selected && (
          <div className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Email:</span> <span className="font-medium">{selected.email}</span></div>
            <div><span className="text-sm text-muted-foreground">Vehículo:</span> {vehicleIcon[selected.vehicle_type]} {selected.vehicle_type} ({selected.vehicle_plate || 'sin placa'})</div>
            <div><span className="text-sm text-muted-foreground">Estado:</span> <Badge variant={selected.status === 'available' ? 'success' : selected.status === 'busy' ? 'warning' : 'outline'}>{selected.status}</Badge></div>
            <div><span className="text-sm text-muted-foreground">Entregas completadas:</span> {selected.total_deliveries}</div>
            <div><span className="text-sm text-muted-foreground">Rating:</span> {selected.rating} ⭐</div>
            <div className="flex gap-2 pt-2">
              {!selected.is_verified && <Button variant="outline" onClick={() => handleVerify(selected)}>Verificar</Button>}
              <Button variant="outline" className={selected.status !== 'offline' ? 'text-destructive' : 'text-success'} onClick={() => handleToggleActive(selected)}>
                {selected.status !== 'offline' ? 'Suspender' : 'Reactivar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
