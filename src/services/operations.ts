import { getBrowserClient } from '@/lib/db/supabase';

export interface BusinessOperationState {
  businessId: string;
  isOpen: boolean;
  shiftId: string | null;
  openedAt: string | null;
}

export interface CourierShiftState {
  isOpen: boolean;
  shiftId: string | null;
  startedAt: string | null;
}

async function getClient() {
  return getBrowserClient();
}

export const operationsService = {
  async getBusinessState(businessId: string): Promise<BusinessOperationState> {
    const supabase = await getClient();
    const [{ data: business, error: businessError }, { data: shift, error: shiftError }] = await Promise.all([
      supabase
        .from('businesses')
        .select('id,is_accepting_orders,operations_status,opened_at')
        .eq('id', businessId)
        .single(),
      supabase
        .from('business_shifts')
        .select('id,opened_at')
        .eq('business_id', businessId)
        .eq('status', 'open')
        .maybeSingle(),
    ]);
    if (businessError) throw new Error(businessError.message);
    if (shiftError) throw new Error(shiftError.message);
    return {
      businessId,
      isOpen: Boolean(business?.is_accepting_orders && business?.operations_status === 'open' && shift),
      shiftId: shift?.id ?? null,
      openedAt: shift?.opened_at ?? business?.opened_at ?? null,
    };
  },

  async openBusiness(businessId: string, openingCash = 0): Promise<string> {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc('open_business_shift', {
      p_business_id: businessId,
      p_opening_cash: Math.max(0, Math.round(openingCash)),
      p_notes: null,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },

  async closeBusiness(businessId: string, closingCash?: number): Promise<string> {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc('close_business_shift', {
      p_business_id: businessId,
      p_closing_cash: closingCash == null ? null : Math.max(0, Math.round(closingCash)),
      p_notes: null,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },

  async getCourierShift(courierId: string): Promise<CourierShiftState> {
    const supabase = await getClient();
    const { data, error } = await supabase
      .from('courier_shifts')
      .select('id,started_at')
      .eq('courier_id', courierId)
      .eq('status', 'open')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isOpen: Boolean(data), shiftId: data?.id ?? null, startedAt: data?.started_at ?? null };
  },

  async startCourier(latitude?: number, longitude?: number): Promise<string> {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc('start_courier_shift', {
      p_latitude: latitude ?? null,
      p_longitude: longitude ?? null,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },

  async closeCourier(latitude?: number, longitude?: number): Promise<string> {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc('close_courier_shift', {
      p_latitude: latitude ?? null,
      p_longitude: longitude ?? null,
      p_notes: null,
    });
    if (error) throw new Error(error.message);
    return String(data);
  },

  async setCourierBreak(onBreak: boolean): Promise<void> {
    const supabase = await getClient();
    const { error } = await supabase
      .from('drivers')
      .update({
        status: onBreak ? 'on_break' : 'available',
        is_active: true,
        is_available: !onBreak,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
    if (error) throw new Error(error.message);
  },
};
