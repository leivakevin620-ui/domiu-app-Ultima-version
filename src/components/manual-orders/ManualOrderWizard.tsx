'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface BusinessOption {
  id: string;
  name: string;
  active: boolean;
  verified: boolean;
  acceptingOrders: boolean;
  operationsStatus: string;
}

interface BranchOption {
  id: string;
  name: string | null;
  street_address: string;
  formatted_address: string | null;
  neighborhood: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  is_active: boolean;
  delivery_available: boolean;
}

interface ProductOption {
  id: string;
  businessId: string;
  categoryName: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  status: string;
  quantityAvailable: number;
  preparationMinutes: number;
  imageUrl: string | null;
}

interface VariantOption {
  id: string;
  product_id: string;
  name: string;
  values: unknown;
  price_modifier: number;
  quantity_available: number;
  is_active: boolean;
}

interface CourierOption {
  id: string;
  name: string;
  phone: string;
  status: string;
  accountStatus: string | null;
  eligible: boolean;
}

interface BootstrapData {
  actorRole: 'admin' | 'merchant';
  businesses: BusinessOption[];
  business: {
    id: string;
    name: string;
    active: boolean;
    verified: boolean;
    acceptingOrders: boolean;
    operationsStatus: string;
    allowCustomProducts: boolean;
    allowDeliveryFeeOverride: boolean;
  } | null;
  branches: BranchOption[];
  products: ProductOption[];
  variants: VariantOption[];
  couriers: CourierOption[];
}

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
}

interface CartItem {
  key: string;
  isCustom: boolean;
  productId?: string;
  variantId?: string | null;
  name?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  instructions: string;
  modifiers: never[];
}

interface Quote {
  items: Array<{
    productId: string | null;
    variantId: string | null;
    name: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    itemTotal: number;
    isCustom: boolean;
    available: number | null;
  }>;
  subtotal: number;
  discountAmount: number;
  surchargeAmount: number;
  tipAmount: number;
  deliveryFee: number;
  serviceFee: number;
  totalAmount: number;
  estimatedMinutes: number;
  warnings: string[];
  canConfirm: boolean;
}

interface DraftRow {
  id: string;
  title: string;
  payload: Record<string, unknown>;
  version: number;
  updated_at: string;
}

interface FormState {
  businessId: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNotes: string;
  deliveryType: 'delivery' | 'pickup';
  addressStreet: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  addressInstructions: string;
  latitude: string;
  longitude: string;
  distanceKm: string;
  durationMinutes: string;
  deliveryFee: string;
  deliveryFeeOverridden: boolean;
  deliveryFeeOverrideReason: string;
  paymentMethod: 'cash' | 'transfer' | 'credit_card' | 'debit_card' | 'wallet';
  paymentStatus: 'pending' | 'pending_verification' | 'completed' | 'failed';
  paymentReference: string;
  paymentNotes: string;
  amountPaid: string;
  salesChannel: 'whatsapp' | 'phone' | 'in_person' | 'instagram' | 'facebook' | 'direct_message' | 'other';
  salesChannelOther: string;
  initialStatus: 'pending' | 'confirmed';
  courierId: string;
  discountAmount: string;
  surchargeAmount: string;
  tipAmount: string;
  kitchenNotes: string;
  courierNotes: string;
  internalNotes: string;
  generalNotes: string;
  administrativeReason: string;
  adminOverride: boolean;
  addressWarningConfirmed: boolean;
  rawExternalText: string;
}

const initialForm: FormState = {
  businessId: '',
  branchId: '',
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerNotes: '',
  deliveryType: 'delivery',
  addressStreet: '',
  addressComplement: '',
  neighborhood: '',
  city: 'Santa Marta',
  addressInstructions: '',
  latitude: '',
  longitude: '',
  distanceKm: '',
  durationMinutes: '',
  deliveryFee: '',
  deliveryFeeOverridden: false,
  deliveryFeeOverrideReason: '',
  paymentMethod: 'cash',
  paymentStatus: 'pending',
  paymentReference: '',
  paymentNotes: '',
  amountPaid: '0',
  salesChannel: 'whatsapp',
  salesChannelOther: '',
  initialStatus: 'confirmed',
  courierId: '',
  discountAmount: '0',
  surchargeAmount: '0',
  tipAmount: '0',
  kitchenNotes: '',
  courierNotes: '',
  internalNotes: '',
  generalNotes: '',
  administrativeReason: '',
  adminOverride: false,
  addressWarningConfirmed: false,
  rawExternalText: '',
};

