'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Bike, Clock, Heart, MapPin, Star } from 'lucide-react';
import { BusinessPlaceholder } from '@/components/ui/placeholders';
import { useAuth } from '@/contexts/AuthContext';
import { clientService } from '@/services/client';
import { toast } from 'sonner';

interface BusinessCardPremiumProps {
  id?: string;
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

function safeDeliveryFee(deliveryFee?: string) {
  if (!deliveryFee) return 'Tarifa según distancia';
  const value = deliveryFee.trim().toLowerCase();
  const numeric = Number.parseFloat(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  if (value.includes('gratis') || value === '$0' || value === '$0.00' || numeric === 0) {
    return 'Tarifa según distancia';
  }
  return deliveryFee;
}

export function BusinessCardPremium({
  id,
  name,
  image,
  logo,
  category,
  rating = 0,
  reviewCount,
  deliveryTime,
  deliveryFee,
  isOpen = true,
  isFeatured,
  distance,
  promotion,
}: BusinessCardPremiumProps) {
  const { profile } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const handleFav = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!profile?.id || !id || favLoading) return;
    setFavLoading(true);
    try {
      const result = await clientService.toggleFavorite(profile.id, { businessId: id });
      setIsFav(result);
      toast.success(result ? 'Agregado a favoritos' : 'Eliminado de favoritos');
    } catch {
      toast.error('Error al actualizar favorito');
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <motion.article
      className="group cursor-pointer overflow-hidden rounded-3xl border border-[#E3E6EB] bg-white shadow-[0_12px_36px_-28px_rgba(16,24,40,.45)]"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#EEF0F3]">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-all duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <BusinessPlaceholder />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {promotion && !promotion.toLowerCase().includes('gratis') && (
          <div className="absolute left-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-[#FFD400] px-3 py-1.5 text-xs font-black text-[#17191F] shadow-lg">
              {promotion}
            </span>
          </div>
        )}

        {isFeatured && (
          <div className="absolute right-3 top-3 z-10">
            <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#343840] shadow-lg backdrop-blur-sm">
              ⭐ Destacado
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleFav}
          disabled={favLoading}
          className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#4A5059] shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-white"
          aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <Heart className={`h-4 w-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        {!isOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#4D535C] shadow-lg">Cerrado</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-14 z-10 flex flex-wrap items-center gap-2">
          {distance && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              <MapPin className="h-3 w-3" /> {distance}
            </span>
          )}
          {deliveryTime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              <Clock className="h-3 w-3" /> {deliveryTime}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E5E8ED] bg-white shadow-sm">
            {logo ? (
              <Image src={logo} alt={`${name} logo`} fill sizes="48px" className="object-contain p-1" loading="lazy" />
            ) : (
              <span className="text-lg font-black text-[#A17D00]">{name.charAt(0)}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-[#1E2127]">{name}</h3>
                {category && <p className="truncate text-xs font-semibold text-[#737B87]">{category}</p>}
              </div>
              {rating > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFF4C2] px-2.5 py-1 text-xs font-black text-[#655100]">
                  <Star className="h-3 w-3 fill-[#FFB800] text-[#FFB800]" /> {rating.toFixed(1)}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[#626A75]">
              {reviewCount !== undefined && reviewCount > 0 && <span>{reviewCount}+ pedidos</span>}
              <span className="inline-flex items-center gap-1">
                <Bike className="h-3.5 w-3.5" /> {safeDeliveryFee(deliveryFee)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
