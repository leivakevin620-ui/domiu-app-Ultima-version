'use client';

import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))', 'hsl(262, 83%, 58%)'];

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ title, children, className, action }: ChartCardProps) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card shadow-card overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent px-5 py-3.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function RevenueLineChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos de ingresos</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          labelFormatter={(v: React.ReactNode) => { const d = new Date(String(v) + 'T00:00:00'); return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }); }}
        />
        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="orders" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 2, fill: 'hsl(var(--success))' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OrdersBarChart({ data }: { data: { hour: number; count: number }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos de pedidos</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(h) => `${h}h`} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '12px' }}
          labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))">
          {data.map((_, i) => (
            <Cell key={i} fill={data[i].count > 0 ? 'hsl(var(--primary))' : 'hsl(var(--border))'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: { status: string; count: number }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="count" label={(p: unknown) => `${(Number((p as Record<string, unknown>).percent ?? 0) * 100).toFixed(0)}%`}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '12px' }}
          formatter={(value: unknown) => String(value)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CityBarChart({ data }: { data: { city: string; count: number; revenue: number }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos por ciudad</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <XAxis dataKey="city" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '12px' }}
        />
        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RegistrationAreaChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos de registros</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '12px' }}
        />
        <Area type="monotone" dataKey="count" stroke="hsl(var(--success))" fill="hsl(var(--success)/0.15)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusLegend({ data, className }: { data: { status: string; count: number }[]; className?: string }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {data.map((d, i) => (
        <div key={d.status} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
          <span className="text-xs text-muted-foreground capitalize">{d.status}</span>
          <span className="text-xs font-medium text-foreground">({((d.count / total) * 100).toFixed(0)}%)</span>
        </div>
      ))}
    </div>
  );
}
