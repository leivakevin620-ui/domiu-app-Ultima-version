'use client';

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useMaps } from '@/contexts/MapsContext';
import { AlertTriangle, Loader2, Search } from 'lucide-react';

interface PlaceResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

interface PlacesAutocompleteProps {
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

function PlacesAutocompleteInner({ onPlaceSelected, placeholder = 'Buscar dirección...', defaultValue = '', className = '' }: PlacesAutocompleteProps) {
  const { isReady, error } = useMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!isReady || !inputRef.current || autocompleteRef.current || !window.google?.maps?.places) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'co' },
      fields: ['address_components', 'formatted_address', 'geometry'],
    });

    listenerRef.current = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.geometry?.location) return;

      const result: PlaceResult = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        formattedAddress: place.formatted_address || inputRef.current?.value || '',
      };

      for (const comp of place.address_components || []) {
        if (comp.types.includes('locality')) result.city = comp.long_name;
        if (!result.city && comp.types.includes('administrative_area_level_2')) result.city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) result.state = comp.long_name;
        if (comp.types.includes('country')) result.country = comp.long_name;
        if (comp.types.includes('postal_code')) result.postalCode = comp.long_name;
      }

      setValue(result.formattedAddress);
      onPlaceSelected(result);
    });

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
      autocompleteRef.current = null;
    };
  }, [isReady, onPlaceSelected]);

  const handleManualGeocode = useCallback(async () => {
    if (!value.trim() || !isReady || !window.google?.maps) return;
    setLoading(true);
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ address: value, region: 'co' });
      const first = response.results?.[0];
      if (!first) return;

      const result: PlaceResult = {
        lat: first.geometry.location.lat(),
        lng: first.geometry.location.lng(),
        formattedAddress: first.formatted_address,
      };
      for (const comp of first.address_components || []) {
        if (comp.types.includes('locality')) result.city = comp.long_name;
        if (!result.city && comp.types.includes('administrative_area_level_2')) result.city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) result.state = comp.long_name;
        if (comp.types.includes('country')) result.country = comp.long_name;
        if (comp.types.includes('postal_code')) result.postalCode = comp.long_name;
      }
      setValue(result.formattedAddress);
      onPlaceSelected(result);
    } finally {
      setLoading(false);
    }
  }, [value, isReady, onPlaceSelected]);

  if (!isReady) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          {error ? <AlertTriangle className="h-4 w-4 text-warning" /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">
            {error || 'Cargando Google Places…'}
          </span>
        </div>
        {error && (
          <p className="text-xs text-muted-foreground">
            Puedes continuar usando el botón de ubicación GPS mientras se revisa Google Maps.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void handleManualGeocode();
          }
        }}
        className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
    </div>
  );
}

export const PlacesAutocomplete = memo(PlacesAutocompleteInner);
