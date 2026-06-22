'use client';

import React, { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/db/supabase';
import { Wallet, Search, RefreshCw } from 'lucide-react';

interface WalletRow {
  id: string;
  balance: number;
  total_credited: number;
  total_debited: number;
  is_active: boolean;
  profiles: { email: string; first_name: string; last_name: string } | null;
}

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function AdminWallets() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadWallets = async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from('wallets')
      .select('*, profiles!inner(email, first_name, last_name)')
      .order('balance', { ascending: false });
    return (data ?? []) as unknown as WalletRow[];
  };

  useEffect(() => {
    loadWallets().then(items => {
      setWallets(items);
      setLoading(false);
    });
  }, []);

  const filtered = wallets.filter((w) =>
    (w.profiles?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.profiles?.first_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Wallets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Billeteras digitales del sistema</p>
        </div>
        <button onClick={() => { setLoading(true); loadWallets().then(() => setLoading(false)); }} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por email o nombre..." className="h-10 w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm" />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Cargando wallets...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No hay wallets disponibles</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Acreditado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Debitado</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-b border-border/20 transition-colors hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{w.profiles?.first_name || '—'} {w.profiles?.last_name || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.profiles?.email || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${w.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(w.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-success">{formatCurrency(w.total_credited || 0)}</td>
                    <td className="px-4 py-3 text-right text-destructive">{formatCurrency(w.total_debited || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${w.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {w.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Total: {wallets.length} wallets · Balance combinado: {formatCurrency(wallets.reduce((s, w) => s + (w.balance || 0), 0))}
      </p>
    </div>
  );
}
