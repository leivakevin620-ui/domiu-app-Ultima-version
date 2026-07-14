'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CheckCircle2, Loader2, MapPin, PackageCheck, Store, Truck } from 'lucide-react';
import {
  createBusinessManualOrderAction,
  getCurrentBusinessForManualOrder,
  type CurrentBusinessForManualOrder,
} from '@/app/actions/business-manual-orders';
import { calculateRouteDistance } from '@/lib/maps/distance';
import { calculateDeliveryPrice } from '@/lib/orders/delivery-pricing';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60';
const labelClass = 'text-sm font-medium text-foreground';

export default function CrearDomicilioNegocioPage() {
  const [business, setBusiness] = useState<CurrentBusinessForManualOrder | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [addressNotes, setAddressNotes] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit_card' | 'debit_card' | 'wallet'>('cash');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [destinationLat, setDestinationLat] = useState<number | undefined>();
  const [destinationLng, setDestinationLng] = useState<number | undefined>();
  const [calculationSource, setCalculationSource] = useState<'google_maps' | 'manual' | 'fallback'>('manual');

  useEffect(() => {
    let active = true;
    void getCurrentBusinessForManualOrder()
      .then((result) => {
        if (active) setBusiness(result);
      })
      .finally(() => {
        if (active) setLoadingBusiness(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const formattedFee = useMemo(() => {
    const value = Number(deliveryFee);
    return Number.isFinite(value) && value > 0
      ? value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
      : '$0';
  }, [deliveryFee]);

  async function calculateRoute() {
    setError(null);
    if (!business) {
      setError('No se encontró un negocio activo asociado a tu cuenta.');
      return;
    }
    if (deliveryAddress.trim().length < 5) {
      setError('Escribe primero una dirección de entrega válida.');
      return;
    }

    setCalculating(true);
    try {
      const result = await calculateRouteDistance(
        `${business.address}, ${business.city}`,
        `${deliveryAddress}, ${neighborhood}, ${business.city}`,
        business.latitude ?? undefined,
        business.longitude ?? undefined,
      );

      if (!result.distanceKm || result.distanceKm <= 0) {
        throw new Error('No fue posible calcular una distancia válida. Puedes ingresarla manualmente.');
      }

      const pricing = calculateDeliveryPrice(result.distanceKm);
      setDistanceKm(result.distanceKm.toFixed(2));
      setDurationMinutes(String(Math.max(0, Math.round(result.durationMinutes || 0))));
      setDeliveryFee(String(Math.round(pricing.finalPrice)));
      setDestinationLat(result.destinationLat ?? undefined);
      setDestinationLng(result.destinationLng ?? undefined);
      setCalculationSource(result.calculationSource === 'google_maps' ? 'google_maps' : 'fallback');
    } catch (routeError) {
      setCalculationSource('manual');
      setError(routeError instanceof Error ? routeError.message : 'No se pudo calcular la ruta.');
    } finally {
      setCalculating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatedOrder(null);

    const distance = Number(distanceKm);
    const duration = Number(durationMinutes);
    const fee = Number(deliveryFee);
    if (!Number.isFinite(distance) || distance <= 0) {
      setError('La distancia debe ser mayor a 0 km.');
      return;
    }
    if (!Number.isFinite(duration) || duration < 0) {
      setError('El tiempo estimado no es válido.');
      return;
    }
    if (!Number.isFinite(fee) || fee < 1000) {
      setError('La tarifa debe ser de al menos $1.000.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createBusinessManualOrderAction({
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryLat: destinationLat,
        deliveryLng: destinationLng,
        neighborhood: neighborhood || undefined,
        addressNotes: addressNotes || undefined,
        distanceKm: distance,
        durationMinutes: duration,
        deliveryFee: Math.round(fee),
        paymentMethod,
        specialInstructions: specialInstructions || undefined,
        priceCalculationSource: calculationSource,
      });

      if (!result.success) {
        setError(result.error || 'No se pudo crear el domicilio.');
        return;
      }

      setCreatedOrder(result.orderNumber || 'creado');
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setNeighborhood('');
      setAddressNotes('');
      setDistanceKm('');
      setDurationMinutes('');
      setDeliveryFee('');
      setSpecialInstructions('');
      setDestinationLat(undefined);
      setDestinationLng(undefined);
      setCalculationSource('manual');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingBusiness) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <Store className="mx-auto h-9 w-9 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold">No hay un negocio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta debe tener un negocio activo y una dirección configurada antes de crear domicilios.
        </p>
        <Link href="/negocio/configuracion" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Revisar configuración
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/negocio/domicilios" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a domicilios
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Crear domicilio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registra un envío recibido por WhatsApp, llamada o en el local.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">{business.name}</p>
          <p className="mt-1 flex max-w-xs items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {business.address}, {business.city}
          </p>
        </div>
      </div>

      {createdOrder && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <p className="font-semibold text-foreground">Domicilio creado correctamente</p>
              <p className="text-sm text-muted-foreground">Código: {createdOrder}. Ya está disponible para despacho.</p>
            </div>
          </div>
          <Link href="/negocio/domicilios" className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white">
            Ver domicilios
          </Link>
        </div>
      )}

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Cliente y entrega</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Nombre del cliente
              <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} minLength={3} maxLength={120} required />
            </label>
            <label className={labelClass}>Teléfono
              <input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="3001234567" pattern="3[0-9]{9}" required />
            </label>
            <label className={`${labelClass} md:col-span-2`}>Dirección de entrega
              <input className={inputClass} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Calle, carrera, número y referencia" required />
            </label>
            <label className={labelClass}>Barrio o sector
              <input className={inputClass} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </label>
            <label className={labelClass}>Referencia de la dirección
              <input className={inputClass} value={addressNotes} onChange={(e) => setAddressNotes(e.target.value)} placeholder="Casa azul, frente al parque..." />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Ruta y tarifa</h2>
            </div>
            <button type="button" onClick={calculateRoute} disabled={calculating} className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60">
              {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calcular ruta y tarifa
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className={labelClass}>Distancia (km)
              <input className={inputClass} type="number" min="0.1" max="250" step="0.01" value={distanceKm} onChange={(e) => { setDistanceKm(e.target.value); setCalculationSource('manual'); }} required />
            </label>
            <label className={labelClass}>Tiempo estimado (min)
              <input className={inputClass} type="number" min="0" max="600" step="1" value={durationMinutes} onChange={(e) => { setDurationMinutes(e.target.value); setCalculationSource('manual'); }} required />
            </label>
            <label className={labelClass}>Tarifa del domicilio
              <input className={inputClass} type="number" min="1000" max="500000" step="100" value={deliveryFee} onChange={(e) => { setDeliveryFee(e.target.value); setCalculationSource('manual'); }} required />
              <span className="mt-1 block text-xs text-muted-foreground">{formattedFee}</span>
            </label>
            <label className={labelClass}>Método de pago
              <select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia / Nequi / Daviplata</option>
                <option value="credit_card">Tarjeta de crédito</option>
                <option value="debit_card">Tarjeta débito</option>
                <option value="wallet">Billetera DomiU</option>
              </select>
            </label>
            <label className={`${labelClass} md:col-span-2`}>Instrucciones especiales
              <textarea className={inputClass} rows={3} value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="Qué debe recoger, persona de contacto, cuidado especial..." />
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {submitting ? 'Creando domicilio...' : 'Crear y publicar domicilio'}
          </button>
        </div>
      </form>
    </div>
  );
}
