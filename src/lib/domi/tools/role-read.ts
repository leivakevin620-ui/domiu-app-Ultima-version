import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiServerContext } from '@/lib/domi/server-context';
import { canExecuteDomiTool } from '@/lib/domi/tools/registry';
import type { DomiToolPlan, DomiToolResult } from '@/lib/domi/tools/types';

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'refunded']);
const ACTIVE_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'pendiente',
  confirmed: 'confirmado',
  preparing: 'en preparación',
  ready: 'listo para recoger',
  assigned: 'asignado',
  accepted: 'aceptado',
  picked_up: 'recogido',
  in_transit: 'en camino',
  delivered: 'entregado',
  cancelled: 'cancelado',
  refunded: 'reembolsado',
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolean(value: unknown) {
  return value === true;
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(max, parsed)) : fallback;
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

function maskEmail(value: unknown) {
  const email = text(value);
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'usuario';
  return `${local.slice(0, 2)}***@${domain}`;
}

function statusLabel(value: unknown) {
  const status = text(value, 'pending');
  return ORDER_STATUS_LABELS[status] || status;
}

function denied(name: DomiToolPlan['name'], reason = 'permission_denied'): DomiToolResult {
  return {
    name,
    success: false,
    message: 'Esta herramienta no está disponible para tu perfil o contexto actual.',
    data: { reason },
    recordCount: 0,
    suggestedActions: [],
    navigation: [],
  };
}

function ensureMerchantContext(context: DomiServerContext, plan: DomiToolPlan) {
  return canExecuteDomiTool(context, plan.name)
    && context.role === 'merchant'
    && context.tenantType === 'business'
    && context.tenantId !== context.userId;
}

async function merchantListOrders(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!ensureMerchantContext(context, plan)) return denied(plan.name, 'merchant_tenant_missing');

  const limit = boundedInteger(plan.arguments.limit, 10, 20);
  const activeOnly = plan.arguments.activeOnly !== false;
  let query = supabase
    .from('orders')
    .select('id,order_number,status,payment_status,total_amount,estimated_delivery_time,created_at,updated_at,courier_id')
    .eq('business_id', context.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (activeOnly) query = query.in('status', ACTIVE_ORDER_STATUSES);

  const { data, error } = await query;
  if (error) throw new Error('merchant_orders_read_failed');

  const orders = ((data ?? []) as Array<Record<string, unknown>>).map((order) => ({
    id: text(order.id),
    orderNumber: text(order.order_number),
    status: text(order.status),
    statusLabel: statusLabel(order.status),
    paymentStatus: text(order.payment_status),
    total: numeric(order.total_amount),
    courierAssigned: Boolean(order.courier_id),
    createdAt: text(order.created_at),
    updatedAt: text(order.updated_at),
    estimatedDeliveryTime: text(order.estimated_delivery_time) || null,
  }));

  const delayed = orders.filter((order) => {
    if (TERMINAL_ORDER_STATUSES.has(order.status)) return false;
    const updatedAt = Date.parse(order.updatedAt);
    return Number.isFinite(updatedAt) && Date.now() - updatedAt > 45 * 60_000;
  });

  const message = orders.length > 0
    ? `Encontré ${orders.length} pedido${orders.length === 1 ? '' : 's'} de ${context.tenantLabel}. ${orders.slice(0, 6).map((order) => `${order.orderNumber}: ${order.statusLabel}, ${formatCop(order.total)}`).join('; ')}.${delayed.length ? ` Atención: ${delayed.length} lleva más de 45 minutos sin actualización.` : ''}`
    : activeOnly
      ? 'No hay pedidos activos para tu negocio en este momento.'
      : 'No encontré pedidos registrados para tu negocio.';

  return {
    name: plan.name,
    success: true,
    message,
    data: { businessId: context.tenantId, activeOnly, orders, delayedCount: delayed.length },
    recordCount: orders.length,
    suggestedActions: ['Consultar inventario', 'Consultar ventas'],
    navigation: [{ label: 'Abrir pedidos del negocio', href: '/negocio/pedidos' }],
  };
}

