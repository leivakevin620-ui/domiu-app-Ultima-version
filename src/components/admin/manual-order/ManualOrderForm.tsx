'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { parseManualOrderText } from '@/lib/orders/parse-manual-order';
import { calculateDeliveryPrice } from '@/lib/orders/delivery-pricing';
import { createManualOrderAction, getBusinessDetailsForOrder } from '@/app/actions/admin-orders';
import { calculateRouteDistance } from '@/lib/maps/distance';
import { Loader2, MapPin, Phone, User, Navigation, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  customerName: z.string().min(3, 'Mínimo 3 caracteres'),
  customerPhone: z.string().regex(/^3\d{9}$/, 'Debe ser 10 dígitos empezando por 3'),
  deliveryAddress: z.string().min(5, 'Mínimo 5 caracteres'),
  neighborhood: z.string().optional(),
  addressNotes: z.string().optional(),
  businessId: z.string().min(1, 'Selecciona un local'),
  distanceKm: z.number().positive('Debe ser mayor a 0'),
  durationMinutes: z.number().min(0),
  deliveryFee: z.number().positive('Debe ser mayor a 0'),
  paymentMethod: z.string().min(1, 'Selecciona un método'),
  assignmentMode: z.enum(['manual', 'public']),
  courierId: z.string().optional(),
  manualPrice: z.number().optional(),
  specialInstructions: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BusinessOption {
  id: string;
  name: string;
  is_active: boolean;
  is_verified: boolean;
  hasAddress: boolean;
  hasCoordinates: boolean;
}

interface CourierOption {
  id: string;
  name: string;
  status: string;
}

interface BusinessDetail {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  is_verified: boolean;
  accepts_orders: boolean;
  hasAddress: boolean;
  hasCoordinates: boolean;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'credit_card', label: 'Tarjeta' },
  { value: 'pse', label: 'PSE' },
  { value: 'wallet', label: 'Wallet' },
];

const CREATE_TIMEOUT_MS = 30000;

