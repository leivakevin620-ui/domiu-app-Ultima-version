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
import type { AdminOrder } from '@/services/admin';
import { Search, RefreshCw } from 'lucide-react';

const statusConfig: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'info',
  in_transit: 'default',
  delivered: 'success',
  cancelled: 'destructive',
  refunded: 'destructive',
};

const ORDER_STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready', 'in_transit', 'delivered', 'cancelled', 'refunded',
];

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function AdminOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setOrders(await adminService.getOrders(search || undefined, statusFilter)); }
    catch {}
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleStatusChange = async () => {
    if (!newStatus || !selected) return;
    try {
      await adminService.updateOrderStatusAdmin(selected.id, newStatus as any);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'cambiar_estado_pedido', 'order', selected.id, `#${selected.order_number}: ${selected.status} -> ${newStatus}`);
      setAlert({ type: 'success', msg: `Pedido #${selected.order_number} actualizado a ${newStatus}` });
      setSelected(null);
      setNewStatus('');
      fetch();
    } catch { setAlert({ type: 'error', msg: 'Error al actualizar' }); }
  };

  return (
    <PageContainer>
      <PageTitle title="Gestión de Pedidos" description="Visualiza y administra todos los pedidos de la plataforma" />
      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedidos..." className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20" />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
          { value: 'all', label: 'Todos los estados' },
          ...ORDER_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') })),
        ]} className="w-44" />
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
      </div>

      <DataTable
        columns={[
          { key: 'order_number', header: '# Pedido', sortable: true },
          { key: 'customer_name', header: 'Cliente', render: (o: AdminOrder) => o.customer_name || '—' },
          { key: 'business_name', header: 'Negocio', sortable: true },
          {
            key: 'status', header: 'Estado',
            render: (o: AdminOrder) => <Badge variant={statusConfig[o.status] || 'default'}>{o.status.replace('_', ' ')}</Badge>,
          },
          {
            key: 'payment_status', header: 'Pago',
            render: (o: AdminOrder) => <Badge variant={o.payment_status === 'completed' ? 'success' : 'warning'}>{o.payment_status}</Badge>,
          },
          { key: 'total_amount', header: 'Total', render: (o: AdminOrder) => formatCurrency(o.total_amount), sortable: true },
          { key: 'courier_name', header: 'Repartidor', render: (o: AdminOrder) => o.courier_name || '—' },
          { key: 'created_at', header: 'Fecha', render: (o: AdminOrder) => new Date(o.created_at).toLocaleString('es-CO') },
          { key: 'actions', header: 'Acciones', render: (o: AdminOrder) => (
            <Button variant="ghost" size="sm" onClick={() => { setSelected(o); setNewStatus(o.status); }}>Gestionar</Button>
          )},
        ]}
        data={orders}
        keyExtractor={o => o.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay pedidos'}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected?.order_number || ''}`}>
        {selected && (
          <div className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Cliente:</span> <span className="font-medium">{selected.customer_name || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Negocio:</span> <span className="font-medium">{selected.business_name}</span></div>
            <div><span className="text-sm text-muted-foreground">Estado actual:</span> <Badge variant={statusConfig[selected.status]}>{selected.status}</Badge></div>
            <div><span className="text-sm text-muted-foreground">Total:</span> <span className="font-medium">{formatCurrency(selected.total_amount)}</span></div>
            <div><span className="text-sm text-muted-foreground">Repartidor:</span> <span className="font-medium">{selected.courier_name || 'Sin asignar'}</span></div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Cambiar estado manualmente:</p>
              <Select value={newStatus} onChange={e => setNewStatus(e.target.value)} options={ORDER_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleStatusChange} disabled={newStatus === selected.status}>Actualizar Estado</Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
