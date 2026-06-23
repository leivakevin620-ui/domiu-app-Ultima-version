'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Mic, SlidersHorizontal, Map as MapIcon } from 'lucide-react';

export function SearchBar() {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/cliente/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <motion.div
      className="sticky top-16 z-20 bg-background/70 backdrop-blur-2xl pb-3 pt-2 supports-[backdrop-filter]:bg-background/60"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <div className={`relative flex flex-1 items-center rounded-2xl border bg-background/80 backdrop-blur-xl transition-all ${focused ? 'border-primary/30 shadow-lg shadow-primary/5 ring-2 ring-primary/10' : 'border-border/50 shadow-sm'}`}>
          <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Buscar productos, restaurantes..."
            className="h-11 w-full bg-transparent pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button type="button" className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-muted">
            <Mic className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/80 text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/30 hover:text-primary hover:shadow-sm">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/80 text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/30 hover:text-primary hover:shadow-sm">
          <MapIcon className="h-4 w-4" />
        </button>
      </form>
    </motion.div>
  );
}
