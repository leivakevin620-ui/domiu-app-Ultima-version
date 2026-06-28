'use client';

import React from 'react';
import Link from 'next/link';
import { AdminLiveDashboard } from '@/components/admin/live-dashboard/AdminLiveDashboard';
import { FileText, LifeBuoy, ClipboardList, Truck, Store, ArrowRight } from 'lucide-react';

const shortcuts = [
  {
    title: 'Solicitudes pendientes',
    description: 'Aprobar o rechazar personas que quieren ser repartidores o registrar negocios.',
    href: '/admin/solicitudes',
    icon: FileText,
  },
  {
    title: 'Soporte y reportes',
    description: 'Ver mensajes de clientes, repartidores y negocios.',
    href: '/admin/soporte',
    icon: LifeBuoy,
  },
  {
    title: 'Pedidos y domicilios',
    description: 'Gestionar pedidos, domicilios manuales, estados y ganancias.',
    href: '/admin/pedidos',
    icon: ClipboardList,
  },
  {
    title: 'Repartidores',
    description: 'Revisar perfiles, documentos y actividad de domiciliarios.',
    href: '/admin/repartidores',
    icon: Truck,
  },
  {
    title: 'Negocios',
    description: 'Administrar locales, productos, imágenes y propietarios.',
    href: '/admin/negocios',
    icon: Store,
  },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card/60 p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Panel Admin DomiU</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accesos principales para operar solicitudes, soporte, pedidos, repartidores y negocios.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {shortcuts.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-border/60 bg-background/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>

                <h2 className="text-sm font-bold text-foreground">{item.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>

                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <AdminLiveDashboard />
    </div>
  );
}