const money = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(value || 0);

const numberValue = (value: string) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground';

function buildIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `manual:${crypto.randomUUID()}`;
  return `manual:${Date.now()}:${Math.random().toString(36).slice(2, 14)}`;
}

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const issues = Array.isArray(body.issues)
      ? body.issues.map((issue) => String((issue as { message?: unknown }).message || '')).filter(Boolean)
      : [];
    throw new Error(issues[0] || String(body.error || 'No se pudo completar la solicitud.'));
  }
  return body as T;
}

function Section(props: { title: string; icon: React.ReactNode; children: React.ReactNode; description?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">{props.icon}</div>
        <div>
          <h2 className="font-black text-foreground">{props.title}</h2>
          {props.description && <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>}
        </div>
      </div>
      {props.children}
    </section>
  );
}

export function ManualOrderWizard({ mode }: { mode: 'admin' | 'merchant' }) {
  const router = useRouter();
  const [bootstrap, setBootstrap] = React.useState<BootstrapData | null>(null);
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [calculating, setCalculating] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState('');
  const [customerSearch, setCustomerSearch] = React.useState('');
  const [customers, setCustomers] = React.useState<CustomerResult[]>([]);
  const [searchingCustomers, setSearchingCustomers] = React.useState(false);
  const [drafts, setDrafts] = React.useState<DraftRow[]>([]);
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [draftVersion, setDraftVersion] = React.useState(1);
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [showSummary, setShowSummary] = React.useState(false);
  const idempotencyRef = React.useRef(buildIdempotencyKey());
  const dirtyRef = React.useRef(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    dirtyRef.current = true;
    setQuote(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadBootstrap = React.useCallback(async (businessId?: string) => {
    setLoading(true);
    try {
      const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : '';
      const data = await jsonRequest<BootstrapData>(`/api/manual-orders/bootstrap${query}`);
      setBootstrap(data);
      setForm((current) => ({
        ...current,
        businessId: data.business?.id || '',
        branchId: data.branches.find((branch) => branch.is_primary)?.id || data.branches[0]?.id || '',
      }));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo iniciar el formulario.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrafts = React.useCallback(async (businessId?: string) => {
    try {
      const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : '';
      const data = await jsonRequest<{ drafts: DraftRow[] }>(`/api/manual-orders/drafts${query}`);
      setDrafts(data.drafts);
    } catch {
      setDrafts([]);
    }
  }, []);

  React.useEffect(() => {
    void loadBootstrap();
    void loadDrafts();
  }, [loadBootstrap, loadDrafts]);

  React.useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || confirming) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [confirming]);

  const selectBusiness = async (businessId: string) => {
    update('businessId', businessId);
    setItems([]);
    setQuote(null);
    setDraftId(null);
    setDraftVersion(1);
    await loadBootstrap(businessId);
    await loadDrafts(businessId);
  };

  const selectCustomer = (customer: CustomerResult) => {
    setForm((current) => ({
      ...current,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
    }));
    setCustomers([]);
    setCustomerSearch('');
    setQuote(null);
    dirtyRef.current = true;
  };

  const clearRegisteredCustomer = () => {
    setForm((current) => ({ ...current, customerId: '', customerName: '', customerPhone: '', customerEmail: '' }));
    setQuote(null);
  };

  const searchCustomers = async () => {
    if (customerSearch.trim().length < 2 || !form.businessId) return;
    setSearchingCustomers(true);
    try {
      const data = await jsonRequest<{ customers: CustomerResult[] }>(
        `/api/manual-orders/customers?q=${encodeURIComponent(customerSearch)}&businessId=${encodeURIComponent(form.businessId)}`,
      );
      setCustomers(data.customers);
      if (!data.customers.length) toast.info('No se encontraron clientes registrados. Puedes continuar como invitado.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudieron buscar clientes.');
    } finally {
      setSearchingCustomers(false);
    }
  };

  const addProduct = (product: ProductOption) => {
    const existing = items.find((item) => !item.isCustom && item.productId === product.id && !item.variantId);
    if (existing) {
      setItems((current) => current.map((item) => item.key === existing.key
        ? { ...item, quantity: Math.min(99, item.quantity + 1) }
        : item));
    } else {
      setItems((current) => [...current, {
        key: `product:${product.id}:${Date.now()}`,
        isCustom: false,
        productId: product.id,
        variantId: null,
        quantity: 1,
        instructions: '',
        modifiers: [],
      }]);
    }
    setQuote(null);
    dirtyRef.current = true;
  };

  const addCustomProduct = () => {
    setItems((current) => [...current, {
      key: `custom:${Date.now()}`,
      isCustom: true,
      name: 'Artículo personalizado',
      description: '',
      quantity: 1,
      unitPrice: 0,
      instructions: '',
      modifiers: [],
    }]);
    setQuote(null);
    dirtyRef.current = true;
  };

  const changeItem = (key: string, patch: Partial<CartItem>) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
    setQuote(null);
    dirtyRef.current = true;
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
    setQuote(null);
    dirtyRef.current = true;
  };

  const payload = React.useMemo(() => ({
    draftId,
    businessId: form.businessId,
    branchId: form.branchId || null,
    customerId: form.customerId || null,
    customer: {
      name: form.customerName,
      phone: form.customerPhone,
      email: form.customerEmail,
      notes: form.customerNotes,
    },
    addressId: null,
    address: {
      street: [form.addressStreet, form.addressComplement].filter(Boolean).join(', '),
      complement: form.addressComplement,
      neighborhood: form.neighborhood,
      city: form.city,
      state: 'Magdalena',
      instructions: form.addressInstructions,
      formattedAddress: '',
      placeId: '',
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    },
    items: items.map((item) => item.isCustom ? {
      isCustom: true as const,
      name: item.name || 'Artículo personalizado',
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      instructions: item.instructions,
      modifiers: [],
    } : {
      isCustom: false as const,
      productId: item.productId || '',
      variantId: item.variantId || null,
      quantity: item.quantity,
      instructions: item.instructions,
      modifiers: [],
    }),
    deliveryType: form.deliveryType,
    distanceKm: Number(form.distanceKm || 0),
    durationMinutes: Math.round(Number(form.durationMinutes || 0)),
    deliveryFee: numberValue(form.deliveryFee),
    deliveryFeeOverridden: form.deliveryFeeOverridden,
    deliveryFeeOverrideReason: form.deliveryFeeOverrideReason,
    paymentMethod: form.paymentMethod,
    paymentStatus: form.paymentStatus,
    paymentReference: form.paymentReference,
    paymentNotes: form.paymentNotes,
    amountPaid: numberValue(form.amountPaid),
    salesChannel: form.salesChannel,
    salesChannelOther: form.salesChannelOther,
    initialStatus: form.initialStatus,
    courierId: form.courierId || null,
    discountAmount: numberValue(form.discountAmount),
    surchargeAmount: numberValue(form.surchargeAmount),
    tipAmount: numberValue(form.tipAmount),
    kitchenNotes: form.kitchenNotes,
    courierNotes: form.courierNotes,
    internalNotes: form.internalNotes,
    generalNotes: form.generalNotes,
    administrativeReason: form.administrativeReason,
    adminOverride: form.adminOverride,
    addressWarningConfirmed: form.addressWarningConfirmed,
    rawExternalText: form.rawExternalText,
  }), [draftId, form, items]);

  const calculate = async () => {
    setCalculating(true);
    try {
      const data = await jsonRequest<{ quote: Quote }>('/api/manual-orders/quote', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setQuote(data.quote);
      setForm((current) => ({ ...current, deliveryFee: String(data.quote.deliveryFee) }));
      setShowSummary(true);
      toast.success('Valores verificados en el servidor.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo calcular el pedido.');
    } finally {
      setCalculating(false);
    }
  };

  const saveDraft = async () => {
    if (!form.businessId) return toast.error('Selecciona un negocio antes de guardar.');
    setSavingDraft(true);
    try {
      const title = `${form.customerName || 'Cliente pendiente'} · ${new Date().toLocaleDateString('es-CO')}`;
      const data = await jsonRequest<{ draft: { id: string; version: number } }>('/api/manual-orders/drafts', {
        method: 'POST',
        body: JSON.stringify({
          id: draftId,
          businessId: form.businessId,
          branchId: form.branchId || null,
          title,
          payload,
          version: draftVersion,
        }),
      });
      setDraftId(data.draft.id);
      setDraftVersion(data.draft.version);
      dirtyRef.current = false;
      await loadDrafts(form.businessId);
      toast.success('Borrador guardado. No se reservó inventario ni se generó cobro.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar el borrador.');
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraft = (draft: DraftRow) => {
    const saved = draft.payload as Partial<ReturnType<typeof Object>> & Record<string, unknown>;
    const savedCustomer = (saved.customer || {}) as Record<string, unknown>;
    const savedAddress = (saved.address || {}) as Record<string, unknown>;
    const savedItems = Array.isArray(saved.items) ? saved.items as Array<Record<string, unknown>> : [];
    setForm((current) => ({
      ...current,
      businessId: String(saved.businessId || current.businessId),
      branchId: String(saved.branchId || ''),
      customerId: String(saved.customerId || ''),
      customerName: String(savedCustomer.name || ''),
      customerPhone: String(savedCustomer.phone || ''),
      customerEmail: String(savedCustomer.email || ''),
      customerNotes: String(savedCustomer.notes || ''),
      deliveryType: saved.deliveryType === 'pickup' ? 'pickup' : 'delivery',
      addressStreet: String(savedAddress.street || ''),
      addressComplement: String(savedAddress.complement || ''),
      neighborhood: String(savedAddress.neighborhood || ''),
      city: String(savedAddress.city || 'Santa Marta'),
      addressInstructions: String(savedAddress.instructions || ''),
      latitude: savedAddress.latitude == null ? '' : String(savedAddress.latitude),
      longitude: savedAddress.longitude == null ? '' : String(savedAddress.longitude),
      distanceKm: String(saved.distanceKm || ''),
      durationMinutes: String(saved.durationMinutes || ''),
      deliveryFee: String(saved.deliveryFee || ''),
      deliveryFeeOverridden: Boolean(saved.deliveryFeeOverridden),
      deliveryFeeOverrideReason: String(saved.deliveryFeeOverrideReason || ''),
      paymentMethod: (saved.paymentMethod as FormState['paymentMethod']) || 'cash',
      paymentStatus: (saved.paymentStatus as FormState['paymentStatus']) || 'pending',
      paymentReference: String(saved.paymentReference || ''),
      paymentNotes: String(saved.paymentNotes || ''),
      amountPaid: String(saved.amountPaid || 0),
      salesChannel: (saved.salesChannel as FormState['salesChannel']) || 'whatsapp',
      salesChannelOther: String(saved.salesChannelOther || ''),
      initialStatus: saved.initialStatus === 'pending' ? 'pending' : 'confirmed',
      courierId: String(saved.courierId || ''),
      discountAmount: String(saved.discountAmount || 0),
      surchargeAmount: String(saved.surchargeAmount || 0),
      tipAmount: String(saved.tipAmount || 0),
      kitchenNotes: String(saved.kitchenNotes || ''),
      courierNotes: String(saved.courierNotes || ''),
      internalNotes: String(saved.internalNotes || ''),
      generalNotes: String(saved.generalNotes || ''),
      administrativeReason: String(saved.administrativeReason || ''),
      adminOverride: Boolean(saved.adminOverride),
      addressWarningConfirmed: Boolean(saved.addressWarningConfirmed),
      rawExternalText: String(saved.rawExternalText || ''),
    }));
    setItems(savedItems.map((item, index) => ({
      key: `draft:${draft.id}:${index}`,
      isCustom: Boolean(item.isCustom),
      productId: item.productId ? String(item.productId) : undefined,
      variantId: item.variantId ? String(item.variantId) : null,
      name: item.name ? String(item.name) : undefined,
      description: item.description ? String(item.description) : undefined,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      instructions: String(item.instructions || ''),
      modifiers: [],
    })));
    setDraftId(draft.id);
    setDraftVersion(draft.version);
    setQuote(null);
    dirtyRef.current = false;
    toast.success('Borrador recuperado.');
  };

  const deleteDraft = async (draft: DraftRow) => {
    try {
      await jsonRequest(`/api/manual-orders/drafts/${draft.id}`, { method: 'DELETE' });
      if (draftId === draft.id) {
        setDraftId(null);
        setDraftVersion(1);
      }
      await loadDrafts(form.businessId);
      toast.success('Borrador eliminado.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo eliminar el borrador.');
    }
  };

  const confirm = async () => {
    if (!quote) return toast.error('Calcula y revisa el pedido antes de confirmarlo.');
    if (!quote.canConfirm) return toast.error('Existen advertencias que impiden confirmar el pedido.');
    setConfirming(true);
    try {
      const data = await jsonRequest<{ order: { orderId: string; orderNumber: string; totalAmount: number; idempotent: boolean } }>(
        '/api/manual-orders/confirm',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyRef.current },
          body: JSON.stringify(payload),
        },
      );
      dirtyRef.current = false;
      toast.success(`Pedido ${data.order.orderNumber} creado por ${money(data.order.totalAmount)}.`);
      const destination = mode === 'admin' ? '/admin/pedidos' : '/negocio/pedidos';
      router.push(destination);
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo confirmar el pedido.');
    } finally {
      setConfirming(false);
    }
  };

  const filteredProducts = (bootstrap?.products || []).filter((product) => {
    const term = productSearch.trim().toLocaleLowerCase('es');
    if (!term) return true;
    return `${product.name} ${product.sku} ${product.categoryName}`.toLocaleLowerCase('es').includes(term);
  }).slice(0, 30);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!bootstrap?.business && mode === 'merchant') {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm">
        No se encontró un negocio asociado a esta cuenta. Completa primero la configuración del negocio.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-28 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <PackagePlus className="h-4 w-4" /> Pedido externo
          </div>
          <h1 className="text-2xl font-black text-foreground sm:text-3xl">Crear pedido manual</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Registra un pedido de WhatsApp, llamada, atención presencial o redes sociales. Los valores e inventario se verifican nuevamente en el servidor.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={mode === 'admin' ? '/admin/pedidos' : '/negocio/pedidos'} className="rounded-xl border px-4 py-2 text-sm font-bold">Cancelar</Link>
          <button type="button" onClick={() => void saveDraft()} disabled={savingDraft} className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-bold disabled:opacity-50">
            {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar borrador
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2 font-bold"><ClipboardList className="h-4 w-4 text-primary" /> Borradores recientes</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {drafts.map((draft) => (
              <div key={draft.id} className="min-w-[230px] rounded-xl border bg-card p-3">
                <p className="truncate text-sm font-bold">{draft.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(draft.updated_at).toLocaleString('es-CO')}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => loadDraft(draft)} className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground">Reanudar</button>
                  <button type="button" onClick={() => void deleteDraft(draft)} aria-label="Eliminar borrador" className="rounded-lg bg-destructive/10 px-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Section title="Negocio y canal" icon={<ClipboardList className="h-5 w-5" />} description="El comercio queda limitado a su propio negocio; administración puede seleccionar uno autorizado.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Negocio</label>
                <select value={form.businessId} disabled={mode === 'merchant'} onChange={(event) => void selectBusiness(event.target.value)} className={inputClass}>
                  <option value="">Seleccionar</option>
                  {bootstrap.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Sucursal</label>
                <select value={form.branchId} onChange={(event) => update('branchId', event.target.value)} className={inputClass}>
                  <option value="">Seleccionar</option>
                  {bootstrap.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.street_address}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Canal de origen</label>
                <select value={form.salesChannel} onChange={(event) => update('salesChannel', event.target.value as FormState['salesChannel'])} className={inputClass}>
                  <option value="whatsapp">WhatsApp</option><option value="phone">Llamada</option><option value="in_person">Presencial</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="direct_message">Mensaje directo</option><option value="other">Otro</option>
                </select>
              </div>
              {form.salesChannel === 'other' && <div><label className={labelClass}>Descripción del canal</label><input value={form.salesChannelOther} onChange={(event) => update('salesChannelOther', event.target.value)} className={inputClass} /></div>}
            </div>
          </Section>

          <Section title="Cliente" icon={<UserRound className="h-5 w-5" />} description="Vincula un cliente existente o continúa como invitado sin crearle una cuenta de acceso.">
            <div className="mb-4 flex gap-2">
              <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), void searchCustomers())} placeholder="Buscar por nombre, teléfono o correo" className={inputClass} />
              <button type="button" onClick={() => void searchCustomers()} disabled={searchingCustomers} className="rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50">{searchingCustomers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
            </div>
            {customers.length > 0 && <div className="mb-4 grid gap-2 sm:grid-cols-2">{customers.map((customer) => <button type="button" key={customer.id} onClick={() => selectCustomer(customer)} className="rounded-xl border p-3 text-left hover:border-primary"><p className="font-bold">{customer.name}</p><p className="text-xs text-muted-foreground">{customer.phone || customer.email} · {customer.status}</p></button>)}</div>}
            {form.customerId && <div className="mb-4 flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-3 text-sm"><span><CheckCircle2 className="mr-2 inline h-4 w-4 text-success" />Cliente registrado vinculado</span><button type="button" onClick={clearRegisteredCustomer} className="text-xs font-bold text-destructive">Usar invitado</button></div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Nombre completo</label><input value={form.customerName} disabled={Boolean(form.customerId)} onChange={(event) => update('customerName', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Teléfono</label><input value={form.customerPhone} disabled={Boolean(form.customerId)} inputMode="tel" onChange={(event) => update('customerPhone', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Correo opcional</label><input value={form.customerEmail} disabled={Boolean(form.customerId)} type="email" onChange={(event) => update('customerEmail', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Notas del cliente</label><input value={form.customerNotes} onChange={(event) => update('customerNotes', event.target.value)} className={inputClass} /></div>
            </div>
          </Section>

          <Section title="Entrega" icon={<MapPin className="h-5 w-5" />} description="La tarifa siempre se cobra al cliente. Recoger en el local elimina domicilio y repartidor.">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => update('deliveryType', 'delivery')} className={`rounded-xl border p-3 text-sm font-bold ${form.deliveryType === 'delivery' ? 'border-primary bg-primary/10 text-primary' : ''}`}>A domicilio</button>
              <button type="button" onClick={() => { update('deliveryType', 'pickup'); update('courierId', ''); update('deliveryFee', '0'); }} className={`rounded-xl border p-3 text-sm font-bold ${form.deliveryType === 'pickup' ? 'border-primary bg-primary/10 text-primary' : ''}`}>Recoger en el local</button>
            </div>
            {form.deliveryType === 'delivery' && <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={labelClass}>Dirección</label><input value={form.addressStreet} onChange={(event) => update('addressStreet', event.target.value)} placeholder="Calle, carrera, número" className={inputClass} /></div>
              <div><label className={labelClass}>Complemento</label><input value={form.addressComplement} onChange={(event) => update('addressComplement', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Barrio o sector</label><input value={form.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Ciudad</label><input value={form.city} onChange={(event) => update('city', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Referencia</label><input value={form.addressInstructions} onChange={(event) => update('addressInstructions', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Distancia km opcional</label><input type="number" min="0" step="0.1" value={form.distanceKm} onChange={(event) => update('distanceKm', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Duración minutos</label><input type="number" min="0" value={form.durationMinutes} onChange={(event) => update('durationMinutes', event.target.value)} className={inputClass} /></div>
              {!form.latitude && !form.longitude && <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"><input type="checkbox" checked={form.addressWarningConfirmed} onChange={(event) => update('addressWarningConfirmed', event.target.checked)} className="mt-1" /><span>Confirmo que revisé la dirección aunque no tiene coordenadas. El servidor aplicará una tarifa de respaldo cuando no exista distancia.</span></label>}
              {bootstrap.business?.allowDeliveryFeeOverride && <label className="sm:col-span-2 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.deliveryFeeOverridden} onChange={(event) => update('deliveryFeeOverridden', event.target.checked)} />Ingresar tarifa manual con motivo</label>}
              {form.deliveryFeeOverridden && <><div><label className={labelClass}>Tarifa manual</label><input type="number" min="0" value={form.deliveryFee} onChange={(event) => update('deliveryFee', event.target.value)} className={inputClass} /></div><div><label className={labelClass}>Motivo obligatorio</label><input value={form.deliveryFeeOverrideReason} onChange={(event) => update('deliveryFeeOverrideReason', event.target.value)} className={inputClass} /></div></>}
            </div>}
          </Section>

          <Section title="Productos" icon={<ShoppingCart className="h-5 w-5" />} description="El precio visible es informativo. El servidor vuelve a consultar precio, descuento e inventario al confirmar.">
            <div className="mb-4 flex gap-2"><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar nombre, categoría o SKU" className={inputClass} />{bootstrap.business?.allowCustomProducts && <button type="button" onClick={addCustomProduct} className="inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 text-xs font-bold"><Plus className="h-4 w-4" />Personalizado</button>}</div>
            <div className="mb-5 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {filteredProducts.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)} disabled={product.status !== 'available' || product.quantityAvailable < 1} className="flex items-center justify-between rounded-xl border p-3 text-left disabled:opacity-50"><div><p className="font-bold">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku} · stock {product.quantityAvailable}</p></div><strong className="text-sm text-primary">{money(product.discountPrice ?? product.price)}</strong></button>)}
            </div>
            <div className="space-y-3">
              {items.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Agrega al menos un producto.</div>}
              {items.map((item) => {
                const product = bootstrap.products.find((value) => value.id === item.productId);
                const variants = bootstrap.variants.filter((variant) => variant.product_id === item.productId && variant.is_active);
                return <div key={item.key} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">{item.isCustom ? <input value={item.name || ''} onChange={(event) => changeItem(item.key, { name: event.target.value })} className={inputClass} /> : <p className="font-bold">{product?.name || 'Producto'}</p>}<p className="mt-1 text-xs text-muted-foreground">{item.isCustom ? 'No se añadirá al catálogo' : `${product?.sku || ''} · disponible ${product?.quantityAvailable ?? 0}`}</p></div><button type="button" onClick={() => removeItem(item.key)} aria-label="Eliminar producto" className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3"><div><label className={labelClass}>Cantidad</label><input type="number" min="1" max="99" value={item.quantity} onChange={(event) => changeItem(item.key, { quantity: Math.max(1, Number(event.target.value || 1)) })} className={inputClass} /></div>{item.isCustom ? <div><label className={labelClass}>Precio unitario</label><input type="number" min="0" value={item.unitPrice || 0} onChange={(event) => changeItem(item.key, { unitPrice: numberValue(event.target.value) })} className={inputClass} /></div> : variants.length > 0 ? <div><label className={labelClass}>Variante</label><select value={item.variantId || ''} onChange={(event) => changeItem(item.key, { variantId: event.target.value || null })} className={inputClass}><option value="">Sin variante</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · stock {variant.quantity_available} · +{money(Number(variant.price_modifier || 0))}</option>)}</select></div> : <div />}<div><label className={labelClass}>Instrucción</label><input value={item.instructions} onChange={(event) => changeItem(item.key, { instructions: event.target.value })} className={inputClass} /></div></div>
                </div>;
              })}
            </div>
          </Section>

          <Section title="Pago, notas y operación" icon={<ChevronRight className="h-5 w-5" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Método de pago</label><select value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value as FormState['paymentMethod'])} className={inputClass}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="credit_card">Tarjeta de crédito</option><option value="debit_card">Tarjeta débito</option><option value="wallet">Billetera</option></select></div>
              <div><label className={labelClass}>Estado del pago</label><select value={form.paymentStatus} onChange={(event) => update('paymentStatus', event.target.value as FormState['paymentStatus'])} className={inputClass}><option value="pending">Pendiente</option><option value="pending_verification">Pendiente de verificación</option><option value="completed">Pagado</option><option value="failed">Fallido</option></select></div>
              <div><label className={labelClass}>Referencia externa</label><input value={form.paymentReference} onChange={(event) => update('paymentReference', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Valor pagado</label><input type="number" min="0" value={form.amountPaid} onChange={(event) => update('amountPaid', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Notas para cocina</label><textarea value={form.kitchenNotes} onChange={(event) => update('kitchenNotes', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Notas para repartidor</label><textarea value={form.courierNotes} onChange={(event) => update('courierNotes', event.target.value)} className={inputClass} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Notas internas</label><textarea value={form.internalNotes} onChange={(event) => update('internalNotes', event.target.value)} className={inputClass} /></div>
              {mode === 'admin' && <><div><label className={labelClass}>Estado inicial</label><select value={form.initialStatus} onChange={(event) => update('initialStatus', event.target.value as FormState['initialStatus'])} className={inputClass}><option value="confirmed">Confirmado</option><option value="pending">Pendiente</option></select></div><div><label className={labelClass}>Repartidor opcional</label><select value={form.courierId} disabled={form.deliveryType === 'pickup'} onChange={(event) => update('courierId', event.target.value)} className={inputClass}><option value="">Búsqueda pública</option>{bootstrap.couriers.filter((courier) => courier.eligible).map((courier) => <option key={courier.id} value={courier.id}>{courier.name} · {courier.status}</option>)}</select></div><div><label className={labelClass}>Descuento autorizado</label><input type="number" min="0" value={form.discountAmount} onChange={(event) => update('discountAmount', event.target.value)} className={inputClass} /></div><div><label className={labelClass}>Recargo autorizado</label><input type="number" min="0" value={form.surchargeAmount} onChange={(event) => update('surchargeAmount', event.target.value)} className={inputClass} /></div><label className="sm:col-span-2 flex items-center gap-2 rounded-xl border p-3 text-sm font-bold"><input type="checkbox" checked={form.adminOverride} onChange={(event) => update('adminOverride', event.target.checked)} />Continuar ante restricciones operativas con motivo</label><div className="sm:col-span-2"><label className={labelClass}>Motivo administrativo</label><textarea value={form.administrativeReason} onChange={(event) => update('administrativeReason', event.target.value)} className={inputClass} /></div></>}
              <div><label className={labelClass}>Propina</label><input type="number" min="0" value={form.tipAmount} onChange={(event) => update('tipAmount', event.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Notas del pago</label><input value={form.paymentNotes} onChange={(event) => update('paymentNotes', event.target.value)} className={inputClass} /></div>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Resumen</h2><button type="button" onClick={() => setShowSummary(!showSummary)} className="lg:hidden"><ChevronRight className={`h-5 w-5 transition ${showSummary ? 'rotate-90' : ''}`} /></button></div>
            <div className={`${showSummary ? 'block' : 'hidden'} mt-4 space-y-4 lg:block`}>
              {!quote ? <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Calcula el pedido para verificar precios, inventario, tarifa y total.</div> : <><div className="space-y-2">{quote.items.map((item, index) => <div key={`${item.productId || 'custom'}-${index}`} className="flex justify-between gap-3 text-sm"><span>{item.quantity}x {item.name}</span><strong>{money(item.itemTotal)}</strong></div>)}</div><div className="space-y-2 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>{quote.discountAmount > 0 && <div className="flex justify-between text-success"><span>Descuento</span><span>-{money(quote.discountAmount)}</span></div>}{quote.surchargeAmount > 0 && <div className="flex justify-between"><span>Recargo</span><span>{money(quote.surchargeAmount)}</span></div>}<div className="flex justify-between"><span>Domicilio</span><span>{money(quote.deliveryFee)}</span></div><div className="flex justify-between"><span>Servicio DomiU</span><span>{money(quote.serviceFee)}</span></div>{quote.tipAmount > 0 && <div className="flex justify-between"><span>Propina</span><span>{money(quote.tipAmount)}</span></div>}<div className="flex justify-between border-t pt-3 text-lg font-black"><span>Total</span><span>{money(quote.totalAmount)}</span></div><p className="text-xs text-muted-foreground">Tiempo estimado: {quote.estimatedMinutes} minutos</p></div>{quote.warnings.length > 0 && <div className="space-y-2">{quote.warnings.map((warning) => <div key={warning} className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" />{warning}</div>)}</div>}</>}
              <button type="button" onClick={() => void calculate()} disabled={calculating || items.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-black text-primary disabled:opacity-50">{calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Calcular y validar</button>
              <button type="button" onClick={() => void confirm()} disabled={confirming || !quote?.canConfirm} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50">{confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Confirmar y crear pedido</button>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">La confirmación descuenta inventario atómicamente. Un doble clic o reintento reutiliza la misma clave y no duplica el pedido.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-2"><button type="button" onClick={() => void calculate()} disabled={calculating || items.length === 0} className="flex-1 rounded-xl border border-primary py-3 text-sm font-black text-primary disabled:opacity-50">Calcular</button><button type="button" onClick={() => void confirm()} disabled={confirming || !quote?.canConfirm} className="flex-1 rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">Confirmar</button></div>
      </div>
    </div>
  );
}
