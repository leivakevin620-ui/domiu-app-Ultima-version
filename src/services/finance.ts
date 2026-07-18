import { getBrowserClient } from '@/lib/db/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ParticipantType = 'business' | 'courier';
export type SettlementDirection = 'company_owes_participant' | 'participant_owes_company' | 'balanced';

export interface FinancialConfig {
  id: string;
  courier_share_bps: number;
  service_fee_bps: number;
  service_fee_min: number;
  service_fee_max: number;
  service_fee_rounding: number;
  business_product_commission_bps: number;
  currency: string;
}

export interface OperationalShift {
  id: string;
  participant_type: ParticipantType;
  participant_id: string;
  participant_name: string;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed' | 'cancelled';
  online_seconds: number;
  orders_count: number;
  product_sales: number;
  delivery_fees: number;
  service_fees: number;
  courier_earnings: number;
  platform_earnings: number;
  cash_collected: number;
  electronic_collected: number;
  company_owes_participant: number;
  participant_owes_company: number;
  net_balance: number;
  opening_note: string | null;
  closing_note: string | null;
}

export interface SettlementBalance {
  participant_type: ParticipantType;
  participant_id: string;
  participant_name?: string;
  company_owes_participant: number;
  participant_owes_company: number;
  net_balance: number;
  pending_entries: number;
  last_pending_at: string | null;
}

export interface SettlementEntry {
  id: string;
  order_id: string;
  shift_id: string | null;
  participant_type: ParticipantType;
  participant_id: string;
  direction: Exclude<SettlementDirection, 'balanced'>;
  reason: 'business_product_sale' | 'courier_earning' | 'cash_remittance' | 'adjustment';
  amount: number;
  status: 'pending' | 'settled' | 'void';
  description: string | null;
  due_at: string | null;
  settled_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface SettlementBatch {
  id: string;
  participant_type: ParticipantType;
  participant_id: string;
  period_start: string;
  period_end: string;
  company_owes_participant: number;
  participant_owes_company: number;
  net_balance: number;
  direction: SettlementDirection;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShift(row: any): OperationalShift {
  return {
    ...row,
    online_seconds: asNumber(row.online_seconds),
    orders_count: asNumber(row.orders_count),
    product_sales: asNumber(row.product_sales),
    delivery_fees: asNumber(row.delivery_fees),
    service_fees: asNumber(row.service_fees),
    courier_earnings: asNumber(row.courier_earnings),
    platform_earnings: asNumber(row.platform_earnings),
    cash_collected: asNumber(row.cash_collected),
    electronic_collected: asNumber(row.electronic_collected),
    company_owes_participant: asNumber(row.company_owes_participant),
    participant_owes_company: asNumber(row.participant_owes_company),
    net_balance: asNumber(row.net_balance),
  } as OperationalShift;
}

function normalizeBalance(row: any): SettlementBalance {
  return {
    ...row,
    company_owes_participant: asNumber(row.company_owes_participant),
    participant_owes_company: asNumber(row.participant_owes_company),
    net_balance: asNumber(row.net_balance),
    pending_entries: asNumber(row.pending_entries),
  } as SettlementBalance;
}

function normalizeBatch(row: any): SettlementBatch {
  return {
    ...row,
    company_owes_participant: asNumber(row.company_owes_participant),
    participant_owes_company: asNumber(row.participant_owes_company),
    net_balance: asNumber(row.net_balance),
  } as SettlementBatch;
}

export const financeService = {
  async getActiveConfig(): Promise<FinancialConfig> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('platform_financial_config')
      .select('id,courier_share_bps,service_fee_bps,service_fee_min,service_fee_max,service_fee_rounding,business_product_commission_bps,currency')
      .eq('is_active', true)
      .lte('effective_from', new Date().toISOString())
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) throw new Error(error?.message || 'No existe una configuración financiera activa');
    return {
      ...data,
      courier_share_bps: asNumber(data.courier_share_bps),
      service_fee_bps: asNumber(data.service_fee_bps),
      service_fee_min: asNumber(data.service_fee_min),
      service_fee_max: asNumber(data.service_fee_max),
      service_fee_rounding: asNumber(data.service_fee_rounding),
      business_product_commission_bps: asNumber(data.business_product_commission_bps),
    } as FinancialConfig;
  },

