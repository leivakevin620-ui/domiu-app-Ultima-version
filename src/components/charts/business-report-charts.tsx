'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { BusinessReport } from '@/services/business';

const formatCurrency = (n: number) => '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });

export function SalesLineChart({ data }: { data: BusinessReport['dailySales'] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }} formatter={(v: unknown) => formatCurrency(Number(v) || 0)} />
        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--warning))' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopProductsBarChart({ data }: { data: BusinessReport['topProducts'] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }} formatter={(v: unknown) => `${Number(v) || 0} vendidos`} />
        <Bar dataKey="total" fill="hsl(var(--warning))" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PeakHoursBarChart({ data }: { data: BusinessReport['peakHours'] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}:00`} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12 }} formatter={(v: unknown) => `${Number(v) || 0} pedidos`} />
        <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
