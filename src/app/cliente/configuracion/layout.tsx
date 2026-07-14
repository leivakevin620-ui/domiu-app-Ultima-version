'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Settings } from 'lucide-react';

const items = [
  { href: '/cliente/configuracion', label: 'Preferencias', icon: Settings, exact: true },
  { href: '/cliente/configuracion/direcciones', label: 'Direcciones y ubicación', icon: MapPin, exact: false },
];

export default function CustomerSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl py-5">
      <nav className="mx-4 mb-4 flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2 sm:mx-6">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
