import { getBrowserClient } from '@/lib/db/supabase';

export interface CourierFinancialSummary {
  courier_id: string;
  delivered_orders: number;
  gross_delivery_value: number;
  platform_commission: number;
  net_earnings: number;
  company_owes_courier: number;
  courier_owes_company: number;
  net_balance: number;
}

export interface BusinessFinancialSummary {
  business_id: string;
  delivered_orders: number;
  product_sales: number;
  company_owes_business: number;
  business_owes_company: number;
  net_balance: number;
}

export interface SettlementBatch {
  id: string;
  participant_type: 'courier' | 'business';
  participant_id: string;
  period_start: string;
  period_end: string;
  company_owes_participant: number;
  participant_owes_company: number;
  net_balance: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  payment_reference: string | null;
  created_at: string;
}

function numeric<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const output = { ...row };
  for (const key of keys) {
    if (key in output) (output as Record<string, unknown>)[key] = Number(output[key] ?? 0);
  }
  return output;
}

export const financeService = {
  async getCourierSummary(courierId: string): Promise<CourierFinancialSummary> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('courier_financial_summary')
      .select('*')
      .eq('courier_id', courierId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return {
        courier_id: courierId,
        delivered_orders: 0,
        gross_delivery_value: 0,
        platform_commission: 0,
        net_earnings: 0,
        company_owes_courier: 0,
        courier_owes_company: 0,
        net_balance: 0,
      };
    }
    return numeric(data, [
      'delivered_orders',
      'gross_delivery_value',
      'platform_commission',
      'net_earnings',
      'company_owes_courier',
      'courier_owes_company',
      'net_balance',
    ]) as CourierFinancialSummary;
  },

  async getBusinessSummary(businessId: string): Promise<BusinessFinancialSummary> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('business_financial_summary')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return {
        business_id: businessId,
        delivered_orders: 0,
        product_sales: 0,
        company_owes_business: 0,
        business_owes_company: 0,
        net_balance: 0,
      };
    }
    return numeric(data, [
      'delivered_orders',
      'product_sales',
      'company_owes_business',
      'business_owes_company',
      'net_balance',
    ]) as BusinessFinancialSummary;
  },

  async listSettlements(): Promise<SettlementBatch[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('settlement_batches')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => numeric(row, [
      'company_owes_participant',
      'participant_owes_company',
      'net_balance',
    ])) as SettlementBatch[];
  },

  async createSettlement(
    participantType: 'courier' | 'business',
    participantId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<string> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('create_settlement_batch', {
      p_participant_type: participantType,
      p_participant_id: participantId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },

  async markSettlementPaid(batchId: string, reference?: string): Promise<void> {
    const supabase = getBrowserClient();
    const { error } = await supabase.rpc('mark_settlement_paid', {
      p_batch_id: batchId,
      p_payment_reference: reference?.trim() || null,
    });
    if (error) throw new Error(error.message);
  },
};