async function merchantInventorySummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!ensureMerchantContext(context, plan)) return denied(plan.name, 'merchant_tenant_missing');

  const limit = boundedInteger(plan.arguments.limit, 50, 100);
  const threshold = boundedInteger(plan.arguments.lowStockThreshold, 5, 50);
  const { data, error } = await supabase
    .from('products')
    .select('id,name,sku,status,quantity_available,price,discount_price,total_sales,updated_at')
    .eq('business_id', context.tenantId)
    .is('deleted_at', null)
    .order('quantity_available', { ascending: true })
    .limit(limit);
  if (error) throw new Error('merchant_inventory_read_failed');

  const products = ((data ?? []) as Array<Record<string, unknown>>).map((product) => ({
    id: text(product.id),
    name: text(product.name, 'Producto'),
    sku: text(product.sku),
    status: text(product.status),
    quantity: numeric(product.quantity_available),
    price: numeric(product.discount_price) > 0 ? numeric(product.discount_price) : numeric(product.price),
    totalSales: numeric(product.total_sales),
    updatedAt: text(product.updated_at),
  }));
  const lowStock = products.filter((product) => product.status !== 'discontinued' && product.quantity <= threshold);
  const unavailable = products.filter((product) => product.status !== 'available' || product.quantity <= 0);

  const message = products.length > 0
    ? `Tu catálogo tiene ${products.length} producto${products.length === 1 ? '' : 's'} revisado${products.length === 1 ? '' : 's'}. ${lowStock.length} tienen ${threshold} unidades o menos y ${unavailable.length} no están disponibles. ${lowStock.slice(0, 6).map((product) => `${product.name}: ${product.quantity}`).join('; ') || 'No hay alertas de inventario bajo.'}`
    : 'Tu negocio todavía no tiene productos activos en el catálogo.';

  return {
    name: plan.name,
    success: true,
    message,
    data: {
      businessId: context.tenantId,
      threshold,
      productCount: products.length,
      lowStock,
      unavailableCount: unavailable.length,
    },
    recordCount: products.length,
    suggestedActions: ['Consultar pedidos', 'Consultar productos más vendidos'],
    navigation: [{ label: 'Administrar productos', href: '/negocio/productos' }],
  };
}

async function merchantSalesSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!ensureMerchantContext(context, plan)) return denied(plan.name, 'merchant_tenant_missing');

  const days = boundedInteger(plan.arguments.days, 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  const [ordersResult, productsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id,status,total_amount,subtotal,discount_amount,created_at')
      .eq('business_id', context.tenantId)
      .is('deleted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('products')
      .select('id,name,total_sales,status')
      .eq('business_id', context.tenantId)
      .is('deleted_at', null)
      .order('total_sales', { ascending: false })
      .limit(5),
  ]);
  if (ordersResult.error || productsResult.error) throw new Error('merchant_sales_read_failed');

  const rows = (ordersResult.data ?? []) as Array<Record<string, unknown>>;
  const delivered = rows.filter((order) => text(order.status) === 'delivered');
  const grossSales = delivered.reduce((sum, order) => sum + numeric(order.total_amount), 0);
  const subtotal = delivered.reduce((sum, order) => sum + numeric(order.subtotal), 0);
  const discounts = delivered.reduce((sum, order) => sum + numeric(order.discount_amount), 0);
  const cancelled = rows.filter((order) => text(order.status) === 'cancelled').length;
  const active = rows.filter((order) => ACTIVE_ORDER_STATUSES.includes(text(order.status))).length;
  const averageTicket = delivered.length > 0 ? grossSales / delivered.length : 0;
  const topProducts = ((productsResult.data ?? []) as Array<Record<string, unknown>>).map((product) => ({
    id: text(product.id),
    name: text(product.name, 'Producto'),
    totalSales: numeric(product.total_sales),
    status: text(product.status),
  }));

  return {
    name: plan.name,
    success: true,
    message: `En los últimos ${days} días, ${context.tenantLabel} registró ${delivered.length} pedido${delivered.length === 1 ? '' : 's'} entregado${delivered.length === 1 ? '' : 's'} por ${formatCop(grossSales)}. Ticket promedio: ${formatCop(averageTicket)}. Hay ${active} pedidos activos y ${cancelled} cancelados. ${topProducts.length ? `Más vendidos: ${topProducts.map((product) => `${product.name} (${product.totalSales})`).join('; ')}.` : ''}`,
    data: {
      businessId: context.tenantId,
      days,
      deliveredOrders: delivered.length,
      activeOrders: active,
      cancelledOrders: cancelled,
      grossSales,
      subtotal,
      discounts,
      averageTicket,
      topProducts,
    },
    recordCount: rows.length,
    suggestedActions: ['Consultar inventario', 'Consultar reseñas'],
    navigation: [{ label: 'Abrir reportes', href: '/negocio/reportes' }],
  };
}

