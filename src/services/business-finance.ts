import { getBrowserClient } from '@/lib/db/supabase';

export interface BusinessFinancialStats {
  todayProductSales: number;
  weekProductSales: number;
  monthProductSales: number;
  lifetimeProductSales: number;
  deliveredOrders: number;
  activeOrders: number;
  averageProductTicket: number;
  catalog: {
    totalProducts: number;
    availableProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    productsWithoutImage: number;
    productsWithoutValidPrice: number;
    imagesPendingReview: number;
    imagesApproved: number;
  };
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function productEarnings(row: Record<string, unknown>) {
  const stored = money(row.business_earnings);
  return stored > 0 ? stored : money(row.subtotal);
}

export const businessFinanceService = {
  async getStats(businessId: string): Promise<BusinessFinancialStats> {
    const supabase = getBrowserClient();
    const [ordersResult, catalogResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id,status,subtotal,business_earnings,created_at,updated_at')
        .eq('business_id', businessId)
        .is('deleted_at', null),
      supabase
        .from('merchant_catalog_quality_v')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle(),
    ]);
    if (ordersResult.error) throw new Error(ordersResult.error.message);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const orders = (ordersResult.data ?? []) as Array<Record<string, unknown>>;
    const delivered = orders.filter((order) => order.status === 'delivered');
    const active = orders.filter((order) =>
      ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'accepted', 'picked_up', 'in_transit'].includes(
        String(order.status),
      ),
    );
    const sumFrom = (start: Date) =>
      delivered
        .filter((order) => new Date(String(order.updated_at || order.created_at)) >= start)
        .reduce((sum, order) => sum + productEarnings(order), 0);
    const lifetime = delivered.reduce((sum, order) => sum + productEarnings(order), 0);
    const catalog = catalogResult.data;

    return {
      todayProductSales: sumFrom(todayStart),
      weekProductSales: sumFrom(weekStart),
      monthProductSales: sumFrom(monthStart),
      lifetimeProductSales: lifetime,
      deliveredOrders: delivered.length,
      activeOrders: active.length,
      averageProductTicket: delivered.length ? Math.round(lifetime / delivered.length) : 0,
      catalog: {
        totalProducts: Number(catalog?.total_products ?? 0),
        availableProducts: Number(catalog?.available_products ?? 0),
        outOfStockProducts: Number(catalog?.out_of_stock_products ?? 0),
        lowStockProducts: Number(catalog?.low_stock_products ?? 0),
        productsWithoutImage: Number(catalog?.products_without_image ?? 0),
        productsWithoutValidPrice: Number(catalog?.products_without_valid_price ?? 0),
        imagesPendingReview: Number(catalog?.images_pending_review ?? 0),
        imagesApproved: Number(catalog?.images_approved ?? 0),
      },
    };
  },
};
