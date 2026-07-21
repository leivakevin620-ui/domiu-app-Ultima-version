'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { adminOrdersService, type AdminOrderView } from '@/services/admin-orders';
import { useAuth } from '@/contexts/AuthContext';
import type { OrderStatus } from '@/types/database';
import { PackagePlus, RefreshCw } from 'lucide-react';

const statusConfig: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  pending: 'warning', assigned: 'info', accepted: 'info', confirmed: 'info', preparing: 'info',
  ready: 'info', picked_up: 'info', in_transit: 'default', delivered: 'success',
  cancelled: 'destructive', refunded: 'destructive',
};

const ORDER_STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'refunded',
];

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp', phone: 'Llamada', in_person: 'Presencial', instagram: 'Instagram',
  facebook: 'Facebook', direct_message: 'Mensaje directo', other: 'Otro',
};

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function AdminOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminOrderView | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const reloadOrders = async () => {
    try {
      setOrders(await adminOrdersService.list(search || undefined, statusFilter));
    } catch {
      setAlert({ type: 'error', msg: 'No se pudieron cargar los pedidos.' });
    }
  };

  useEffect(() => { (async () => { await reloadOrders(); setLoading(false); })(); }, [search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setInterval(() => { void reloadOrders(); }, 15000); return () => clearInterval(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async () => {
    if (!newStatus || !selected) return;
    try {
      await adminService.updateOrderStatusAdmin(selected.id, newStatus as OrderStatus);
      if (profile) await adminService.logAudit(profile.id, `${profile.first_name} ${profile.last_name}`, 'cambiar_estado_pedido', 'order', selected.id, `#${selected.order_number}: ${selected.status} -> ${newStatus}`);
      setAlert({ type: 'success', msg: `Pedido #${selected.order_number} actualizado a ${newStatus}` });
      setSelected(null);
      setNewStatus('');
      await reloadOrders();
    } catch {
      setAlert({ type: 'error', msg: 'Error al actualizar' });
    }
  };

  const columns: EnterpriseColumn<AdminOrderView>[] = [
    { key: 'order_number', header: '# Pedido', sortable: true },
    { key: 'customer_name', header: 'Cliente', render: (order) => order.customer_name || 'Cliente invitado' },
    { key: 'business_name', header: 'Negocio', sortable: true },
    {
      key: 'order_type', header: 'Origen',
      render: (order) => order.created_manually
        ? <Badge variant="warning">Manual · {channelLabels[order.sales_channel || ''] || 'Externo'}</Badge>
        : <Badge variant="default">Aplicación</Badge>,
    },
    {
      key: 'status', header: 'Estado',
      render: (order) => <Badge variant={statusConfig[order.status] || 'default'}>{order.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'payment_status', header: 'Pago',
      render: (order) => <Badge variant={order.payment_status === 'completed' ? 'success' : 'warning'}>{order.payment_status}</Badge>,
    },
    { key: 'total_amount', header: 'Total', render: (order) => formatCurrency(order.total_amount), sortable: true },
    { key: 'courier_earnings', header: 'Gan. Repartidor', render: (order) => order.courier_earnings != null ? formatCurrency(order.courier_earnings) : '—' },
    { key: 'platform_earnings', header: 'Gan. DomiU', render: (order) => order.platform_earnings != null ? formatCurrency(order.platform_earnings) : '—' },
    { key: 'courier_name', header: 'Repartidor', render: (order) => order.delivery_type === 'pickup' ? 'Recoger en local' : order.courier_name || 'Sin asignar' },
    { key: 'created_at', header: 'Fecha', render: (order) => new Date(order.created_at).toLocaleString('es-CO') },
    { key: 'actions', header: 'Acciones', render: (order) => (
      <Button variant="ghost" size="sm" onClick={() => { setSelected(order); setNewStatus(order.status); }}>Gestionar</Button>
    )},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestión de Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pedidos de la aplicación y canales externos en el mismo flujo.</p>
        </div>
        <Link href="/admin/pedidos/crear" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          <PackagePlus className="h-4 w-4" /> Crear pedido manual
        </Link>
      </div>

      {alert && <Alert variant={alert.type} title={alert.msg} dismissible onDismiss={() => setAlert(null)} />}

      <EnterpriseTable
        columns={columns}
        data={orders}
        keyExtractor={order => order.id}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar pedidos..."
        loading={loading}
        emptyMessage="No hay pedidos"
        exportable
        exportFilename="pedidos"
        actions={<>
          <Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} options={[
            { value: 'all', label: 'Todos los estados' },
            ...ORDER_STATUSES.map(status => ({ value: status, label: status.replace('_', ' ') })),
          ]} className="w-44" />
          <Button variant="outline" size="sm" onClick={() => { void reloadOrders(); }}><RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar</Button>
        </>}
      />

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={`Pedido #${selected?.order_number || ''}`}>
        {selected && <div className="space-y-3">
          <div><span className="text-sm text-muted-foreground">Cliente:</span> <span className="font-medium">{selected.customer_name || 'Cliente invitado'}</span></div>
          <div><span className="text-sm text-muted-foreground">Negocio:</span> <span className="font-medium">{selected.business_name}</span></div>
          <div><span className="text-sm text-muted-foreground">Origen:</span> <Badge variant={selected.created_manually ? 'warning' : 'default'}>{selected.created_manually ? `Manual · ${channelLabels[selected.sales_channel || ''] || 'Externo'}` : 'Aplicación'}</Badge></div>
          <div><span className="text-sm text-muted-foreground">Entrega:</span> <span className="font-medium">{selected.delivery_type === 'pickup' ? 'Recoger en el local' : 'Domicilio'}</span></div>
          <div><span className="text-sm text-muted-foreground">Estado actual:</span> <Badge variant={statusConfig[selected.status]}>{selected.status}</Badge></div>
          <div><span className="text-sm text-muted-foreground">Total:</span> <span className="font-medium">{formatCurrency(selected.total_amount)}</span></div>
          <div><span className="text-sm text-muted-foreground">Repartidor:</span> <span className="font-medium">{selected.delivery_type === 'pickup' ? 'No aplica' : selected.courier_name || 'Sin asignar'}</span></div>
          {selected.courier_earnings != null && <div><span className="text-sm text-muted-foreground">Ganancia repartidor:</span> <span className="font-medium">{formatCurrency(selected.courier_earnings)}</span></div>}
          {selected.platform_earnings != null && <div><span className="text-sm text-muted-foreground">Ganancia DomiU:</span> <span className="font-medium">{formatCurrency(selected.platform_earnings)}</span></div>}
          <div><p className="mb-1 text-sm text-muted-foreground">Cambiar estado manualmente:</p><Select value={newStatus} onChange={event => setNewStatus(event.target.value)} options={ORDER_STATUSES.map(status => ({ value: status, label: status.replace('_', ' ') }))} /></div>
          <div className="flex gap-2 pt-2"><Button onClick={handleStatusChange} disabled={newStatus === selected.status}>Actualizar Estado</Button><Button variant="ghost" onClick={() => setSelected(null)}>Cerrar</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
