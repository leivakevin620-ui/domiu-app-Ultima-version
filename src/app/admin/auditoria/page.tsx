'use client';

import React, { useEffect, useState } from 'react';
import { auditService } from '@/services/audit';
import { useAuth } from '@/contexts/AuthContext';
import { permissionsService } from '@/services/permissions';
import { useRouter } from 'next/navigation';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Shield, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { ADMIN_ROLES } from '@/types/auth';
import type { AuditLog } from '@/services/audit';

const ACTION_LABELS: Record<string, string> = {
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  cambiar_estado_pedido: 'Cambio de estado',
  suspender_usuario: 'Suspensión de usuario',
  reactivar_usuario: 'Reactivación de usuario',
  cambiar_rol: 'Cambio de rol',
  verificar_negocio: 'Verificación de negocio',
  suspender_negocio: 'Suspensión de negocio',
  reactivar_negocio: 'Reactivación de negocio',
  verificar_repartidor: 'Verificación de repartidor',
  suspender_repartidor: 'Suspensión de repartidor',
  reactivar_repartidor: 'Reactivación de repartidor',
};

export default function AdminAuditoria() {
  const { profile, isLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);

  const pageSize = 30;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    if (isLoading) return;
    if (!profile || !ADMIN_ROLES.includes(profile.role)) { router.push('/login'); return; }
    if (!permissionsService.hasPermission(profile.admin_role, 'audit.read', profile.email)) {
      router.push('/admin');
      return;
    }
  }, [profile, isLoading, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const filters: Record<string, string> = {};
        if (actionFilter) filters.action = actionFilter;
        if (entityFilter) filters.entityType = entityFilter;
        if (search) filters.search = search;
        const { logs: data, total: t } = await auditService.getAll(page, pageSize, filters);
        setLogs(data);
        setTotal(t);
      } catch { /* ok */ }
      setLoading(false);
    })();
  }, [page, actionFilter, entityFilter, search]);

  useEffect(() => {
    (async () => {
      const all = await auditService.getAllActions();
      setActions(all);
    })();
  }, []);

  if (isLoading) return <SkeletonCard />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Centro de Auditoría</h1>
            <p className="mt-1 text-sm text-muted-foreground">Registro detallado de todas las acciones administrativas</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar en auditoría..."
            className="h-10 w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="h-10 w-44 rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"
          >
            <option value="">Todas las acciones</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="h-10 w-44 rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"
          >
            <option value="">Todos los módulos</option>
            <option value="profile">Usuarios</option>
            <option value="business">Negocios</option>
            <option value="driver">Repartidores</option>
            <option value="order">Pedidos</option>
            <option value="wallet">Wallets</option>
            <option value="settings">Configuración</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Módulo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Detalles</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Dispositivo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Resultado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No se encontraron registros de auditoría</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{log.admin_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{log.entity_type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{log.details || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        <span>{log.browser || '—'}</span>
                        {log.device && <span className="ml-1">· {log.device}</span>}
                        {log.os && <span className="ml-1">· {log.os}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${log.result === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                        {log.result === 'error' ? 'Error' : 'Éxito'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Mostrando {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
