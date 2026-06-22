'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { loadGoogleMaps, hasApiKey, isMapsLoaded } from '@/lib/maps/loader';

interface MapsContextValue {
  isReady: boolean;
  hasKey: boolean;
  error: string | null;
  maps: typeof google.maps | null;
}

const MapsContext = createContext<MapsContextValue>({
  isReady: false,
  hasKey: false,
  error: null,
  maps: null,
});

export function MapsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MapsContextValue>({
    isReady: false,
    hasKey: hasApiKey(),
    error: null,
    maps: null,
  });

  useEffect(() => {
    if (!hasApiKey()) {
      setTimeout(() => setState(prev => ({ ...prev, error: 'API key de Google Maps no configurada', isReady: false })));
      return;
    }

    if (isMapsLoaded() && window.google?.maps) {
      setTimeout(() => setState(prev => ({ ...prev, isReady: true, maps: window.google.maps })));
      return;
    }

    loadGoogleMaps()
      .then(() => {
        setState(prev => ({ ...prev, isReady: true, maps: window.google?.maps ?? null, error: null }));
      })
      .catch(err => {
        setState(prev => ({ ...prev, error: err.message, isReady: false }));
      });
  }, []);

  return <MapsContext.Provider value={state}>{children}</MapsContext.Provider>;
}

export function useMaps(): MapsContextValue {
  return useContext(MapsContext);
}
