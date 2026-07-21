import type { DomiServerContext } from '@/lib/domi/server-context';
import type { DomiAgentPlan } from '@/lib/domi/agent/types';
import {
  cleanDomiQuery,
  extractDomiReference,
  normalizeDomiText,
  parseDomiBudget,
} from '@/lib/domi/agent/text-utils';

function basePlan(message: string) {
  return {
    query: cleanDomiQuery(message),
    budget: parseDomiBudget(message),
    reference: extractDomiReference(message),
    requestedQuantity: 1,
    rawMessage: message,
  };
}

export function classifyDomiAdvancedIntent(
  context: Pick<DomiServerContext, 'role' | 'permissions'>,
  message: string,
): DomiAgentPlan | null {
  const normalized = normalizeDomiText(message);
  const base = basePlan(message);

  if (context.role === 'admin' && /\b(panel|evaluacion|aprendizaje|candidatos|calidad)\b.{0,30}\b(domi|asistente|respuestas?)\b/.test(normalized)) {
    return { ...base, intent: 'admin_evaluation' };
  }
  if (/\b(voz|microfono|hablar|escuchar|leer en voz alta|respuesta hablada)\b/.test(normalized)) {
    return { ...base, intent: 'voice_settings' };
  }
  if (/\b(proactividad|alertas de domi|avisos de domi|recordatorios de domi)\b/.test(normalized)) {
    return { ...base, intent: 'proactive_settings' };
  }
  if (/\b(olvida|olvidar|borra|borrar|elimina|eliminar)\b/.test(normalized)
    && /\b(recuerdo|memoria|preferencia|direccion favorita)\b/.test(normalized)
    && !/\b(toda|todos|completa|completos)\b/.test(normalized)) {
    return { ...base, intent: 'memory_forget_specific', reference: base.query || base.reference };
  }
  if (/\b(corrige|corregir|cambia|cambiar|actualiza|actualizar)\b/.test(normalized)
    && /\b(recuerdo|memoria|preferencia|direccion favorita)\b/.test(normalized)) {
    return { ...base, intent: 'memory_correct', reference: base.query || base.reference };
  }

  if (context.role !== 'customer') return null;

  if (/\b(promocion|promociones|descuento|descuentos|cupon|cupones|oferta|ofertas)\b/.test(normalized)) {
    return { ...base, intent: 'promotions' };
  }
  if (/\b(direccion|direcciones)\b/.test(normalized)
    && /\b(mi|mis|guardada|guardadas|habitual|principal|usar|elige|elegir)\b/.test(normalized)) {
    return { ...base, intent: 'addresses' };
  }
  if (/\b(metodo de pago|metodos de pago|como puedo pagar|formas de pago)\b/.test(normalized)) {
    return { ...base, intent: 'payment_methods' };
  }
  if (/\b(prepara|preparar|crea|crear|arma|armar|deja listo|borrador)\b.{0,35}\b(pedido|compra|carrito)\b/.test(normalized)
    || /\b(agrega|agregar|anade)\b.{0,30}\b(la primera|la mejor|esa opcion|al carrito)\b/.test(normalized)) {
    return { ...base, intent: 'prepare_order_draft' };
  }
  if (/\b(retomar|continuar|sigamos|donde quedamos|compra pendiente)\b/.test(normalized)) {
    return { ...base, intent: 'resume_goal' };
  }

  const recommendation = /\b(recomienda|recomiendame|mejor opcion|que comer|que comprar|mas barato|mas rapido|comparar|compara)\b/.test(normalized);
  const catalog = /\b(salchipapa|hamburguesa|pizza|perro|pollo|alitas|sushi|comida|farmacia|medicamento|mercado|supermercado|producto|restaurante)\b/.test(normalized);
  if (base.budget && (recommendation || catalog)) {
    return { ...base, intent: 'budget_recommendation' };
  }
  if (recommendation) {
    return { ...base, intent: 'product_recommendation' };
  }

  return null;
}
