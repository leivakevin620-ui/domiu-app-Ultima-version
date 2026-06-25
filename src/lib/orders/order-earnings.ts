export interface OrderEarnings {
  courierEarnings: number;
  platformEarnings: number;
  businessAmount: number;
  courierPercentage: number;
  platformPercentage: number;
}

export function calculateOrderEarnings(totalAmount: number, deliveryFee: number): OrderEarnings {
  const courierPercentage = 0.8;
  const platformPercentage = 0.2;
  const courierEarnings = Math.round(deliveryFee * courierPercentage);
  const platformEarnings = deliveryFee - courierEarnings;
  const businessAmount = totalAmount - deliveryFee;
  return {
    courierEarnings,
    platformEarnings,
    businessAmount: Math.max(0, businessAmount),
    courierPercentage,
    platformPercentage,
  };
}
