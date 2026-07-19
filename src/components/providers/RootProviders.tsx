'use client';

import React, { type ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { MapsProvider } from '@/contexts/MapsContext';
import { OrderProvider } from '@/contexts/OrderContext';
import { DomiAssistant } from '@/components/domi/DomiAssistant';

interface RootProvidersProps {
  children: ReactNode;
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <OrderProvider>
          <MapsProvider>
            <style>{`
              .leaflet-container {
                position: relative !important;
                z-index: 0 !important;
                isolation: isolate !important;
                contain: paint;
              }

              .leaflet-container .leaflet-pane,
              .leaflet-container .leaflet-top,
              .leaflet-container .leaflet-bottom,
              .leaflet-container .leaflet-control {
                max-width: 100%;
              }
            `}</style>
            {children}
            <DomiAssistant />
          </MapsProvider>
        </OrderProvider>
      </CartProvider>
    </AuthProvider>
  );
}
