import 'server-only';

import { getServiceClient } from '@/lib/db/supabase';
import {
  DEFAULT_FINANCIAL_SETTINGS,
  validateFinancialSettings,
  type FinancialSettings,
} from '@/lib/orders/order-earnings';

export async function loadActiveFinancialSettings(): Promise<FinancialSettings> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('platform_financial_settings')
    .select(
      'courier_delivery_rate_bps,platform_delivery_rate_bps,customer_service_rate_bps,customer_service_minimum_cop,customer_service_maximum_cop,manual_delivery_service_fee_cop,rounding_increment_cop,service_fee_enabled',
    )
    .eq('is_active', true)
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_FINANCIAL_SETTINGS;
  }

  return validateFinancialSettings({
    courierDeliveryRateBps: Number(data.courier_delivery_rate_bps),
    platformDeliveryRateBps: Number(data.platform_delivery_rate_bps),
    customerServiceRateBps: Number(data.customer_service_rate_bps),
    customerServiceMinimumCop: Number(data.customer_service_minimum_cop),
    customerServiceMaximumCop: Number(data.customer_service_maximum_cop),
    manualDeliveryServiceFeeCop: Number(data.manual_delivery_service_fee_cop),
    roundingIncrementCop: Number(data.rounding_increment_cop),
    serviceFeeEnabled: Boolean(data.service_fee_enabled),
  });
}