export function ManualOrderForm() {
  const router = useRouter();
  const [whatsAppText, setWhatsAppText] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [couriers, setCouriers] = React.useState<CourierOption[]>([]);
  const [selectedBusiness, setSelectedBusiness] = React.useState<BusinessDetail | null>(null);
  const [calculating, setCalculating] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createTimedOut, setCreateTimedOut] = React.useState(false);
  const [priceResult, setPriceResult] = React.useState<{
    distanceKm: number;
    durationMinutes: number;
    rawPrice: number;
    finalPrice: number;
    calculationSource: string;
    confidence: string;
    warnings: string[];
  } | null>(null);
  const [parsedData, setParsedData] = React.useState<{
    customerName: string;
    customerPhone: string;
    address: string;
    neighborhood: string;
    addressNotes: string;
    confidence: Record<string, number>;
    warnings: string[];
  } | null>(null);
  const [distanceMode, setDistanceMode] = React.useState<'auto' | 'manual'>('auto');
  const createTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
      paymentMethod: '',
      assignmentMode: 'public',
      courierId: '',
      manualPrice: undefined,
      specialInstructions: '',
    },
  });

  const watchBusinessId = form.watch('businessId');
  const watchAssignmentMode = form.watch('assignmentMode');

  React.useEffect(() => {
    async function load() {
      const { getBusinessesForOrderSelect, getAvailableCouriersForAdmin } = await import('@/app/actions/admin-orders');
      const [bizData, courData] = await Promise.all([
        getBusinessesForOrderSelect(),
        getAvailableCouriersForAdmin(),
      ]);
      setBusinesses(bizData);
      setCouriers(courData);
    }
    load();
  }, []);

  React.useEffect(() => {
    if (!watchBusinessId) {
      setSelectedBusiness(null);
      return;
    }
    async function loadDetail() {
      const detail = await getBusinessDetailsForOrder(watchBusinessId);
      setSelectedBusiness(detail);
    }
    loadDetail();
  }, [watchBusinessId]);

  React.useEffect(() => {
    return () => {
      if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
    };
  }, []);

  const handleParse = () => {
    if (!whatsAppText.trim()) {
      toast.error('Pega el texto del WhatsApp primero');
      return;
    }
    setParsing(true);
    const result = parseManualOrderText(whatsAppText);
    setParsedData(result);

    form.setValue('customerName', result.customerName);
    form.setValue('customerPhone', result.customerPhone);
    form.setValue('deliveryAddress', result.address);
    form.setValue('neighborhood', result.neighborhood);
    form.setValue('addressNotes', result.addressNotes);

    setParsing(false);

    if (result.warnings.length > 0) {
      result.warnings.forEach(w => toast.warning(w));
    }
  };

  const handleCalculate = async () => {
    const business = selectedBusiness;
    if (!business) {
      toast.error('Selecciona un local primero');
      return;
    }

    if (distanceMode === 'manual') {
      const km = form.getValues('distanceKm');
      if (!km || km <= 0) {
        toast.error('Ingresa los kilómetros manualmente');
        return;
      }
      const pricing = calculateDeliveryPrice(km);
      form.setValue('durationMinutes', pricing.durationMinutes);
      form.setValue('deliveryFee', pricing.finalPrice);
      setPriceResult({
        distanceKm: km,
        durationMinutes: pricing.durationMinutes,
        rawPrice: pricing.rawPrice,
        finalPrice: pricing.finalPrice,
        calculationSource: 'manual',
        confidence: 'medium',
        warnings: pricing.warnings,
      });
      if (pricing.warnings.length > 0) {
        pricing.warnings.forEach(w => toast.warning(w));
      } else {
        toast.success(`Precio sugerido: $${pricing.finalPrice.toLocaleString('es-CO')}`);
      }
      return;
    }

    const deliveryAddress = form.getValues('deliveryAddress');
    if (!deliveryAddress || deliveryAddress.length < 5) {
      toast.error('Ingresa la dirección de entrega');
      return;
    }

    if (!business.hasAddress) {
      toast.error(`El local "${business.name}" no tiene dirección registrada. Cambia a modo manual e ingresa los km.`);
      return;
    }

    setCalculating(true);
    setPriceResult(null);

    try {
      const route = await calculateRouteDistance(
        business.address,
        deliveryAddress,
        business.latitude ?? undefined,
        business.longitude ?? undefined,
      );

      form.setValue('distanceKm', route.distanceKm);
      form.setValue('durationMinutes', route.durationMinutes);

      const pricing = calculateDeliveryPrice(route.distanceKm);
      form.setValue('deliveryFee', pricing.finalPrice);

      setPriceResult({
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        rawPrice: pricing.rawPrice,
        finalPrice: pricing.finalPrice,
        calculationSource: route.calculationSource,
        confidence: pricing.confidence,
        warnings: [...route.warnings, ...pricing.warnings],
      });

      if (route.distanceKm <= 0 && !deliveryAddress) {
        toast.error('No se pudo calcular la distancia. Cambia a modo manual.');
      } else if (route.warnings.length > 0 || pricing.warnings.length > 0) {
        [...route.warnings, ...pricing.warnings].forEach(w => toast.warning(w));
        if (route.distanceKm > 0) {
          toast.success(`Distancia: ${route.distanceKm} km | Precio sugerido: $${pricing.finalPrice.toLocaleString('es-CO')}`);
        }
      } else {
        toast.success(`Distancia: ${route.distanceKm} km | Precio sugerido: $${pricing.finalPrice.toLocaleString('es-CO')}`);
      }
    } catch {
      toast.error('Error al calcular. Cambia a modo manual e ingresa los km.');
      setDistanceMode('manual');
    } finally {
      setCalculating(false);
    }
  };

  const handleCreate = async (values: FormValues) => {
    if (values.deliveryFee <= 0) {
      toast.error('Calcula el valor del domicilio antes de crear el pedido');
      return;
    }

    setCreating(true);
    setCreateTimedOut(false);

    const manualPriceUsed = !!values.manualPrice && values.manualPrice! > 0;
    const finalFee: number = manualPriceUsed ? values.manualPrice! : values.deliveryFee;

    createTimeoutRef.current = setTimeout(() => {
      setCreateTimedOut(true);
      toast.warning('El servidor está tardando más de lo normal. No cierres esta página.');
    }, CREATE_TIMEOUT_MS - 5000);

    try {
      const resultPromise = createManualOrderAction({
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        deliveryAddress: values.deliveryAddress,
        neighborhood: values.neighborhood || undefined,
        addressNotes: values.addressNotes || undefined,
        businessId: values.businessId,
        businessName: selectedBusiness?.name || undefined,
        businessAddress: selectedBusiness?.address || '',
        businessNeighborhood: selectedBusiness?.neighborhood || undefined,
        businessCity: selectedBusiness?.city || undefined,
        businessLat: selectedBusiness?.latitude ?? undefined,
        businessLng: selectedBusiness?.longitude ?? undefined,
        distanceKm: values.distanceKm,
        durationMinutes: values.durationMinutes,
        deliveryFee: finalFee,
        manualPriceUsed,
        priceCalculationSource: (priceResult?.calculationSource || 'manual') as 'google_maps' | 'manual' | 'fallback',
        paymentMethod: values.paymentMethod,
        assignmentMode: values.assignmentMode as 'manual' | 'public',
        courierId: values.assignmentMode === 'manual' && values.courierId ? values.courierId : undefined,
        specialInstructions: values.specialInstructions || undefined,
        rawWhatsAppText: whatsAppText || undefined,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo de espera agotado (30s)')), CREATE_TIMEOUT_MS)
      );

      const result = await Promise.race([resultPromise, timeoutPromise]);

      if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pedido ${result.orderNumber} creado exitosamente`);
      form.reset();
      setWhatsAppText('');
      setParsedData(null);
      setPriceResult(null);
      setSelectedBusiness(null);
      setCreateTimedOut(false);
      setTimeout(() => router.push('/admin/pedidos'), 1500);
    } catch (err) {
      if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear pedido';
      toast.error(msg);
      console.error('[ManualOrderForm] Error:', err);
    } finally {
      setCreating(false);
      setCreateTimedOut(false);
    }
  };

  const getConfidenceColor = (v: number) => {
    if (v >= 0.8) return 'text-green-400';
    if (v >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formValues = form.watch();

  const checks = [
    { label: 'Cliente', ok: formValues.customerName?.length >= 3 },
    { label: 'Teléfono', ok: /^3\d{9}$/.test(formValues.customerPhone || '') },
    { label: 'Dirección entrega', ok: (formValues.deliveryAddress?.length || 0) >= 5 },
    { label: 'Local seleccionado', ok: !!selectedBusiness },
    { label: 'Local con dirección', ok: selectedBusiness?.hasAddress ?? false },
    { label: 'Distancia calculada', ok: (formValues.distanceKm || 0) > 0 },
    { label: 'Precio calculado', ok: (formValues.deliveryFee || 0) > 0 },
    { label: 'Método de pago', ok: !!formValues.paymentMethod },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Pegar información del local</h2>
        <textarea
          value={whatsAppText}
          onChange={(e) => setWhatsAppText(e.target.value)}
          placeholder="Pega aquí el texto recibido por WhatsApp del local..."
          rows={4}
          className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={handleParse}
          disabled={parsing || !whatsAppText.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Extraer datos
        </button>
      </div>

      {parsedData && parsedData.warnings.length > 0 && (
        <div className="rounded-xl border border-yellow-700/50 bg-yellow-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
            <div>
              <p className="mb-1 text-sm font-medium text-yellow-300">Advertencias al extraer datos</p>
              <ul className="space-y-0.5">
                {parsedData.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-yellow-200/80">{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-6">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">Nuevo Pedido</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                <User className="mr-1.5 inline h-4 w-4" />
                Cliente
              </label>
              <input
                {...form.register('customerName')}
                placeholder="Nombre del cliente"
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {form.formState.errors.customerName && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.customerName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                <Phone className="mr-1.5 inline h-4 w-4" />
                Teléfono
              </label>
              <input
                {...form.register('customerPhone')}
                placeholder="3016837146"
                maxLength={10}
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {form.formState.errors.customerPhone && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.customerPhone.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                <MapPin className="mr-1.5 inline h-4 w-4" />
                Dirección
              </label>
              <input
                {...form.register('deliveryAddress')}
                placeholder="Dirección exacta del cliente"
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {form.formState.errors.deliveryAddress && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.deliveryAddress.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">Barrio / Zona</label>
              <input
                {...form.register('neighborhood')}
                placeholder="Ej: Villa Marbella"
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">Notas de dirección</label>
              <input
                {...form.register('addressNotes')}
                placeholder="Referencias, piso, etc."
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                <Store className="mr-1.5 inline h-4 w-4" />
                Local / Negocio
              </label>
              <select
                {...form.register('businessId')}
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Seleccionar un local</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id} disabled={!b.is_active || !b.hasAddress}>
                    {b.name}
                    {!b.is_active ? ' (inactivo)' : ''}
                    {!b.hasAddress && b.is_active ? ' (sin dirección)' : ''}
                  </option>
                ))}
              </select>
              {form.formState.errors.businessId && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.businessId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">Dirección del local</label>
              <input
                value={selectedBusiness?.address || ''}
                readOnly
                placeholder="Selecciona un local"
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-slate-300"
              />
              {selectedBusiness && !selectedBusiness.hasAddress && (
                <p className="mt-1 text-xs text-yellow-400">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Este local no tiene dirección registrada
                </p>
              )}
            </div>
          </div>

          {selectedBusiness && (
            <div className="mt-5 rounded-xl border border-slate-600/50 bg-slate-700/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-400" />
                  <span className="text-base font-semibold text-white">{selectedBusiness.name}</span>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  selectedBusiness.hasCoordinates
                    ? 'bg-green-900/40 text-green-400'
                    : selectedBusiness.hasAddress
                    ? 'bg-yellow-900/40 text-yellow-400'
                    : 'bg-red-900/40 text-red-400'
                }`}>
                  {selectedBusiness.hasCoordinates ? 'Listo' : selectedBusiness.hasAddress ? 'Sin coordenadas' : 'Incompleto'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-400">Dirección:</div>
                <div className="text-slate-200">{selectedBusiness.address || <span className="text-yellow-400">No registrada</span>}</div>
                <div className="text-slate-400">Barrio:</div>
                <div className="text-slate-200">{selectedBusiness.neighborhood || <span className="text-slate-500">—</span>}</div>
                <div className="text-slate-400">Ciudad:</div>
                <div className="text-slate-200">{selectedBusiness.city || 'Santa Marta'}</div>
                <div className="text-slate-400">Coordenadas:</div>
                <div className="text-slate-200">
                  {selectedBusiness.hasCoordinates
                    ? `${selectedBusiness.latitude!.toFixed(4)}, ${selectedBusiness.longitude!.toFixed(4)}`
                    : <span className="text-yellow-400">No disponibles</span>}
                </div>
              </div>
            </div>
          )}

          <div className="mt-5">
            <label className="mb-3 block text-sm font-semibold text-slate-300">Modo de distancia</label>
            <div className="flex flex-wrap gap-3">
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                distanceMode === 'auto'
                  ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                  : 'border-slate-600 bg-slate-700/50 text-slate-300'
              }`}>
                <input
                  type="radio"
                  checked={distanceMode === 'auto'}
                  onChange={() => setDistanceMode('auto')}
                  className="accent-emerald-500"
                />
                <Navigation className="h-4 w-4" />
                Automático (Google Maps)
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                distanceMode === 'manual'
                  ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                  : 'border-slate-600 bg-slate-700/50 text-slate-300'
              }`}>
                <input
                  type="radio"
                  checked={distanceMode === 'manual'}
                  onChange={() => setDistanceMode('manual')}
                  className="accent-emerald-500"
                />
                <DollarSign className="h-4 w-4" />
                Manual (ingresar km)
              </label>
            </div>
          </div>

          {distanceMode === 'manual' && (
            <div className="mt-1 rounded-lg border border-yellow-700/30 bg-yellow-900/10 p-3 text-xs text-yellow-300">
              Ingresa los kilómetros estimados manualmente. El precio se calculará según la tarifa base.
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                <Navigation className="mr-1.5 inline h-4 w-4" />
                Kilómetros
              </label>
              <input
                type="number"
                step="0.1"
                {...form.register('distanceKm', { valueAsNumber: true })}
                placeholder={distanceMode === 'auto' ? 'Se llenará automáticamente' : 'Ej: 5.5'}
                readOnly={distanceMode === 'auto'}
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 read-only:opacity-60"
              />
              {form.formState.errors.distanceKm && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.distanceKm.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">Duración estimada</label>
              <input
                type="number"
                {...form.register('durationMinutes', { valueAsNumber: true })}
                placeholder="0 min"
                readOnly
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 read-only:opacity-60"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating || !selectedBusiness || (!form.getValues('deliveryAddress') && distanceMode === 'auto')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {distanceMode === 'auto' ? 'Calcular domicilio' : 'Calcular precio'}
            </button>
          </div>

          {priceResult && (
            <div className="mt-4 rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-4">
              <h3 className="mb-3 text-sm font-semibold text-emerald-300">Cálculo del domicilio</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-700/50 p-3">
                  <p className="text-xs text-slate-400">Distancia</p>
                  <p className="text-lg font-bold text-white">{priceResult.distanceKm} km</p>
                </div>
                <div className="rounded-lg bg-slate-700/50 p-3">
                  <p className="text-xs text-slate-400">Duración</p>
                  <p className="text-lg font-bold text-white">{priceResult.durationMinutes} min</p>
                </div>
                <div className="rounded-lg bg-slate-700/50 p-3">
                  <p className="text-xs text-slate-400">Precio sugerido</p>
                  <p className="text-lg font-bold text-emerald-400">
                    ${priceResult.finalPrice.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span>Fuente: {priceResult.calculationSource}</span>
                <span>Confianza: {priceResult.confidence}</span>
                {priceResult.warnings.length > 0 && (
                  <span className="text-yellow-400">{priceResult.warnings.length} advertencia(s)</span>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">Método de pago</label>
              <select
                {...form.register('paymentMethod')}
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Seleccionar...</option>
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
              {form.formState.errors.paymentMethod && (
                <p className="mt-1 text-xs text-red-400">{form.formState.errors.paymentMethod.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                <DollarSign className="mr-1.5 inline h-4 w-4" />
                Precio manual (opcional)
              </label>
              <input
                type="number"
                {...form.register('manualPrice', { valueAsNumber: true })}
                placeholder="Dejar vacío para usar valor automático"
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-3 block text-sm font-semibold text-slate-300">Modo de asignación</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm text-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-900/30 has-[:checked]:text-emerald-300">
                <input
                  type="radio"
                  value="manual"
                  {...form.register('assignmentMode')}
                  className="accent-emerald-500"
                />
                Asignar manualmente
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm text-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-900/30 has-[:checked]:text-emerald-300">
                <input
                  type="radio"
                  value="public"
                  {...form.register('assignmentMode')}
                  className="accent-emerald-500"
                />
                Publicar para cualquier repartidor
              </label>
            </div>
          </div>

          {watchAssignmentMode === 'manual' && (
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">Repartidor</label>
              <select
                {...form.register('courierId')}
                className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Sin asignar</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">Notas</label>
            <textarea
              {...form.register('specialInstructions')}
              rows={2}
              placeholder="Instrucciones especiales para el repartidor..."
              className="w-full rounded-lg border border-slate-600 bg-input-bg p-3 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-400">Estado del pedido</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center gap-2">
                {check.ok ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-slate-500" />
                )}
                <span className={check.ok ? 'text-slate-300' : 'text-slate-500'}>{check.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {createTimedOut ? 'Esperando respuesta del servidor...' : 'Creando pedido...'}
            </span>
          ) : (
            'Crear Pedido'
          )}
        </button>
      </form>

      {parsedData && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <h3 className="mb-2 text-sm font-medium text-slate-400">Confianza de extracción</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            {Object.entries(parsedData.confidence).map(([key, val]) => (
              <span key={key} className={getConfidenceColor(val)}>
                {key}: {Math.round(val * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Store(props: { className?: string }) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
