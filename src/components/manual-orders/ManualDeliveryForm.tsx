'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Clock3,
  DollarSign,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Send,
  Store,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseManualOrderText } from '@/lib/orders/parse-manual-order';
import { calculateDeliveryPrice } from '@/lib/orders/delivery-pricing';
import { calculateRouteDistance } from '@/lib/maps/distance';
import {
  getRouteSafetyWarnings,
  parseWhatsAppOrderStrict,
  validateManualDeliveryAddress,
} from '@/lib/manual-order-safety';
import {
  createManualDeliveryAction,
  getManualDeliveryBusinessDetails,
  getManualDeliveryBusinesses,
  getManualDeliveryCouriers,
  type ManualDeliveryBusinessDetail,
  type ManualDeliveryBusinessOption,
  type ManualDeliveryCourierOption,
} from '@/app/actions/manual-deliveries';
import { cn } from '@/lib/utils';

const schema = z.object({
  customerName: z.string().min(3, 'Escribe el nombre completo del cliente'),
  customerPhone: z.string().regex(/^3\d{9}$/, 'Usa un celular colombiano de 10 dígitos'),
  deliveryAddress: z.string().min(5, 'Escribe una dirección válida'),
  neighborhood: z.string().optional(),
  addressNotes: z.string().optional(),
  businessId: z.string().min(1, 'Selecciona un negocio'),
  distanceKm: z.number().positive('Calcula o escribe la distancia'),
  durationMinutes: z.number().min(0),
  deliveryFee: z.number().positive('Calcula el valor del domicilio'),
  paymentMethod: z.string().min(1, 'Selecciona un método de pago'),
  assignmentMode: z.enum(['manual', 'public']),
  courierId: z.string().optional(),
  manualPrice: z.number().optional(),
  specialInstructions: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;
type PanelMode = 'admin' | 'business';

type PriceResult = {
  distanceKm: number;
  durationMinutes: number;
  finalPrice: number;
  calculationSource: string;
  confidence: string;
  warnings: string[];
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'credit_card', label: 'Tarjeta' },
  { value: 'pse', label: 'PSE' },
  { value: 'wallet', label: 'Billetera DomiU' },
];

const fieldClass = 'domiu-input';
const labelClass = 'domiu-label';

function currency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function ManualDeliveryForm({ panel }: { panel: PanelMode }) {
  const router = useRouter();
  const [whatsAppText, setWhatsAppText] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [businesses, setBusinesses] = React.useState<ManualDeliveryBusinessOption[]>([]);
  const [couriers, setCouriers] = React.useState<ManualDeliveryCourierOption[]>([]);
  const [selectedBusiness, setSelectedBusiness] = React.useState<ManualDeliveryBusinessDetail | null>(null);
  const [distanceMode, setDistanceMode] = React.useState<'auto' | 'manual'>('auto');
  const [calculating, setCalculating] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [priceResult, setPriceResult] = React.useState<PriceResult | null>(null);
  const [extractionWarnings, setExtractionWarnings] = React.useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      deliveryAddress: '',
      neighborhood: '',
      addressNotes: '',
      businessId: '',
      distanceKm: 0,
      durationMinutes: 0,
      deliveryFee: 0,
      paymentMethod: 'cash',
      assignmentMode: 'public',
      courierId: '',
      manualPrice: undefined,
      specialInstructions: '',
    },
  });

  const businessId = form.watch('businessId');
  const assignmentMode = form.watch('assignmentMode');
  const values = form.watch();

  React.useEffect(() => {
    let active = true;
    async function loadOptions() {
      const [businessData, courierData] = await Promise.all([
        getManualDeliveryBusinesses(),
        panel === 'admin' ? getManualDeliveryCouriers() : Promise.resolve([]),
      ]);
      if (!active) return;
      setBusinesses(businessData);
      setCouriers(courierData);
      if (businessData.length === 1) {
        form.setValue('businessId', businessData[0].id, { shouldValidate: true });
      }
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, [form, panel]);

  React.useEffect(() => {
    let active = true;
    if (!businessId) {
      setSelectedBusiness(null);
      return () => {
        active = false;
      };
    }

    void getManualDeliveryBusinessDetails(businessId).then((detail) => {
      if (active) setSelectedBusiness(detail);
    });

    return () => {
      active = false;
    };
  }, [businessId]);

  function resetPrice() {
    form.setValue('distanceKm', 0);
    form.setValue('durationMinutes', 0);
    form.setValue('deliveryFee', 0);
    setPriceResult(null);
  }

  function parseWhatsApp() {
    if (!whatsAppText.trim()) {
      toast.error('Pega primero el mensaje recibido por WhatsApp');
      return;
    }

    setParsing(true);
    try {
      const legacy = parseManualOrderText(whatsAppText);
      const strict = parseWhatsAppOrderStrict(whatsAppText);
      const result = {
        ...legacy,
        ...strict,
        warnings: [...new Set([...(legacy.warnings || []), ...(strict.warnings || [])])],
      };

      form.setValue('customerName', result.customerName || '', { shouldValidate: true });
      form.setValue('customerPhone', result.customerPhone || '', { shouldValidate: true });
      form.setValue('deliveryAddress', result.address || '', { shouldValidate: true });
      form.setValue('neighborhood', result.neighborhood || '');
      form.setValue('addressNotes', result.addressNotes || '');
      form.setValue('specialInstructions', result.orderNotes || '');
      setExtractionWarnings(result.warnings);
      resetPrice();

      if (result.warnings.length) {
        toast.warning('Revisa los datos extraídos antes de crear el domicilio');
      } else {
        toast.success('Datos extraídos. Confirma la información antes de continuar');
      }
    } finally {
      setParsing(false);
    }
  }

  async function calculateDelivery() {
    if (!selectedBusiness) {
      toast.error('Selecciona primero el negocio de recogida');
      return;
    }

    if (distanceMode === 'manual') {
      const km = form.getValues('distanceKm');
      if (!Number.isFinite(km) || km <= 0) {
        toast.error('Escribe la distancia en kilómetros');
        return;
      }
      const pricing = calculateDeliveryPrice(km);
      form.setValue('durationMinutes', pricing.durationMinutes, { shouldValidate: true });
      form.setValue('deliveryFee', pricing.finalPrice, { shouldValidate: true });
      setPriceResult({
        distanceKm: km,
        durationMinutes: pricing.durationMinutes,
        finalPrice: pricing.finalPrice,
        calculationSource: 'manual',
        confidence: pricing.confidence,
        warnings: pricing.warnings,
      });
      toast.success(`Valor sugerido: ${currency(pricing.finalPrice)}`);
      return;
    }

    const validation = validateManualDeliveryAddress(
      form.getValues('deliveryAddress'),
      form.getValues('neighborhood'),
    );
    if (!validation.ok) {
      validation.warnings.forEach((warning) => toast.error(warning));
      return;
    }
    if (!selectedBusiness.hasAddress) {
      toast.error('El negocio no tiene una dirección registrada. Usa el modo manual');
      return;
    }

    setCalculating(true);
    try {
      const route = await calculateRouteDistance(
        selectedBusiness.address,
        validation.normalizedAddress,
        selectedBusiness.latitude ?? undefined,
        selectedBusiness.longitude ?? undefined,
      );
      const safetyWarnings = getRouteSafetyWarnings(route.distanceKm, route.warnings || []);
      if (route.distanceKm <= 0 || safetyWarnings.length) {
        safetyWarnings.forEach((warning) => toast.error(warning));
        toast.error('No fue posible validar la ruta automáticamente');
        resetPrice();
        return;
      }

      const pricing = calculateDeliveryPrice(route.distanceKm);
      form.setValue('distanceKm', route.distanceKm, { shouldValidate: true });
      form.setValue('durationMinutes', route.durationMinutes, { shouldValidate: true });
      form.setValue('deliveryFee', pricing.finalPrice, { shouldValidate: true });
      setPriceResult({
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        finalPrice: pricing.finalPrice,
        calculationSource: route.calculationSource,
        confidence: pricing.confidence,
        warnings: [...(route.warnings || []), ...pricing.warnings],
      });
      toast.success(`${route.distanceKm} km · ${currency(pricing.finalPrice)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible calcular la ruta');
    } finally {
      setCalculating(false);
    }
  }

  async function submit(data: FormValues) {
    if (!selectedBusiness) {
      toast.error('Selecciona un negocio válido');
      return;
    }
    if (!priceResult || data.distanceKm <= 0 || data.deliveryFee <= 0) {
      toast.error('Calcula el domicilio antes de confirmar');
      return;
    }

    const addressValidation = validateManualDeliveryAddress(data.deliveryAddress, data.neighborhood);
    if (!addressValidation.ok) {
      addressValidation.warnings.forEach((warning) => toast.error(warning));
      return;
    }

    const manualPriceUsed = Boolean(data.manualPrice && data.manualPrice > 0);
    const finalFee = manualPriceUsed ? data.manualPrice! : data.deliveryFee;
    const calculationSource: 'google_maps' | 'manual' | 'fallback' = manualPriceUsed
      ? 'manual'
      : priceResult.calculationSource.includes('google')
        ? 'google_maps'
        : priceResult.calculationSource === 'manual'
          ? 'manual'
          : 'fallback';

    setCreating(true);
    try {
      const result = await createManualDeliveryAction({
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        deliveryAddress: addressValidation.normalizedAddress,
        neighborhood: data.neighborhood || undefined,
        addressNotes: data.addressNotes || undefined,
        businessId: data.businessId,
        businessName: selectedBusiness.name,
        businessAddress: selectedBusiness.address,
        businessNeighborhood: selectedBusiness.neighborhood || undefined,
        businessCity: selectedBusiness.city,
        businessLat: selectedBusiness.latitude ?? undefined,
        businessLng: selectedBusiness.longitude ?? undefined,
        distanceKm: data.distanceKm,
        durationMinutes: data.durationMinutes,
        deliveryFee: finalFee,
        manualPriceUsed,
        priceCalculationSource: calculationSource,
        paymentMethod: data.paymentMethod,
        assignmentMode: panel === 'business' ? 'public' : data.assignmentMode,
        courierId:
          panel === 'admin' && data.assignmentMode === 'manual' && data.courierId
            ? data.courierId
            : undefined,
        specialInstructions: data.specialInstructions || undefined,
        rawWhatsAppText: whatsAppText || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Domicilio #${result.orderNumber} creado correctamente`);
      form.reset({
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        neighborhood: '',
        addressNotes: '',
        businessId: businesses.length === 1 ? businesses[0].id : '',
        distanceKm: 0,
        durationMinutes: 0,
        deliveryFee: 0,
        paymentMethod: 'cash',
        assignmentMode: 'public',
        courierId: '',
        manualPrice: undefined,
        specialInstructions: '',
      });
      setWhatsAppText('');
      setExtractionWarnings([]);
      setPriceResult(null);
      window.setTimeout(
        () => router.push(panel === 'admin' ? '/admin/pedidos' : '/negocio/pedidos'),
        900,
      );
    } finally {
      setCreating(false);
    }
  }

  const checks = [
    { label: 'Cliente identificado', ok: values.customerName.length >= 3 },
    { label: 'Celular válido', ok: /^3\d{9}$/.test(values.customerPhone) },
    { label: 'Dirección completa', ok: values.deliveryAddress.length >= 5 },
    { label: 'Negocio seleccionado', ok: Boolean(selectedBusiness) },
    { label: 'Ruta calculada', ok: values.distanceKm > 0 },
    { label: 'Tarifa definida', ok: values.deliveryFee > 0 },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
        <section className="domiu-premium-panel overflow-hidden">
          <div className="border-b border-border bg-gradient-to-r from-[#fff9e7] to-white px-5 py-5 sm:px-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFC400] text-[#171a1f] shadow-sm">
                <ClipboardPaste className="h-5 w-5" />
              </div>
              <div>
                <p className="domiu-section-kicker">Entrada rápida</p>
                <h2 className="mt-1 text-lg font-extrabold text-foreground">Convertir mensaje de WhatsApp</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Pega el mensaje del cliente y DomiU completará los datos que pueda reconocer.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-7">
            <textarea
              value={whatsAppText}
              onChange={(event) => setWhatsAppText(event.target.value)}
              rows={5}
              placeholder={'Ejemplo:\nCliente: Ana Torres\nCelular: 3001234567\nDirección: Calle 20 # 8-15, Bavaria\nReferencia: portón blanco'}
              className="domiu-input min-h-36 resize-y"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Los datos extraídos deben confirmarse manualmente antes de crear el domicilio.
              </p>
              <button
                type="button"
                onClick={parseWhatsApp}
                disabled={parsing || !whatsAppText.trim()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#171a1f] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#282d34] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
                Extraer información
              </button>
            </div>
          </div>
        </section>

        {extractionWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-extrabold">Revisa la extracción</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {extractionWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        <section className="domiu-premium-panel p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="domiu-section-kicker">Paso 1</p>
              <h2 className="text-lg font-extrabold text-foreground">Cliente y destino</h2>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}><User className="mr-1.5 inline h-4 w-4" />Nombre del cliente</label>
              <input {...form.register('customerName')} className={fieldClass} placeholder="Nombre completo" />
              {form.formState.errors.customerName && <p className="mt-1.5 text-xs font-medium text-destructive">{form.formState.errors.customerName.message}</p>}
            </div>
            <div>
              <label className={labelClass}><Phone className="mr-1.5 inline h-4 w-4" />Celular</label>
              <input {...form.register('customerPhone')} className={fieldClass} placeholder="3001234567" maxLength={10} inputMode="numeric" />
              {form.formState.errors.customerPhone && <p className="mt-1.5 text-xs font-medium text-destructive">{form.formState.errors.customerPhone.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}><MapPin className="mr-1.5 inline h-4 w-4" />Dirección de entrega</label>
              <input {...form.register('deliveryAddress')} onChange={(event) => { form.setValue('deliveryAddress', event.target.value, { shouldDirty: true, shouldValidate: true }); resetPrice(); }} className={fieldClass} placeholder="Calle, carrera, número y sector" />
              {form.formState.errors.deliveryAddress && <p className="mt-1.5 text-xs font-medium text-destructive">{form.formState.errors.deliveryAddress.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Barrio o zona</label>
              <input {...form.register('neighborhood')} className={fieldClass} placeholder="Ej. Bavaria" />
            </div>
            <div>
              <label className={labelClass}>Referencia</label>
              <input {...form.register('addressNotes')} className={fieldClass} placeholder="Portón, piso, local, color..." />
            </div>
          </div>
        </section>

        <section className="domiu-premium-panel p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="domiu-section-kicker">Paso 2</p>
              <h2 className="text-lg font-extrabold text-foreground">Punto de recogida</h2>
            </div>
          </div>

          <label className={labelClass}>Negocio</label>
          <select {...form.register('businessId')} className={fieldClass}>
            <option value="">Seleccionar negocio</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id} disabled={!business.is_active || !business.hasAddress}>
                {business.name}{!business.hasAddress ? ' · sin dirección' : ''}
              </option>
            ))}
          </select>
          {form.formState.errors.businessId && <p className="mt-1.5 text-xs font-medium text-destructive">{form.formState.errors.businessId.message}</p>}

          {selectedBusiness && (
            <div className="domiu-soft-card mt-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-foreground">{selectedBusiness.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedBusiness.address || 'Sin dirección registrada'}</p>
                </div>
                <span className={cn('rounded-full px-3 py-1 text-xs font-bold', selectedBusiness.hasCoordinates ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                  {selectedBusiness.hasCoordinates ? 'Ubicación lista' : 'Dirección sin coordenadas'}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="domiu-premium-panel p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <p className="domiu-section-kicker">Paso 3</p>
              <h2 className="text-lg font-extrabold text-foreground">Ruta y tarifa</h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(['auto', 'manual'] as const).map((mode) => (
              <label key={mode} className={cn('cursor-pointer rounded-2xl border p-4 transition', distanceMode === mode ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-white hover:border-primary/50')}>
                <input type="radio" className="sr-only" checked={distanceMode === mode} onChange={() => { setDistanceMode(mode); resetPrice(); }} />
                <div className="flex items-start gap-3">
                  {mode === 'auto' ? <Navigation className="h-5 w-5 text-primary" /> : <DollarSign className="h-5 w-5 text-primary" />}
                  <div>
                    <p className="font-extrabold text-foreground">{mode === 'auto' ? 'Automática' : 'Manual de respaldo'}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{mode === 'auto' ? 'Calcula distancia y tiempo con el servicio de mapas.' : 'Úsala cuando la ruta automática no esté disponible.'}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Distancia en kilómetros</label>
              <input type="number" step="0.1" readOnly={distanceMode === 'auto'} {...form.register('distanceKm', { valueAsNumber: true })} className={fieldClass} placeholder={distanceMode === 'auto' ? 'Se calculará automáticamente' : 'Ej. 4.8'} />
            </div>
            <div>
              <label className={labelClass}>Tiempo estimado</label>
              <input type="number" readOnly {...form.register('durationMinutes', { valueAsNumber: true })} className={fieldClass} placeholder="Minutos" />
            </div>
          </div>

          <button type="button" onClick={calculateDelivery} disabled={calculating || !selectedBusiness} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#171a1f] px-5 text-sm font-bold text-white transition hover:bg-[#282d34] disabled:cursor-not-allowed disabled:opacity-50">
            {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Calcular domicilio
          </button>

          {priceResult && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric icon={<MapPin className="h-4 w-4" />} label="Distancia" value={`${priceResult.distanceKm} km`} />
              <Metric icon={<Clock3 className="h-4 w-4" />} label="Tiempo" value={`${priceResult.durationMinutes} min`} />
              <Metric icon={<DollarSign className="h-4 w-4" />} label="Tarifa sugerida" value={currency(priceResult.finalPrice)} accent />
            </div>
          )}
        </section>

        <section className="domiu-premium-panel p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="domiu-section-kicker">Paso 4</p>
              <h2 className="text-lg font-extrabold text-foreground">Pago y asignación</h2>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Método de pago</label>
              <select {...form.register('paymentMethod')} className={fieldClass}>
                {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tarifa manual opcional</label>
              <input type="number" {...form.register('manualPrice', { valueAsNumber: true })} className={fieldClass} placeholder={priceResult ? currency(priceResult.finalPrice) : 'Solo para sobrescribir la tarifa'} />
            </div>
          </div>

          {panel === 'admin' ? (
            <div className="mt-5">
              <label className={labelClass}>Modo de asignación</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={cn('cursor-pointer rounded-2xl border p-4 transition', assignmentMode === 'public' ? 'border-primary bg-primary/10' : 'border-border bg-white')}>
                  <input type="radio" value="public" {...form.register('assignmentMode')} className="sr-only" />
                  <p className="font-extrabold text-foreground">Publicar para repartidores</p>
                  <p className="mt-1 text-xs text-muted-foreground">El domicilio queda disponible para la operación.</p>
                </label>
                <label className={cn('cursor-pointer rounded-2xl border p-4 transition', assignmentMode === 'manual' ? 'border-primary bg-primary/10' : 'border-border bg-white')}>
                  <input type="radio" value="manual" {...form.register('assignmentMode')} className="sr-only" />
                  <p className="font-extrabold text-foreground">Asignar ahora</p>
                  <p className="mt-1 text-xs text-muted-foreground">Selecciona un repartidor disponible.</p>
                </label>
              </div>
              {assignmentMode === 'manual' && (
                <div className="mt-4">
                  <label className={labelClass}>Repartidor</label>
                  <select {...form.register('courierId')} className={fieldClass}>
                    <option value="">Seleccionar repartidor</option>
                    {couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name} · {courier.status || 'sin estado'}</option>)}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm text-foreground">
              El domicilio será publicado para que un repartidor disponible pueda tomarlo.
            </div>
          )}

          <div className="mt-5">
            <label className={labelClass}>Instrucciones para la entrega</label>
            <textarea {...form.register('specialInstructions')} rows={3} className={fieldClass} placeholder="Producto a recoger, persona de contacto, indicaciones especiales..." />
          </div>
        </section>

        <button type="submit" disabled={creating} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-black text-primary-foreground shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
          {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {creating ? 'Creando domicilio...' : 'Crear domicilio manual'}
        </button>
      </form>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <section className="domiu-premium-panel p-5">
          <p className="domiu-section-kicker">Validación</p>
          <h2 className="mt-1 text-lg font-extrabold text-foreground">Estado del domicilio</h2>
          <div className="mt-4 space-y-3">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center gap-3">
                {check.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-5 w-5 rounded-full border-2 border-border" />}
                <span className={cn('text-sm font-medium', check.ok ? 'text-foreground' : 'text-muted-foreground')}>{check.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-[#171a1f] p-5 text-white shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FFC400]">Resumen</p>
          <div className="mt-4 space-y-4">
            <SummaryRow label="Cliente" value={values.customerName || 'Pendiente'} />
            <SummaryRow label="Negocio" value={selectedBusiness?.name || 'Pendiente'} />
            <SummaryRow label="Destino" value={values.neighborhood || values.deliveryAddress || 'Pendiente'} />
            <SummaryRow label="Distancia" value={values.distanceKm > 0 ? `${values.distanceKm} km` : 'Pendiente'} />
          </div>
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-xs text-slate-400">Total del domicilio</p>
            <p className="mt-1 text-3xl font-black text-[#FFC400]">{currency(values.manualPrice && values.manualPrice > 0 ? values.manualPrice : values.deliveryFee)}</p>
          </div>
        </section>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
          <strong>Consejo operativo:</strong> confirma nombre, celular, dirección y referencia con el cliente antes de publicar el domicilio.
        </div>
      </aside>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={cn('domiu-soft-card p-4', accent && 'border-primary/40 bg-[#fff9e8]')}>
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-bold">{label}</span></div>
      <p className={cn('mt-2 text-xl font-black text-foreground', accent && 'text-[#9b7200]')}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[12rem] text-right font-bold text-white">{value}</span>
    </div>
  );
}