async function merchantReviewsSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!ensureMerchantContext(context, plan)) return denied(plan.name, 'merchant_tenant_missing');
  const limit = boundedInteger(plan.arguments.limit, 10, 30);

  const { data, error } = await supabase
    .from('ratings')
    .select('id,rating,title,review,response,created_at,verified_purchase,is_public')
    .eq('rated_entity_id', context.tenantId)
    .eq('rating_type', 'merchant')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('merchant_reviews_read_failed');

  const reviews = ((data ?? []) as Array<Record<string, unknown>>)
    .filter((review) => boolean(review.is_public))
    .map((review) => ({
      id: text(review.id),
      rating: numeric(review.rating),
      title: text(review.title) || null,
      review: text(review.review).slice(0, 280) || null,
      hasResponse: Boolean(review.response),
      verifiedPurchase: boolean(review.verified_purchase),
      createdAt: text(review.created_at),
    }));
  const average = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const unanswered = reviews.filter((review) => !review.hasResponse).length;

  return {
    name: plan.name,
    success: true,
    message: reviews.length
      ? `Revisé ${reviews.length} reseña${reviews.length === 1 ? '' : 's'} recientes. Promedio: ${average.toFixed(1)} de 5. ${unanswered} no tienen respuesta. ${reviews.slice(0, 4).map((review) => `${review.rating}/5${review.review ? `: ${review.review}` : ''}`).join('; ')}`
      : 'Tu negocio no tiene reseñas públicas recientes.',
    data: { businessId: context.tenantId, averageRating: average, unansweredCount: unanswered, reviews },
    recordCount: reviews.length,
    suggestedActions: ['Consultar ventas', 'Consultar pedidos'],
    navigation: [{ label: 'Abrir reseñas', href: '/negocio/resenas' }],
  };
}

async function resolveBusinessNames(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data, error } = await supabase.from('businesses').select('id,name').in('id', ids);
  if (error) throw new Error('domi_business_names_failed');
  return new Map(((data ?? []) as Array<Record<string, unknown>>).map((row) => [text(row.id), text(row.name, 'Negocio')]));
}

async function courierAvailableOrders(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'courier') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 10, 20);

  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,business_id,status,delivery_fee,courier_earnings,pickup_address,delivery_distance_km,created_at,order_type')
    .is('courier_id', null)
    .is('deleted_at', null)
    .or('status.in.(confirmed,ready),and(status.eq.pending,order_type.eq.manual_delivery)')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error('courier_available_orders_read_failed');

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const businessMap = await resolveBusinessNames(
    supabase,
    [...new Set(rows.map((row) => text(row.business_id)).filter(Boolean))],
  );
  const orders = rows.map((order) => ({
    id: text(order.id),
    orderNumber: text(order.order_number),
    businessName: businessMap.get(text(order.business_id)) || 'Negocio',
    status: text(order.status),
    pickupAddress: text(order.pickup_address) || null,
    distanceKm: numeric(order.delivery_distance_km) || null,
    estimatedEarnings: numeric(order.courier_earnings) || numeric(order.delivery_fee),
    createdAt: text(order.created_at),
    orderType: text(order.order_type) || null,
  }));

  return {
    name: plan.name,
    success: true,
    message: orders.length
      ? `Hay ${orders.length} pedido${orders.length === 1 ? '' : 's'} disponible${orders.length === 1 ? '' : 's'}. ${orders.slice(0, 6).map((order) => `${order.orderNumber} en ${order.businessName}${order.distanceKm ? `, ${order.distanceKm.toFixed(1)} km` : ''}, ganancia estimada ${formatCop(order.estimatedEarnings)}`).join('; ')}.`
      : 'No hay pedidos disponibles para aceptar en este momento.',
    data: { orders },
    recordCount: orders.length,
    suggestedActions: ['Consultar mis pedidos asignados', 'Consultar ganancias'],
    navigation: [{ label: 'Abrir pedidos disponibles', href: '/repartidor/pedidos' }],
  };
}