  calculateServiceFee(subtotal: number, config: FinancialConfig) {
    if (subtotal <= 0) return 0;
    const raw = subtotal * config.service_fee_bps / 10000;
    const rounded = Math.ceil(raw / config.service_fee_rounding) * config.service_fee_rounding;
    return Math.min(config.service_fee_max, Math.max(config.service_fee_min, rounded));
  },

  async getCurrentShift(type: ParticipantType, participantId: string): Promise<OperationalShift | null> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('operational_shifts')
      .select('*')
      .eq('participant_type', type)
      .eq('participant_id', participantId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? normalizeShift(data) : null;
  },

  async getShiftHistory(type: ParticipantType, participantId: string, limit = 30): Promise<OperationalShift[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('operational_shifts')
      .select('*')
      .eq('participant_type', type)
      .eq('participant_id', participantId)
      .order('opened_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(normalizeShift);
  },

  async openBusinessShift(businessId: string, note?: string) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('open_business_operation', {
      p_business_id: businessId,
      p_note: note || null,
    } as never);
    if (error) throw new Error(error.message);
    return normalizeShift(data);
  },

  async closeBusinessShift(businessId: string, note?: string) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('close_business_operation', {
      p_business_id: businessId,
      p_note: note || null,
    } as never);
    if (error) throw new Error(error.message);
    return normalizeShift(data);
  },

  async openCourierShift(courierId: string, note?: string) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('open_courier_operation', {
      p_courier_id: courierId,
      p_note: note || null,
    } as never);
    if (error) throw new Error(error.message);
    return normalizeShift(data);
  },

  async closeCourierShift(courierId: string, note?: string) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('close_courier_operation', {
      p_courier_id: courierId,
      p_note: note || null,
    } as never);
    if (error) throw new Error(error.message);
    return normalizeShift(data);
  },

  async getBalance(type: ParticipantType, participantId: string): Promise<SettlementBalance> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('participant_settlement_balances')
      .select('*')
      .eq('participant_type', type)
      .eq('participant_id', participantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalizeBalance(data ?? {
      participant_type: type,
      participant_id: participantId,
      company_owes_participant: 0,
      participant_owes_company: 0,
      net_balance: 0,
      pending_entries: 0,
      last_pending_at: null,
    });
  },

  async getAllBalances(): Promise<SettlementBalance[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('participant_settlement_balances')
      .select('*')
      .order('last_pending_at', { ascending: false });
    if (error) throw new Error(error.message);
    const balances = (data ?? []).map(normalizeBalance);
    const courierIds = balances.filter((row) => row.participant_type === 'courier').map((row) => row.participant_id);
    const businessIds = balances.filter((row) => row.participant_type === 'business').map((row) => row.participant_id);
    const [profilesResult, businessesResult] = await Promise.all([
      courierIds.length ? supabase.from('profiles').select('id,first_name,last_name,email').in('id', courierIds) : Promise.resolve({ data: [] as any[] }),
      businessIds.length ? supabase.from('businesses').select('id,name').in('id', businessIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const names = new Map<string, string>();
    for (const row of profilesResult.data ?? []) names.set(row.id, [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Repartidor');
    for (const row of businessesResult.data ?? []) names.set(row.id, row.name);
    return balances.map((row) => ({ ...row, participant_name: names.get(row.participant_id) || 'Participante DomiU' }));
  },

  async getEntries(type: ParticipantType, participantId: string, limit = 500): Promise<SettlementEntry[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('settlement_entries')
      .select('*')
      .eq('participant_type', type)
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({ ...row, amount: asNumber(row.amount) })) as SettlementEntry[];
  },

  async getBatches(type?: ParticipantType, participantId?: string, limit = 100): Promise<SettlementBatch[]> {
    const supabase = getBrowserClient();
    let query = supabase.from('settlement_batches').select('*').order('created_at', { ascending: false }).limit(limit);
    if (type) query = query.eq('participant_type', type);
    if (participantId) query = query.eq('participant_id', participantId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(normalizeBatch);
  },

  async createBatch(input: {
    participantType: ParticipantType;
    participantId: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('create_settlement_batch', {
      p_participant_type: input.participantType,
      p_participant_id: input.participantId,
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_notes: input.notes || null,
    } as never);
    if (error) throw new Error(error.message);
    return normalizeBatch(data);
  },

  async payBatch(batchId: string) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('pay_settlement_batch', { p_batch_id: batchId } as never);
    if (error) throw new Error(error.message);
    return normalizeBatch(data);
  },

  async markAllNotificationsRead() {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('mark_all_notifications_as_read');
    if (error) throw new Error(error.message);
    return asNumber(data);
  },
};
