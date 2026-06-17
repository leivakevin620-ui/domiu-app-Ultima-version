'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { Package, Plus } from 'lucide-react';

export default function NegocioProductos() {
  return (
    <PageContainer>
      <PageTitle
        title="Productos"
        description="Gestiona tu catálogo de productos"
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </button>
      </PageTitle>
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="No hay productos aún"
        description="Agrega tu primer producto para comenzar a vender."
      />
    </PageContainer>
  );
}
