import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiToolPlan, DomiToolResult } from '@/lib/domi/tools/types';

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'pendiente de confirmación',
  confirmed: 'confirmado',
  preparing: 'en preparación',
  ready: 'listo para recoger',
  assigned: 'asignado a un repartidor',
  accepted: 'aceptado por el repartidor',
  picked_up: 'recogido en el negocio',
  in_transit: 'en camino',
  delivered: 'entregado',
  cancelled: 'cancelado',
  refunded: 'reembolsado',
};

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'refunded']);

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: unknown, timezone: string) {
  const date = new Date(text(value));
  if (Number.isNaN(date.getTime())) return 'fecha no disponible';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

function safeSearchTerm(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function safeOrderReference(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 32);
}

function canUse(context: DomiServerContext, permission: string) {
  return context.role === 'customer' && context.permissions.includes(permission);
}

function denied(name: DomiToolPlan['name']): DomiToolResult {
  return {
    name,
    success: false,
    message: 'Esta herramienta no está disponible para tu perfil.',
    data: { reason: 'permission_denied' },
    recordCount: 0,
    suggestedActions: [],
    navigation: [],
  };
}

async function searchCatalog(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canUse(context, 'business.search') || !canUse(context, 'products.search')) {
    return denied(plan.name);
  }

  const query = safeSearchTerm(plan.arguments.query);
  if (!query) {
    return {
      name: plan.name,
      success: true,
      message: 'Dime qué producto, comida o negocio deseas buscar. Por ejemplo: “hamburguesas”, “farmacia” o “pollo asado”.',
      data: { query: '', businesses: [], products: [] },
      recordCount: 0,
      suggestedActions: ['Buscar hamburguesas', 'Buscar farmacia', 'Buscar pollo'],
      navigation: [{ label: 'Abrir buscador', href: '/cliente/search' }],
    };
  }

  const filter = `%${query}%`;
  const [businessResult, productResult] = await Promise.all([
    supabase
      .from('businesses')
      .select('id,name,slug,description,cuisine_type,business_type,rating,total_ratings,is_accepting_orders,operations_status,metadata')
      .eq('is_active', true)
      .eq('is_verified', true)
      .is('deleted_at', null)
      .or(`name.ilike.${filter},description.ilike.${filter},cuisine_type.ilike.${filter},business_type.ilike.${filter}`)
      .order('rating', { ascending: false })
      .limit(5),
    supabase
      .from('products')
      .select('id,business_id,name,description,price,discount_price,image_url,status,metadata')
      .eq('status', 'available')
      .is('deleted_at', null)
      .or(`name.ilike.${filter},description.ilike.${filter}`)
      .limit(12),
  ]);

  if (businessResult.error || productResult.error) throw new Error('customer_catalog_search_failed');

  const directBusinesses = (businessResult.data ?? []) as Array<Record<string, unknown>>;
  const productRows = (productResult.data ?? []) as Array<Record<string, unknown>>;
  const productBusinessIds = [...new Set(productRows.map((row) => text(row.business_id)).filter(Boolean))];

  const relatedBusinessResult = productBusinessIds.length > 0
    ? await supabase
        .from('businesses')
        .select('id,name,slug,is_active,is_verified,is_accepting_orders,operations_status,metadata')
        .in('id', productBusinessIds)
        .eq('is_active', true)
        .eq('is_verified', true)
        .is('deleted_at', null)
    : { data: [], error: null };

  if (relatedBusinessResult.error) throw new Error('customer_catalog_business_validation_failed');

  const businessMap = new Map<string, Record<string, unknown>>();
  for (const business of [...directBusinesses, ...((relatedBusinessResult.data ?? []) as Array<Record<string, unknown>>)]) {
    businessMap.set(text(business.id), business);
  }

  const businesses = directBusinesses
    .filter((business) => text(objectValue(business.metadata).catalog_status, 'live') === 'live')
    .map((business) => ({
      id: text(business.id),
      name: text(business.name, 'Negocio'),
      slug: text(business.slug),
      category: text(business.cuisine_type) || text(business.business_type) || 'Otros',
      rating: numeric(business.rating),
      isOpen: Boolean(business.is_accepting_orders) && text(business.operations_status) === 'open',
    }));

  const products = productRows
    .map((product) => {
      const business = businessMap.get(text(product.business_id));
      if (!business || text(objectValue(business.metadata).catalog_status, 'live') !== 'live') return null;
      const price = numeric(product.discount_price) > 0 ? numeric(product.discount_price) : numeric(product.price);
      return {
        id: text(product.id),
        name: text(product.name, 'Producto'),
        price,
        businessId: text(product.business_id),
        businessName: text(business.name, 'Negocio'),
        businessSlug: text(business.slug),
        isOpen: Boolean(business.is_accepting_orders) && text(business.operations_status) === 'open',
      };
    })
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .slice(0, 8);

  const lines: string[] = [];
  if (products.length > 0) {
    lines.push(`Productos: ${products.slice(0, 5).map((product) => `${product.name} en ${product.businessName} por ${formatCop(product.price)}${product.isOpen ? '' : ' (cerrado ahora)'}`).join('; ')}.`);
  }
  if (businesses.length > 0) {
    lines.push(`Negocios: ${businesses.map((business) => `${business.name} (${business.category}${business.isOpen ? ', abierto' : ', cerrado'})`).join('; ')}.`);
  }

  const recordCount = businesses.length + products.length;
  const message = recordCount > 0
    ? `Encontré ${recordCount} resultado${recordCount === 1 ? '' : 's'} para “${query}”. ${lines.join(' ')}`
    : `No encontré resultados activos y verificados para “${query}”. Prueba con otro nombre o una categoría más general.`;

  const navigation = [
    ...products.map((product) => ({ label: `Ver ${product.businessName}`, href: `/cliente/business/${product.businessSlug}` })),
    ...businesses.map((business) => ({ label: `Ver ${business.name}`, href: `/cliente/business/${business.slug}` })),
  ].filter((link, index, all) => link.href !== '/cliente/business/' && all.findIndex((item) => item.href === link.href) === index).slice(0, 4);

  return {
    name: plan.name,
    success: true,
    message,
    data: { query, businesses, products },
    recordCount,
    suggestedActions: recordCount > 0 ? ['Consultar mi carrito', 'Buscar otro producto'] : ['Buscar hamburguesas', 'Buscar farmacia'],
    navigation,
  };
}

