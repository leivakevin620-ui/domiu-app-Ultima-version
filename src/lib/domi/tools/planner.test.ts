import { describe, expect, it } from 'vitest';
import {
  planDomiAdminTool,
  planDomiCourierTool,
  planDomiCustomerTool,
  planDomiMerchantTool,
  planDomiTool,
} from '@/lib/domi/tools/planner';

const customer = {
  role: 'customer' as const,
  permissions: ['business.search', 'products.search', 'cart.read', 'orders.read'],
};

const merchant = {
  role: 'merchant' as const,
  permissions: ['business.read', 'orders.read', 'catalog.read', 'inventory.read', 'reports.read', 'reviews.read'],
};

const courier = {
  role: 'courier' as const,
  permissions: ['assignments.read', 'delivery.read', 'route.read', 'earnings.read', 'support.create'],
};

const admin = {
  role: 'admin' as const,
  permissions: ['operation.read', 'orders.read', 'business.read', 'courier.read', 'reports.read', 'finance.read', 'audit.read'],
};

describe('Domi multirole tool planner', () => {
  it('planifica búsqueda de catálogo y limpia la consulta del cliente', () => {
    expect(planDomiCustomerTool(customer, 'Buscar hamburguesas')).toEqual({
      name: 'customer.search_catalog',
      intent: 'customer_search_catalog',
      arguments: { query: 'hamburguesas' },
    });
  });

  it('diferencia carrito, historial y seguimiento del cliente', () => {
    expect(planDomiTool(customer, '¿Qué tengo agregado en el carrito?')?.name)
      .toBe('customer.cart_summary');
    expect(planDomiTool(customer, 'Consultar mis pedidos')?.name)
      .toBe('customer.list_orders');
    expect(planDomiTool(customer, '¿Dónde está mi último pedido?')?.name)
      .toBe('customer.track_order');
  });

  it('planifica inventario, ventas, reseñas y pedidos del negocio', () => {
    expect(planDomiMerchantTool(merchant, 'Muéstrame el inventario bajo')?.name)
      .toBe('merchant.inventory_summary');
    expect(planDomiTool(merchant, 'Cuánto vendimos este mes')?.name)
      .toBe('merchant.sales_summary');
    expect(planDomiTool(merchant, 'Resume las reseñas recientes')?.name)
      .toBe('merchant.reviews_summary');
    expect(planDomiTool(merchant, 'Muéstrame los pedidos demorados')?.name)
      .toBe('merchant.list_orders');
  });

  it('planifica asignaciones, disponibles, ganancias e historial del repartidor', () => {
    expect(planDomiCourierTool(courier, 'Cuáles son mis pedidos asignados')?.name)
      .toBe('courier.assignments');
    expect(planDomiTool(courier, 'Muéstrame pedidos disponibles')?.name)
      .toBe('courier.available_orders');
    expect(planDomiTool(courier, 'Cuánto he ganado')?.name)
      .toBe('courier.earnings_summary');
    expect(planDomiTool(courier, 'Ver historial de entregas completadas')?.name)
      .toBe('courier.delivery_history');
  });

  it('planifica métricas, pedidos, negocios, repartidores y auditoría del administrador', () => {
    expect(planDomiAdminTool(admin, 'Estado general de la plataforma')?.name)
      .toBe('admin.platform_metrics');
    expect(planDomiTool(admin, 'Pedidos detenidos')?.name)
      .toBe('admin.order_summary');
    expect(planDomiTool(admin, 'Resumen de negocios')?.name)
      .toBe('admin.business_summary');
    expect(planDomiTool(admin, 'Estado de los repartidores')?.name)
      .toBe('admin.courier_summary');
    expect(planDomiTool(admin, 'Auditoría y errores recientes')?.name)
      .toBe('admin.audit_summary');
  });

  it('no planifica herramientas sin los permisos requeridos', () => {
    expect(planDomiTool({ role: 'customer', permissions: ['orders.read'] }, 'Buscar pizza'))
      .toBeNull();
    expect(planDomiTool({ role: 'merchant', permissions: ['orders.read'] }, 'Ver inventario'))
      .toBeNull();
    expect(planDomiTool({ role: 'courier', permissions: ['delivery.read'] }, 'Ver pedidos asignados'))
      .toBeNull();
    expect(planDomiTool({ role: 'admin', permissions: ['orders.read'] }, 'Estado general de la plataforma'))
      .toBeNull();
  });

  it('no cruza herramientas entre perfiles', () => {
    expect(planDomiTool(customer, 'Muéstrame la auditoría')).toBeNull();
    expect(planDomiTool(merchant, 'Muéstrame pedidos disponibles para repartir')).toBeNull();
    expect(planDomiTool(courier, 'Muéstrame ventas del negocio')).toBeNull();
    expect(planDomiTool(admin, 'Qué tengo en mi carrito')).toBeNull();
  });
});