async function courierAssignments(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'courier') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 10, 20);
  const activeOnly = plan.arguments.activeOnly !== false;

  let query = supabase
    .from('orders')
    .select('id,order_number,business_id,delivery_address_id,status,pickup_address,special_instructions,estimated_delivery_time,delivery_distance_km,courier_earnings,created_at,updated_at')
    .eq('courier_id', context.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (activeOnly) query = query.in('status', ACTIVE_ORDER_STATUSES);
  const { data, error } = await query;
  if (error) throw new Error('courier_assignments_read_failed');

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const businessMap = await resolveBusinessNames(
    supabase,
    [...new Set(rows.map((row) => text(row.business_id)).filter(Boolean))],
  );
  const addressIds = [...new Set(rows.map((row) => text(row.delivery_address_id)).filter(Boolean))];
  const addressResult = addressIds.length
    ? await supabase
        .from('addresses')
        .select('id,street_address,city,state_province,instructions')
        .in('id', addressIds)
        .is('deleted_at', null)
    : { data: [], error: null };
  if (addressResult.error) throw new Error('courier_assignment_addresses_failed');
  const addressMap = new Map(((addressResult.data ?? []) as Array<Record<string, unknown>>).map((address) => [
    text(address.id),
    {
      address: [text(address.street_address), text(address.city), text(address.state_province)].filter(Boolean).join(', '),
      instructions: text(address.instructions) || null,
    },
  ]));

  const assignments = rows.map((order) => {
    const address = addressMap.get(text(order.delivery_address_id));
    return {
      id: text(order.id),
      orderNumber: text(order.order_number),
      businessName: businessMap.get(text(order.business_id)) || 'Negocio',
      status: text(order.status),
      statusLabel: statusLabel(order.status),
      pickupAddress: text(order.pickup_address) || null,
      deliveryAddress: address?.address || 'Dirección disponible al abrir el pedido',
      instructions: text(order.special_instructions) || address?.instructions || null,
      estimatedDeliveryTime: text(order.estimated_delivery_time) || null,
      distanceKm: numeric(order.delivery_distance_km) || null,
      earnings: numeric(order.courier_earnings),
      updatedAt: text(order.updated_at),
    };
  });

  return {
    name: plan.name,
    success: true,
    message: assignments.length
      ? `Tienes ${assignments.length} pedido${assignments.length === 1 ? '' : 's'} asignado${assignments.length === 1 ? '' : 's'}. ${assignments.slice(0, 5).map((order) => `${order.orderNumber}: ${order.statusLabel}, recoge en ${order.businessName} y entrega en ${order.deliveryAddress}`).join('; ')}.`
      : 'No tienes pedidos activos asignados en este momento.',
    data: { activeOnly, assignments },
    recordCount: assignments.length,
    suggestedActions: ['Consultar pedidos disponibles', 'Consultar ganancias'],
    navigation: [{ label: 'Abrir mis pedidos', href: '/repartidor/pedidos' }],
  };
}

async function courierEarningsSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'courier') return denied(plan.name);
  const days = boundedInteger(plan.arguments.days, 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();

  const { data, error } = await supabase
    .from('driver_earnings')
    .select('id,order_id,base_amount,bonus_amount,penalty_amount,total_earned,status,paid_at,created_at')
    .eq('driver_id', context.userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error('courier_earnings_read_failed');

  const earnings = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: text(row.id),
    orderId: text(row.order_id),
    baseAmount: numeric(row.base_amount),
    bonusAmount: numeric(row.bonus_amount),
    penaltyAmount: numeric(row.penalty_amount),
    totalEarned: numeric(row.total_earned),
    status: text(row.status),
    paidAt: text(row.paid_at) || null,
    createdAt: text(row.created_at),
  }));
  const total = earnings.reduce((sum, item) => sum + item.totalEarned, 0);
  const paid = earnings.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.totalEarned, 0);
  const pending = earnings.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.totalEarned, 0);
  const bonuses = earnings.reduce((sum, item) => sum + item.bonusAmount, 0);
  const penalties = earnings.reduce((sum, item) => sum + item.penaltyAmount, 0);

  return {
    name: plan.name,
    success: true,
    message: `En los últimos ${days} días tienes ${earnings.length} movimiento${earnings.length === 1 ? '' : 's'} por ${formatCop(total)}. Pagado: ${formatCop(paid)}. Pendiente: ${formatCop(pending)}. Bonos: ${formatCop(bonuses)}. Descuentos o penalizaciones: ${formatCop(penalties)}.`,
    data: { days, total, paid, pending, bonuses, penalties, movementCount: earnings.length },
    recordCount: earnings.length,
    suggestedActions: ['Consultar mis entregas', 'Consultar pedidos disponibles'],
    navigation: [{ label: 'Abrir ganancias', href: '/repartidor/ganancias' }],
  };
}