async function cartSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canUse(context, 'cart.read')) return denied(plan.name);

  const cart = context.client.cart;
  if (!cart || cart.items.length === 0) {
    return {
      name: plan.name,
      success: true,
      message: 'Tu carrito está vacío en este dispositivo.',
      data: { businessId: null, businessName: null, items: [], itemCount: 0, subtotal: 0 },
      recordCount: 0,
      suggestedActions: ['Buscar productos'],
      navigation: [{ label: 'Explorar negocios', href: '/cliente' }],
    };
  }

  const productIds = [...new Set(cart.items.map((item) => item.productId))];
  const productResult = await supabase
    .from('products')
    .select('id,business_id,name,price,discount_price,status,deleted_at')
    .in('id', productIds);
  if (productResult.error) throw new Error('customer_cart_products_failed');

  const productRows = (productResult.data ?? []) as Array<Record<string, unknown>>;
  const businessIds = [...new Set(productRows.map((row) => text(row.business_id)).filter(Boolean))];
  const businessResult = businessIds.length > 0
    ? await supabase
        .from('businesses')
        .select('id,name,slug,is_active,is_verified,is_accepting_orders,operations_status,deleted_at,metadata')
        .in('id', businessIds)
    : { data: [], error: null };
  if (businessResult.error) throw new Error('customer_cart_business_failed');

  const productMap = new Map(productRows.map((row) => [text(row.id), row]));
  const businessMap = new Map(((businessResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [text(row.id), row]));
  const expectedBusinessId = cart.businessId;

  let subtotal = 0;
  let itemCount = 0;
  let businessName = '';
  let businessSlug = '';
  let integrityMismatchCount = 0;
  const unavailable: string[] = [];
  const items = cart.items.map((cartItem) => {
    const product = productMap.get(cartItem.productId);
    const quantity = Math.max(1, Math.min(99, cartItem.quantity));
    itemCount += quantity;
    if (!product) {
      unavailable.push('Un producto ya no existe en el catálogo');
      return { productId: cartItem.productId, name: 'Producto no disponible', quantity, unitPrice: 0, total: 0, available: false };
    }

    const actualBusinessId = text(product.business_id);
    const matchesExpectedBusiness = !expectedBusinessId || actualBusinessId === expectedBusinessId;
    if (!matchesExpectedBusiness) integrityMismatchCount += 1;

    const business = businessMap.get(actualBusinessId);
    const metadata = objectValue(business?.metadata);
    const validBusiness = Boolean(
      business
      && matchesExpectedBusiness
      && business.is_active
      && business.is_verified
      && !business.deleted_at
      && text(metadata.catalog_status, 'live') === 'live',
    );
    const available = text(product.status) === 'available' && !product.deleted_at && validBusiness;
    const unitPrice = numeric(product.discount_price) > 0 ? numeric(product.discount_price) : numeric(product.price);
    const total = available ? unitPrice * quantity : 0;
    subtotal += total;
    if (!available) unavailable.push(text(product.name, 'Producto no disponible'));
    if (business && matchesExpectedBusiness && !businessName) {
      businessName = text(business.name, 'Negocio');
      businessSlug = text(business.slug);
    }
    return {
      productId: text(product.id),
      name: text(product.name, 'Producto'),
      quantity,
      unitPrice,
      total,
      available,
      businessId: actualBusinessId,
      integrityValid: matchesExpectedBusiness,
    };
  });

  const availableItems = items.filter((item) => item.available);
  const summary = availableItems.length > 0
    ? availableItems.map((item) => `${item.quantity} × ${item.name} (${formatCop(item.total)})`).join('; ')
    : 'No hay productos disponibles para calcular.';
  const availabilityNote = unavailable.length > 0
    ? ` Revisa ${unavailable.length} producto${unavailable.length === 1 ? '' : 's'} no disponible${unavailable.length === 1 ? '' : 's'} antes de continuar.`
    : '';
  const integrityNote = integrityMismatchCount > 0
    ? ' Detecté productos asociados a otro negocio y los excluí del subtotal por seguridad.'
    : '';

  return {
    name: plan.name,
    success: true,
    message: `Tu carrito de ${businessName || 'DomiU'} tiene ${itemCount} unidad${itemCount === 1 ? '' : 'es'}: ${summary} Subtotal verificado con precios actuales: ${formatCop(subtotal)}.${availabilityNote}${integrityNote}`,
    data: {
      businessId: expectedBusinessId,
      businessName: businessName || null,
      items,
      itemCount,
      subtotal,
      unavailableCount: unavailable.length,
      integrityMismatchCount,
      priceSource: 'server_catalog',
    },
    recordCount: items.length,
    suggestedActions: unavailable.length > 0 ? ['Buscar productos', 'Consultar mis pedidos'] : ['Consultar mis pedidos'],
    navigation: [
      { label: 'Abrir carrito', href: '/cliente/cart' },
      ...(businessSlug ? [{ label: `Ver ${businessName}`, href: `/cliente/business/${businessSlug}` }] : []),
    ],
  };
}

