'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyEarningPoint } from '@/services/courier-pro';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

export function EarningsChart({ data }: { data: DailyEarningPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 11 }} formatter={(v: unknown) => formatCurrency(Number(v) || 0)} />
        <Area type="monotone" dataKey="total" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#earningsGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
