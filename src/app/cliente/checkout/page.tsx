'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  Info,
  Landmark,
  MapPin,
  Paperclip,
  Route,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, type CartCustomization } from '@/contexts/CartContext';
import { getBrowserClient } from '@/lib/db/supabase';
import { formatCop } from '@/lib/money/cop';
import { addressService, type DeliveryAddress } from '@/services/addresses';
import {
  attachTransferProofAction,
  createCustomerOrderAction,
  quoteCustomerDeliveryAction,
} from '@/app/actions/customer-orders';

function customizationSummary(customization?: CartCustomization) {
  if (!customization) return [];
  const rows: string[] = [];
  if (customization.style) rows.push(`Estilo: ${customization.style}`);
  if (customization.sauces?.length) rows.push(`Salsas: ${customization.sauces.join(', ')}`);
  if (customization.saucePresentation) {
    rows.push(
      `Presentación: ${
        customization.saucePresentation === 'aparte' ? 'salsas aparte' : 'alitas bañadas en salsa'
      }`,
    );
  }
  if (customization.extras?.length) {
    const extras = customization.extras
      .filter((extra) => extra.quantity > 0)
      .map((extra) => `${extra.quantity}x ${extra.name}`)
      .join(', ');
    if (extras) rows.push(`Adicionales: ${extras}`);
  }
  if (customization.preparationNote?.trim()) {
    rows.push(`Nota: ${customization.preparationNote.trim()}`);
  }
  return rows;
}

type DeliveryQuote = {
  distanceKm: number;
  durationMinutes: number;
  deliveryFee: number;
  serviceFee: number;
  customerTotal: number;
  routeSource: string;
  pickupAddress: string;
};

type BusinessLocation = {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
};

type PaymentMethod = 'cash' | 'transfer';

type BusinessPaymentMethod = {
  method: PaymentMethod;
  displayName: string;
  provider: string | null;
  accountHolder: string | null;
  accountIdentifier: string | null;
  instructions: string | null;
};

const PAYMENT_PRESENTATION: Record<
  PaymentMethod,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  cash: {
    title: 'Efectivo contra entrega',
    description: 'Paga al repartidor cuando recibas el pedido.',
    icon: Banknote,
  },
  transfer: {
    title: 'Transferencia',
    description: 'Adjunta referencia y comprobante para que el negocio valide el pago.',
    icon: Landmark,
  },
};

