'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { Heart } from 'lucide-react';

export default function ClienteFavoritos() {
  return (
    <PageContainer>
      <PageTitle title="Mis Favoritos" description="Restaurantes y productos guardados" />
      <EmptyState
        icon={<Heart className="h-6 w-6" />}
        title="Sin favoritos aún"
        description="Guarda tus restaurantes y productos favoritos para encontrarlos rápidamente."
      />
    </PageContainer>
  );
}
