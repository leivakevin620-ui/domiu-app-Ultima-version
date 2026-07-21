import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomiAgentState, DomiRecommendation } from '@/lib/domi/agent/types';
import { estimateDomiPricing } from '@/lib/domi/agent/pricing';
import { normalizeDomiText } from '@/lib/domi/agent/text-utils';

interface RecommendationRequest {
  query: string;
  budget: number | null;
  limit?: number;
}

function rowObject(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return rowObject(value[0]);
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function words(value: string) {
  return normalizeDomiText(value)
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 16);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export async function recommendDomiProducts(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  request: RecommendationRequest;
}): Promise<DomiRecommendation[]> {
  const queryWords = words(args.request.query);
  const memoryWords = words(args.state.memories.map((memory) => memory.text).join(' '));

  const { data, error } = await args.supabase
    .from('products')
    .select(`
      id,business_id,name,description,price,discount_price,quantity_available,status,
      preparation_time_minutes,rating,total_ratings,total_sales,image_url,metadata,
      businesses!inner(id,name,slug,rating,total_ratings,is_active,is_verified,is_accepting_orders,operations_status,latitude,longitude,metadata),
      categories(name)
    `)
    .eq('status', 'available')
    .gt('quantity_available', 0)
    .eq('businesses.is_active', true)
    .eq('businesses.is_accepting_orders', true)
    .eq('businesses.operations_status', 'open')
    .is('deleted_at', null)
    .order('total_sales', { ascending: false })
    .limit(120);

  if (error) throw new Error('domi_recommendation_catalog_failed');
  const candidates = (data ?? []).filter((item) => {
    if (!queryWords.length) return true;
    const business = rowObject(item.businesses);
    const category = rowObject(item.categories);
    const haystack = normalizeDomiText([
      item.name,
      item.description,
      category.name,
      business.name,
    ].filter(Boolean).join(' '));
    return queryWords.some((word) => haystack.includes(word));
  });

  const favoritesResult = await args.supabase
    .from('customer_favorites')
    .select('business_id,product_id')
    .eq('user_id', args.state.context.userId);
  const favoriteProducts = new Set(
    (favoritesResult.data ?? []).map((item) => item.product_id).filter(Boolean),
  );
  const favoriteBusinesses = new Set(
    (favoritesResult.data ?? []).map((item) => item.business_id).filter(Boolean),
  );

  const ranked = await Promise.all(candidates.slice(0, 50).map(async (item) => {
    const business = rowObject(item.businesses);
    const originalPrice = numeric(item.price);
    const currentPrice = item.discount_price === null || item.discount_price === undefined
      ? originalPrice
      : Math.min(originalPrice, numeric(item.discount_price, originalPrice));
    const pricing = await estimateDomiPricing({
      supabase: args.supabase,
      userId: args.state.context.userId,
      business: {
        latitude: business.latitude === null || business.latitude === undefined ? null : numeric(business.latitude),
        longitude: business.longitude === null || business.longitude === undefined ? null : numeric(business.longitude),
      },
      subtotal: currentPrice,
    });
    const estimatedTotal = currentPrice + pricing.deliveryFee + pricing.serviceFee;
    const productText = normalizeDomiText(`${item.name} ${item.description || ''}`);
    const preferenceMatches = memoryWords.filter((word) => productText.includes(word)).length;
    const productRating = numeric(item.rating);
    const businessRating = numeric(business.rating);
    const discountAmount = Math.max(0, originalPrice - currentPrice);
    const withinBudget = !args.request.budget || estimatedTotal <= args.request.budget;
    let score = 0;
    score += withinBudget ? 40 : -Math.min(35, (estimatedTotal - (args.request.budget || estimatedTotal)) / 1000);
    score += businessRating * 4;
    score += productRating * 3;
    score += Math.min(15, discountAmount / 1000);
    score += Math.min(12, Math.log10(numeric(item.total_sales) + 1) * 6);
    score += Math.min(18, preferenceMatches * 4);
    if (favoriteProducts.has(item.id)) score += 14;
    if (favoriteBusinesses.has(item.business_id)) score += 8;
    score += Math.max(0, 10 - numeric(item.preparation_time_minutes, 15) / 3);

    const reasons: string[] = [];
    if (withinBudget && args.request.budget) reasons.push(`entra en tu presupuesto de ${formatMoney(args.request.budget)}`);
    if (discountAmount > 0) reasons.push(`tiene ${formatMoney(discountAmount)} de descuento confirmado`);
    if (businessRating >= 4) reasons.push(`el negocio tiene calificación ${businessRating.toFixed(1)}`);
    if (preferenceMatches > 0) reasons.push('coincide con preferencias que autorizaste');
    if (pricing.distanceKm !== null) reasons.push(`la distancia estimada es ${pricing.distanceKm} km`);
    if (!reasons.length) reasons.push('está disponible y el negocio está recibiendo pedidos');

    return {
      productId: String(item.id),
      productName: String(item.name),
      productDescription: String(item.description || ''),
      imageUrl: item.image_url ? String(item.image_url) : null,
      businessId: String(item.business_id),
      businessName: String(business.name || 'Negocio'),
      businessSlug: String(business.slug || ''),
      businessRating,
      productRating,
      quantityAvailable: Math.max(0, numeric(item.quantity_available)),
      preparationMinutes: Math.max(0, numeric(item.preparation_time_minutes, 15)),
      originalPrice,
      currentPrice,
      discountAmount,
      deliveryFee: pricing.deliveryFee,
      serviceFee: pricing.serviceFee,
      estimatedTotal,
      estimatedDeliveryMinutes: pricing.estimatedMinutes + Math.max(0, numeric(item.preparation_time_minutes, 15)),
      withinBudget,
      score: Math.round(score * 10) / 10,
      reasons,
      dataStatus: pricing.source === 'coordinates' ? 'confirmed' : 'estimated',
    } satisfies DomiRecommendation;
  }));

  return ranked
    .sort((left, right) => {
      if (left.withinBudget !== right.withinBudget) return left.withinBudget ? -1 : 1;
      return right.score - left.score;
    })
    .slice(0, Math.min(5, Math.max(1, args.request.limit || 3)));
}

export function explainDomiRecommendations(
  recommendations: DomiRecommendation[],
  budget: number | null,
) {
  if (!recommendations.length) {
    return 'No encontré productos disponibles que coincidan con esa búsqueda. Puedo intentar con una categoría o un nombre diferente.';
  }

  const within = recommendations.filter((item) => item.withinBudget);
  const selected = within.length ? within : recommendations;
  const intro = budget
    ? within.length
      ? `Encontré ${within.length} ${within.length === 1 ? 'opción' : 'opciones'} que entran en tu presupuesto.`
      : 'No encontré una opción que entre completamente en el presupuesto; te muestro las más cercanas sin ocultar los cargos estimados.'
    : `Comparé ${recommendations.length} opciones disponibles.`;
  const lines = selected.slice(0, 3).map((item, index) => {
    const status = item.dataStatus === 'confirmed' ? 'confirmado' : 'estimado';
    return `${index + 1}. ${item.productName} en ${item.businessName}: ${formatMoney(item.currentPrice)} + domicilio ${formatMoney(item.deliveryFee)} + servicio ${formatMoney(item.serviceFee)} = ${formatMoney(item.estimatedTotal)} (${status}). ${item.reasons[0]}.`;
  });
  const best = selected[0];
  return `${intro}\n\n${lines.join('\n')}\n\nTe recomiendo la primera porque ${best.reasons.join(', ')}.`;
}