function safeFileName(name: string) {
  const parts = name.split('.');
  const extension = parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
  const base = parts
    .join('.')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'comprobante'}${extension}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, businessId, businessName, subtotal, isEmpty, clearCart } = useCart();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<BusinessPaymentMethod[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
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
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );
  const selectedPaymentConfig = useMemo(
    () => paymentMethods.find((method) => method.method === paymentMethod) ?? null,
    [paymentMethod, paymentMethods],
  );

  const loadAddresses = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingAddresses(true);
    try {
      const rows = await addressService.list(profile.id);
      setAddresses(rows);
      const preferred = rows.find((row) => row.is_primary) ?? rows[0];
      setSelectedAddressId(preferred?.id ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar tus direcciones');
    } finally {
      setLoadingAddresses(false);
    }
  }, [profile?.id]);

  const loadBusinessConfiguration = useCallback(async () => {
    if (!businessId) return;
    setLoadingLocations(true);
    setLoadingPayments(true);
    try {
      const supabase = getBrowserClient();
      const [businessResult, locationResult, paymentResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('is_active,is_verified,is_open,metadata')
          .eq('id', businessId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('business_addresses')
          .select(
            'id,name,street_address,formatted_address,city,state_province,latitude,longitude,is_primary',
          )
          .eq('business_id', businessId)
          .eq('is_active', true)
          .eq('delivery_available', true)
          .is('deleted_at', null)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('business_payment_methods')
          .select('method,display_name,provider,account_holder,account_identifier,instructions')
          .eq('business_id', businessId)
          .eq('is_enabled', true)
          .in('method', ['cash', 'transfer']),
      ]);

      if (businessResult.error) throw new Error(businessResult.error.message);
      if (locationResult.error) throw new Error(locationResult.error.message);
      if (paymentResult.error) throw new Error(paymentResult.error.message);
      const business = businessResult.data;
      if (!business?.is_active || !business.is_verified) {
        throw new Error('Este negocio no está habilitado para recibir pedidos.');
      }
      if (!business.is_open) {
        throw new Error('Este negocio está cerrado en este momento.');
      }

      const normalizedLocations = (locationResult.data ?? [])
        .filter((row) => row.latitude != null && row.longitude != null)
        .map((row) => ({
          id: String(row.id),
          name: String(row.name || (row.is_primary ? 'Local principal' : 'Sucursal')),
          formattedAddress:
            String(row.formatted_address || '').trim() ||
            [row.street_address, row.city, row.state_province].filter(Boolean).join(', '),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          isPrimary: Boolean(row.is_primary),
        }));
      setLocations(normalizedLocations);
      setSelectedLocationId((current) =>
        normalizedLocations.some((row) => row.id === current)
          ? current
          : normalizedLocations.find((row) => row.isPrimary)?.id ?? normalizedLocations[0]?.id ?? '',
      );

      const normalizedPayments = (paymentResult.data ?? [])
        .filter((row) => row.method === 'cash' || row.method === 'transfer')
        .filter(
          (row) =>
            row.method === 'cash' ||
            Boolean(row.provider && row.account_holder && row.account_identifier),
        )
        .map((row) => ({
          method: row.method as PaymentMethod,
          displayName: String(
            row.display_name || PAYMENT_PRESENTATION[row.method as PaymentMethod].title,
          ),
          provider: row.provider ? String(row.provider) : null,
          accountHolder: row.account_holder ? String(row.account_holder) : null,
          accountIdentifier: row.account_identifier ? String(row.account_identifier) : null,
          instructions: row.instructions ? String(row.instructions) : null,
        }));
      setPaymentMethods(normalizedPayments);
      setPaymentMethod((current) =>
        normalizedPayments.some((method) => method.method === current)
          ? current
          : normalizedPayments.length === 1
            ? normalizedPayments[0].method
            : '',
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo cargar la configuración del negocio',
      );
    } finally {
      setLoadingLocations(false);
      setLoadingPayments(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    void loadBusinessConfiguration();
  }, [loadBusinessConfiguration]);

  useEffect(() => {
    setPaymentReference('');
    setPaymentProof(null);
  }, [paymentMethod]);

  useEffect(() => {
    if (!businessId || !selectedLocationId || !selectedAddressId) {
      setQuote(null);
      return;
    }
    if (selectedAddress?.latitude == null || selectedAddress.longitude == null) {
      setQuote(null);
      setQuoteError(
        'La dirección seleccionada no tiene coordenadas exactas. Corrígela antes de confirmar.',
      );
      return;
    }

    let active = true;
    const calculate = async () => {
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const result = await quoteCustomerDeliveryAction({
          businessId,
          businessAddressId: selectedLocationId,
          deliveryAddressId: selectedAddressId,
          subtotal,
        });
        if (!active) return;
        if (!result.success) {
          setQuote(null);
          setQuoteError(result.error);
          return;
        }
        setQuote({
          distanceKm: result.distanceKm,
          durationMinutes: result.durationMinutes,
          deliveryFee: result.deliveryFee,
          serviceFee: result.serviceFee,
          customerTotal: result.customerTotal,
          routeSource: result.routeSource,
          pickupAddress: result.pickupAddress,
        });
      } catch (cause) {
        if (!active) return;
        setQuote(null);
        setQuoteError(cause instanceof Error ? cause.message : 'No se pudo calcular el domicilio');
      } finally {
        if (active) setQuoteLoading(false);
      }
    };
    void calculate();
    return () => {
      active = false;
    };
  }, [businessId, selectedAddress?.latitude, selectedAddress?.longitude, selectedAddressId, selectedLocationId, subtotal]);

  const deliveryFee = quote?.deliveryFee ?? 0;
  const serviceFee = quote?.serviceFee ?? 0;
  const total = quote?.customerTotal ?? subtotal + deliveryFee + serviceFee;

  const validateProofFile = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) throw new Error('El comprobante debe ser JPG, PNG, WEBP o PDF');
    if (file.size > 5 * 1024 * 1024) throw new Error('El comprobante no puede superar 5 MB');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return setError('Debes iniciar sesión para confirmar el pedido.');
    if (!businessId || !businessName || items.length === 0) {
      return setError('El carrito no contiene un pedido válido.');
    }
    if (!selectedLocationId || !selectedLocation) return setError('Selecciona el local de origen.');
    if (!selectedAddressId || !selectedAddress) return setError('Selecciona una dirección de entrega.');
    if (selectedAddress.latitude == null || selectedAddress.longitude == null) {
      return setError('La dirección elegida no tiene coordenadas exactas.');
    }
    if (!paymentMethod || !selectedPaymentConfig) return setError('Selecciona cómo vas a pagar.');
    if (paymentMethod === 'transfer') {
      if (!paymentReference.trim()) return setError('Escribe la referencia de la transferencia.');
      if (!paymentProof) return setError('Adjunta el comprobante de la transferencia.');
      try {
        validateProofFile(paymentProof);
      } catch (cause) {
        return setError(cause instanceof Error ? cause.message : 'El comprobante no es válido');
      }
    }
    if (!quote) return setError(quoteError || 'Espera mientras calculamos el total exacto.');

    setPlacing(true);
    setError('');
    try {
      const result = await createCustomerOrderAction({
        businessId,
        businessAddressId: selectedLocationId,
        deliveryAddressId: selectedAddressId,
        paymentMethod,
        paymentReference: paymentMethod === 'transfer' ? paymentReference.trim() : undefined,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice),
          customization: item.customization as Record<string, unknown> | undefined,
          specialInstructions: item.customization?.preparationNote,
        })),
        subtotal: Math.round(subtotal),
        taxAmount: 0,
        discountAmount: 0,
        instructions: instructions.trim(),
      });
      if (!result.success) throw new Error(result.error);

      if (paymentMethod === 'transfer' && paymentProof) {
        const supabase = getBrowserClient();
        const path = `${profile.id}/${result.orderId}/${crypto.randomUUID()}-${safeFileName(
          paymentProof.name,
        )}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(path, paymentProof, {
            upsert: false,
            contentType: paymentProof.type,
          });
        if (uploadError) {
          throw new Error(`El pedido fue creado, pero el comprobante no se pudo subir: ${uploadError.message}`);
        }
        const attached = await attachTransferProofAction({
          orderId: result.orderId,
          proofPath: path,
        });
        if (!attached.success) {
          throw new Error(`El pedido fue creado, pero el comprobante no se pudo asociar: ${attached.error}`);
        }
      }

      setPlaced(true);
      clearCart();
      window.setTimeout(() => router.push(`/cliente/pedidos/${result.orderId}`), 900);
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
          <Link
            href="/cliente"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Explorar negocios
          </Link>
        </section>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="max-w-md rounded-3xl border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">¡Pedido confirmado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Abriendo el seguimiento en vivo.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-5">
        <form onSubmit={submit} className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Dirección de entrega</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada pedido debe salir con coordenadas exactas verificadas.
                </p>
              </div>
              <Link href="/cliente/configuracion/direcciones" className="text-xs font-semibold text-primary">
                Administrar
              </Link>
            </div>
            {loadingAddresses ? (
              <p className="text-sm text-muted-foreground">Cargando direcciones…</p>
            ) : addresses.length > 0 ? (
              <div className="space-y-2">
                {addresses.map((address) => {
                  const exact = address.latitude != null && address.longitude != null;
                  return (
                    <label
                      key={address.id}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                        selectedAddressId === address.id ? 'border-primary bg-primary/5' : ''
                      } ${!exact ? 'opacity-70' : ''}`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === address.id}
                        onChange={() => setSelectedAddressId(address.id)}
                      />
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 text-sm">
                        <strong className="block">{address.label || 'Dirección'}</strong>
                        <span className="block text-xs text-muted-foreground">
                          {address.formatted_address || address.street_address}
                        </span>
                        <span
                          className={`mt-1 block text-[11px] font-medium ${
                            exact ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          {exact ? 'Ubicación exacta guardada' : 'Debes confirmar el punto en el mapa'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning">
                No tienes una dirección guardada. Agrégala antes de continuar.
              </p>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4">
              <h2 className="font-bold">Local de origen</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                La ruta y la tarifa parten del establecimiento seleccionado.
              </p>
            </div>
            {loadingLocations ? (
              <p className="text-sm text-muted-foreground">Buscando locales abiertos…</p>
            ) : locations.length > 0 ? (
              <div className="space-y-2">
                {locations.map((location) => (
                  <label
                    key={location.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                      selectedLocationId === location.id ? 'border-orange-500 bg-orange-50/60' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="business-location"
                      checked={selectedLocationId === location.id}
                      onChange={() => setSelectedLocationId(location.id)}
                    />
                    <Store className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <span className="min-w-0 text-sm">
                      <strong className="block">
                        {location.name}
                        {location.isPrimary ? ' · principal' : ''}
                      </strong>
                      <span className="block text-xs text-muted-foreground">
                        {location.formattedAddress}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                Este negocio no tiene un local abierto con coordenadas exactas.
              </p>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-bold">Método de pago</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo aparecen los métodos configurados por el negocio.
            </p>
            {loadingPayments ? (
              <p className="mt-4 text-sm text-muted-foreground">Cargando métodos…</p>
            ) : paymentMethods.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((option) => {
                  const presentation = PAYMENT_PRESENTATION[option.method];
                  const Icon = presentation.icon;
                  const selected = paymentMethod === option.method;
                  return (
                    <button
                      key={option.method}
                      type="button"
                      onClick={() => setPaymentMethod(option.method)}
                      className={`relative flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <span
                        className={`rounded-xl p-2 ${
                          selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <strong className="block text-sm">{option.displayName}</strong>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {presentation.description}
                        </span>
                      </span>
                      {selected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                El negocio no tiene métodos de pago activos.
              </p>
            )}

            {paymentMethod === 'transfer' && selectedPaymentConfig && (
              <div className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Enviar a</p>
                  <p className="mt-1 font-black">{selectedPaymentConfig.provider}</p>
                  <p className="text-sm">Titular: {selectedPaymentConfig.accountHolder}</p>
                  <p className="text-sm">
                    Identificador: <strong>{selectedPaymentConfig.accountIdentifier}</strong>
                  </p>
                  {selectedPaymentConfig.instructions && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedPaymentConfig.instructions}
                    </p>
                  )}
                </div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Referencia de la transferencia
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Número o referencia del movimiento"
                    className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
                  />
                </label>
                <label className="block cursor-pointer rounded-xl border border-dashed bg-background p-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-muted p-2">
                      <Paperclip className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">Adjuntar comprobante</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {paymentProof ? paymentProof.name : 'JPG, PNG, WEBP o PDF · máximo 5 MB'}
                      </p>
                    </div>
                    {paymentProof && <FileCheck2 className="ml-auto h-5 w-5 text-success" />}
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (!file) return setPaymentProof(null);
                      try {
                        validateProofFile(file);
                        setPaymentProof(file);
                        setError('');
                      } catch (cause) {
                        setPaymentProof(null);
                        setError(cause instanceof Error ? cause.message : 'Archivo no válido');
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed bg-muted/30 p-4 opacity-70">
              <CreditCard className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold">Pago electrónico</p>
                <p className="text-xs text-muted-foreground">
                  Se activará cuando exista una pasarela real y un webhook verificado.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 font-bold">Instrucciones de entrega</h2>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Ejemplo: llamar al llegar o entregar en portería."
              rows={4}
              className="w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm outline-none"
            />
          </section>

          {quoteLoading && (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              Calculando ruta, domicilio y total final…
            </p>
          )}
          {quoteError && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              {quoteError}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={placing || quoteLoading || !quote || !paymentMethod || !selectedLocationId}
            className="w-full rounded-2xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-60"
          >
            {placing
              ? paymentMethod === 'transfer'
                ? 'Creando pedido y subiendo comprobante…'
                : 'Creando pedido…'
              : `Confirmar pedido — ${formatCop(total)}`}
          </button>
        </form>

        <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-20 lg:col-span-2">
          <h2 className="font-bold">Resumen del pedido</h2>
          <p className="mb-4 text-sm text-muted-foreground">{businessName}</p>
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-semibold">{formatCop(item.unitPrice * item.quantity)}</span>
                </div>
                {customizationSummary(item.customization).map((row) => (
                  <p key={row} className="mt-1 text-xs text-muted-foreground">
                    {row}
                  </p>
                ))}
              </article>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>Productos</span>
              <span>{formatCop(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Domicilio</span>
              <span>{quote ? formatCop(deliveryFee) : 'Por calcular'}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5">
                Tarifa de servicio DomiU
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span>{quote ? formatCop(serviceFee) : 'Por calcular'}</span>
            </div>
            <p className="rounded-xl bg-muted/50 p-3 text-[11px] leading-5 text-muted-foreground">
              Esta tarifa permite operar la plataforma, soporte y seguimiento. Está incluida de forma
              visible en el total antes de confirmar.
            </p>
            <div className="flex justify-between">
              <span>Pago</span>
              <span>
                {paymentMethod === 'cash'
                  ? 'Efectivo'
                  : paymentMethod === 'transfer'
                    ? 'Transferencia'
                    : 'Sin seleccionar'}
              </span>
            </div>
          </div>

          {quote && (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                {quote.distanceKm.toFixed(2)} km
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                aprox. {quote.durationMinutes} min
              </div>
              <p className="col-span-2 text-[10px] text-muted-foreground">
                Ruta:{' '}
                {quote.routeSource === 'google_routes'
                  ? 'Google Routes'
                  : quote.routeSource === 'osrm'
                    ? 'ruta vial de respaldo'
                    : 'distancia geográfica de respaldo'}
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{formatCop(total)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
