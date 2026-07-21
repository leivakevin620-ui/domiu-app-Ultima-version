import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DomiAdvancedResult,
  DomiAgentState,
  DomiRecommendation,
} from '@/lib/domi/agent/types';
import { lastDomiToolData } from '@/lib/domi/agent/state-loader';
import { estimateDomiPricing } from '@/lib/domi/agent/pricing';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstRecommendation(state: DomiAgentState): DomiRecommendation | null {
  const data = lastDomiToolData(state);
  const candidates = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const candidate = candidates[0];
  if (!candidate || typeof candidate !== 'object') return null;
  const row = candidate as Record<string, unknown>;
  if (typeof row.productId !== 'string' || typeof row.businessId !== 'string') return null;
  return row as unknown as DomiRecommendation;
}

function money(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export async function prepareDomiOrderDraft(args: {
  supabase: SupabaseClient;
  state: DomiAgentState;
  quantity?: number;
}): Promise<DomiAdvancedResult> {
  const recommendation = firstRecommendation(args.state);
  if (!recommendation) {
    return {
      intent: 'prepare_order_draft',
      tool: 'agent.order_draft_service',
      message: 'Antes de preparar el carrito necesito una opción concreta. Pídeme una recomendación o busca un producto y luego dime “agrega la primera opción al carrito”.',
      data: { draft: null, clientCommands: [] },
      recordCount: 0,
      suggestedActions: ['Recomiéndame algo', 'Buscar productos disponibles'],
      navigation: [{ label: 'Abrir catálogo', href: '/cliente' }],
    };
  }

  const { data: product, error } = await args.supabase
    .from('products')
    .select(`
      id,business_id,name,description,price,discount_price,quantity_available,status,image_url,metadata,
      businesses!inner(id,name,slug,is_active,is_accepting_orders,operations_status,latitude,longitude)
    `)
    .eq('id', recommendation.productId)
    .eq('business_id', recommendation.businessId)
    .eq('status', 'available')
    .gt('quantity_available', 0)
    .eq('businesses.is_active', true)
    .eq('businesses.is_accepting_orders', true)
    .eq('businesses.operations_status', 'open')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error('domi_order_draft_product_read_failed');
  if (!product) {
    return {
      intent: 'prepare_order_draft',
      tool: 'agent.order_draft_service',
      message: 'La opción cambió o dejó de estar disponible antes de preparar el carrito. No realicé ningún cambio. Buscaré alternativas actuales nuevamente.',
      data: { draft: null, clientCommands: [] },
      recordCount: 0,
      suggestedActions: ['Buscar alternativas actuales'],
      navigation: [{ label: 'Volver al catálogo', href: '/cliente' }],
    };
  }

  const business = record(Array.isArray(product.businesses) ? product.businesses[0] : product.businesses);
  const requestedQuantity = Math.max(1, Math.min(25, Math.floor(args.quantity || 1)));
  const quantity = Math.min(requestedQuantity, Number(product.quantity_available || 0));
  if (quantity < 1) throw new Error('domi_order_draft_inventory_unavailable');

  const originalPrice = Number(product.price || 0);
  const unitPrice = product.discount_price === null || product.discount_price === undefined
    ? originalPrice
    : Math.min(originalPrice, Number(product.discount_price));
  const subtotal = unitPrice * quantity;
  const pricing = await estimateDomiPricing({
    supabase: args.supabase,
    userId: args.state.context.userId,
    business: {
      latitude: business.latitude === null || business.latitude === undefined
        ? null : Number(business.latitude),
      longitude: business.longitude === null || business.longitude === undefined
        ? null : Number(business.longitude),
    },
    subtotal,
  });
  const { data: address } = await args.supabase
    .from('addresses')
    .select('id,label,formatted_address,street_address')
    .eq('user_id', args.state.context.userId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  const totalAmount = subtotal + pricing.deliveryFee + pricing.serviceFee;
  const item = {
    productId: String(product.id),
    name: String(product.name),
    quantity,
    unitPrice,
    itemTotal: subtotal,
    instructions: null,
  };
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: draft, error: draftError } = await args.supabase
    .from('domi_order_drafts')
    .insert({
      user_id: args.state.context.userId,
      conversation_id: args.state.conversationId,
      business_id: String(product.business_id),
      address_id: address?.id || null,
      status: address ? 'ready' : 'draft',
      items: [item],
      subtotal,
      delivery_fee: pricing.deliveryFee,
      service_fee: pricing.serviceFee,
      discount_amount: Math.max(0, (originalPrice - unitPrice) * quantity),
      total_amount: totalAmount,
      source: 'domi',
      metadata: {
        recommendationScore: recommendation.score,
        pricingSource: pricing.source,
        distanceKm: pricing.distanceKm,
        requiresAddressConfirmation: true,
        requiresPaymentConfirmation: true,
      },
      expires_at: expiresAt,
    })
    .select('id,status,expires_at')
    .single();
  if (draftError || !draft) throw new Error('domi_order_draft_write_failed');

  const productPayload = {
    id: String(product.id),
    business_id: String(product.business_id),
    name: String(product.name),
    description: String(product.description || ''),
    price: unitPrice,
    image_url: product.image_url ? String(product.image_url) : null,
    is_available: true,
    metadata: record(product.metadata),
  };
  const command = {
    type: 'cart.replace' as const,
    payload: {
      product: productPayload,
      businessId: String(product.business_id),
      businessName: String(business.name || recommendation.businessName),
      quantity,
      unitPrice,
      draftId: String(draft.id),
    },
  };

  return {
    intent: 'prepare_order_draft',
    tool: 'agent.order_draft_service',
    message: `Preparé ${quantity} × ${product.name} de ${business.name || recommendation.businessName}. Subtotal ${money(subtotal)}, domicilio ${money(pricing.deliveryFee)}, tarifa de servicio ${money(pricing.serviceFee)} y total estimado ${money(totalAmount)}. ${address ? `Usé provisionalmente ${address.label || address.formatted_address || address.street_address}, pero debes confirmar la dirección.` : 'Debes seleccionar una dirección antes de continuar.'} El pedido todavía no existe y el pago debe hacerse manualmente.`,
    data: {
      draft: {
        id: String(draft.id),
        status: String(draft.status),
        expiresAt: String(draft.expires_at),
        businessId: String(product.business_id),
        businessName: String(business.name || recommendation.businessName),
        address: address || null,
        items: [item],
        subtotal,
        deliveryFee: pricing.deliveryFee,
        serviceFee: pricing.serviceFee,
        totalAmount,
      },
      clientCommands: [command],
    },
    recordCount: 1,
    suggestedActions: address ? ['Revisar el carrito', 'Ir al pago manual'] : ['Agregar una dirección'],
    navigation: address
      ? [
          { label: 'Revisar carrito', href: '/cliente/cart' },
          { label: 'Continuar al pago manual', href: `/cliente/checkout?domiDraft=${draft.id}` },
        ]
      : [{ label: 'Agregar dirección', href: '/cliente/configuracion/direcciones' }],
    clientCommands: [command],
    requiresConfirmation: false,
    riskLevel: 'low',
  };
}
