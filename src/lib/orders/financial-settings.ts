import 'server-only';

import { getServiceClient } from '@/lib/db/supabase';
import {
  DEFAULT_FINANCIAL_SETTINGS,
  validateFinancialSettings,
  type FinancialSettings,
} from '@/lib/orders/order-earnings';

function percentToBasisPoints(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100);
}

export async function loadActiveFinancialSettings(): Promise<FinancialSettings> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('platform_financial_settings')
    .select(
      'service_fee_rate,service_fee_min,service_fee_max,service_fee_rounding,delivery_commission_rate,is_active,effective_from',
    )
    .eq('is_active', true)
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULT_FINANCIAL_SETTINGS;

  const platformDeliveryRateBps = percentToBasisPoints(
    data.delivery_commission_rate,
    DEFAULT_FINANCIAL_SETTINGS.platformDeliveryRateBps,
  );

  return validateFinancialSettings({
    courierDeliveryRateBps: 10_000 - platformDeliveryRateBps,
    platformDeliveryRateBps,
    customerServiceRateBps: percentToBasisPoints(
      data.service_fee_rate,
      DEFAULT_FINANCIAL_SETTINGS.customerServiceRateBps,
    ),
    customerServiceMinimumCop: Number(
      data.service_fee_min ?? DEFAULT_FINANCIAL_SETTINGS.customerServiceMinimumCop,
    ),
    customerServiceMaximumCop: Number(
      data.service_fee_max ?? DEFAULT_FINANCIAL_SETTINGS.customerServiceMaximumCop,
    ),
    manualDeliveryServiceFeeCop: Number(
      data.service_fee_min ?? DEFAULT_FINANCIAL_SETTINGS.manualDeliveryServiceFeeCop,
    ),
    roundingIncrementCop: Number(
      data.service_fee_rounding ?? DEFAULT_FINANCIAL_SETTINGS.roundingIncrementCop,
    ),
    serviceFeeEnabled: true,
  });
}
