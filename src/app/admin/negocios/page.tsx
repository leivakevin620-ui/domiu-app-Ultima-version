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
import type { AdminBusiness } from '@/services/admin';
import { Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function AdminBusinesses() {
  const { profile } = useAuth();
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminBusiness | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setBusinesses(await adminService.getBusinesses(search || undefined, filter)); }
    catch {}
    setLoading(false);
  }, [search, filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleVerify = async (b: AdminBusiness) => {
    try {
      await adminService.verifyBusiness(b.id);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'verificar_negocio', 'business', b.id, b.name);
      setAlert({ type: 'success', msg: `${b.name} verificado` });
      fetch();
    } catch { setAlert({ type: 'error', msg: 'Error al verificar' }); }
  };

  const handleToggleActive = async (b: AdminBusiness) => {
    try {
      await adminService.updateBusinessStatus(b.id, !b.is_active);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, b.is_active ? 'suspender_negocio' : 'reactivar_negocio', 'business', b.id, b.name);
      setAlert({ type: 'success', msg: `${b.name} ${b.is_active ? 'suspendido' : 'reactivado'}` });
      fetch();
    } catch { setAlert({ type: 'error', msg: 'Error' }); }
  };

  return (
    <PageContainer>
      <PageTitle title="Gestión de Negocios" description="Administra y verifica los negocios registrados" />
      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar negocios..." className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" />
        </div>
        <Select value={filter} onChange={e => setFilter(e.target.value)} options={[
          { value: 'all', label: 'Todos' },
          { value: 'verified', label: 'Verificados' },
          { value: 'pending', label: 'Pendientes' },
          { value: 'suspended', label: 'Suspendidos' },
        ]} className="w-44" />
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Negocio', sortable: true },
          { key: 'owner_name', header: 'Propietario', render: (b: AdminBusiness) => b.owner_name || '—' },
          { key: 'cuisine_type', header: 'Tipo', render: (b: AdminBusiness) => <Badge variant="info">{b.cuisine_type || '—'}</Badge> },
          { key: 'rating', header: 'Rating', render: (b: AdminBusiness) => `${b.rating} ⭐ (${b.total_ratings})` },
          {
            key: 'is_verified',
            header: 'Verificado',
            render: (b: AdminBusiness) => b.is_verified
              ? <Badge variant="success">Verificado</Badge>
              : <Badge variant="warning">Pendiente</Badge>,
          },
          {
            key: 'is_active',
            header: 'Estado',
            render: (b: AdminBusiness) => b.is_active
              ? <Badge variant="success">Activo</Badge>
              : <Badge variant="destructive">Suspendido</Badge>,
          },
          { key: 'created_at', header: 'Registro', render: (b: AdminBusiness) => new Date(b.created_at).toLocaleDateString('es-CO') },
          {
            key: 'actions', header: 'Acciones',
            render: (b: AdminBusiness) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelected(b)}>Detalles</Button>
                {!b.is_verified && <Button variant="ghost" size="sm" className="text-success" onClick={() => handleVerify(b)}><CheckCircle className="mr-1 h-3.5 w-3.5" />Verificar</Button>}
                <Button variant="ghost" size="sm" className={b.is_active ? 'text-destructive' : 'text-success'} onClick={() => handleToggleActive(b)}>
                  {b.is_active ? <><XCircle className="mr-1 h-3.5 w-3.5" />Suspender</> : 'Reactivar'}
                </Button>
              </div>
            ),
          },
        ]}
        data={businesses}
        keyExtractor={b => b.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay negocios'}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Propietario:</span> <span className="font-medium">{selected.owner_name || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Email:</span> <span className="font-medium">{selected.owner_email}</span></div>
            <div><span className="text-sm text-muted-foreground">Teléfono:</span> <span className="font-medium">{selected.phone || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Tipo:</span> <Badge variant="info">{selected.cuisine_type || '—'}</Badge></div>
            <div><span className="text-sm text-muted-foreground">Rating:</span> {selected.rating} ⭐ ({selected.total_ratings} reseñas)</div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => handleVerify(selected)} disabled={selected.is_verified}>Verificar</Button>
              <Button variant="outline" className={selected.is_active ? 'text-destructive' : 'text-success'} onClick={() => handleToggleActive(selected)}>
                {selected.is_active ? 'Suspender' : 'Reactivar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
