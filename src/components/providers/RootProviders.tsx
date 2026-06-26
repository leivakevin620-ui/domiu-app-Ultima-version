'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { MapsProvider } from '@/contexts/MapsContext';

interface RootProvidersProps {
  children: ReactNode;
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <MapsProvider>
          {children}
        </MapsProvider>
      </CartProvider>
    </AuthProvider>
  );
}
