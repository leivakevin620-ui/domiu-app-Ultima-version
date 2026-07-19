import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiToolPlan } from '@/lib/domi/tools/types';

function normalizedText(message: string) {
  return message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSearchQuery(message: string) {
  const withoutPrefix = message
    .trim()
    .replace(/^(?:por favor\s+)?(?:busca(?:r|me)?|encuentra(?:r|me)?|muestra(?:me)?|quiero(?:\s+buscar)?|hay)\s+/i, '')
    .replace(/^(?:productos?|negocios?|restaurantes?|comida)\s+(?:de|para|con)?\s*/i, '')
    .replace(/[<>()[\]{}|`$^\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  if (!withoutPrefix || /^(productos?|negocios?|restaurantes?|comida|algo)$/.test(withoutPrefix.toLowerCase())) {
    return '';
  }
  return withoutPrefix;
}

function extractOrderReference(message: string) {
  const uuid = message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
  if (uuid) return uuid;

  const labelled = message.match(/(?:pedido|orden|numero|número|#)\s*[:#-]?\s*([A-Za-z0-9-]{4,32})/i)?.[1];
  return labelled?.trim().slice(0, 32) || '';
}

function hasPermission(context: Pick<DomiServerContext, 'permissions'>, permission: string) {
  return context.permissions.includes(permission);
}

function planCustomerTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  if (context.role !== 'customer') return null;

  const normalized = normalizedText(message);
  const has = (permission: string) => hasPermission(context, permission);

  if (/\b(auditoria|auditorias|permiso|permisos|roles?|sesiones?|usuarios? del sistema|metricas administrativas|panel admin|administrador)\b/.test(normalized)) {
    return null;
  }

  if (has('cart.read') && /\b(carrito|cesta|compra actual|que tengo agregado|qué tengo agregado)\b/.test(normalized)) {
    return {
      name: 'customer.cart_summary',
      intent: 'customer_cart_summary',
      arguments: {},
    };
  }

  if (
    has('orders.read')
    && /\b(pedido|orden|domicilio)\b/.test(normalized)
    && /\b(donde|estado|seguir|rastrear|seguimiento|como va|cómo va|ultimo|último|actual)\b/.test(normalized)
  ) {
    return {
      name: 'customer.track_order',
      intent: 'customer_track_order',
      arguments: { reference: extractOrderReference(message) },
    };
  }

  if (
    has('orders.read')
    && /\b(mis pedidos|pedidos recientes|historial de pedidos|ver pedidos|consultar mis pedidos|ordenes recientes|órdenes recientes)\b/.test(normalized)
  ) {
    return {
      name: 'customer.list_orders',
      intent: 'customer_list_orders',
      arguments: { limit: 5 },
    };
  }

  const searchSignal = /\b(busca|buscar|buscame|encuentra|encuentrame|muestra|muestrame|quiero|hay)\b/.test(normalized)
    || /\b(hamburguesa|pizza|pollo|alitas|sushi|farmacia|medicamento|mercado|supermercado|restaurante|producto)\b/.test(normalized);

  if (has('business.search') && has('products.search') && searchSignal) {
    return {
      name: 'customer.search_catalog',
      intent: 'customer_search_catalog',
      arguments: { query: cleanSearchQuery(message) },
    };
  }

  return null;
}

export function planDomiMerchantTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  if (context.role !== 'merchant') return null;
  const normalized = normalizedText(message);

  if (/\b(como repartidor|para repartir|pedidos libres|sin asignar|ganancias del repartidor|auditoria administrativa|permisos del sistema)\b/.test(normalized)) {
    return null;
  }

  if (
    hasPermission(context, 'inventory.read')
    && /\b(inventario|existencias|stock|agotad|pocas unidades|bajo inventario|productos bajos)\b/.test(normalized)
  ) {
    return {
      name: 'merchant.inventory_summary',
      intent: 'merchant_inventory_summary',
      arguments: { lowStockThreshold: 5, limit: 50 },
    };
  }

  if (
    hasPermission(context, 'reviews.read')
    && /\b(resena|reseña|resenas|reseñas|comentarios|calificaciones|opiniones)\b/.test(normalized)
  ) {
    return {
      name: 'merchant.reviews_summary',
      intent: 'merchant_reviews_summary',
      arguments: { limit: 10 },
    };
  }

  if (
    hasPermission(context, 'reports.read')
    && /\b(ventas|vendimos|vendido|facturacion|facturación|facturamos|ingresos|reporte|metricas|métricas|mas vendido|más vendido|rendimiento)\b/.test(normalized)
  ) {
    return {
      name: 'merchant.sales_summary',
      intent: 'merchant_sales_summary',
      arguments: { days: 30 },
    };
  }

  if (
    hasPermission(context, 'orders.read')
    && /\b(pedido|pedidos|orden|ordenes|órdenes|demora|retraso|preparacion|preparación)\b/.test(normalized)
  ) {
    return {
      name: 'merchant.list_orders',
      intent: 'merchant_list_orders',
      arguments: {
        limit: 10,
        activeOnly: !/\b(historial|todos|anteriores|completados)\b/.test(normalized),
      },
    };
  }

  return null;
}

export function planDomiCourierTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  if (context.role !== 'courier') return null;
  const normalized = normalizedText(message);

  if (/\b(ventas del negocio|inventario del negocio|auditoria administrativa|permisos del sistema|todos los repartidores)\b/.test(normalized)) {
    return null;
  }

  if (
    hasPermission(context, 'earnings.read')
    && /\b(ganancia|ganancias|saldo|liquidacion|liquidación|cuanto he ganado|cuánto he ganado|pago)\b/.test(normalized)
  ) {
    return {
      name: 'courier.earnings_summary',
      intent: 'courier_earnings_summary',
      arguments: { days: 30 },
    };
  }

  if (
    hasPermission(context, 'delivery.read')
    && /\b(historial|entregas completadas|pedidos entregados|domicilios realizados)\b/.test(normalized)
  ) {
    return {
      name: 'courier.delivery_history',
      intent: 'courier_delivery_history',
      arguments: { limit: 10 },
    };
  }

  if (
    hasPermission(context, 'assignments.read')
    && /\b(disponibles|pedidos libres|pedidos para aceptar|nuevos pedidos|sin asignar)\b/.test(normalized)
  ) {
    return {
      name: 'courier.available_orders',
      intent: 'courier_available_orders',
      arguments: { limit: 10 },
    };
  }

  if (
    hasPermission(context, 'assignments.read')
    && hasPermission(context, 'delivery.read')
    && /\b(asignad|mis pedidos|pedido actual|ruta|recogida|recoger|direccion|dirección|entrega|instrucciones)\b/.test(normalized)
  ) {
    return {
      name: 'courier.assignments',
      intent: 'courier_assignments',
      arguments: { limit: 10, activeOnly: true },
    };
  }

  return null;
}

export function planDomiAdminTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  if (context.role !== 'admin') return null;
  const normalized = normalizedText(message);

  if (
    hasPermission(context, 'audit.read')
    && /\b(auditoria|auditoría|auditorias|auditorías|seguridad|errores recientes|acciones recientes|registro de actividad)\b/.test(normalized)
  ) {
    return {
      name: 'admin.audit_summary',
      intent: 'admin_audit_summary',
      arguments: { limit: 15 },
    };
  }

  if (
    hasPermission(context, 'business.read')
    && /\b(negocio|negocios|comercio|comercios|locales|verificados)\b/.test(normalized)
  ) {
    return {
      name: 'admin.business_summary',
      intent: 'admin_business_summary',
      arguments: { limit: 15 },
    };
  }

  if (
    hasPermission(context, 'courier.read')
    && /\b(repartidor|repartidores|courier|domiciliarios|conductores)\b/.test(normalized)
  ) {
    return {
      name: 'admin.courier_summary',
      intent: 'admin_courier_summary',
      arguments: { limit: 15 },
    };
  }

  if (
    hasPermission(context, 'orders.read')
    && /\b(pedido|pedidos|orden|ordenes|órdenes|detenidos|demorados|retrasados)\b/.test(normalized)
  ) {
    return {
      name: 'admin.order_summary',
      intent: 'admin_order_summary',
      arguments: { limit: 20, stalledMinutes: 45 },
    };
  }

  if (
    hasPermission(context, 'operation.read')
    && hasPermission(context, 'reports.read')
    && /\b(metricas|métricas|dashboard|resumen general|estado general|estado del sistema|operacion|operación|plataforma|rendimiento)\b/.test(normalized)
  ) {
    return {
      name: 'admin.platform_metrics',
      intent: 'admin_platform_metrics',
      arguments: {},
    };
  }

  return null;
}

export function planDomiTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  switch (context.role) {
    case 'customer':
      return planCustomerTool(context, message);
    case 'merchant':
      return planDomiMerchantTool(context, message);
    case 'courier':
      return planDomiCourierTool(context, message);
    case 'admin':
      return planDomiAdminTool(context, message);
    default:
      return null;
  }
}

// Alias conservado para que la ruta existente use el planificador multirrol sin una migración destructiva.
export const planDomiCustomerTool = planDomiTool;
