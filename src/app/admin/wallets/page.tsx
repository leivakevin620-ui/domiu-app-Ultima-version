'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { EmptyState } from '@/components/ui/empty-state';
import { Wallet } from 'lucide-react';

export default function AdminWallets() {
  return (
    <PageContainer>
      <PageTitle title="Wallets" description="Gestiona las billeteras digitales" />
      <EmptyState
        icon={<Wallet className="h-6 w-6" />}
        title="Gestión de Wallets"
        description="Aquí podrás ver y administrar todas las billeteras digitales del sistema."
      />
    </PageContainer>
  );
}
