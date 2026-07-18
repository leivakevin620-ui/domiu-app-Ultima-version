'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { getBrowserClient } from '@/lib/db/supabase';
import { formatCop } from '@/lib/money/cop';

type Row = {
  courierId: string;
  courierName: string;
  email: string;
  workDate: string;
  onlineSeconds: number;
  completedDeliveries: number;
  netEarnings: number;
  cashCollected: number;
  companyOwes: number;
  courierOwes: number;
  netBalance: number;
};

function duration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 3600)} h ${Math.floor((safe % 3600) / 60)} min`;
}

export default function AdminLiquidationsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [direction, setDirection] = useState<'company_to_courier' | 'courier_to_company'>(
    'company_to_courier',
  );
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { data: stubs, error: stubError } = await supabase
        .from('courier_daily_payment_stub_v')
        .select('*')
        .eq('work_date', date)
        .order('courier_net_earnings_cop', { ascending: false });
      if (stubError) throw new Error(stubError.message);
      const courierIds = [...new Set((stubs ?? []).map((stub) => String(stub.courier_id)))];
      const [profilesResult, balancesResult] = await Promise.all([
        courierIds.length
          ? supabase
              .from('profiles')
              .select('id,first_name,last_name,email')
              .in('id', courierIds)
          : Promise.resolve({ data: [], error: null }),
        courierIds.length
          ? supabase.from('courier_balance_summary_v').select('*').in('courier_id', courierIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (balancesResult.error) throw new Error(balancesResult.error.message);
      const profiles = new Map(
        (profilesResult.data ?? []).map((profile) => [String(profile.id), profile]),
      );
      const balances = new Map(
        (balancesResult.data ?? []).map((balance) => [String(balance.courier_id), balance]),
      );
      setRows(
        (stubs ?? []).map((stub) => {
          const courierId = String(stub.courier_id);
          const profile = profiles.get(courierId);
          const balance = balances.get(courierId);
          return {
            courierId,
            courierName:
              [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
              profile?.email ||
              'Repartidor',
            email: String(profile?.email || ''),
            workDate: String(stub.work_date),
            onlineSeconds: Number(stub.online_seconds ?? 0),
            completedDeliveries: Number(stub.completed_deliveries ?? 0),
            netEarnings: Number(stub.courier_net_earnings_cop ?? 0),
            cashCollected: Number(stub.cash_collected_cop ?? 0),
            companyOwes: Number(balance?.company_owes_courier_cop ?? 0),
            courierOwes: Number(balance?.courier_owes_company_cop ?? 0),
            netBalance: Number(balance?.net_balance_cop ?? 0),
          };
        }),
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las liquidaciones');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.courierName} ${row.email}`.toLowerCase().includes(term));
  }, [rows, search]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (summary, row) => ({
          deliveries: summary.deliveries + row.completedDeliveries,
          earnings: summary.earnings + row.netEarnings,
          cash: summary.cash + row.cashCollected,
          companyOwes: summary.companyOwes + row.companyOwes,
          courierOwes: summary.courierOwes + row.courierOwes,
        }),
        { deliveries: 0, earnings: 0, cash: 0, companyOwes: 0, courierOwes: 0 },
      ),
    [rows],
  );

  const openSettlement = (
    row: Row,
    nextDirection: 'company_to_courier' | 'courier_to_company',
  ) => {
    setSelected(row);
    setDirection(nextDirection);
    setAmount(
      String(
        nextDirection === 'company_to_courier' ? row.companyOwes : row.courierOwes,
      ),
    );
    setReference('');
    setNote('');
  };

  const saveSettlement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const parsedAmount = Number(amount.replaceAll('.', '').replaceAll(',', ''));
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setError('El valor de la liquidación debe ser un número entero mayor que cero');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const supabase = getBrowserClient();
      const { error: rpcError } = await supabase.rpc('record_courier_settlement', {
        p_courier_id: selected.courierId,
        p_direction: direction,
        p_amount_cop: parsedAmount,
        p_reference: reference.trim() || null,
        p_note: note.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la liquidación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-7 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              Finanzas operativas
            </p>
            <h1 className="mt-2 text-3xl font-black">Liquidaciones de repartidores</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consulta jornadas, ganancias, efectivo cobrado y el saldo exacto entre DomiU y cada repartidor.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
            <p className="text-xs text-slate-300">Fecha de liquidación</p>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Domicilios" value={String(totals.deliveries)} />
        <Summary label="Ganancias repartidores" value={formatCop(totals.earnings)} />
        <Summary label="Efectivo cobrado" value={formatCop(totals.cash)} />
        <Summary label="DomiU debe" value={formatCop(totals.companyOwes)} />
        <Summary label="Repartidores deben" value={formatCop(totals.courierOwes)} />
      </section>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar repartidor…"
              className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {error && (
          <p className="m-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-5 py-4">Repartidor</th>
                <th className="px-4 py-4">En línea</th>
                <th className="px-4 py-4">Domicilios</th>
                <th className="px-4 py-4">Ganancia neta</th>
                <th className="px-4 py-4">Efectivo</th>
                <th className="px-4 py-4">Saldo</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.courierId} className="align-top hover:bg-muted/20">
                  <td className="px-5 py-4">
                    <p className="font-black">{row.courierName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="px-4 py-4 font-semibold">{duration(row.onlineSeconds)}</td>
                  <td className="px-4 py-4 font-black">{row.completedDeliveries}</td>
                  <td className="px-4 py-4 font-black text-success">{formatCop(row.netEarnings)}</td>
                  <td className="px-4 py-4 font-semibold">{formatCop(row.cashCollected)}</td>
                  <td className="px-4 py-4">
                    {row.courierOwes > 0 ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                        Debe {formatCop(row.courierOwes)}
                      </span>
                    ) : row.companyOwes > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                        DomiU debe {formatCop(row.companyOwes)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                        Saldado
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/liquidaciones/imprimir?courierId=${row.courierId}&date=${date}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black"
                      >
                        <Printer className="h-3.5 w-3.5" /> PDF
                      </Link>
                      <a
                        href={`/api/reports/courier-statement?courierId=${row.courierId}&date=${date}&format=xls`}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                      </a>
                      {row.companyOwes > 0 && (
                        <button
                          type="button"
                          onClick={() => openSettlement(row, 'company_to_courier')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" /> Pagar
                        </button>
                      )}
                      {row.courierOwes > 0 && (
                        <button
                          type="button"
                          onClick={() => openSettlement(row, 'courier_to_company')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white"
                        >
                          <ArrowUpFromLine className="h-3.5 w-3.5" /> Recibir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No hay jornadas de repartidores registradas para esta fecha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveSettlement} className="w-full max-w-lg rounded-3xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                  Registrar liquidación
                </p>
                <h2 className="mt-2 text-xl font-black">{selected.courierName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {direction === 'company_to_courier'
                    ? 'DomiU pagará al repartidor.'
                    : 'El repartidor entregará dinero a DomiU.'}
                </p>
              </div>
              <Wallet className="h-7 w-7 text-primary" />
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-bold">
                Valor COP
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  className="mt-1 h-12 w-full rounded-xl border bg-background px-3"
                />
              </label>
              <label className="block text-sm font-bold">
                Referencia del pago o recibo
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transferencia, recibo de caja o comprobante"
                  className="mt-1 h-12 w-full rounded-xl border bg-background px-3"
                />
              </label>
              <label className="block text-sm font-bold">
                Nota
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-black"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Registrando…' : 'Confirmar movimiento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5" />
          <p className="text-sm leading-6">
            Cada pago o entrega de efectivo crea un movimiento auditable. El saldo no se edita directamente: se modifica únicamente mediante asientos del libro contable.
          </p>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-black">{value}</p>
    </article>
  );
}
