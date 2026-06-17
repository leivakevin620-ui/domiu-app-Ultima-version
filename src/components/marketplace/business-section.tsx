'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BusinessCard } from '@/components/delivery/business-card';
import type { MarketplaceBusiness } from '@/services/marketplace';

interface BusinessSectionProps {
  title: string;
  businesses: MarketplaceBusiness[];
  viewAllHref?: string;
}

export function BusinessSection({ title, businesses, viewAllHref }: BusinessSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todo
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {businesses.map((biz) => (
          <Link key={biz.id} href={`/cliente/business/${biz.slug}`}>
            <BusinessCard
              name={biz.name}
              category={biz.category_name}
              rating={biz.rating}
              deliveryTime={biz.delivery_time}
              deliveryFee={biz.delivery_fee}
              isOpen={biz.is_open}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
