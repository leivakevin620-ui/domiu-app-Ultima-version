'use server';

import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';
import {
  manualOrderDraftSchema,
  manualOrderInputSchema,
  type ManualOrderInput,
  type ManualOrderItemInput,
} from '@/lib/manual-orders/schema';

const uuidSchema = z.string().uuid();
const customerSearchSchema = z.object({
  businessId: z.string().uuid(),
  query: z.string().trim().min(2).max(100),
});

export interface ManualOrderBusinessOption {
  id: string;
  name: string;
  isActive: boolean;
  isVerified: boolean;
  isAcceptingOrders: boolean;
  operationsStatus: string;
  allowCustomItems: boolean;
  allowDeliveryFeeOverride: boolean;
  maxDiscountPercent: number;
}

export interface ManualOrderBranchOption {
  id: string;
  businessId: string;
  name: string;
  streetAddress: string;
  city: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number;
  isPrimary: boolean;
}

export interface ManualOrderCourierOption {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export interface ManualOrderCatalogProduct {
  id: string;
  businessId: string;
  categoryName: string;
  sku: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  quantityAvailable: number;
  trackInventory: boolean;
  extras: Array<{ name: string; price: number }>;
  variants: Array<{
    id: string;
    name: string;
    values: unknown;
    priceModifier: number;
    quantityAvailable: number;
    isActive: boolean;
  }>;
}

export interface ManualOrderCustomerOption {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface ManualOrderCalculation {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryFee: number;
  serviceFee: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  deliveryFeeSource: 'automatic' | 'google_maps' | 'postgis' | 'manual_override' | 'pickup';
  warnings: string[];
  items: Array<{
    key: string;
    name: string;
    quantity: number;
    unitPrice: number;
    itemTotal: number;
    isCustomItem: boolean;
  }>;
}

interface ActorContext {
  id: string;
  email: string;
  role: 'admin' | 'merchant';
}

interface BusinessAccess {
  business: Record<string, unknown> & {
    id: string;
    owner_id: string;
    name: string;
    is_active: boolean;
    is_accepting_orders: boolean;
    operations_status: string;
    metadata: Record<string, unknown> | null;
  };
  branch: Record<string, unknown> & {
    id: string;
    business_id: string;
    street_address: string;
    city: string;
    latitude: number | string | null;
    longitude: number | string | null;
  };
}

function booleanMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes';
}

function numberMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = Number(metadata?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function asMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function roundMoneyUp(value: number, increment: number) {
  if (increment <= 0) return Math.round(value);
  return Math.ceil(value / increment) * increment;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function normalizePhone(value: string | undefined) {
  return (value || '').replace(/\D/g, '');
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const known = [
    'Actor requerido',
    'Solicitud inválida',
    'Clave de idempotencia',
    'Huella de solicitud',
    'Usuario no autorizado',
    'Rol no autorizado',
    'Negocio no encontrado',
    'No puedes crear pedidos',
    'Selecciona una sucursal',
    'El negocio está cerrado',
    'Tipo de cliente inválido',
    'Cliente registrado no encontrado',
    'Nombre del cliente invitado',
    'Teléfono del cliente invitado',
    'Tipo de entrega inválido',
    'Dirección de entrega incompleta',
    'Canal de origen inválido',
    'Describe el canal',
    'Método de pago inválido',
    'Estado de pago inválido',
    'Agrega al menos un producto',
    'El negocio no permite productos personalizados',
    'Los productos personalizados requieren',
    'Precio del producto personalizado',
    'Nombre del producto personalizado',
    'Cantidad de producto inválida',
    'Producto no disponible',
    'Variante inválida',
    'Complemento no autorizado',
    'El subtotal debe',
    'El descuento no puede',
    'El descuento supera',
    'No tienes permiso',
    'Indica el motivo',
    'Solo administración puede asignar',
    'Repartidor no disponible',
    'Estado inicial',
    'Stock insuficiente',
    'La dirección no tiene coordenadas',
    'No fue posible calcular',
    'La tarifa manual requiere',
    'No existe una configuración',
    'La clave de idempotencia ya fue usada',
  ];
  const match = known.find((prefix) => message.includes(prefix));
  return match ? message : 'No se pudo completar el pedido. Revisa los datos e inténtalo nuevamente.';
}

async function getActor(): Promise<{ actor?: ActorContext; error?: string }> {
  const auth = await requireAuth();
  if (auth.error) return { error: auth.error.message };
  const role = auth.session.profile.role;
  if (role !== 'admin' && role !== 'merchant') {
    return { error: 'No tienes permisos para crear pedidos manuales.' };
  }
  return {
    actor: {
      id: auth.session.user.id,
      email: auth.session.user.email,
      role,
    },
  };
}

async function requireBusinessAccess(actor: ActorContext, businessId: string, branchId?: string): Promise<BusinessAccess> {
  const db = getServiceClient();
  let businessQuery = db
    .from('businesses')
    .select('id,owner_id,name,is_active,is_verified,is_accepting_orders,operations_status,metadata,deleted_at')
    .eq('id', businessId)
    .eq('is_active', true)
    .is('deleted_at', null);
  if (actor.role === 'merchant') businessQuery = businessQuery.eq('owner_id', actor.id);
  const { data: business, error: businessError } = await businessQuery.maybeSingle();
  if (businessError || !business) throw new Error('Negocio no encontrado o fuera de tu alcance.');

  let branchQuery = db
    .from('business_addresses')
    .select('id,business_id,name,street_address,city,neighborhood,latitude,longitude,service_radius_km,is_primary,is_active,deleted_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .limit(1);
  if (branchId) branchQuery = branchQuery.eq('id', branchId);
  const { data: branch, error: branchError } = await branchQuery.maybeSingle();
  if (branchError || !branch) throw new Error('Selecciona una sucursal activa del negocio.');

  return { business: business as BusinessAccess['business'], branch: branch as BusinessAccess['branch'] };
}

export async function getManualOrderSetupAction() {
  const actorResult = await getActor();
  if (!actorResult.actor) return { error: actorResult.error || 'No autorizado', businesses: [], branches: [], couriers: [] };
  const actor = actorResult.actor;
  const db = getServiceClient();

  let businessesQuery = db
    .from('businesses')
    .select('id,name,is_active,is_verified,is_accepting_orders,operations_status,owner_id,metadata')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');
  if (actor.role === 'merchant') businessesQuery = businessesQuery.eq('owner_id', actor.id);

  const { data: rawBusinesses } = await businessesQuery;
  const businessIds = (rawBusinesses || []).map((business) => business.id);
  const { data: rawBranches } = businessIds.length
    ? await db
        .from('business_addresses')
        .select('id,business_id,name,street_address,city,neighborhood,latitude,longitude,service_radius_km,is_primary')
        .in('business_id', businessIds)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false })
    : { data: [] };

  const businesses: ManualOrderBusinessOption[] = (rawBusinesses || []).map((business) => {
    const metadata = (business.metadata || {}) as Record<string, unknown>;
    return {
      id: business.id,
      name: business.name,
      isActive: Boolean(business.is_active),
      isVerified: Boolean(business.is_verified),
      isAcceptingOrders: Boolean(business.is_accepting_orders),
      operationsStatus: business.operations_status || 'closed',
      allowCustomItems: actor.role === 'admin' || booleanMetadata(metadata, 'allow_custom_manual_items'),
      allowDeliveryFeeOverride: actor.role === 'admin' || booleanMetadata(metadata, 'allow_manual_delivery_fee_override'),
      maxDiscountPercent: actor.role === 'admin' ? 100 : numberMetadata(metadata, 'manual_order_max_discount_pct'),
    };
  });

  const branches: ManualOrderBranchOption[] = (rawBranches || []).map((branch) => ({
    id: branch.id,
    businessId: branch.business_id,
    name: branch.name || (branch.is_primary ? 'Sede principal' : 'Sucursal'),
    streetAddress: branch.street_address,
    city: branch.city || 'Santa Marta',
    neighborhood: branch.neighborhood || '',
    latitude: branch.latitude === null ? null : Number(branch.latitude),
    longitude: branch.longitude === null ? null : Number(branch.longitude),
    serviceRadiusKm: Number(branch.service_radius_km || 0),
    isPrimary: Boolean(branch.is_primary),
  }));

  let couriers: ManualOrderCourierOption[] = [];
  if (actor.role === 'admin') {
    const { data: drivers } = await db.from('drivers').select('id,status').eq('is_active', true);
    const driverIds = (drivers || []).map((driver) => driver.id);
    const { data: profiles } = driverIds.length
      ? await db.from('profiles').select('id,first_name,last_name,phone,status').in('id', driverIds).eq('status', 'active')
      : { data: [] };
    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    couriers = (drivers || []).flatMap((driver) => {
      const profile = profilesById.get(driver.id);
      if (!profile) return [];
      return [{
        id: driver.id,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Repartidor',
        phone: profile.phone || '',
        status: driver.status || 'unknown',
      }];
    });
  }

  return { role: actor.role, businesses, branches, couriers };
}

export async function getManualOrderCatalogAction(businessId: string) {
  const parsedBusinessId = uuidSchema.safeParse(businessId);
  if (!parsedBusinessId.success) return { error: 'Negocio inválido', products: [] as ManualOrderCatalogProduct[] };
  const actorResult = await getActor();
  if (!actorResult.actor) return { error: actorResult.error || 'No autorizado', products: [] as ManualOrderCatalogProduct[] };

  try {
    await requireBusinessAccess(actorResult.actor, parsedBusinessId.data);
    const db = getServiceClient();
    const { data: products, error } = await db
      .from('products')
      .select('id,business_id,category_id,sku,name,description,price,discount_price,status,quantity_available,image_url,metadata,categories(name)')
      .eq('business_id', parsedBusinessId.data)
      .eq('status', 'available')
      .is('deleted_at', null)
      .order('name');
    if (error) return { error: 'No se pudo cargar el catálogo', products: [] as ManualOrderCatalogProduct[] };

    const productIds = (products || []).map((product) => product.id);
    const { data: variants } = productIds.length
      ? await db
          .from('product_variants')
          .select('id,product_id,name,values,price_modifier,quantity_available,is_active')
          .in('product_id', productIds)
          .eq('is_active', true)
      : { data: [] };
    const variantsByProduct = new Map<string, typeof variants>();
    for (const variant of variants || []) {
      const current = variantsByProduct.get(variant.product_id) || [];
      current.push(variant);
      variantsByProduct.set(variant.product_id, current);
    }

    const result: ManualOrderCatalogProduct[] = (products || []).map((product) => {
      const metadata = (product.metadata || {}) as Record<string, unknown>;
      const extras = Array.isArray(metadata.extras)
        ? metadata.extras.flatMap((extra) => {
            if (!extra || typeof extra !== 'object') return [];
            const row = extra as Record<string, unknown>;
            const name = String(row.name || '').trim();
            if (!name) return [];
            return [{ name, price: asMoney(row.price) }];
          })
        : [];
      const categoryRelation = product.categories as unknown;
      const categoryName = Array.isArray(categoryRelation)
        ? String((categoryRelation[0] as { name?: string } | undefined)?.name || 'Otros')
        : String((categoryRelation as { name?: string } | null)?.name || 'Otros');
      const price = asMoney(product.price);
      const discountPrice = product.discount_price === null ? null : asMoney(product.discount_price);
      return {
        id: product.id,
        businessId: product.business_id,
        categoryName,
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        imageUrl: product.image_url || null,
        price,
        discountPrice,
        effectivePrice: discountPrice && discountPrice > 0 ? discountPrice : price,
        quantityAvailable: Number(product.quantity_available || 0),
        trackInventory: booleanMetadata(metadata, 'track_inventory'),
        extras,
        variants: (variantsByProduct.get(product.id) || []).map((variant) => ({
          id: variant.id,
          name: variant.name,
          values: variant.values,
          priceModifier: asMoney(variant.price_modifier),
          quantityAvailable: Number(variant.quantity_available || 0),
          isActive: Boolean(variant.is_active),
        })),
      };
    });
    return { products: result };
  } catch (error) {
    return { error: publicError(error), products: [] as ManualOrderCatalogProduct[] };
  }
}

export async function searchManualOrderCustomersAction(input: unknown) {
  const parsed = customerSearchSchema.safeParse(input);
  if (!parsed.success) return { error: 'Búsqueda inválida', customers: [] as ManualOrderCustomerOption[] };
  const actorResult = await getActor();
  if (!actorResult.actor) return { error: actorResult.error || 'No autorizado', customers: [] as ManualOrderCustomerOption[] };

  try {
    await requireBusinessAccess(actorResult.actor, parsed.data.businessId);
    const db = getServiceClient();
    let allowedCustomerIds: string[] | null = null;
    if (actorResult.actor.role === 'merchant') {
      const { data: orders } = await db
        .from('orders')
        .select('customer_id')
        .eq('business_id', parsed.data.businessId)
        .not('customer_id', 'is', null)
        .is('deleted_at', null)
        .limit(500);
      allowedCustomerIds = [...new Set((orders || []).map((order) => order.customer_id).filter(Boolean))];
      if (allowedCustomerIds.length === 0) return { customers: [] as ManualOrderCustomerOption[] };
    }

    const raw = parsed.data.query.replace(/[,%()]/g, ' ').trim();
    const digits = raw.replace(/\D/g, '');
    let query = db
      .from('profiles')
      .select('id,first_name,last_name,phone,email')
      .eq('role', 'customer')
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(20);
    if (allowedCustomerIds) query = query.in('id', allowedCustomerIds);
    if (digits.length >= 3) query = query.ilike('phone', `%${digits}%`);
    else if (raw.includes('@')) query = query.ilike('email', `%${raw}%`);
    else query = query.or(`first_name.ilike.%${raw}%,last_name.ilike.%${raw}%`);

    const { data, error } = await query;
    if (error) return { error: 'No se pudo buscar clientes', customers: [] as ManualOrderCustomerOption[] };
    return {
      customers: (data || []).map((customer) => ({
        id: customer.id,
        name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Cliente DomiU',
        phone: customer.phone || '',
        email: customer.email || '',
      })),
    };
  } catch (error) {
    return { error: publicError(error), customers: [] as ManualOrderCustomerOption[] };
  }
}

async function calculateForActor(actor: ActorContext, order: ManualOrderInput): Promise<ManualOrderCalculation> {
  const db = getServiceClient();
  const { business } = await requireBusinessAccess(actor, order.businessId, order.businessAddressId);
  const metadata = (business.metadata || {}) as Record<string, unknown>;
  const allowCustomItems = actor.role === 'admin' || booleanMetadata(metadata, 'allow_custom_manual_items');
  const allowFeeOverride = actor.role === 'admin' || booleanMetadata(metadata, 'allow_manual_delivery_fee_override');
  const maxDiscountPercent = actor.role === 'admin' ? 100 : numberMetadata(metadata, 'manual_order_max_discount_pct');

  const productIds = [...new Set(order.items.filter((item) => !item.isCustomItem).map((item) => item.productId).filter(Boolean))] as string[];
  const { data: products } = productIds.length
    ? await db
        .from('products')
        .select('id,business_id,sku,name,price,discount_price,status,quantity_available,metadata')
        .in('id', productIds)
        .eq('business_id', order.businessId)
        .eq('status', 'available')
        .is('deleted_at', null)
    : { data: [] };
  if ((products || []).length !== productIds.length) throw new Error('Producto no disponible o perteneciente a otro negocio.');
  const productsById = new Map((products || []).map((product) => [product.id, product]));

  const variantIds = [...new Set(order.items.map((item) => item.variantId).filter(Boolean))] as string[];
  const { data: variants } = variantIds.length
    ? await db
        .from('product_variants')
        .select('id,product_id,name,values,price_modifier,quantity_available,is_active')
        .in('id', variantIds)
        .eq('is_active', true)
    : { data: [] };
  if ((variants || []).length !== variantIds.length) throw new Error('Variante inválida.');
  const variantsById = new Map((variants || []).map((variant) => [variant.id, variant]));

  let subtotal = 0;
  const resolvedItems: ManualOrderCalculation['items'] = [];
  for (const item of order.items) {
    let name = item.name || 'Producto personalizado';
    let unitPrice = 0;
    if (item.isCustomItem) {
      if (!allowCustomItems) throw new Error('El negocio no permite productos personalizados.');
      if (actor.role === 'admin' && (!order.administrativeReason || order.administrativeReason.length < 5)) {
        throw new Error('Los productos personalizados requieren un motivo administrativo.');
      }
      unitPrice = asMoney(item.unitPrice);
    } else {
      const product = productsById.get(item.productId || '');
      if (!product) throw new Error('Producto no disponible o perteneciente a otro negocio.');
      name = product.name;
      const productMetadata = (product.metadata || {}) as Record<string, unknown>;
      unitPrice = asMoney(product.discount_price && Number(product.discount_price) > 0 ? product.discount_price : product.price);
      if (item.variantId) {
        const variant = variantsById.get(item.variantId);
        if (!variant || variant.product_id !== product.id) throw new Error('Variante inválida.');
        unitPrice += asMoney(variant.price_modifier);
        if (booleanMetadata(productMetadata, 'track_inventory') && Number(variant.quantity_available || 0) < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}.`);
        }
      } else if (booleanMetadata(productMetadata, 'track_inventory') && Number(product.quantity_available || 0) < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }
      const allowedExtras = Array.isArray(productMetadata.extras) ? productMetadata.extras : [];
      for (const modifier of item.modifiers) {
        const allowed = allowedExtras.find((extra) => {
          if (!extra || typeof extra !== 'object') return false;
          return String((extra as Record<string, unknown>).name || '').toLowerCase() === modifier.name.toLowerCase();
        }) as Record<string, unknown> | undefined;
        if (!allowed) throw new Error(`Complemento no autorizado para ${product.name}.`);
        unitPrice += asMoney(allowed.price);
      }
    }
    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;
    resolvedItems.push({
      key: item.isCustomItem ? `custom-${resolvedItems.length}` : `${item.productId}-${item.variantId || 'base'}-${resolvedItems.length}`,
      name,
      quantity: item.quantity,
      unitPrice,
      itemTotal,
      isCustomItem: item.isCustomItem,
    });
  }

  if (order.discountAmount > subtotal) throw new Error('El descuento no puede superar el subtotal.');
  const discountPercent = subtotal > 0 ? (order.discountAmount / subtotal) * 100 : 0;
  if (actor.role === 'merchant' && order.discountAmount > 0 && (maxDiscountPercent <= 0 || discountPercent > maxDiscountPercent)) {
    throw new Error('El descuento supera la autorización del negocio.');
  }

  let deliveryFee = 0;
  let deliveryFeeSource: ManualOrderCalculation['deliveryFeeSource'] = 'pickup';
  const warnings: string[] = [];
  if (order.deliveryType === 'delivery') {
    if (order.deliveryFeeOverridden) {
      if (!allowFeeOverride) throw new Error('No tienes permiso para modificar manualmente la tarifa.');
      deliveryFee = asMoney(order.deliveryFee);
      deliveryFeeSource = 'manual_override';
    } else {
      if (order.distanceKm <= 0) throw new Error('No fue posible calcular una distancia válida.');
      const { data: pricing } = await db
        .from('delivery_pricing_settings')
        .select('base_fee,base_distance_km,extra_per_km,rounding_increment')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!pricing) throw new Error('No existe una configuración de domicilio activa.');
      const baseFee = asMoney(pricing.base_fee);
      const baseDistance = Number(pricing.base_distance_km || 0);
      const extraPerKm = Number(pricing.extra_per_km || 0);
      const rounding = asMoney(pricing.rounding_increment) || 1;
      const raw = baseFee + Math.max(order.distanceKm - baseDistance, 0) * extraPerKm;
      deliveryFee = order.distanceKm <= baseDistance ? baseFee : roundMoneyUp(raw, rounding);
      deliveryFeeSource = order.routeSource.includes('google') ? 'google_maps' : 'postgis';
      warnings.push('La tarifa y el total se validarán nuevamente en PostgreSQL al confirmar.');
    }
  }

  const { data: financialData } = await db.rpc('current_financial_settings');
  const financial = Array.isArray(financialData) ? financialData[0] : financialData;
  if (!financial) throw new Error('No existe una configuración financiera activa.');
  const taxableProducts = Math.max(subtotal - order.discountAmount, 0);
  const serviceRaw = taxableProducts * (Number(financial.service_fee_rate || 0) / 100);
  const serviceRounded = roundMoneyUp(serviceRaw, Number(financial.service_fee_rounding || 1));
  const serviceFee = subtotal > 0
    ? Math.min(Number(financial.service_fee_max || serviceRounded), Math.max(Number(financial.service_fee_min || 0), serviceRounded))
    : 0;
  const totalAmount = taxableProducts + order.taxAmount + deliveryFee + serviceFee;
  const amountPaid = order.paymentStatus === 'completed' ? totalAmount : Math.min(order.amountPaid, totalAmount);

  return {
    subtotal,
    discountAmount: order.discountAmount,
    taxAmount: order.taxAmount,
    deliveryFee,
    serviceFee,
    totalAmount,
    amountPaid,
    amountDue: Math.max(totalAmount - amountPaid, 0),
    deliveryFeeSource,
    warnings,
    items: resolvedItems,
  };
}

export async function calculateManualOrderAction(input: unknown) {
  const parsed = manualOrderInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Datos inválidos' };
  const actorResult = await getActor();
  if (!actorResult.actor) return { error: actorResult.error || 'No autorizado' };
  try {
    return { calculation: await calculateForActor(actorResult.actor, parsed.data) };
  } catch (error) {
    return { error: publicError(error) };
  }
}

function toDatabasePayload(order: ManualOrderInput, calculation: ManualOrderCalculation, requestFingerprint: string, draftId?: string) {
  const deliveryAddress = order.deliveryAddress;
  const hasCoordinates = deliveryAddress?.latitude !== undefined && deliveryAddress?.longitude !== undefined;
  const routeSource = order.deliveryType === 'pickup'
    ? 'pickup'
    : order.deliveryFeeOverridden
      ? 'manual'
      : hasCoordinates
        ? 'postgis_direct'
        : order.routeSource;

  return {
    business_id: order.businessId,
    business_address_id: order.businessAddressId,
    customer_type: order.customerType,
    customer_id: order.customerType === 'registered' ? order.customerId || null : null,
    customer_name: order.customerType === 'guest' ? order.customerName || '' : null,
    customer_phone: order.customerType === 'guest' ? normalizePhone(order.customerPhone) : null,
    customer_email: order.customerType === 'guest' ? order.customerEmail || null : null,
    customer_notes: order.customerNotes || null,
    delivery_type: order.deliveryType,
    delivery_address: deliveryAddress
      ? {
          street_address: deliveryAddress.streetAddress,
          formatted_address: deliveryAddress.formattedAddress || null,
          neighborhood: deliveryAddress.neighborhood || null,
          city: deliveryAddress.city || 'Santa Marta',
          instructions: deliveryAddress.instructions || null,
          place_id: deliveryAddress.placeId || null,
          latitude: deliveryAddress.latitude ?? null,
          longitude: deliveryAddress.longitude ?? null,
          incomplete_confirmed: deliveryAddress.incompleteConfirmed,
        }
      : {},
    items: order.items.map((item: ManualOrderItemInput) => ({
      product_id: item.isCustomItem ? null : item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
      special_instructions: item.specialInstructions || null,
      modifiers: item.modifiers,
      is_custom_item: item.isCustomItem,
      name: item.isCustomItem ? item.name : null,
      description: item.isCustomItem ? item.description || null : null,
      unit_price: item.isCustomItem ? item.unitPrice : null,
    })),
    discount_amount: calculation.discountAmount,
    tax_amount: calculation.taxAmount,
    delivery_fee: calculation.deliveryFee,
    delivery_fee_overridden: order.deliveryFeeOverridden,
    delivery_fee_override_reason: order.deliveryFeeOverrideReason || null,
    delivery_fee_source: calculation.deliveryFeeSource,
    distance_km: order.deliveryFeeOverridden ? order.distanceKm : 0,
    duration_minutes: order.deliveryFeeOverridden ? order.durationMinutes : 0,
    route_distance_km: order.deliveryFeeOverridden ? order.distanceKm : 0,
    route_duration_minutes: order.deliveryFeeOverridden ? order.durationMinutes : 0,
    route_source: routeSource,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    amount_paid: calculation.amountPaid,
    payment_reference: order.paymentReference || null,
    payment_notes: order.paymentNotes || null,
    sales_channel: order.salesChannel,
    sales_channel_detail: order.salesChannelDetail || null,
    initial_status: order.courierId ? 'assigned' : order.initialStatus,
    courier_id: order.courierId || null,
    administrative_reason: order.administrativeReason || null,
    notes: {
      customer: order.notes.customer || null,
      kitchen: order.notes.kitchen || null,
      courier: order.notes.courier || null,
      internal: order.notes.internal || null,
    },
    idempotency_key: order.idempotencyKey,
    request_fingerprint: requestFingerprint,
    draft_id: draftId || null,
  };
}

export async function createManualOrderEnterpriseAction(input: unknown, draftId?: string) {
  const parsed = manualOrderInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' };
  const parsedDraftId = draftId ? uuidSchema.safeParse(draftId) : null;
  if (parsedDraftId && !parsedDraftId.success) return { success: false, error: 'Borrador inválido' };
  const actorResult = await getActor();
  if (!actorResult.actor) return { success: false, error: actorResult.error || 'No autorizado' };
  const actor = actorResult.actor;

  try {
    const calculation = await calculateForActor(actor, parsed.data);
    const requestFingerprint = fingerprint({ ...parsed.data, idempotencyKey: undefined });
    const payload = toDatabasePayload(parsed.data, calculation, requestFingerprint, parsedDraftId?.data);
    const db = getServiceClient();
    const { data, error } = await db.rpc('create_manual_order_v2', {
      p_actor_id: actor.id,
      p_payload: payload,
    });
    if (error) throw error;
    const result = (data || {}) as Record<string, unknown>;
    if (!result.success) throw new Error('No se pudo crear el pedido.');
    return {
      success: true,
      replayed: Boolean(result.replayed),
      orderId: String(result.order_id || ''),
      orderNumber: String(result.order_number || ''),
      status: String(result.status || parsed.data.initialStatus),
      totalAmount: asMoney(result.total_amount || calculation.totalAmount),
    };
  } catch (error) {
    await serverAudit
      .logError(actor.id, actor.email, actor.role, 'manual_order_created', 'orders', error instanceof Error ? error.message : 'unknown')
      .catch(() => undefined);
    return { success: false, error: publicError(error) };
  }
}

export async function saveManualOrderDraftAction(input: unknown) {
  const parsed = manualOrderDraftSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Borrador inválido' };
  const actorResult = await getActor();
  if (!actorResult.actor) return { success: false, error: actorResult.error || 'No autorizado' };
  const actor = actorResult.actor;

  try {
    await requireBusinessAccess(actor, parsed.data.businessId, parsed.data.businessAddressId || undefined);
    const db = getServiceClient();
    if (parsed.data.id) {
      const { data, error } = await db
        .from('manual_order_drafts')
        .update({
          business_id: parsed.data.businessId,
          business_address_id: parsed.data.businessAddressId || null,
          payload: parsed.data.payload,
          version: parsed.data.version + 1,
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', parsed.data.id)
        .eq('actor_id', actor.id)
        .eq('status', 'draft')
        .eq('version', parsed.data.version)
        .select('id,version,updated_at')
        .maybeSingle();
      if (error || !data) return { success: false, error: 'El borrador cambió en otra sesión. Recárgalo antes de guardar.' };
      return { success: true, draft: data };
    }

    const { data, error } = await db
      .from('manual_order_drafts')
      .insert({
        actor_id: actor.id,
        actor_role: actor.role,
        business_id: parsed.data.businessId,
        business_address_id: parsed.data.businessAddressId || null,
        payload: parsed.data.payload,
        status: 'draft',
        version: 1,
      })
      .select('id,version,updated_at')
      .single();
    if (error || !data) return { success: false, error: 'No se pudo guardar el borrador.' };
    return { success: true, draft: data };
  } catch (error) {
    return { success: false, error: publicError(error) };
  }
}

export async function listManualOrderDraftsAction() {
  const actorResult = await getActor();
  if (!actorResult.actor) return { error: actorResult.error || 'No autorizado', drafts: [] };
  const db = getServiceClient();
  await db.rpc('expire_manual_order_drafts', { p_actor_id: actorResult.actor.id });
  const { data, error } = await db
    .from('manual_order_drafts')
    .select('id,business_id,business_address_id,payload,version,expires_at,updated_at,businesses(name)')
    .eq('actor_id', actorResult.actor.id)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) return { error: 'No se pudieron cargar los borradores.', drafts: [] };
  return { drafts: data || [] };
}

export async function discardManualOrderDraftAction(draftId: string) {
  const parsed = uuidSchema.safeParse(draftId);
  if (!parsed.success) return { success: false, error: 'Borrador inválido' };
  const actorResult = await getActor();
  if (!actorResult.actor) return { success: false, error: actorResult.error || 'No autorizado' };
  const db = getServiceClient();
  const { data, error } = await db
    .from('manual_order_drafts')
    .update({ status: 'discarded' })
    .eq('id', parsed.data)
    .eq('actor_id', actorResult.actor.id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();
  if (error || !data) return { success: false, error: 'No se pudo eliminar el borrador.' };
  return { success: true };
}
