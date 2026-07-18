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

export function planDomiCustomerTool(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiToolPlan | null {
  if (context.role !== 'customer') return null;

  const normalized = normalizedText(message);
  const has = (permission: string) => context.permissions.includes(permission);

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