async function courierDeliveryHistory(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'courier') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 10, 30);

  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,business_id,status,courier_earnings,actual_delivery_time,created_at')
    .eq('courier_id', context.userId)
    .eq('status', 'delivered')
    .is('deleted_at', null)
    .order('actual_delivery_time', { ascending: false })
    .limit(limit);
  if (error) throw new Error('courier_delivery_history_failed');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const businessMap = await resolveBusinessNames(
    supabase,
    [...new Set(rows.map((row) => text(row.business_id)).filter(Boolean))],
  );
  const deliveries = rows.map((order) => ({
    id: text(order.id),
    orderNumber: text(order.order_number),
    businessName: businessMap.get(text(order.business_id)) || 'Negocio',
    earnings: numeric(order.courier_earnings),
    deliveredAt: text(order.actual_delivery_time) || text(order.created_at),
  }));

  return {
    name: plan.name,
    success: true,
    message: deliveries.length
      ? `Tus últimas ${deliveries.length} entregas son: ${deliveries.slice(0, 6).map((delivery) => `${delivery.orderNumber} de ${delivery.businessName}, ${formatDate(delivery.deliveredAt, context.client.timezone)}, ${formatCop(delivery.earnings)}`).join('; ')}.`
      : 'Todavía no tienes entregas completadas registradas.',
    data: { deliveries },
    recordCount: deliveries.length,
    suggestedActions: ['Consultar ganancias', 'Consultar pedidos disponibles'],
    navigation: [{ label: 'Abrir historial de pedidos', href: '/repartidor/pedidos' }],
  };
}

async function adminPlatformMetrics(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'admin') return denied(plan.name);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [users, businesses, couriers, activeOrders, todayOrders] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
    supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ACTIVE_ORDER_STATUSES).is('deleted_at', null),
    supabase.from('orders').select('id,total_amount,status', { count: 'exact' }).gte('created_at', todayIso).is('deleted_at', null).limit(500),
  ]);
  if (users.error || businesses.error || couriers.error || activeOrders.error || todayOrders.error) {
    throw new Error('admin_metrics_read_failed');
  }

  const todayRows = (todayOrders.data ?? []) as Array<Record<string, unknown>>;
  const todayDelivered = todayRows.filter((order) => text(order.status) === 'delivered');
  const todayRevenue = todayDelivered.reduce((sum, order) => sum + numeric(order.total_amount), 0);
  const metrics = {
    activeUsers: Number(users.count || 0),
    activeBusinesses: Number(businesses.count || 0),
    activeCouriers: Number(couriers.count || 0),
    activeOrders: Number(activeOrders.count || 0),
    todayOrders: Number(todayOrders.count || 0),
    todayDelivered: todayDelivered.length,
    todayRevenue,
  };

  return {
    name: plan.name,
    success: true,
    message: `Estado general: ${metrics.activeUsers} usuarios activos, ${metrics.activeBusinesses} negocios activos, ${metrics.activeCouriers} repartidores activos y ${metrics.activeOrders} pedidos en curso. Hoy se registraron ${metrics.todayOrders} pedidos, ${metrics.todayDelivered} entregados por ${formatCop(metrics.todayRevenue)}.`,
    data: { metrics, generatedAt: new Date().toISOString() },
    recordCount: 6,
    suggestedActions: ['Consultar pedidos detenidos', 'Consultar negocios', 'Consultar repartidores'],
    navigation: [{ label: 'Abrir dashboard administrativo', href: '/admin' }],
  };
}

