import { getBrowserClient } from '@/lib/db/supabase';
import { financeService, type OperationalShift, type SettlementBalance } from '@/services/finance';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY = 86_400_000;

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(rows: any[], field: string) {
  return rows.reduce((total, row) => total + number(row[field]), 0);
}

export type BusinessFinancialSummary = {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  totalSales: number;
  activeOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageProductTicket: number;
  currentShift: OperationalShift | null;
  balance: SettlementBalance;
};

export type CourierFinancialSummary = {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  totalEarnings: number;
  todayDeliveries: number;
  totalDeliveries: number;
  deliveryFees: number;
  platformCommission: number;
  currentShift: OperationalShift | null;
  balance: SettlementBalance;
};

export type AdminFinancialSummary = {
  todayPlatformEarnings: number;
  monthPlatformEarnings: number;
  totalPlatformEarnings: number;
  serviceFees: number;
  deliveryCommissions: number;
  businessPayable: number;
  courierPayable: number;
  courierReceivable: number;
  pendingSettlementEntries: number;
};

export const dashboardFinanceService = {
  async getBusinessSummary(businessId: string): Promise<BusinessFinancialSummary> {
    const supabase = getBrowserClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const week = new Date(now.getTime() - 7 * DAY).toISOString();
    const month = new Date(now.getTime() - 30 * DAY).toISOString();
    const [{ data, error }, currentShift, balance] = await Promise.all([
      supabase
        .from('orders')
        .select('id,status,business_earnings,created_at,actual_delivery_time,updated_at')
        .eq('business_id', businessId)
        .is('deleted_at', null),
      financeService.getCurrentShift('business', businessId),
      financeService.getBalance('business', businessId),
    ]);
    if (error) throw new Error(error.message);
    const orders = (data ?? []) as any[];
    const delivered = orders.filter((row) => row.status === 'delivered');
    const active = orders.filter((row) => !['delivered', 'cancelled', 'refunded'].includes(row.status));
    const cancelled = orders.filter((row) => ['cancelled', 'refunded'].includes(row.status));
    const timestamp = (row: any) => String(row.actual_delivery_time || row.updated_at || row.created_at);
    return {
      todaySales: sum(delivered.filter((row) => timestamp(row) >= today), 'business_earnings'),
      weekSales: sum(delivered.filter((row) => timestamp(row) >= week), 'business_earnings'),
      monthSales: sum(delivered.filter((row) => timestamp(row) >= month), 'business_earnings'),
      totalSales: sum(delivered, 'business_earnings'),
      activeOrders: active.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      averageProductTicket: delivered.length ? sum(delivered, 'business_earnings') / delivered.length : 0,
      currentShift,
      balance,
    };
  },

  async getCourierSummary(courierId: string): Promise<CourierFinancialSummary> {
    const supabase = getBrowserClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const week = new Date(now.getTime() - 7 * DAY).toISOString();
    const month = new Date(now.getTime() - 30 * DAY).toISOString();
    const [{ data, error }, currentShift, balance] = await Promise.all([
      supabase
        .from('orders')
        .select('id,status,courier_earnings,delivery_fee,platform_delivery_commission,created_at,actual_delivery_time,updated_at')
        .eq('courier_id', courierId)
        .is('deleted_at', null),
      financeService.getCurrentShift('courier', courierId),
      financeService.getBalance('courier', courierId),
    ]);
    if (error) throw new Error(error.message);
    const delivered = ((data ?? []) as any[]).filter((row) => row.status === 'delivered');
    const timestamp = (row: any) => String(row.actual_delivery_time || row.updated_at || row.created_at);
    return {
      todayEarnings: sum(delivered.filter((row) => timestamp(row) >= today), 'courier_earnings'),
      weekEarnings: sum(delivered.filter((row) => timestamp(row) >= week), 'courier_earnings'),
      monthEarnings: sum(delivered.filter((row) => timestamp(row) >= month), 'courier_earnings'),
      totalEarnings: sum(delivered, 'courier_earnings'),
      todayDeliveries: delivered.filter((row) => timestamp(row) >= today).length,
      totalDeliveries: delivered.length,
      deliveryFees: sum(delivered, 'delivery_fee'),
      platformCommission: sum(delivered, 'platform_delivery_commission'),
      currentShift,
      balance,
    };
  },

  async getAdminSummary(): Promise<AdminFinancialSummary> {
    const supabase = getBrowserClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const month = new Date(now.getTime() - 30 * DAY).toISOString();
    const [{ data: orderRows, error }, balances] = await Promise.all([
      supabase
        .from('orders')
        .select('status,platform_earnings,platform_delivery_commission,service_fee,created_at,actual_delivery_time,updated_at')
        .eq('status', 'delivered')
        .is('deleted_at', null),
      financeService.getAllBalances(),
    ]);
    if (error) throw new Error(error.message);
    const orders = (orderRows ?? []) as any[];
    const timestamp = (row: any) => String(row.actual_delivery_time || row.updated_at || row.created_at);
    const businesses = balances.filter((row) => row.participant_type === 'business');
    const couriers = balances.filter((row) => row.participant_type === 'courier');
    return {
      todayPlatformEarnings: sum(orders.filter((row) => timestamp(row) >= today), 'platform_earnings'),
      monthPlatformEarnings: sum(orders.filter((row) => timestamp(row) >= month), 'platform_earnings'),
      totalPlatformEarnings: sum(orders, 'platform_earnings'),
      serviceFees: sum(orders, 'service_fee'),
      deliveryCommissions: sum(orders, 'platform_delivery_commission'),
      businessPayable: businesses.reduce((total, row) => total + row.company_owes_participant, 0),
      courierPayable: couriers.reduce((total, row) => total + row.company_owes_participant, 0),
      courierReceivable: couriers.reduce((total, row) => total + row.participant_owes_company, 0),
      pendingSettlementEntries: balances.reduce((total, row) => total + row.pending_entries, 0),
    };
  },
};
