'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, FavoriteItem } from '@/services/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { Heart, Store, Package, Trash2, Star, ChevronRight } from 'lucide-react';

export default function ClienteFavoritosPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'businesses' | 'products'>('all');

  useEffect(() => {
    if (!profile?.id) return;
    clientService.getFavorites(profile.id).then(data => {
      setFavorites(data);
      setLoading(false);
    });
  }, [profile?.id]);

  const handleRemove = useCallback(async (id: string) => {
    await clientService.removeFavorite(id);
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  const filtered = favorites.filter(f => {
    if (tab === 'businesses') return f.business_id;
    if (tab === 'products') return f.product_id;
    return true;
  });

  const tabs = [
    { key: 'all' as const, label: 'Todos', count: favorites.length },
    { key: 'businesses' as const, label: 'Negocios', count: favorites.filter(f => f.business_id).length },
    { key: 'products' as const, label: 'Productos', count: favorites.filter(f => f.product_id).length },
  ];

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-bold text-foreground">Mis Favoritos</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex gap-1 rounded-xl bg-muted/50 p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                tab === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title={tab === 'all' ? 'Sin favoritos aún' : tab === 'businesses' ? 'Sin negocios favoritos' : 'Sin productos favoritos'}
            description="Guarda lo que te guste para encontrarlo rápidamente."
            action={
              <button
                onClick={() => router.push('/cliente')}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Explorar
              </button>
            }
          />
        ) : (
          <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AnimatePresence>
              {filtered.map((fav, i) => (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card/50 transition-all hover:border-primary/20 hover:shadow-lg"
                >
                  {fav.business_id && fav.business ? (
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                        <Store className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/cliente/business/${fav.business?.slug}`)}>
                        <p className="text-sm font-semibold text-foreground truncate">{fav.business.name}</p>
                        <p className="text-xs text-muted-foreground">{fav.business.cuisine_type}</p>
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                          <Star className="h-3 w-3 fill-current" />
                          {fav.business.rating.toFixed(1)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(fav.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : fav.product_id && fav.product ? (
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 text-secondary">
                        <Package className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{fav.product.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{fav.product.business_name ?? ''}</p>
                        <p className="mt-1 text-sm font-bold text-primary">
                          ${(fav.product.discount_price ?? fav.product.price).toFixed(2)}
                          {fav.product.discount_price && (
                            <span className="ml-1.5 text-xs text-muted-foreground line-through">${fav.product.price.toFixed(2)}</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(fav.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
