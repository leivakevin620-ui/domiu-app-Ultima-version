'use client';

import React, { type ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { MapsProvider } from '@/contexts/MapsContext';
import { OrderProvider } from '@/contexts/OrderContext';

interface RootProvidersProps {
  children: ReactNode;
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <OrderProvider>
          <MapsProvider>{children}</MapsProvider>
        </OrderProvider>
      </CartProvider>
    </AuthProvider>
  );
}