async function adminOrderSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'admin') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 20, 50);
  const stalledMinutes = boundedInteger(plan.arguments.stalledMinutes, 45, 240);

  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,business_id,courier_id,status,total_amount,created_at,updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('admin_orders_read_failed');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const orders = rows.map((order) => ({
    id: text(order.id),
    orderNumber: text(order.order_number),
    businessId: text(order.business_id),
    courierAssigned: Boolean(order.courier_id),
    status: text(order.status),
    total: numeric(order.total_amount),
    createdAt: text(order.created_at),
    updatedAt: text(order.updated_at),
  }));
  const byStatus = orders.reduce<Record<string, number>>((summary, order) => {
    summary[order.status] = (summary[order.status] || 0) + 1;
    return summary;
  }, {});
  const stalled = orders.filter((order) => {
    if (TERMINAL_ORDER_STATUSES.has(order.status)) return false;
    const updatedAt = Date.parse(order.updatedAt);
    return Number.isFinite(updatedAt) && Date.now() - updatedAt > stalledMinutes * 60_000;
  });

  return {
    name: plan.name,
    success: true,
    message: `Revisé ${orders.length} pedidos recientes. Estados: ${Object.entries(byStatus).map(([status, count]) => `${statusLabel(status)} ${count}`).join(', ') || 'sin datos'}. ${stalled.length} pedido${stalled.length === 1 ? '' : 's'} lleva${stalled.length === 1 ? '' : 'n'} más de ${stalledMinutes} minutos sin actualización.`,
    data: { orders, byStatus, stalled, stalledMinutes },
    recordCount: orders.length,
    suggestedActions: ['Consultar métricas generales', 'Consultar negocios'],
    navigation: [{ label: 'Abrir pedidos administrativos', href: '/admin/pedidos' }],
  };
}

async function adminBusinessSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'admin') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 15, 50);

  const { data, error } = await supabase
    .from('businesses')
    .select('id,name,business_type,is_active,is_verified,rating,total_ratings,operations_status,is_accepting_orders,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('admin_businesses_read_failed');
  const businesses = ((data ?? []) as Array<Record<string, unknown>>).map((business) => ({
    id: text(business.id),
    name: text(business.name, 'Negocio'),
    type: text(business.business_type),
    active: boolean(business.is_active),
    verified: boolean(business.is_verified),
    rating: numeric(business.rating),
    totalRatings: numeric(business.total_ratings),
    operationsStatus: text(business.operations_status),
    acceptingOrders: boolean(business.is_accepting_orders),
    createdAt: text(business.created_at),
  }));
  const active = businesses.filter((business) => business.active).length;
  const pendingVerification = businesses.filter((business) => !business.verified).length;
  const open = businesses.filter((business) => business.operationsStatus === 'open' && business.acceptingOrders).length;

  return {
    name: plan.name,
    success: true,
    message: `Revisé ${businesses.length} negocios recientes: ${active} activos, ${open} recibiendo pedidos y ${pendingVerification} pendientes de verificación. ${businesses.slice(0, 6).map((business) => `${business.name}: ${business.active ? 'activo' : 'inactivo'}, ${business.verified ? 'verificado' : 'sin verificar'}`).join('; ')}.`,
    data: { businesses, activeCount: active, openCount: open, pendingVerificationCount: pendingVerification },
    recordCount: businesses.length,
    suggestedActions: ['Consultar métricas generales', 'Consultar pedidos'],
    navigation: [{ label: 'Abrir negocios', href: '/admin/negocios' }],
  };
}

