'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { SkeletonStats } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { adminService, type FinanceSummary } from '@/services/admin';
import { commissionService, type CommissionConfig, type CommissionTransaction, type BusinessPayout } from '@/services/commission';
import { reportService } from '@/services/reports';
import { logger } from '@/lib/logger';
import { DollarSign, Percent, Banknote, Download, CheckCircle, ArrowUpCircle } from 'lucide-react';

type TabId = 'comisiones' | 'transacciones' | 'pagos';

export default function AdminFinanzas() {
  const { profile } = useAuth();
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [payouts, setPayouts] = useState<BusinessPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('comisiones');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadAll = () => {
    if (!profile?.id) return;
    Promise.all([
      adminService.getFinanceSummary(),
      commissionService.getConfigs(),
      commissionService.getTransactions(),
      commissionService.getPayouts(),
    ])
      .then(([summary, configsData, txData, payoutData]) => {
        setFinanceSummary(summary);
        setConfigs(configsData);
        setTransactions(txData);
        setPayouts(payoutData);
      })
      .catch((e) => logger.error('Error loading finance data', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleConfig = async (id: string, active: boolean) => {
    await commissionService.toggleConfig(id, !active);
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !active } : c)));
  };

  const handleCollect = async () => {
    if (selectedIds.size === 0) return;
    await commissionService.collectCommissions([...selectedIds]);
    setSelectedIds(new Set());
    loadAll();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExportSales = async () => {
    const csv = await reportService.exportSalesCSV();
    reportService.downloadCSV('ventas', csv);
  };
  const handleExportCommissions = async () => {
    const csv = await reportService.exportCommissionsCSV();
    reportService.downloadCSV('comisiones', csv);
  };

  if (loading) return <SkeletonStats />;

  const tabs = [
    { id: 'comisiones' as TabId, label: 'Configuración' },
    { id: 'transacciones' as TabId, label: 'Transacciones' },
    { id: 'pagos' as TabId, label: 'Pagos' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Finanzas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comisiones, ingresos y pagos a negocios</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportSales} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" /> Ventas CSV
          </button>
          <button onClick={handleExportCommissions} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" /> Comisiones CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Comisiones Totales" value={`$${(financeSummary?.totalCommission ?? 0).toFixed(2)}`} gradient="primary" />
        <StatCard icon={<Percent className="h-5 w-5" />} label="Pendientes" value={`$${(financeSummary?.pendingCommission ?? 0).toFixed(2)}`} gradient="warning" />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Cobradas" value={`$${(financeSummary?.collectedCommission ?? 0).toFixed(2)}`} gradient="success" />
        <StatCard icon={<Banknote className="h-5 w-5" />} label="Pagos Pendientes" value={`$${(financeSummary?.pendingPayouts ?? 0).toFixed(2)}`} gradient="warning" />
        <StatCard icon={<ArrowUpCircle className="h-5 w-5" />} label="Pagado a Negocios" value={`$${(financeSummary?.totalPayouts ?? 0).toFixed(2)}`} gradient="success" />
      </div>

      <Tabs tabs={tabs} activeTab={tab} onTabChange={(id) => setTab(id as TabId)} />

      {tab === 'comisiones' && (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Configuración de Comisiones</h3>
          </div>
          <div className="p-5 space-y-2">
            {configs.map((cfg) => (
              <div key={cfg.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <Badge variant={cfg.type === 'global' ? 'default' : cfg.type === 'category' ? 'secondary' : 'outline'}>
                    {cfg.type === 'global' ? 'Global' : cfg.type === 'category' ? 'Categoría' : 'Negocio'}
                  </Badge>
                  <span className="text-sm text-foreground">{cfg.category ?? cfg.business_id ?? '—'}</span>
                  <span className="text-sm font-semibold">{cfg.rate}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={cfg.is_active ? 'default' : 'secondary'}>{cfg.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  <button
                    onClick={() => handleToggleConfig(cfg.id, cfg.is_active)}
                    className={`text-xs font-medium ${cfg.is_active ? 'text-destructive' : 'text-success'}`}
                  >
                    {cfg.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'transacciones' && (
        <div className="space-y-4">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
              <span className="text-sm text-foreground">{selectedIds.size} seleccionadas</span>
              <button onClick={handleCollect} className="rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                Cobrar seleccionadas
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Transacciones de Comisión</h3>
            </div>
            <div className="p-5 space-y-2">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <DollarSign className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Sin transacciones</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground">{tx.order_id.slice(0, 8)}</span>
                      <span className="text-muted-foreground">${tx.order_total.toFixed(2)}</span>
                      <span className="text-muted-foreground">{tx.commission_rate}%</span>
                      <span className="font-semibold text-foreground">${tx.commission_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={tx.status === 'collected' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                        {tx.status === 'collected' ? 'Cobrada' : tx.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                      </Badge>
                      {tx.status === 'pending' && (
                        <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="h-4 w-4 rounded border-border" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'pagos' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['pending', 'approved', 'completed', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={async () => { const p = await commissionService.getPayouts(s); setPayouts(p); }}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobados' : s === 'completed' ? 'Completados' : 'Rechazados'}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
            <div className="border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Pagos a Negocios</h3>
            </div>
            <div className="p-5 space-y-2">
              {payouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Banknote className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Sin solicitudes de pago</p>
                </div>
              ) : (
                payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/50 p-4 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">${p.amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{p.method} · {new Date(p.requested_at).toLocaleDateString('es-CO')}</p>
                      {p.notes && <p className="mt-1 text-xs text-muted-foreground/70">{p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'completed' ? 'default' : p.status === 'approved' ? 'secondary' : p.status === 'rejected' ? 'destructive' : 'outline'}>
                        {p.status === 'pending' ? 'Pendiente' : p.status === 'approved' ? 'Aprobado' : p.status === 'completed' ? 'Completado' : 'Rechazado'}
                      </Badge>
                      {p.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => commissionService.approvePayout(p.id, profile!.id).then(loadAll)} className="rounded-lg bg-success/10 px-2 py-1 text-xs text-success hover:bg-success/20">Aprobar</button>
                          <button onClick={() => commissionService.rejectPayout(p.id, profile!.id).then(loadAll)} className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20">Rechazar</button>
                        </div>
                      )}
                      {p.status === 'approved' && (
                        <button onClick={() => commissionService.completePayout(p.id, profile!.id).then(loadAll)} className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20">Completar</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
