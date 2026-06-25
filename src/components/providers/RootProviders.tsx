'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { CourierProvider } from '@/contexts/CourierContext';
import { MapsProvider } from '@/contexts/MapsContext';

interface RootProvidersProps {
  children: ReactNode;
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <CourierProvider>
          <MapsProvider>
            {children}
          </MapsProvider>
        </CourierProvider>
      </CartProvider>
    </AuthProvider>
  );
}
