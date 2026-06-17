'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin } from 'lucide-react';

interface HeroSearchProps {
  onSearchFocus?: () => void;
}

export function HeroSearch({ onSearchFocus }: HeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/cliente/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 px-6 py-8 text-primary-foreground sm:px-8 sm:py-10">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-2 text-sm text-primary-foreground/80">
          <MapPin className="h-4 w-4" />
          <span>Av. Principal 123, Centro</span>
        </div>

        <h2 className="mb-1 text-xl font-semibold sm:text-2xl">
          ¿Qué quieres comer hoy?
        </h2>
        <p className="mb-5 text-sm text-primary-foreground/70">
          Descubre los mejores restaurantes cerca de ti
        </p>

        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={onSearchFocus}
            placeholder="Buscar restaurantes o platillos..."
            className="h-12 w-full rounded-xl border-0 bg-white pl-12 pr-4 text-sm text-foreground shadow-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </form>
      </div>
    </div>
  );
}