async function listOrders(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canUse(context, 'orders.read')) return denied(plan.name);

  const requestedLimit = numeric(plan.arguments.limit);
  const limit = Math.max(1, Math.min(10, requestedLimit || 5));
  const orderResult = await supabase
    .from('orders')
    .select('id,order_number,business_id,status,payment_status,total_amount,estimated_delivery_time,created_at,updated_at')
    .eq('customer_id', context.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (orderResult.error) throw new Error('customer_orders_read_failed');

  const orderRows = (orderResult.data ?? []) as Array<Record<string, unknown>>;
  const businessIds = [...new Set(orderRows.map((row) => text(row.business_id)).filter(Boolean))];
  const businessResult = businessIds.length > 0
    ? await supabase.from('businesses').select('id,name').in('id', businessIds)
    : { data: [], error: null };
  if (businessResult.error) throw new Error('customer_orders_business_failed');
  const businessMap = new Map(((businessResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [text(row.id), text(row.name, 'Negocio')]));

  const orders = orderRows.map((order) => ({
    id: text(order.id),
    orderNumber: text(order.order_number),
    businessName: businessMap.get(text(order.business_id)) || 'Negocio',
    status: text(order.status, 'pending'),
    statusLabel: ORDER_STATUS_LABELS[text(order.status)] || text(order.status, 'pendiente'),
    paymentStatus: text(order.payment_status),
    total: numeric(order.total_amount),
    createdAt: text(order.created_at),
    estimatedDeliveryTime: text(order.estimated_delivery_time) || null,
  }));

  const message = orders.length > 0
    ? `Tus pedidos más recientes son: ${orders.map((order) => `${order.orderNumber} de ${order.businessName}, ${order.statusLabel}, por ${formatCop(order.total)}, creado ${formatDate(order.createdAt, context.client.timezone)}`).join('; ')}.`
    : 'Todavía no tienes pedidos registrados en esta cuenta.';

  return {
    name: plan.name,
    success: true,
    message,
    data: { orders },
    recordCount: orders.length,
    suggestedActions: orders.length > 0 ? ['¿Dónde está mi último pedido?', 'Consultar mi carrito'] : ['Buscar productos'],
    navigation: orders.slice(0, 4).map((order) => ({ label: `Ver ${order.orderNumber}`, href: `/cliente/pedidos/${order.id}` })),
  };
}

async function trackOrder(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canUse(context, 'orders.read')) return denied(plan.name);

  const reference = safeOrderReference(plan.arguments.reference);
  const orderResult = await supabase
    .from('orders')
    .select('id,order_number,business_id,status,payment_status,total_amount,estimated_delivery_time,created_at,updated_at')
    .eq('customer_id', context.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (orderResult.error) throw new Error('customer_track_order_read_failed');

  const orderRows = (orderResult.data ?? []) as Array<Record<string, unknown>>;
  const selected = reference
    ? orderRows.find((order) => text(order.id).toLowerCase() === reference.toLowerCase() || text(order.order_number).toLowerCase().includes(reference.toLowerCase()))
    : orderRows.find((order) => !TERMINAL_ORDER_STATUSES.has(text(order.status))) || orderRows[0];

  if (!selected) {
    return {
      name: plan.name,
      success: true,
      message: reference
        ? `No encontré el pedido “${reference}” dentro de tu cuenta.`
        : 'No tienes pedidos registrados para hacer seguimiento.',
      data: { reference, order: null },
      recordCount: 0,
      suggestedActions: ['Consultar mis pedidos', 'Buscar productos'],
      navigation: [{ label: 'Ver pedidos', href: '/cliente/pedidos' }],
    };
  }

  const [businessResult, trackingResult] = await Promise.all([
    supabase.from('businesses').select('name').eq('id', text(selected.business_id)).maybeSingle(),
    supabase
      .from('order_tracking')
      .select('status,created_at')
      .eq('order_id', text(selected.id))
      .order('created_at', { ascending: false })
      .limit(8),
  ]);
  if (businessResult.error || trackingResult.error) throw new Error('customer_track_order_details_failed');

  const status = text(selected.status, 'pending');
  const events = ((trackingResult.data ?? []) as Array<Record<string, unknown>>).map((event) => ({
    status: text(event.status),
    statusLabel: ORDER_STATUS_LABELS[text(event.status)] || text(event.status),
    createdAt: text(event.created_at),
  }));
  const estimated = text(selected.estimated_delivery_time);
  const estimatedText = estimated ? ` Entrega estimada: ${formatDate(estimated, context.client.timezone)}.` : '';
  const latestEvent = events[0]
    ? ` Última actualización: ${events[0].statusLabel}, ${formatDate(events[0].createdAt, context.client.timezone)}.`
    : '';
  const order = {
    id: text(selected.id),
    orderNumber: text(selected.order_number),
    businessName: text(businessResult.data?.name, 'Negocio'),
    status,
    statusLabel: ORDER_STATUS_LABELS[status] || status,
    paymentStatus: text(selected.payment_status),
    total: numeric(selected.total_amount),
    createdAt: text(selected.created_at),
    estimatedDeliveryTime: estimated || null,
    active: !TERMINAL_ORDER_STATUSES.has(status),
    events,
  };

  return {
    name: plan.name,
    success: true,
    message: `Tu pedido ${order.orderNumber} de ${order.businessName} está ${order.statusLabel}. Total: ${formatCop(order.total)}.${estimatedText}${latestEvent}`,
    data: { reference, order },
    recordCount: 1,
    suggestedActions: order.active ? ['Actualizar seguimiento', 'Consultar mis pedidos'] : ['Consultar mis pedidos', 'Buscar productos'],
    navigation: [{ label: `Abrir pedido ${order.orderNumber}`, href: `/cliente/pedidos/${order.id}` }],
  };
}

export async function executeDomiCustomerTool(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  switch (plan.name) {
    case 'customer.search_catalog':
      return searchCatalog(supabase, context, plan);
    case 'customer.cart_summary':
      return cartSummary(supabase, context, plan);
    case 'customer.list_orders':
      return listOrders(supabase, context, plan);
    case 'customer.track_order':
      return trackOrder(supabase, context, plan);
    default:
      return denied(plan.name);
  }
}
