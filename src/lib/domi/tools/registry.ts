import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiToolDefinition, DomiToolName } from '@/lib/domi/tools/types';

const READ_TIMEOUT_MS = 8_000;

export const DOMI_TOOL_REGISTRY: Record<DomiToolName, DomiToolDefinition> = {
  'customer.search_catalog': {
    name: 'customer.search_catalog',
    description: 'Busca negocios y productos activos del catálogo público.',
    roles: ['customer'],
    permissions: ['business.search', 'products.search'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'customer.cart_summary': {
    name: 'customer.cart_summary',
    description: 'Valida y resume el carrito del cliente con precios actuales del servidor.',
    roles: ['customer'],
    permissions: ['cart.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'customer.list_orders': {
    name: 'customer.list_orders',
    description: 'Consulta únicamente los pedidos del cliente autenticado.',
    roles: ['customer'],
    permissions: ['orders.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'customer.track_order': {
    name: 'customer.track_order',
    description: 'Consulta el seguimiento de un pedido perteneciente al cliente autenticado.',
    roles: ['customer'],
    permissions: ['orders.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'merchant.list_orders': {
    name: 'merchant.list_orders',
    description: 'Consulta pedidos pertenecientes al negocio autenticado.',
    roles: ['merchant'],
    permissions: ['orders.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'merchant.inventory_summary': {
    name: 'merchant.inventory_summary',
    description: 'Resume inventario y productos con existencias bajas del negocio autenticado.',
    roles: ['merchant'],
    permissions: ['inventory.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'merchant.sales_summary': {
    name: 'merchant.sales_summary',
    description: 'Calcula ventas verificadas del negocio autenticado.',
    roles: ['merchant'],
    permissions: ['reports.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'merchant.reviews_summary': {
    name: 'merchant.reviews_summary',
    description: 'Resume reseñas públicas asociadas al negocio autenticado.',
    roles: ['merchant'],
    permissions: ['reviews.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'courier.available_orders': {
    name: 'courier.available_orders',
    description: 'Consulta pedidos disponibles sin revelar asignaciones de otros repartidores.',
    roles: ['courier'],
    permissions: ['assignments.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'courier.assignments': {
    name: 'courier.assignments',
    description: 'Consulta únicamente pedidos asignados al repartidor autenticado.',
    roles: ['courier'],
    permissions: ['assignments.read', 'delivery.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'courier.earnings_summary': {
    name: 'courier.earnings_summary',
    description: 'Resume ganancias del repartidor autenticado.',
    roles: ['courier'],
    permissions: ['earnings.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'courier.delivery_history': {
    name: 'courier.delivery_history',
    description: 'Consulta entregas completadas por el repartidor autenticado.',
    roles: ['courier'],
    permissions: ['delivery.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'admin.platform_metrics': {
    name: 'admin.platform_metrics',
    description: 'Consulta métricas agregadas de operación sin exportar datos personales.',
    roles: ['admin'],
    permissions: ['operation.read', 'reports.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'admin.order_summary': {
    name: 'admin.order_summary',
    description: 'Resume estados y pedidos potencialmente detenidos de la plataforma.',
    roles: ['admin'],
    permissions: ['orders.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'admin.business_summary': {
    name: 'admin.business_summary',
    description: 'Consulta estado agregado de negocios sin exponer secretos.',
    roles: ['admin'],
    permissions: ['business.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'admin.courier_summary': {
    name: 'admin.courier_summary',
    description: 'Consulta estado operativo agregado de repartidores.',
    roles: ['admin'],
    permissions: ['courier.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
  'admin.audit_summary': {
    name: 'admin.audit_summary',
    description: 'Consulta eventos recientes de auditoría con datos limitados.',
    roles: ['admin'],
    permissions: ['audit.read'],
    riskLevel: 'low',
    requiresConfirmation: false,
    timeoutMs: READ_TIMEOUT_MS,
    idempotent: true,
  },
};

export function canExecuteDomiTool(context: DomiServerContext, name: DomiToolName) {
  const definition = DOMI_TOOL_REGISTRY[name];
  return Boolean(
    definition
      && definition.roles.includes(context.role)
      && definition.permissions.every((permission) => context.permissions.includes(permission)),
  );
}

export async function withDomiToolTimeout<T>(name: DomiToolName, operation: () => Promise<T>): Promise<T> {
  const timeoutMs = DOMI_TOOL_REGISTRY[name]?.timeoutMs || READ_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`domi_tool_timeout:${name}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
