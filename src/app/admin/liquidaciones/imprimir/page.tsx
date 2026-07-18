'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/db/supabase';
import { DomiULogo } from '@/components/brand/DomiULogo';
import { formatCop } from '@/lib/money/cop';

type Data = {
  name: string;
  email: string;
  phone: string;
  date: string;
  shifts: number;
  onlineSeconds: number;
  deliveries: number;
  deliveryFees: number;
  earnings: number;
  cash: number;
  companyOwes: number;
  courierOwes: number;
  netBalance: number;
  firstOnlineAt: string | null;
  lastOfflineAt: string | null;
};

function duration(seconds: number) {
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}

function dateTime(value: string | null) {
  if (!value) return 'No registrado';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
}

export default function AdminPrintLiquidationPage() {
  const params = useSearchParams();
  const courierId = params.get('courierId') || '';
  const date = params.get('date') || new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!courierId) {
      setError('Falta el identificador del repartidor');
      setLoading(false);
      return;
    }
    try {
      const supabase = getBrowserClient();
      const [profileResult, stubResult, balanceResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('first_name,last_name,email,phone')
          .eq('id', courierId)
          .maybeSingle(),
        supabase
          .from('courier_daily_payment_stub_v')
          .select('*')
          .eq('courier_id', courierId)
          .eq('work_date', date)
          .maybeSingle(),
        supabase
          .from('courier_balance_summary_v')
          .select('*')
          .eq('courier_id', courierId)
          .maybeSingle(),
      ]);
      if (profileResult.error || stubResult.error || balanceResult.error) {
        throw new Error(
          profileResult.error?.message ||
            stubResult.error?.message ||
            balanceResult.error?.message ||
            'No se pudo cargar la liquidación',
        );
      }
      if (!profileResult.data) throw new Error('Repartidor no encontrado');
      const profile = profileResult.data;
      const stub = stubResult.data ?? {};
      const balance = balanceResult.data ?? {};
      setData({
        name:
          [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
          profile.email ||
          'Repartidor',
        email: String(profile.email || ''),
        phone: String(profile.phone || 'No registrado'),
        date,
        shifts: Number(stub.shifts_count ?? 0),
        onlineSeconds: Number(stub.online_seconds ?? 0),
        deliveries: Number(stub.completed_deliveries ?? 0),
        deliveryFees: Number(stub.delivery_fees_cop ?? 0),
        earnings: Number(stub.courier_net_earnings_cop ?? 0),
        cash: Number(stub.cash_collected_cop ?? 0),
        companyOwes: Number(balance.company_owes_courier_cop ?? 0),
        courierOwes: Number(balance.courier_owes_company_cop ?? 0),
        netBalance: Number(balance.net_balance_cop ?? 0),
        firstOnlineAt: stub.first_online_at ? String(stub.first_online_at) : null,
        lastOfflineAt: stub.last_offline_at ? String(stub.last_offline_at) : null,
      });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la liquidación');
    } finally {
      setLoading(false);
    }
  }, [courierId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/liquidaciones" className="inline-flex items-center gap-2 text-sm font-black text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver a liquidaciones
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground"
          >
            <Printer className="h-4 w-4" /> Guardar como PDF
          </button>
          <a
            href={`/api/reports/courier-statement?courierId=${courierId}&date=${date}&format=xls`}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-black"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border bg-card">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          {error}
        </p>
      ) : data ? (
        <article className="overflow-hidden rounded-[2rem] border bg-white text-slate-900 shadow-xl print:rounded-none print:border-0 print:shadow-none">
          <header className="bg-slate-950 px-8 py-7 text-white">
            <div className="flex items-center justify-between gap-6">
              <div>
                <DomiULogo variant="dark" className="justify-start" />
                <h1 className="mt-3 text-2xl font-black">Liquidación diaria de repartidor</h1>
                <p className="mt-1 text-sm text-slate-300">DomiU Magdalena · {data.date}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-300">Estado del saldo</p>
                <p className="mt-1 text-xl font-black">
                  {data.netBalance > 0
                    ? `DomiU debe ${formatCop(data.companyOwes)}`
                    : data.netBalance < 0
                      ? `Repartidor debe ${formatCop(data.courierOwes)}`
                      : 'Saldo en cero'}
                </p>
              </div>
            </div>
          </header>

          <section className="grid gap-5 bg-amber-50 px-8 py-6 sm:grid-cols-3">
            <Field label="Repartidor" value={data.name} />
            <Field label="Correo" value={data.email} />
            <Field label="Teléfono" value={data.phone} />
          </section>

          <section className="grid gap-4 px-8 py-7 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Jornadas" value={String(data.shifts)} />
            <Metric label="Tiempo en línea" value={duration(data.onlineSeconds)} />
            <Metric label="Domicilios realizados" value={String(data.deliveries)} />
            <Metric label="Tarifas de domicilio" value={formatCop(data.deliveryFees)} />
            <Metric label="Ganancia neta" value={formatCop(data.earnings)} highlighted />
            <Metric label="Efectivo cobrado" value={formatCop(data.cash)} />
            <Metric label="DomiU le debe" value={formatCop(data.companyOwes)} />
            <Metric label="Repartidor debe" value={formatCop(data.courierOwes)} />
          </section>

          <section className="mx-8 mb-7 rounded-2xl border bg-slate-50 p-5">
            <h2 className="font-black">Control de jornada</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Primera conexión" value={dateTime(data.firstOnlineAt)} />
              <Field label="Último cierre" value={dateTime(data.lastOfflineAt)} />
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Este documento refleja los movimientos registrados en el libro contable de DomiU. No sustituye comprobantes bancarios o recibos de caja asociados a una liquidación.
            </p>
          </section>

          <footer className="border-t px-8 py-5 text-xs text-slate-500">
            Generado el{' '}
            {new Intl.DateTimeFormat('es-CO', {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: 'America/Bogota',
            }).format(new Date())}
            .
          </footer>
        </article>
      ) : null}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value, highlighted = false }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlighted ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}
