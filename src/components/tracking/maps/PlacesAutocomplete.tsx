'use client';

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { useMaps } from '@/contexts/MapsContext';
import { Search, Loader2 } from 'lucide-react';

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
  const { isReady } = useMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'co' },
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.geometry?.location) return;

      const result: PlaceResult = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        formattedAddress: place.formatted_address || inputRef.current?.value || '',
      };

      for (const comp of place.address_components || []) {
        if (comp.types.includes('locality')) result.city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) result.state = comp.long_name;
        if (comp.types.includes('country')) result.country = comp.long_name;
        if (comp.types.includes('postal_code')) result.postalCode = comp.long_name;
      }

      if (inputRef.current) inputRef.current.value = result.formattedAddress;
      setValue(result.formattedAddress);
      onPlaceSelected(result);
    });
  }, [isReady, onPlaceSelected]);

  const handleManualGeocode = useCallback(async () => {
    if (!value.trim() || !isReady) return;
    setLoading(true);
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: value }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          const result: PlaceResult = {
            lat: loc.lat(),
            lng: loc.lng(),
            formattedAddress: results[0].formatted_address,
          };
          for (const comp of results[0].address_components || []) {
            if (comp.types.includes('locality')) result.city = comp.long_name;
            if (comp.types.includes('administrative_area_level_1')) result.state = comp.long_name;
            if (comp.types.includes('country')) result.country = comp.long_name;
            if (comp.types.includes('postal_code')) result.postalCode = comp.long_name;
          }
          onPlaceSelected(result);
        }
        setLoading(false);
      });
    } catch {
      setLoading(false);
    }
  }, [value, isReady, onPlaceSelected]);

  if (!isReady) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando Google Places...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && handleManualGeocode()}
        className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export const PlacesAutocomplete = memo(PlacesAutocompleteInner);
