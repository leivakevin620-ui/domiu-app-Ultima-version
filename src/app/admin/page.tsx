'use client';

import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { adminService } from '@/services/admin';
import type { DashboardStats, AuditLog } from '@/services/admin';
import {
  ShoppingCart, PackageCheck, XCircle, Store, Truck, Users, DollarSign, TrendingUp,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, logs] = await Promise.all([
          adminService.getDashboardStats(),
          adminService.getRecentActivity(),
        ]);
        setStats(s);
        setRecentActivity(logs);
      } catch { /* da error */ }
      setLoading(false);
    })();
  }, []);

  const formatCurrency = (n: number) =>
    '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <PageContainer>
      <PageTitle title="Panel de Administración" description="Resumen general del sistema" />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Pedidos Hoy"
          value={loading ? '...' : String(stats?.todayOrders ?? 0)}
          trend={stats?.todayOrders ? { value: 'Hoy', positive: true } : undefined}
        />
        <StatCard
          icon={<PackageCheck className="h-5 w-5 text-status-success" />}
          label="Completados"
          value={loading ? '...' : String(stats?.completedOrders ?? 0)}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-destructive" />}
          label="Cancelados"
          value={loading ? '...' : String(stats?.cancelledOrders ?? 0)}
        />
        <StatCard
          icon={<Store className="h-5 w-5" />}
          label="Negocios Activos"
          value={loading ? '...' : String(stats?.activeBusinesses ?? 0)}
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          label="Repartidores"
          value={loading ? '...' : String(stats?.onlineCouriers ?? 0)}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Clientes"
          value={loading ? '...' : String(stats?.totalCustomers ?? 0)}
        />
        <StatCard
          icon={<ShoppingCart className="h-5 w-5 text-warning" />}
          label="Activos"
          value={loading ? '...' : String(stats?.activeOrders ?? 0)}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-success" />}
          label="Ingresos Hoy"
          value={loading ? '...' : formatCurrency(stats?.todayRevenue ?? 0)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Ingresos del Mes"
          value={loading ? '...' : formatCurrency(stats?.monthRevenue ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard title="Actividad Reciente" className="max-h-96">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad reciente. Las acciones de administración aparecerán aquí.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{log.admin_name || 'Admin'}</span>
                      <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {log.entity_type}{log.details ? ` — ${log.details}` : ''}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Resumen de Pedidos">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Pendientes', value: '0', color: 'bg-warning/10 text-warning' },
                { label: 'En Preparación', value: '0', color: 'bg-info/10 text-info' },
                { label: 'En Camino', value: '0', color: 'bg-primary/10 text-primary' },
                { label: 'Entregados Hoy', value: String(stats?.completedOrders ?? 0), color: 'bg-success/10 text-success' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-4 text-center">
                  <p className={`text-2xl font-bold ${item.color.split(' ')[1]}`}>{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>
    </PageContainer>
  );
}
