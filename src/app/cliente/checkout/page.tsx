'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock3, LocateFixed, MapPin, Route } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, type CartCustomization } from '@/contexts/CartContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { addressService, type DeliveryAddress } from '@/services/addresses';
import { getCurrentExactLocation } from '@/lib/maps/geolocation';
import { createCustomerOrderAction } from '@/app/actions/customer-orders';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function customizationSummary(customization?: CartCustomization) {
  if (!customization) return [];
  const rows: string[] = [];
  if (customization.style) rows.push(`Estilo: ${customization.style}`);
  if (customization.sauces?.length) rows.push(`Salsas: ${customization.sauces.join(', ')}`);
  if (customization.saucePresentation) {
    rows.push(`Presentación: ${customization.saucePresentation === 'aparte' ? 'salsas aparte' : 'alitas bañadas en salsa'}`);
  }
  if (customization.extras?.length) {
    rows.push(`Adicionales: ${customization.extras.filter((extra) => extra.quantity > 0).map((extra) => `${extra.quantity}x ${extra.name}`).join(', ')}`);
  }
  if (customization.preparationNote?.trim()) rows.push(`Nota: ${customization.preparationNote.trim()}`);
  return rows;
}

type DeliveryQuote = {
  distance_km: number;
  duration_minutes: number;
  delivery_fee: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, businessId, businessName, subtotal, isEmpty, clearCart } = useCart();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [locating, setLocating] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState('');
  const [instructions, setInstructions] = useState('');

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const loadAddresses = useCallback(async (preferredId?: string) => {
    if (!profile?.id) return;
    setLoadingAddresses(true);
    try {
      const rows = await addressService.list(profile.id);
      setAddresses(rows);
      const preferred = preferredId
        ? rows.find((row) => row.id === preferredId)
        : rows.find((row) => row.is_primary) ?? rows[0];
      setSelectedAddressId(preferred?.id ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar tus direcciones');
    } finally {
      setLoadingAddresses(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    if (!businessId || !selectedAddressId) {
      setQuote(null);
      return;
    }

    let active = true;
    const calculate = async () => {
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const supabase = getBrowserClient();
        const { data, error: rpcError } = await supabase
          .rpc('calculate_delivery_quote', {
            p_business_id: businessId,
            p_address_id: selectedAddressId,
          })
          .single();
        if (!active) return;
        if (rpcError || !data) {
          setQuote(null);
          setQuoteError(rpcError?.message || 'No se pudo calcular el domicilio');
          return;
        }
        const row = data as Record<string, unknown>;
        setQuote({
          distance_km: Number(row.distance_km),
          duration_minutes: Number(row.duration_minutes),
          delivery_fee: Number(row.delivery_fee),
        });
      } finally {
        if (active) setQuoteLoading(false);
      }
    };
    void calculate();
    return () => {
      active = false;
    };
  }, [businessId, selectedAddressId]);

  const useCurrentLocation = async () => {
    if (!profile?.id || locating) return;
    setLocating(true);
    setError('');
    try {
      const location = await getCurrentExactLocation();
      const saved = await addressService.save(
        profile.id,
        {
          type: selectedAddress?.type || 'home',
          label: selectedAddress?.label || 'Ubicación actual',
          streetAddress: location.formattedAddress,
          city: location.city,
          state: location.state,
          postalCode: location.postalCode,
          country: location.country,
          latitude: location.lat,
          longitude: location.lng,
          accuracy: location.accuracy,
          isPrimary: true,
          instructions: selectedAddress?.instructions || '',
        },
        selectedAddress?.id,
      );
      await loadAddresses(saved.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la ubicación');
    } finally {
      setLocating(false);
    }
  };

  const deliveryFee = quote?.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return setError('Debes iniciar sesión para confirmar el pedido.');
    if (!businessId || !businessName || items.length === 0) return setError('El carrito no contiene un pedido válido.');
    if (!selectedAddressId || !selectedAddress) return setError('Selecciona una dirección de entrega.');
    if (!quote) return setError(quoteError || 'Espera mientras calculamos el domicilio.');

    setPlacing(true);
    setError('');
    try {
      const result = await createCustomerOrderAction({
        businessId,
        deliveryAddressId: selectedAddressId,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          customization: item.customization as Record<string, unknown> | undefined,
          specialInstructions: item.customization?.preparationNote,
        })),
        subtotal,
        taxAmount: 0,
        instructions: instructions.trim(),
      });
      if (!result.success) throw new Error(result.error);
      setPlaced(true);
      clearCart();
      window.setTimeout(() => router.push(`/cliente/pedidos/${result.orderId}`), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el pedido.');
      setPlacing(false);
    }
  };

  if (isEmpty && !placed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-12">
        <section className="w-full rounded-3xl border border-dashed bg-card p-10 text-center">
          <h1 className="text-xl font-bold">Tu carrito está vacío</h1>
          <Link href="/cliente" className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Explorar negocios</Link>
        </section>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="max-w-md rounded-3xl border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">✓</div>
          <h1 className="text-2xl font-bold">¡Pedido confirmado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Abriendo el seguimiento en vivo.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-5">
        <form onSubmit={submit} className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="font-bold">Dirección de entrega</h2><p className="mt-1 text-xs text-muted-foreground">La ubicación exacta mejora la tarifa; sin ella se aplicará el domicilio mínimo.</p></div>
              <Link href="/cliente/direcciones" className="text-xs font-semibold text-primary">Administrar</Link>
            </div>
            {loadingAddresses ? <p className="text-sm text-muted-foreground">Cargando direcciones…</p> : addresses.length > 0 ? (
              <div className="space-y-2">
                {addresses.map((address) => (
                  <label key={address.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${selectedAddressId === address.id ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="radio" name="address" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 text-sm"><strong className="block">{address.label || 'Dirección'}</strong><span className="block text-xs text-muted-foreground">{address.street_address}</span><span className={`mt-1 block text-[11px] font-medium ${address.latitude != null ? 'text-success' : 'text-warning'}`}>{address.latitude != null ? 'Ubicación exacta guardada' : 'Sin coordenadas: se aplicará domicilio mínimo'}</span></span>
                  </label>
                ))}
              </div>
            ) : <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning">No tienes una dirección guardada.</p>}
            <button type="button" onClick={() => void useCurrentLocation()} disabled={locating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary disabled:opacity-50"><LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />{locating ? 'Obteniendo ubicación…' : selectedAddress ? 'Actualizar con mi ubicación actual' : 'Usar mi ubicación actual'}</button>
          </section>

          <section className="rounded-2xl border bg-card p-5"><h2 className="mb-3 font-bold">Instrucciones de entrega</h2><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Ejemplo: llamar al llegar o entregar en portería." rows={4} className="w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm outline-none" /></section>
          {quoteLoading && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Calculando distancia y tarifa…</p>}
          {quoteError && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{quoteError}</p>}
          {selectedAddress && selectedAddress.latitude == null && quote && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Pedido habilitado con domicilio mínimo de {formatCurrency(quote.delivery_fee)}. Puedes confirmar ahora o actualizar la ubicación para calcular la distancia exacta.</p>}
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={placing || quoteLoading || !quote} className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-60">{placing ? 'Creando pedido…' : `Confirmar pedido — ${formatCurrency(total)}`}</button>
        </form>

        <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-20 lg:col-span-2">
          <h2 className="font-bold">Resumen del pedido</h2><p className="mb-4 text-sm text-muted-foreground">{businessName}</p>
          <div className="space-y-4">{items.map((item) => <article key={item.id} className="border-b pb-4 last:border-0"><div className="flex justify-between gap-3"><span className="font-medium">{item.quantity}x {item.product.name}</span><span className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span></div>{customizationSummary(item.customization).map((row) => <p key={row} className="mt-1 text-xs text-muted-foreground">{row}</p>)}</article>)}</div>
          <div className="mt-4 space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Productos</span><span>{formatCurrency(subtotal)}</span></div><div className="flex justify-between font-semibold"><span>Domicilio</span><span>{quote ? formatCurrency(deliveryFee) : 'Por calcular'}</span></div></div>
          {quote && <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-xs"><div className="flex items-center gap-2"><Route className="h-4 w-4 text-primary" />{selectedAddress?.latitude == null ? 'Tarifa mínima' : `${quote.distance_km.toFixed(2)} km`}</div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />aprox. {quote.duration_minutes} min</div></div>}
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
        </aside>
      </div>
    </main>
  );
}