async function adminCourierSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'admin') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 15, 50);

  const { data, error } = await supabase
    .from('drivers')
    .select('id,status,is_available,is_verified,is_active,total_deliveries,completed_deliveries,rating,updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('admin_couriers_read_failed');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const profileResult = rows.length
    ? await supabase.from('profiles').select('id,first_name,last_name,status').in('id', rows.map((row) => text(row.id)))
    : { data: [], error: null };
  if (profileResult.error) throw new Error('admin_courier_profiles_failed');
  const profileMap = new Map(((profileResult.data ?? []) as Array<Record<string, unknown>>).map((profile) => [
    text(profile.id),
    {
      name: [text(profile.first_name), text(profile.last_name)].filter(Boolean).join(' ') || 'Repartidor',
      accountStatus: text(profile.status),
    },
  ]));
  const couriers = rows.map((driver) => {
    const profile = profileMap.get(text(driver.id));
    return {
      id: text(driver.id),
      name: profile?.name || 'Repartidor',
      accountStatus: profile?.accountStatus || 'unknown',
      status: text(driver.status),
      available: boolean(driver.is_available),
      verified: boolean(driver.is_verified),
      active: boolean(driver.is_active),
      totalDeliveries: numeric(driver.total_deliveries),
      completedDeliveries: numeric(driver.completed_deliveries),
      rating: numeric(driver.rating),
      updatedAt: text(driver.updated_at),
    };
  });
  const available = couriers.filter((courier) => courier.available && courier.active).length;
  const unverified = couriers.filter((courier) => !courier.verified).length;

  return {
    name: plan.name,
    success: true,
    message: `Revisé ${couriers.length} repartidores recientes: ${available} disponibles y ${unverified} pendientes de verificación. ${couriers.slice(0, 6).map((courier) => `${courier.name}: ${courier.status}, ${courier.completedDeliveries} entregas`).join('; ')}.`,
    data: { couriers, availableCount: available, unverifiedCount: unverified },
    recordCount: couriers.length,
    suggestedActions: ['Consultar métricas generales', 'Consultar pedidos'],
    navigation: [{ label: 'Abrir repartidores', href: '/admin/repartidores' }],
  };
}

async function adminAuditSummary(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  if (!canExecuteDomiTool(context, plan.name) || context.role !== 'admin') return denied(plan.name);
  const limit = boundedInteger(plan.arguments.limit, 15, 30);

  const { data, error } = await supabase
    .from('audit_log')
    .select('id,user_email,user_role,action,entity_type,result,error_message,created_at,details')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('admin_audit_read_failed');
  const events = ((data ?? []) as Array<Record<string, unknown>>).map((event) => ({
    id: text(event.id),
    user: maskEmail(event.user_email),
    role: text(event.user_role),
    action: text(event.action),
    entityType: text(event.entity_type),
    result: text(event.result),
    error: text(event.error_message).slice(0, 180) || null,
    createdAt: text(event.created_at),
  }));
  const failed = events.filter((event) => event.result === 'error' || event.result === 'blocked');

  return {
    name: plan.name,
    success: true,
    message: `Revisé ${events.length} eventos recientes de auditoría. ${failed.length} fueron bloqueados o terminaron con error. ${events.slice(0, 6).map((event) => `${event.action} por ${event.user}: ${event.result}, ${formatDate(event.createdAt, context.client.timezone)}`).join('; ')}.`,
    data: { events, failedCount: failed.length, personalDataMasked: true },
    recordCount: events.length,
    suggestedActions: ['Consultar métricas generales', 'Consultar pedidos detenidos'],
    navigation: [{ label: 'Abrir auditoría', href: '/admin/auditoria' }],
  };
}

export async function executeDomiRoleReadTool(
  supabase: SupabaseClient,
  context: DomiServerContext,
  plan: DomiToolPlan,
): Promise<DomiToolResult> {
  switch (plan.name) {
    case 'merchant.list_orders':
      return merchantListOrders(supabase, context, plan);
    case 'merchant.inventory_summary':
      return merchantInventorySummary(supabase, context, plan);
    case 'merchant.sales_summary':
      return merchantSalesSummary(supabase, context, plan);
    case 'merchant.reviews_summary':
      return merchantReviewsSummary(supabase, context, plan);
    case 'courier.available_orders':
      return courierAvailableOrders(supabase, context, plan);
    case 'courier.assignments':
      return courierAssignments(supabase, context, plan);
    case 'courier.earnings_summary':
      return courierEarningsSummary(supabase, context, plan);
    case 'courier.delivery_history':
      return courierDeliveryHistory(supabase, context, plan);
    case 'admin.platform_metrics':
      return adminPlatformMetrics(supabase, context, plan);
    case 'admin.order_summary':
      return adminOrderSummary(supabase, context, plan);
    case 'admin.business_summary':
      return adminBusinessSummary(supabase, context, plan);
    case 'admin.courier_summary':
      return adminCourierSummary(supabase, context, plan);
    case 'admin.audit_summary':
      return adminAuditSummary(supabase, context, plan);
    default:
      return denied(plan.name, 'unsupported_role_tool');
  }
}
