'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Star, Clock, MapPin, Heart } from 'lucide-react';
import { BusinessPlaceholder } from '@/components/ui/placeholders';
import { toast } from 'sonner';

interface BusinessCardPremiumProps {
  name: string;
  image?: string;
  logo?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  deliveryTime?: string;
  deliveryFee?: string;
  isOpen?: boolean;
  isFeatured?: boolean;
  distance?: string;
  promotion?: string;
}

export function BusinessCardPremium({
  name, image, logo, category, rating = 0, reviewCount,
  deliveryTime, deliveryFee, isOpen = true, isFeatured,
  distance, promotion,
}: BusinessCardPremiumProps) {
  return (
    <motion.div
      className="group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-md transition-shadow duration-300 group-hover:shadow-xl">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-all duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <BusinessPlaceholder />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent" />

        {promotion && (
          <div className="absolute left-3 top-3 z-10">
            <span className="inline-flex items-center rounded-2xl bg-warning px-3 py-1 text-xs font-bold text-warning-foreground shadow-lg">
              {promotion}
            </span>
          </div>
        )}

        {isFeatured && (
          <div className="absolute right-3 top-3 z-10">
            <span className="inline-flex items-center rounded-2xl bg-white/90 px-3 py-1 text-xs font-semibold text-foreground shadow-lg backdrop-blur-sm">
              ⭐ Destacado
            </span>
          </div>
        )}

        <button onClick={(e) => { e.stopPropagation(); toast.info('Función en preparación: favoritos'); }} className="absolute right-3 bottom-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-110">
          <Heart className="h-4 w-4" />
        </button>

        {!isOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="rounded-2xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground shadow-lg">
              Cerrado
            </span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-12 z-10 flex items-center gap-2">
          {distance && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
              <MapPin className="h-3 w-3" />
              {distance}
            </span>
          )}
          {deliveryTime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
              <Clock className="h-3 w-3" />
              {deliveryTime}
            </span>
          )}
        </div>

        {rating > 0 && (
          <div className="absolute right-3 top-12 z-10">
            <span className="inline-flex items-center gap-1 rounded-2xl bg-white/90 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        {logo && (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border/30 shadow-sm ring-2 ring-background">
            <Image
              src={logo}
              alt={name}
              fill
              sizes="48px"
              className="object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">{name}</h3>
          {category && <p className="text-xs text-muted-foreground truncate">{category}</p>}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {reviewCount !== undefined && reviewCount > 0 && (
              <span className="text-muted-foreground/60">{reviewCount}+ pedidos</span>
            )}
            {deliveryFee && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className={deliveryFee === 'Gratis' || parseFloat(deliveryFee.replace('$', '')) === 0 ? 'text-success font-medium' : ''}>
                  {deliveryFee === '$0.00' || parseFloat(deliveryFee.replace('$', '')) === 0 ? 'Envío gratis' : deliveryFee}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
