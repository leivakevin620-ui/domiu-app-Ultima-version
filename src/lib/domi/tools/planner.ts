import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiToolPlan } from '@/lib/domi/tools/types';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

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
  const uuid = message.match(new RegExp(`\\b${UUID_PATTERN}\\b`, 'i'))?.[0];
  if (uuid) return uuid;
  const labelled = message.match(/(?:pedido|orden|numero|número|#)\s*[:#-]?\s*([A-Za-z0-9-]{4,32})/i)?.[1];
  return labelled?.trim().slice(0, 32) || '';
}

function extractActionId(message: string) {
  return message.match(new RegExp(UUID_PATTERN, 'i'))?.[0] || '';
}

function extractProductReference(message: string) {
  const uuid = message.match(new RegExp(`\\b${UUID_PATTERN}\\b`, 'i'))?.[0];
  if (uuid) return uuid;
  const patterns = [
    /(?:producto|sku)\s*[:#-]?\s*[“"']?([^“"']{2,100}?)[”"']?(?=\s+(?:como|a|en|con|stock|existencias)|$)/i,
    /(?:stock|existencias)\s+(?:de|del)\s+[“"']?([^“"']{2,100}?)[”"']?(?=\s+(?:a|en|=)|$)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern)?.[1]?.trim();
    if (match) return match.slice(0, 100);
  }
  return '';
}

function extractTargetQuantity(message: string) {
  const match = message.match(/(?:stock|existencias|cantidad|unidades)(?:\s+(?:de|del)\s+[^\d]{1,100})?\s*(?:a|en|=|de)?\s*(\d{1,6})/i)?.[1];
  if (!match) return null;
  const quantity = Number(match);
  return Number.isInteger(quantity) && quantity >= 0 && quantity <= 100000 ? quantity : null;
}

function hasPermission(context: Pick<DomiServerContext, 'permissions'>, permission: string) {
  return context.permissions.includes(permission);
}

function planGlobalTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  const normalized = normalizedText(message);
  const actionId = extractActionId(message);

  if (actionId && /\b(confirmar|confirma|confirmo|ejecutar|ejecuta)\s+accion\b/.test(normalized)) {
    return { name: 'action.confirm', intent: 'action_confirm', arguments: { actionId } };
  }
  if (actionId && /\b(cancelar|cancela|rechazar|rechaza)\s+accion\b/.test(normalized)) {
    return { name: 'action.cancel', intent: 'action_cancel', arguments: { actionId } };
  }

  if (hasPermission(context, 'memory.manage')) {
    if (/\b(que recuerdas|qué recuerdas|muestra mi memoria|ver mi memoria|mis recuerdos|memoria guardada)\b/.test(normalized)) {
      return { name: 'memory.list', intent: 'memory_list', arguments: {} };
    }
    if (/\b(borra|borrar|elimina|eliminar)\b.{0,30}\b(toda|completa|mis)?\s*(memoria|recuerdos)\b/.test(normalized)) {
      return { name: 'memory.delete_all', intent: 'memory_delete_all', arguments: {} };
    }
    if (/\b(desactiva|desactivar|apaga|apagar)\b.{0,25}\b(memoria|recuerdos)\b/.test(normalized)) {
      return { name: 'memory.set_enabled', intent: 'memory_disable', arguments: { enabled: false } };
    }
    if (/\b(activa|activar|enciende|encender)\b.{0,25}\b(memoria|recuerdos)\b/.test(normalized)) {
      return { name: 'memory.set_enabled', intent: 'memory_enable', arguments: { enabled: true } };
    }
  }

  if (
    hasPermission(context, 'support.create')
    && /\b(crea|crear|abre|abrir|genera|generar|envia|enviar|hablar|contactar|escalar)\b.{0,40}\b(ticket|soporte|asesor|humano|reclamo|incidencia)\b/.test(normalized)
  ) {
    return {
      name: 'support.create_ticket',
      intent: 'support_create_ticket',
      arguments: {
        subject: 'Solicitud creada desde Domi',
        description: message.trim().slice(0, 1200),
        priority: /\b(urgente|grave|critico|crítico)\b/.test(normalized) ? 'urgent' : 'normal',
        ticketType: context.role === 'admin' ? 'admin_assistance' : 'domi_assistance',
      },
    };
  }

  return null;
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
    return { name: 'customer.cart_summary', intent: 'customer_cart_summary', arguments: {} };
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
    return { name: 'customer.list_orders', intent: 'customer_list_orders', arguments: { limit: 5 } };
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

  if (hasPermission(context, 'orders.update') && /\b(pedido|orden)\b/.test(normalized)) {
    const reference = extractOrderReference(message);
    const actionVerb = /\b(marca|marcar|cambia|cambiar|actualiza|actualizar|pon|poner|pasa|pasar|confirma|confirmar|cancela|cancelar)\b/.test(normalized);
    const targetStatus = /\bcancelad[oa]?\b|\bcancela(?:r)?\b/.test(normalized)
      ? 'cancelled'
      : /\blisto\b|\bready\b/.test(normalized)
        ? 'ready'
        : /\bpreparando\b|\bpreparacion\b|\bpreparación\b/.test(normalized)
          ? 'preparing'
          : /\bconfirmad[oa]?\b|\bconfirma(?:r)?\b/.test(normalized)
            ? 'confirmed'
            : '';
    if (reference && actionVerb && targetStatus) {
      return {
        name: 'merchant.update_order_status',
        intent: 'merchant_update_order_status',
        arguments: { reference, targetStatus },
      };
    }
  }

  if (hasPermission(context, 'inventory.update') && /\b(producto|sku|stock|existencias|unidades)\b/.test(normalized)) {
    const reference = extractProductReference(message);
    const targetQuantity = extractTargetQuantity(message);
    const targetStatus = /\bno disponible\b|\bagotad[oa]?\b/.test(normalized)
      ? 'unavailable'
      : /\bdisponible\b|\bactivar producto\b/.test(normalized)
        ? 'available'
        : /\bdescontinuad[oa]?\b/.test(normalized)
          ? 'discontinued'
          : '';
    if (reference && (targetStatus || targetQuantity !== null)) {
      return {
        name: 'merchant.update_product',
        intent: 'merchant_update_product',
        arguments: { reference, targetStatus, targetQuantity },
      };
    }
  }

  if (hasPermission(context, 'inventory.read') && /\b(inventario|existencias|stock|agotad|pocas unidades|bajo inventario|productos bajos)\b/.test(normalized)) {
    return { name: 'merchant.inventory_summary', intent: 'merchant_inventory_summary', arguments: { lowStockThreshold: 5, limit: 50 } };
  }
  if (hasPermission(context, 'reviews.read') && /\b(resena|reseña|resenas|reseñas|comentarios|calificaciones|opiniones)\b/.test(normalized)) {
    return { name: 'merchant.reviews_summary', intent: 'merchant_reviews_summary', arguments: { limit: 10 } };
  }
  if (hasPermission(context, 'reports.read') && /\b(ventas|vendimos|vendido|facturacion|facturación|facturamos|ingresos|reporte|metricas|métricas|mas vendido|más vendido|rendimiento)\b/.test(normalized)) {
    return { name: 'merchant.sales_summary', intent: 'merchant_sales_summary', arguments: { days: 30 } };
  }
  if (hasPermission(context, 'orders.read') && /\b(pedido|pedidos|orden|ordenes|órdenes|demora|retraso|preparacion|preparación)\b/.test(normalized)) {
    return {
      name: 'merchant.list_orders',
      intent: 'merchant_list_orders',
      arguments: { limit: 10, activeOnly: !/\b(historial|todos|anteriores|completados)\b/.test(normalized) },
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

  if (hasPermission(context, 'assignments.accept') && /\b(acepta|aceptar|tomar|toma|asigname|asígneme)\b.{0,25}\b(pedido|orden)\b/.test(normalized)) {
    const reference = extractOrderReference(message);
    if (reference) {
      return { name: 'courier.accept_order', intent: 'courier_accept_order', arguments: { reference } };
    }
  }

  if (hasPermission(context, 'delivery.update') && /\b(pedido|orden)\b/.test(normalized)) {
    const reference = extractOrderReference(message);
    const actionVerb = /\b(marca|marcar|cambia|cambiar|actualiza|actualizar|pon|poner|pasa|pasar)\b/.test(normalized);
    const targetStatus = /\bentregad[oa]?\b/.test(normalized)
      ? 'delivered'
      : /\ben camino\b|\btransito\b|\btránsito\b/.test(normalized)
        ? 'in_transit'
        : /\brecogid[oa]?\b|\brecogi\b|\brecogí\b/.test(normalized)
          ? 'picked_up'
          : /\baceptad[oa]?\b/.test(normalized)
            ? 'accepted'
            : '';
    if (reference && actionVerb && targetStatus) {
      return {
        name: 'courier.update_order_status',
        intent: 'courier_update_order_status',
        arguments: { reference, targetStatus },
      };
    }
  }

  if (hasPermission(context, 'earnings.read') && /\b(ganancia|ganancias|saldo|liquidacion|liquidación|cuanto he ganado|cuánto he ganado|pago)\b/.test(normalized)) {
    return { name: 'courier.earnings_summary', intent: 'courier_earnings_summary', arguments: { days: 30 } };
  }
  if (hasPermission(context, 'delivery.read') && /\b(historial|entregas completadas|pedidos entregados|domicilios realizados)\b/.test(normalized)) {
    return { name: 'courier.delivery_history', intent: 'courier_delivery_history', arguments: { limit: 10 } };
  }
  if (hasPermission(context, 'assignments.read') && /\b(disponibles|pedidos libres|pedidos para aceptar|nuevos pedidos|sin asignar)\b/.test(normalized)) {
    return { name: 'courier.available_orders', intent: 'courier_available_orders', arguments: { limit: 10 } };
  }
  if (
    hasPermission(context, 'assignments.read')
    && hasPermission(context, 'delivery.read')
    && /\b(asignad|mis pedidos|pedido actual|ruta|recogida|recoger|direccion|dirección|entrega|instrucciones)\b/.test(normalized)
  ) {
    return { name: 'courier.assignments', intent: 'courier_assignments', arguments: { limit: 10, activeOnly: true } };
  }
  return null;
}

export function planDomiAdminTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  if (context.role !== 'admin') return null;
  const normalized = normalizedText(message);

  if (hasPermission(context, 'audit.read') && /\b(auditoria|auditoría|auditorias|auditorías|seguridad|errores recientes|acciones recientes|registro de actividad)\b/.test(normalized)) {
    return { name: 'admin.audit_summary', intent: 'admin_audit_summary', arguments: { limit: 15 } };
  }
  if (hasPermission(context, 'business.read') && /\b(negocio|negocios|comercio|comercios|locales|verificados)\b/.test(normalized)) {
    return { name: 'admin.business_summary', intent: 'admin_business_summary', arguments: { limit: 15 } };
  }
  if (hasPermission(context, 'courier.read') && /\b(repartidor|repartidores|courier|domiciliarios|conductores)\b/.test(normalized)) {
    return { name: 'admin.courier_summary', intent: 'admin_courier_summary', arguments: { limit: 15 } };
  }
  if (hasPermission(context, 'orders.read') && /\b(pedido|pedidos|orden|ordenes|órdenes|detenidos|demorados|retrasados)\b/.test(normalized)) {
    return { name: 'admin.order_summary', intent: 'admin_order_summary', arguments: { limit: 20, stalledMinutes: 45 } };
  }
  if (
    hasPermission(context, 'operation.read')
    && hasPermission(context, 'reports.read')
    && /\b(metricas|métricas|dashboard|resumen general|estado general|estado del sistema|operacion|operación|plataforma|rendimiento)\b/.test(normalized)
  ) {
    return { name: 'admin.platform_metrics', intent: 'admin_platform_metrics', arguments: {} };
  }
  return null;
}

export function planDomiTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  const global = planGlobalTool(context, message);
  if (global) return global;

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

export const planDomiCustomerTool = planDomiTool;
