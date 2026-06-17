'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ChevronDown, Navigation } from 'lucide-react';
import { ASSETS } from '@/lib/assets';

interface HeroSearchProps {
  onSearchFocus?: () => void;
}

export function HeroSearch({ onSearchFocus }: HeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    if ('geolocation' in navigator) {
      setGeoLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=es`,
              { headers: { 'User-Agent': 'DomiU/1.0' } }
            );
            const data = await res.json();
            const parts = data.display_name?.split(',') ?? [];
            setAddress(parts.slice(0, 3).join(','));
          } catch {
            setAddress(null);
          }
          setGeoLoading(false);
        },
        () => { setGeoLoading(false); setAddress(null); },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/cliente/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl">
      <div className="absolute inset-0">
        <Image
          src={ASSETS.hero}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
      </div>

      <div className="relative z-10 px-6 py-10 sm:px-8 sm:py-14 text-white">
        <button className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/25">
          {geoLoading ? (
            <Navigation className="h-4 w-4 shrink-0 animate-pulse" />
          ) : (
            <MapPin className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate max-w-[200px]">
            {address || 'Selecciona tu dirección'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>

        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl text-balance">
          ¿Qué se te antoja hoy?
        </h1>
        <p className="mb-6 text-sm text-white/70 max-w-md">
          Comida, farmacia, supermercado y más — todo en un solo lugar con entrega rápida en Santa Marta
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={onSearchFocus}
            placeholder="Buscar productos, restaurantes, farmacias..."
            className="h-13 w-full rounded-2xl border-0 bg-white/95 pl-12 pr-4 text-sm text-foreground shadow-xl backdrop-blur-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-white/40"
            style={{ height: '52px' }}
          />
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {['Hamburguesas', 'Pizza', 'Sushi', 'Farmacia'].map((tag) => (
            <button
              key={tag}
              onClick={() => router.push(`/cliente/search?q=${encodeURIComponent(tag)}`)}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
