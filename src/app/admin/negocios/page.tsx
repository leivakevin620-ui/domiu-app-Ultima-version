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
import type { AdminBusiness } from '@/services/admin';
import { RefreshCw, CheckCircle, XCircle, Store } from 'lucide-react';

export default function AdminBusinesses() {
  const { profile } = useAuth();
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminBusiness | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'verify' | 'toggle'; business: AdminBusiness } | null>(null);

  const reload = async () => {
    try { setBusinesses(await adminService.getBusinesses(search || undefined, filter)); }
    catch {}
  };

  useEffect(() => {
    (async () => { await reload(); setLoading(false); })();
  }, [search, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (b: AdminBusiness) => {
    try {
      await adminService.verifyBusiness(b.id);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'verificar_negocio', 'business', b.id, b.name);
      setAlert({ type: 'success', msg: `${b.name} verificado` });
      setConfirmAction(null);
      reload();
    } catch { setAlert({ type: 'error', msg: 'Error al verificar' }); }
  };

  const handleToggleActive = async (b: AdminBusiness) => {
    try {
      await adminService.updateBusinessStatus(b.id, !b.is_active);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, b.is_active ? 'suspender_negocio' : 'reactivar_negocio', 'business', b.id, b.name);
      setAlert({ type: 'success', msg: `${b.name} ${b.is_active ? 'suspendido' : 'reactivado'}` });
      setConfirmAction(null);
      reload();
    } catch { setAlert({ type: 'error', msg: 'Error' }); }
  };

  const columns: EnterpriseColumn<AdminBusiness>[] = [
    {
      key: 'name',
      header: 'Negocio',
      sortable: true,
      render: (b) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
            <Store className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{b.name}</p>
            <p className="text-xs text-muted-foreground">{b.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'owner_name', header: 'Propietario', render: (b) => b.owner_name || '—' },
    { key: 'cuisine_type', header: 'Tipo', render: (b) => <Badge variant="info">{b.cuisine_type || '—'}</Badge> },
    { key: 'rating', header: 'Rating', render: (b) => `${b.rating} ⭐ (${b.total_ratings})` },
    {
      key: 'is_verified',
      header: 'Verificado',
      render: (b) => b.is_verified
        ? <Badge variant="success">Verificado</Badge>
        : <Badge variant="warning">Pendiente</Badge>,
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (b) => b.is_active
        ? <Badge variant="success">Activo</Badge>
        : <Badge variant="destructive">Suspendido</Badge>,
    },
    { key: 'created_at', header: 'Registro', render: (b) => new Date(b.created_at).toLocaleDateString('es-CO') },
    {
      key: 'actions', header: 'Acciones',
      render: (b) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelected(b)}>Detalles</Button>
          {!b.is_verified && <Button variant="ghost" size="sm" className="text-success" onClick={() => setConfirmAction({ type: 'verify', business: b })}><CheckCircle className="mr-1 h-3.5 w-3.5" />Verificar</Button>}
          <Button variant="ghost" size="sm" className={b.is_active ? 'text-destructive' : 'text-success'} onClick={() => setConfirmAction({ type: 'toggle', business: b })}>
            {b.is_active ? <><XCircle className="mr-1 h-3.5 w-3.5" />Suspender</> : 'Reactivar'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestión de Negocios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administra y verifica los negocios registrados</p>
        </div>
      </div>

      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <EnterpriseTable
        columns={columns}
        data={businesses}
        keyExtractor={b => b.id}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar negocios..."
        loading={loading}
        emptyMessage="No hay negocios"
        exportable
        exportFilename="negocios"
        actions={
          <>
            <Select value={filter} onChange={e => setFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos' },
              { value: 'verified', label: 'Verificados' },
              { value: 'pending', label: 'Pendientes' },
              { value: 'suspended', label: 'Suspendidos' },
            ]} className="w-40" />
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); reload().finally(() => setLoading(false)); }}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
          </>
        }
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

      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirmar acción">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {confirmAction?.type === 'verify'
              ? `¿Estás seguro de verificar el negocio "${confirmAction.business.name}"?`
              : `¿Estás seguro de ${confirmAction?.business.is_active ? 'suspender' : 'reactivar'} el negocio "${confirmAction?.business.name}"?`}
          </p>
          <p className="text-xs text-muted-foreground/60">Esta acción quedará registrada en el sistema de auditoría.</p>
          <div className="flex gap-2">
            <Button onClick={() => confirmAction?.type === 'verify' ? handleVerify(confirmAction.business) : handleToggleActive(confirmAction!.business)}>
              Confirmar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
