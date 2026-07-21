'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  createManualOrderAction,
  deleteManualOrderDraftAction,
  getManualOrderContextAction,
  getManualOrderProductsAction,
  loadManualOrderDraftAction,
  saveManualOrderDraftAction,
  searchManualOrderCustomersAction,
} from '@/app/actions/manual-orders';
import { calculateDeliveryPrice } from '@/lib/orders/delivery-pricing';
import type { ManualOrderPanel, ManualOrderRequest } from '@/lib/orders/manual-order-domain';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackagePlus,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  UserRoundSearch,
} from 'lucide-react';

interface BusinessOption {
  id: string;
  name: string;
  isActive: boolean;
  isVerified: boolean;
  allowCustomItems: boolean;
}

interface ProductOption {
  id: string;
  businessId: string;
  sku: string;
  name: string;
  price: number;
  availableQuantity: number;
  status: string;
  categoryName: string;
}

interface CartLine {
  key: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  isCustomItem: boolean;
  instructions: string;
}

interface CustomerResult {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface WorkspaceState {
  businessId: string;
  customerKind: 'guest' | 'registered';
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNotes: string;
  deliveryType: 'delivery' | 'pickup';
  address: string;
  complement: string;
  neighborhood: string;
  city: string;
  reference: string;
  distanceKm: string;
  deliveryFeeSource: 'automatic' | 'manual' | 'not_applicable';
  deliveryFeeAmount: string;
  deliveryFeeReason: string;
  salesChannel: ManualOrderRequest['salesChannel'];
  salesChannelDetail: string;
  paymentMethod: ManualOrderRequest['paymentMethod'];
  paymentStatus: 'pending' | 'completed';
  paidAmount: string;
  initialStatus: 'pending' | 'confirmed';
  preparationNotes: string;
  courierNotes: string;
  internalNotes: string;
  adminReason: string;
  tipAmount: string;
  surchargeAmount: string;
  productSearch: string;
  customerSearch: string;
  customName: string;
  customPrice: string;
  customQuantity: string;
}

const EMPTY_STATE: WorkspaceState = {
  businessId: '',
  customerKind: 'guest',
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerNotes: '',
  deliveryType: 'delivery',
  address: '',
  complement: '',
  neighborhood: '',
  city: 'Santa Marta',
  reference: '',
  distanceKm: '',
  deliveryFeeSource: 'automatic',
  deliveryFeeAmount: '0',
  deliveryFeeReason: '',
  salesChannel: 'whatsapp',
  salesChannelDetail: '',
  paymentMethod: 'cash',
  paymentStatus: 'pending',
  paidAmount: '0',
  initialStatus: 'confirmed',
  preparationNotes: '',
  courierNotes: '',
  internalNotes: '',
  adminReason: '',
  tipAmount: '0',
  surchargeAmount: '0',
  productSearch: '',
  customerSearch: '',
  customName: '',
  customPrice: '',
  customQuantity: '1',
};

const inputClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';
const labelClass = 'mb-1 block text-xs font-semibold text-muted-foreground';
const sectionClass = 'space-y-4 rounded-2xl border bg-card p-4 shadow-sm';

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function toInteger(value: string): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function ManualOrderWorkspace({ panel }: { panel: ManualOrderPanel }) {
  const router = useRouter();
  const [state, setState] = React.useState<WorkspaceState>(EMPTY_STATE);
  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [customerResults, setCustomerResults] = React.useState<CustomerResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [searchingCustomers, setSearchingCustomers] = React.useState(false);
  const [draftRecovered, setDraftRecovered] = React.useState(false);
  const [idempotencyKey, setIdempotencyKey] = React.useState('');

  const patch = <K extends keyof WorkspaceState>(key: K, value: WorkspaceState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  React.useEffect(() => {
    setIdempotencyKey(globalThis.crypto?.randomUUID?.() || '');
    void (async () => {
      const context = await getManualOrderContextAction(panel);
      if (!context.success) {
        toast.error(context.error || 'No se pudo cargar el formulario');
        setLoading(false);
        return;
      }
      setBusinesses(context.businesses);
      const firstBusiness = panel === 'business' ? context.businesses[0] : undefined;
      if (firstBusiness) setState((current) => ({ ...current, businessId: firstBusiness.id }));
      setLoading(false);
    })();
  }, [panel]);

  React.useEffect(() => {
    if (!state.businessId) {
      setProducts([]);
      return;
    }
    setLoadingProducts(true);
    void (async () => {
      const result = await getManualOrderProductsAction(panel, state.businessId);
      setLoadingProducts(false);
      if (!result.success) {
        toast.error(result.error || 'No se pudieron cargar los productos');
        return;
      }
      setProducts(result.products);

      const draftResult = await loadManualOrderDraftAction(panel, state.businessId);
      if (draftResult.success && draftResult.draft && !draftRecovered) {
        const payload = draftResult.draft.payload as { state?: WorkspaceState; cart?: CartLine[] };
        if (payload.state) setState((current) => ({ ...current, ...payload.state, businessId: state.businessId }));
        if (Array.isArray(payload.cart)) setCart(payload.cart);
        setDraftRecovered(true);
        toast.info('Se recuperó tu borrador de pedido manual');
      }
    })();
  }, [draftRecovered, panel, state.businessId]);

  React.useEffect(() => {
    if (state.deliveryType === 'pickup') {
      setState((current) => ({
        ...current,
        deliveryFeeSource: 'not_applicable',
        deliveryFeeAmount: '0',
        distanceKm: '',
      }));
      return;
    }
    if (state.deliveryFeeSource === 'not_applicable') {
      patch('deliveryFeeSource', 'automatic');
    }
  }, [state.deliveryType]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (state.deliveryType !== 'delivery' || state.deliveryFeeSource !== 'automatic') return;
    const distance = Number(state.distanceKm || 0);
    const calculated = calculateDeliveryPrice(distance).finalPrice;
    patch('deliveryFeeAmount', String(calculated));
  }, [state.deliveryFeeSource, state.deliveryType, state.distanceKm]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBusiness = businesses.find((business) => business.id === state.businessId);
  const filteredProducts = products.filter((product) => {
    const query = state.productSearch.trim().toLowerCase();
    if (!query) return true;
    return `${product.name} ${product.sku} ${product.categoryName}`.toLowerCase().includes(query);
  });

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const deliveryFee = state.deliveryType === 'pickup' ? 0 : toInteger(state.deliveryFeeAmount);
  const tip = toInteger(state.tipAmount);
  const surcharge = toInteger(state.surchargeAmount);
  const total = subtotal + deliveryFee + tip + surcharge;

  const addProduct = (product: ProductOption) => {
    if (product.status !== 'available' || product.availableQuantity <= 0) {
      toast.error('Este producto no está disponible');
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.availableQuantity) {
          toast.warning('No hay más unidades disponibles');
          return current;
        }
        return current.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          key: product.id,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          isCustomItem: false,
          instructions: '',
        },
      ];
    });
  };

  const addCustomItem = () => {
    const name = state.customName.trim();
    const price = toInteger(state.customPrice);
    const quantity = Math.max(1, toInteger(state.customQuantity));
    if (!name || price <= 0) {
      toast.error('Escribe el nombre y precio del artículo personalizado');
      return;
    }
    setCart((current) => [
      ...current,
      {
        key: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        price,
        quantity,
        isCustomItem: true,
        instructions: '',
      },
    ]);
    setState((current) => ({ ...current, customName: '', customPrice: '', customQuantity: '1' }));
  };

  const updateLine = (key: string, changes: Partial<CartLine>) => {
    setCart((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...changes };
        if (next.productId) {
          const product = products.find((item) => item.id === next.productId);
          next.quantity = Math.min(Math.max(1, next.quantity), product?.availableQuantity || 1);
        } else {
          next.quantity = Math.min(Math.max(1, next.quantity), 99);
        }
        return next;
      }),
    );
  };

  const searchCustomers = async () => {
    if (!state.businessId || state.customerSearch.trim().length < 3) {
      toast.warning('Escribe al menos 3 caracteres');
      return;
    }
    setSearchingCustomers(true);
    const result = await searchManualOrderCustomersAction(panel, state.businessId, state.customerSearch);
    setSearchingCustomers(false);
    if (!result.success) {
      toast.error(result.error || 'No se pudo buscar el cliente');
      return;
    }
    setCustomerResults(result.customers);
    if (result.customers.length === 0) toast.info('No se encontraron clientes registrados');
  };

  const selectCustomer = (customer: CustomerResult) => {
    setState((current) => ({
      ...current,
      customerKind: 'registered',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
    }));
    setCustomerResults([]);
  };

  const buildPayload = (): ManualOrderRequest => ({
    panel,
    businessId: state.businessId,
    idempotencyKey: idempotencyKey || globalThis.crypto.randomUUID(),
    customer: {
      kind: state.customerKind,
      customerId: state.customerKind === 'registered' ? state.customerId : undefined,
      name: state.customerName,
      phone: state.customerPhone,
      email: state.customerEmail || undefined,
      notes: state.customerNotes || undefined,
    },
    delivery: {
      type: state.deliveryType,
      address: state.deliveryType === 'delivery' ? state.address : undefined,
      complement: state.complement || undefined,
      neighborhood: state.neighborhood || undefined,
      city: state.city || undefined,
      reference: state.reference || undefined,
      distanceKm: state.deliveryType === 'delivery' ? Number(state.distanceKm || 0) : undefined,
    },
    deliveryFee: {
      source: state.deliveryType === 'pickup' ? 'not_applicable' : state.deliveryFeeSource,
      amount: deliveryFee,
      overrideReason: state.deliveryFeeReason || undefined,
    },
    salesChannel: state.salesChannel,
    salesChannelDetail: state.salesChannelDetail || undefined,
    paymentMethod: state.paymentMethod,
    paymentStatus: state.paymentStatus,
    paidAmount: toInteger(state.paidAmount),
    initialStatus: state.initialStatus,
    adminReason: panel === 'admin' ? state.adminReason || undefined : undefined,
    preparationNotes: state.preparationNotes || undefined,
    courierNotes: state.courierNotes || undefined,
    internalNotes: state.internalNotes || undefined,
    tipAmount: tip,
    surchargeAmount: surcharge,
    items: cart.map((line) => ({
      productId: line.isCustomItem ? undefined : line.productId,
      isCustomItem: line.isCustomItem,
      customName: line.isCustomItem ? line.name : undefined,
      customUnitPrice: line.isCustomItem ? line.price : undefined,
      quantity: line.quantity,
      instructions: line.instructions || undefined,
    })),
  });

  const saveDraft = async () => {
    if (!state.businessId) {
      toast.error('Selecciona el negocio');
      return;
    }
    setSavingDraft(true);
    const result = await saveManualOrderDraftAction({
      panel,
      businessId: state.businessId,
      payload: { state, cart },
    });
    setSavingDraft(false);
    result.success ? toast.success('Borrador guardado') : toast.error(result.error || 'No se pudo guardar');
  };

  const deleteDraft = async () => {
    if (!state.businessId) return;
    const result = await deleteManualOrderDraftAction(panel, state.businessId);
    if (result.success) {
      setCart([]);
      setState((current) => ({ ...EMPTY_STATE, businessId: current.businessId }));
      toast.success('Borrador eliminado');
    } else {
      toast.error(result.error || 'No se pudo eliminar el borrador');
    }
  };

  const submit = async () => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    if (!globalThis.confirm(`Confirma la creación del pedido por ${money(total)}.`)) return;
    setSubmitting(true);
    const result = await createManualOrderAction(buildPayload());
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error || 'No se pudo crear el pedido');
      return;
    }
    toast.success(
      result.idempotentReplay
        ? `El pedido #${result.orderNumber} ya había sido creado`
        : `Pedido #${result.orderNumber} creado correctamente`,
    );
    setIdempotencyKey(globalThis.crypto.randomUUID());
    router.push(panel === 'admin' ? '/admin/pedidos' : '/negocio/pedidos');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 text-sm">
        <AlertTriangle className="mb-2 h-5 w-5 text-warning" />
        No existe un negocio activo asociado a esta cuenta.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <section className={sectionClass}>
          <div>
            <h2 className="font-semibold">1. Negocio y canal</h2>
            <p className="text-xs text-muted-foreground">El pedido solo puede contener productos del negocio seleccionado.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={labelClass}>Negocio</span>
              <select
                className={inputClass}
                value={state.businessId}
                disabled={panel === 'business'}
                onChange={(event) => {
                  patch('businessId', event.target.value);
                  setCart([]);
                  setDraftRecovered(false);
                }}
              >
                <option value="">Selecciona un negocio</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}{business.isVerified ? ' · Verificado' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Canal de origen</span>
              <select className={inputClass} value={state.salesChannel} onChange={(event) => patch('salesChannel', event.target.value as WorkspaceState['salesChannel'])}>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Llamada telefónica</option>
                <option value="in_person">Presencial</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="direct_message">Mensaje directo</option>
                <option value="other">Otro</option>
              </select>
            </label>
          </div>
          {state.salesChannel === 'other' && (
            <label>
              <span className={labelClass}>Descripción del canal</span>
              <input className={inputClass} value={state.salesChannelDetail} onChange={(event) => patch('salesChannelDetail', event.target.value)} />
            </label>
          )}
          {panel === 'admin' && (
            <label>
              <span className={labelClass}>Motivo administrativo de creación</span>
              <textarea className={inputClass} rows={2} value={state.adminReason} onChange={(event) => patch('adminReason', event.target.value)} />
            </label>
          )}
        </section>

        <section className={sectionClass}>
          <div>
            <h2 className="font-semibold">2. Cliente</h2>
            <p className="text-xs text-muted-foreground">Un invitado no genera una cuenta de autenticación.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['guest', 'registered'] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                onClick={() => patch('customerKind', kind)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${state.customerKind === kind ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >
                {kind === 'guest' ? 'Cliente invitado' : 'Cliente registrado'}
              </button>
            ))}
          </div>
          {state.customerKind === 'registered' && (
            <div className="space-y-2 rounded-xl bg-muted/40 p-3">
              <div className="flex gap-2">
                <input className={inputClass} placeholder="Nombre, teléfono o correo" value={state.customerSearch} onChange={(event) => patch('customerSearch', event.target.value)} />
                <button type="button" onClick={() => void searchCustomers()} className="rounded-xl bg-primary px-3 text-primary-foreground" disabled={searchingCustomers}>
                  {searchingCustomers ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundSearch className="h-4 w-4" />}
                </button>
              </div>
              {customerResults.map((customer) => (
                <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className="block w-full rounded-lg border bg-background p-2 text-left text-xs">
                  <strong>{customer.name}</strong><br />{customer.phone || customer.email}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={labelClass}>Nombre completo</span>
              <input className={inputClass} value={state.customerName} onChange={(event) => patch('customerName', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Teléfono</span>
              <input className={inputClass} value={state.customerPhone} onChange={(event) => patch('customerPhone', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Correo opcional</span>
              <input type="email" className={inputClass} value={state.customerEmail} onChange={(event) => patch('customerEmail', event.target.value)} />
            </label>
            <label>
              <span className={labelClass}>Notas del cliente</span>
              <input className={inputClass} value={state.customerNotes} onChange={(event) => patch('customerNotes', event.target.value)} />
            </label>
          </div>
        </section>

        <section className={sectionClass}>
          <div>
            <h2 className="font-semibold">3. Entrega</h2>
            <p className="text-xs text-muted-foreground">La tarifa de domicilio se cobra al cliente final.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className={labelClass}>Tipo</span>
              <select className={inputClass} value={state.deliveryType} onChange={(event) => patch('deliveryType', event.target.value as WorkspaceState['deliveryType'])}>
                <option value="delivery">Domicilio</option>
                <option value="pickup">Recoger en el local</option>
              </select>
            </label>
            {state.deliveryType === 'delivery' && (
              <>
                <label>
                  <span className={labelClass}>Cálculo de tarifa</span>
                  <select className={inputClass} value={state.deliveryFeeSource} onChange={(event) => patch('deliveryFeeSource', event.target.value as WorkspaceState['deliveryFeeSource'])}>
                    <option value="automatic">Automática por distancia</option>
                    <option value="manual">Manual con motivo</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Distancia en km</span>
                  <input type="number" min="0" step="0.1" className={inputClass} value={state.distanceKm} onChange={(event) => patch('distanceKm', event.target.value)} />
                </label>
              </>
            )}
          </div>
          {state.deliveryType === 'delivery' && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className={labelClass}>Dirección</span>
                <input className={inputClass} value={state.address} onChange={(event) => patch('address', event.target.value)} />
              </label>
              <label><span className={labelClass}>Complemento</span><input className={inputClass} value={state.complement} onChange={(event) => patch('complement', event.target.value)} /></label>
              <label><span className={labelClass}>Barrio o sector</span><input className={inputClass} value={state.neighborhood} onChange={(event) => patch('neighborhood', event.target.value)} /></label>
              <label><span className={labelClass}>Ciudad</span><input className={inputClass} value={state.city} onChange={(event) => patch('city', event.target.value)} /></label>
              <label><span className={labelClass}>Referencia</span><input className={inputClass} value={state.reference} onChange={(event) => patch('reference', event.target.value)} /></label>
              <label><span className={labelClass}>Tarifa calculada</span><input type="number" min="0" className={inputClass} readOnly={state.deliveryFeeSource === 'automatic'} value={state.deliveryFeeAmount} onChange={(event) => patch('deliveryFeeAmount', event.target.value)} /></label>
              {state.deliveryFeeSource === 'manual' && (
                <label><span className={labelClass}>Motivo de modificación</span><input className={inputClass} value={state.deliveryFeeReason} onChange={(event) => patch('deliveryFeeReason', event.target.value)} /></label>
              )}
            </div>
          )}
        </section>

        <section className={sectionClass}>
          <div>
            <h2 className="font-semibold">4. Productos</h2>
            <p className="text-xs text-muted-foreground">Precios e inventario se validan nuevamente en backend al confirmar.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className={`${inputClass} pl-9`} placeholder="Buscar por nombre, SKU o categoría" value={state.productSearch} onChange={(event) => patch('productSearch', event.target.value)} />
          </div>
          {loadingProducts ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="grid max-h-72 gap-2 overflow-y-auto md:grid-cols-2">
              {filteredProducts.map((product) => (
                <button type="button" key={product.id} onClick={() => addProduct(product)} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left disabled:opacity-50" disabled={product.status !== 'available' || product.availableQuantity <= 0}>
                  <span><strong className="block text-sm">{product.name}</strong><small className="text-muted-foreground">{product.sku} · Stock {product.availableQuantity}</small></span>
                  <span className="text-sm font-bold">{money(product.price)}</span>
                </button>
              ))}
            </div>
          )}
          {(panel === 'admin' || selectedBusiness?.allowCustomItems) && (
            <div className="grid gap-2 rounded-xl border border-dashed p-3 md:grid-cols-[1fr_150px_90px_auto]">
              <input className={inputClass} placeholder="Artículo personalizado" value={state.customName} onChange={(event) => patch('customName', event.target.value)} />
              <input type="number" min="0" className={inputClass} placeholder="Precio" value={state.customPrice} onChange={(event) => patch('customPrice', event.target.value)} />
              <input type="number" min="1" max="99" className={inputClass} value={state.customQuantity} onChange={(event) => patch('customQuantity', event.target.value)} />
              <button type="button" onClick={addCustomItem} className="rounded-xl bg-muted px-3 text-sm font-semibold"><PackagePlus className="inline h-4 w-4" /> Agregar</button>
            </div>
          )}
          <div className="space-y-2">
            {cart.map((line) => (
              <div key={line.key} className="grid gap-2 rounded-xl bg-muted/40 p-3 md:grid-cols-[1fr_90px_140px_auto]">
                <div><strong className="text-sm">{line.name}</strong><input className="mt-1 w-full bg-transparent text-xs outline-none" placeholder="Instrucciones del producto" value={line.instructions} onChange={(event) => updateLine(line.key, { instructions: event.target.value })} /></div>
                <input type="number" min="1" max="99" className={inputClass} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value || 1) })} />
                <strong className="self-center text-sm">{money(line.price * line.quantity)}</strong>
                <button type="button" onClick={() => setCart((current) => current.filter((item) => item.key !== line.key))} className="rounded-lg p-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="font-semibold">5. Pago y notas</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label><span className={labelClass}>Método de pago</span><select className={inputClass} value={state.paymentMethod} onChange={(event) => patch('paymentMethod', event.target.value as WorkspaceState['paymentMethod'])}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="credit_card">Tarjeta crédito</option><option value="debit_card">Tarjeta débito</option><option value="wallet">Billetera</option></select></label>
            <label><span className={labelClass}>Estado del pago</span><select className={inputClass} value={state.paymentStatus} onChange={(event) => patch('paymentStatus', event.target.value as WorkspaceState['paymentStatus'])}><option value="pending">Pendiente</option><option value="completed">Pagado</option></select></label>
            <label><span className={labelClass}>Valor pagado</span><input type="number" min="0" className={inputClass} value={state.paidAmount} onChange={(event) => patch('paidAmount', event.target.value)} /></label>
            <label><span className={labelClass}>Estado inicial</span><select className={inputClass} value={state.initialStatus} onChange={(event) => patch('initialStatus', event.target.value as WorkspaceState['initialStatus'])}><option value="confirmed">Confirmado</option><option value="pending">Pendiente</option></select></label>
            <label><span className={labelClass}>Propina</span><input type="number" min="0" className={inputClass} value={state.tipAmount} onChange={(event) => patch('tipAmount', event.target.value)} /></label>
            <label><span className={labelClass}>Recargo autorizado</span><input type="number" min="0" className={inputClass} value={state.surchargeAmount} onChange={(event) => patch('surchargeAmount', event.target.value)} /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label><span className={labelClass}>Notas de preparación</span><textarea rows={3} className={inputClass} value={state.preparationNotes} onChange={(event) => patch('preparationNotes', event.target.value)} /></label>
            <label><span className={labelClass}>Notas para repartidor</span><textarea rows={3} className={inputClass} value={state.courierNotes} onChange={(event) => patch('courierNotes', event.target.value)} /></label>
            <label><span className={labelClass}>Notas internas</span><textarea rows={3} className={inputClass} value={state.internalNotes} onChange={(event) => patch('internalNotes', event.target.value)} /></label>
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border bg-card p-4 shadow-sm xl:sticky xl:top-4">
        <div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /><h2 className="font-semibold">Confirmación</h2></div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Cliente</span><strong className="max-w-48 truncate">{state.customerName || 'Sin completar'}</strong></div>
          <div className="flex justify-between"><span>Productos</span><strong>{cart.reduce((sum, line) => sum + line.quantity, 0)}</strong></div>
          <div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="flex justify-between"><span>Domicilio</span><strong>{money(deliveryFee)}</strong></div>
          {tip > 0 && <div className="flex justify-between"><span>Propina</span><strong>{money(tip)}</strong></div>}
          {surcharge > 0 && <div className="flex justify-between"><span>Recargo</span><strong>{money(surcharge)}</strong></div>}
          <div className="flex justify-between border-t pt-3 text-base"><span>Total</span><strong>{money(total)}</strong></div>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-xs text-primary"><CheckCircle2 className="mb-1 h-4 w-4" />El backend recalculará precios, stock, domicilio y total antes de guardar.</div>
        <button type="button" onClick={() => void submit()} disabled={submitting || !state.businessId || cart.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Crear pedido manual
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void saveDraft()} disabled={savingDraft} className="rounded-xl border px-3 py-2 text-xs font-semibold"><Save className="mr-1 inline h-3.5 w-3.5" />Guardar</button>
          <button type="button" onClick={() => void deleteDraft()} className="rounded-xl border px-3 py-2 text-xs font-semibold text-destructive"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Eliminar</button>
        </div>
      </aside>
    </div>
  );
}
