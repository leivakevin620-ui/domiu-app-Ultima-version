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
import type { AdminOrder } from '@/services/admin';
import type { OrderStatus } from '@/types/database';
import { RefreshCw } from 'lucide-react';

const statusConfig: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  pending: 'warning',
  assigned: 'info',
  accepted: 'info',
  confirmed: 'info',
  preparing: 'info',
  ready: 'info',
  picked_up: 'info',
  in_transit: 'default',
  delivered: 'success',
  cancelled: 'destructive',
  refunded: 'destructive',
};

const ORDER_STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'refunded',
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
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const reloadOrders = async () => {
    try { setOrders(await adminService.getOrders(search || undefined, statusFilter)); }
    catch {}
  };

  useEffect(() => { (async () => { await reloadOrders(); setLoading(false); })(); }, [search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => { reloadOrders(); }, 15000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async () => {
    if (!newStatus || !selected) return;
    try {
      setActionLoading(true);
      await adminService.updateOrderStatusAdmin(selected.id, newStatus as OrderStatus);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'cambiar_estado_pedido', 'order', selected.id, `#${selected.order_number}: ${selected.status} -> ${newStatus}`);
      setAlert({ type: 'success', msg: `Pedido #${selected.order_number} actualizado a ${newStatus}` });
      setSelected(null);
      setNewStatus('');
      reloadOrders();
    } catch {
      setAlert({ type: 'error', msg: 'Error al actualizar' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignNearestCourier = async () => {
    if (!selected) return;
    try {
      setActionLoading(true);
      const { assignNearestCourierToManualOrderAction } = await import('@/app/actions/manual-delivery-dispatch');
      const result = await assignNearestCourierToManualOrderAction(selected.id);
      if (!result.success) {
        setAlert({ type: 'error', msg: ('error' in result ? result.error : undefined) || 'No se pudo asignar el repartidor' });
        return;
      }
      setAlert({ type: 'success', msg: `Pedido asignado a ${result.courierName}${result.distanceKm ? ` (${result.distanceKm} km)` : ''}` });
      setSelected(null);
      reloadOrders();
    } catch {
      setAlert({ type: 'error', msg: 'Error al asignar repartidor' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishClosestCourier = async () => {
    if (!selected) return;
    try {
      setActionLoading(true);
      const { notifyClosestCourierForManualOrderAction } = await import('@/app/actions/manual-delivery-dispatch');
      const result = await notifyClosestCourierForManualOrderAction(selected.id);
      if (!result.success) {
        setAlert({ type: 'error', msg: ('error' in result ? result.error : undefined) || 'No se pudo publicar al repartidor cercano' });
        return;
      }
      setAlert({ type: 'success', msg: `Pedido enviado primero a ${result.courierName}${result.distanceKm ? ` (${result.distanceKm} km)` : ''}` });
      setSelected(null);
      reloadOrders();
    } catch {
      setAlert({ type: 'error', msg: 'Error al publicar al repartidor cercano' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishAllCouriers = async () => {
    if (!selected) return;
    try {
      setActionLoading(true);
      const { publishManualDeliveryOrderToAllCouriersAction } = await import('@/app/actions/manual-delivery-dispatch');
      const result = await publishManualDeliveryOrderToAllCouriersAction(selected.id);
      if (!result.success) {
        setAlert({ type: 'error', msg: ('error' in result ? result.error : undefined) || 'No se pudo publicar el pedido' });
        return;
      }
      setAlert({ type: 'success', msg: `Pedido publicado a ${result.notifiedCount} repartidores` });
      setSelected(null);
      reloadOrders();
    } catch {
      setAlert({ type: 'error', msg: 'Error al publicar pedido' });
    } finally {
      setActionLoading(false);
    }
  };

  const columns: EnterpriseColumn<AdminOrder>[] = [
    { key: 'order_number', header: '# Pedido', sortable: true },
    { key: 'customer_name', header: 'Cliente', render: (o) => o.customer_name || '—' },
    { key: 'business_name', header: 'Negocio', sortable: true },
    {
      key: 'order_type', header: 'Tipo',
      render: (o) => <Badge variant={o.order_type === 'manual_delivery' ? 'warning' : 'default'}>{o.order_type === 'manual_delivery' ? 'Domicilio' : 'Producto'}</Badge>,
    },
    {
      key: 'status', header: 'Estado',
      render: (o) => <Badge variant={statusConfig[o.status] || 'default'}>{o.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'payment_status', header: 'Pago',
      render: (o) => <Badge variant={o.payment_status === 'completed' ? 'success' : 'warning'}>{o.payment_status}</Badge>,
    },
    { key: 'total_amount', header: 'Total', render: (o) => formatCurrency(o.total_amount), sortable: true },
    { key: 'courier_earnings', header: 'Gan. Repartidor', render: (o) => o.courier_earnings != null ? formatCurrency(o.courier_earnings) : '—' },
    { key: 'platform_earnings', header: 'Gan. DomiU', render: (o) => o.platform_earnings != null ? formatCurrency(o.platform_earnings) : '—' },
    { key: 'courier_name', header: 'Repartidor', render: (o) => o.courier_name || '—' },
    { key: 'created_at', header: 'Fecha', render: (o) => new Date(o.created_at).toLocaleString('es-CO') },
    { key: 'actions', header: 'Acciones', render: (o) => (
      <Button variant="ghost" size="sm" onClick={() => { setSelected(o); setNewStatus(o.status); }}>Gestionar</Button>
    )},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestión de Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visualiza y administra todos los pedidos de la plataforma</p>
        </div>
      </div>

      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <EnterpriseTable
        columns={columns}
        data={orders}
        keyExtractor={o => o.id}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar pedidos..."
        loading={loading}
        emptyMessage="No hay pedidos"
        exportable
        exportFilename="pedidos"
        actions={
          <>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los estados' },
              ...ORDER_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') })),
            ]} className="w-44" />
            <Button variant="outline" size="sm" onClick={() => { reloadOrders(); }}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
          </>
        }
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected?.order_number || ''}`}>
        {selected && (
          <div className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Cliente:</span> <span className="font-medium">{selected.customer_name || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Negocio:</span> <span className="font-medium">{selected.business_name}</span></div>
            <div><span className="text-sm text-muted-foreground">Tipo:</span> <Badge variant={selected.order_type === 'manual_delivery' ? 'warning' : 'default'}>{selected.order_type === 'manual_delivery' ? 'Domicilio manual' : 'Producto'}</Badge></div>
            <div><span className="text-sm text-muted-foreground">Estado actual:</span> <Badge variant={statusConfig[selected.status]}>{selected.status}</Badge></div>
            <div><span className="text-sm text-muted-foreground">Total:</span> <span className="font-medium">{formatCurrency(selected.total_amount)}</span></div>
            <div><span className="text-sm text-muted-foreground">Repartidor:</span> <span className="font-medium">{selected.courier_name || 'Sin asignar'}</span></div>
            {selected.courier_earnings != null && <div><span className="text-sm text-muted-foreground">Ganancia repartidor:</span> <span className="font-medium">{formatCurrency(selected.courier_earnings)}</span></div>}
            {selected.platform_earnings != null && <div><span className="text-sm text-muted-foreground">Ganancia DomiU:</span> <span className="font-medium">{formatCurrency(selected.platform_earnings)}</span></div>}
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Cambiar estado manualmente:</p>
              <Select value={newStatus} onChange={e => setNewStatus(e.target.value)} options={ORDER_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
            </div>
            {selected.order_type === 'manual_delivery' && selected.status === 'pending' && !selected.courier_name && (
              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={handleAssignNearestCourier} disabled={actionLoading}>Asignar más cercano</Button>
                  <Button variant="outline" size="sm" onClick={handlePublishClosestCourier} disabled={actionLoading}>Publicar al más cercano</Button>
                  <Button variant="outline" size="sm" onClick={handlePublishAllCouriers} disabled={actionLoading}>Publicar a todos</Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Asignar fija el pedido a un repartidor. Publicar lo deja libre para aceptación; el primero que acepte lo toma.
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleStatusChange} disabled={newStatus === selected.status || actionLoading}>Actualizar Estado</Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
