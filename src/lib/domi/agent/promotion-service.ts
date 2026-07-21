import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiAdvancedResult } from '@/lib/domi/agent/types';

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export async function getDomiPromotions(args: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<DomiAdvancedResult> {
  const now = new Date().toISOString();
  const [productsResult, couponsResult, usageResult] = await Promise.all([
    args.supabase
      .from('products')
      .select('id,name,price,discount_price,business_id,businesses!inner(name,slug,is_active,is_accepting_orders,operations_status)')
      .eq('status', 'available')
      .gt('quantity_available', 0)
      .not('discount_price', 'is', null)
      .eq('businesses.is_active', true)
      .eq('businesses.is_accepting_orders', true)
      .eq('businesses.operations_status', 'open')
      .order('discount_percentage', { ascending: false })
      .limit(8),
    args.supabase
      .from('coupons')
      .select('id,code,type,value,max_discount,min_amount,expires_at,per_user_limit,description')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .limit(10),
    args.supabase
      .from('coupon_usage')
      .select('coupon_id')
      .eq('user_id', args.userId),
  ]);

  if (productsResult.error || couponsResult.error || usageResult.error) {
    throw new Error('domi_promotions_read_failed');
  }

  const usage = new Map<string, number>();
  for (const item of usageResult.data ?? []) {
    const id = String(item.coupon_id);
    usage.set(id, (usage.get(id) || 0) + 1);
  }
  const coupons = (couponsResult.data ?? []).filter((coupon) =>
    (usage.get(String(coupon.id)) || 0) < Number(coupon.per_user_limit || 1),
  );
  const discountedProducts = (productsResult.data ?? []).filter((product) =>
    Number(product.discount_price) >= 0 && Number(product.discount_price) < Number(product.price),
  );

  if (!coupons.length && !discountedProducts.length) {
    return {
      intent: 'promotions',
      tool: 'agent.promotion_service',
      message: 'No hay promociones ni cupones activos confirmados en este momento. No voy a inventar descuentos; puedo revisar nuevamente el catálogo disponible.',
      data: { coupons: [], discountedProducts: [], checkedAt: now },
      recordCount: 0,
      suggestedActions: ['Buscar productos disponibles', 'Recomiéndame algo económico'],
      navigation: [{ label: 'Ver catálogo', href: '/cliente' }],
    };
  }

  const lines: string[] = [];
  for (const coupon of coupons.slice(0, 4)) {
    const benefit = coupon.type === 'percentage'
      ? `${Number(coupon.value)}% de descuento`
      : coupon.type === 'free_shipping'
        ? 'domicilio sin costo según sus condiciones'
        : `${money(Number(coupon.value))} de descuento`;
    lines.push(`Cupón ${coupon.code}: ${benefit}${Number(coupon.min_amount || 0) > 0 ? ` desde ${money(Number(coupon.min_amount))}` : ''}.`);
  }
  for (const product of discountedProducts.slice(0, 4)) {
    const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
    lines.push(`${product.name} en ${business?.name || 'un negocio activo'}: ${money(Number(product.discount_price))} antes ${money(Number(product.price))}.`);
  }

  return {
    intent: 'promotions',
    tool: 'agent.promotion_service',
    message: `Estas son las promociones confirmadas ahora:\n\n${lines.join('\n')}`,
    data: {
      coupons,
      discountedProducts: discountedProducts.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        discountPrice: Number(product.discount_price),
        businessId: product.business_id,
      })),
      checkedAt: now,
    },
    recordCount: coupons.length + discountedProducts.length,
    suggestedActions: ['Buscar productos con descuento', 'Preparar una compra económica'],
    navigation: [{ label: 'Ver cupones', href: '/cliente/cupones' }],
  };
}
