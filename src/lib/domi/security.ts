import type { UserRole } from '@/types/auth';

export type DomiRole = 'admin' | 'merchant' | 'courier' | 'customer';
export type DomiRiskLevel = 'low' | 'medium' | 'high';

export interface DomiCartItemInput {
  productId?: string;
  quantity?: number;
}

export interface DomiCartSnapshotInput {
  businessId?: string | null;
  items?: DomiCartItemInput[];
}

export interface DomiCartItemContext {
  productId: string;
  quantity: number;
}

export interface DomiCartContext {
  businessId: string | null;
  items: DomiCartItemContext[];
}

export interface DomiClientContextInput {
  path?: string;
  module?: string;
  screen?: string;
  locale?: string;
  timezone?: string;
  cart?: DomiCartSnapshotInput | null;
}

export interface DomiClientContext {
  path: string | null;
  module: string | null;
  screen: string | null;
  locale: string;
  timezone: string;
  cart: DomiCartContext | null;
}

export interface DomiMemoryCandidate {
  text: string;
  type: 'preference';
  explicitConsent: boolean;
}

export interface DomiSecurityDecision {
  blocked: boolean;
  reason?: 'prompt_injection' | 'secret_extraction' | 'privilege_escalation' | 'cross_user_data';
  message?: string;
  riskLevel: DomiRiskLevel;
}

const ADMIN_ROLES = new Set<UserRole>([
  'super_admin',
  'admin_general',
  'admin_financiero',
  'admin_operativo',
  'admin_comercial',
  'admin_soporte',
  'admin',
]);

const ROLE_PATH_PREFIX: Record<DomiRole, string> = {
  admin: '/admin',
  merchant: '/negocio',
  courier: '/repartidor',
  customer: '/cliente',
};

export const DOMI_ROLE_CAPABILITIES: Record<DomiRole, readonly string[]> = {
  admin: ['operation.read', 'orders.read', 'business.read', 'courier.read', 'reports.read', 'finance.read', 'audit.read'],
  merchant: ['business.read', 'orders.read', 'catalog.read', 'inventory.read', 'reports.read', 'reviews.read'],
  courier: ['assignments.read', 'delivery.read', 'route.read', 'earnings.read', 'support.create'],
  customer: ['business.search', 'products.search', 'cart.read', 'orders.read', 'coupons.read', 'support.create'],
};

export function normalizeDomiRole(role: UserRole | string): DomiRole {
  if (ADMIN_ROLES.has(role as UserRole)) return 'admin';
  if (role === 'business' || role === 'merchant') return 'merchant';
  if (role === 'courier') return 'courier';
  return 'customer';
}

function cleanLabel(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
  return cleaned || null;
}

function safePath(role: DomiRole, value: unknown) {
  if (typeof value !== 'string') return null;
  const path = value.trim().split('?')[0].split('#')[0].slice(0, 240);
  if (!path.startsWith('/')) return null;
  const prefix = ROLE_PATH_PREFIX[role];
  return path === prefix || path.startsWith(`${prefix}/`) ? path : null;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function sanitizeCart(role: DomiRole, input?: DomiCartSnapshotInput | null): DomiCartContext | null {
  if (role !== 'customer' || !input || !Array.isArray(input.items)) return null;

  const quantities = new Map<string, number>();
  for (const item of input.items.slice(0, 25)) {
    if (!validUuid(item?.productId)) continue;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    const productId = item.productId.trim();
    quantities.set(productId, Math.min(99, (quantities.get(productId) || 0) + quantity));
  }

  return {
    businessId: validUuid(input.businessId) ? input.businessId.trim() : null,
    items: [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity })),
  };
}

export function sanitizeDomiClientContext(role: DomiRole, input?: DomiClientContextInput | null): DomiClientContext {
  const locale = cleanLabel(input?.locale, 24);
  const timezone = cleanLabel(input?.timezone, 64);
  return {
    path: safePath(role, input?.path),
    module: cleanLabel(input?.module, 60),
    screen: cleanLabel(input?.screen, 80),
    locale: locale && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'es-CO',
    timezone: timezone && /^[A-Za-z_]+(?:\/[A-Za-z_+-]+)+$/.test(timezone) ? timezone : 'America/Bogota',
    cart: sanitizeCart(role, input?.cart),
  };
}

export function evaluateDomiSecurity(message: string): DomiSecurityDecision {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (/(olvida|ignora|omite).{0,35}(instrucciones|reglas|sistema|seguridad)|prompt\s*injection|system\s*prompt/.test(normalized)) {
    return {
      blocked: true,
      reason: 'prompt_injection',
      riskLevel: 'high',
      message: 'No puedo cambiar mis reglas de seguridad ni revelar instrucciones internas. Puedo ayudarte con las funciones permitidas para tu perfil.',
    };
  }

  if (/(api\s*key|service\s*role|token|contrasena|password|secreto|clave privada|env\b|variables de entorno)/.test(normalized)
    && /(muestra|dime|revela|entrega|extrae|copia|lista|ver)/.test(normalized)) {
    return {
      blocked: true,
      reason: 'secret_extraction',
      riskLevel: 'high',
      message: 'No puedo mostrar claves, tokens, contraseñas ni información técnica secreta. Puedo ayudarte a revisar la configuración de forma segura.',
    };
  }

  if (/(soy|hazme|convierteme|cambia mi rol|dame acceso|otorgame permiso).{0,35}(admin|administrador|super admin|superadministrador)/.test(normalized)) {
    return {
      blocked: true,
      reason: 'privilege_escalation',
      riskLevel: 'high',
      message: 'No puedo cambiar roles o permisos mediante una conversación. El acceso se valida desde el sistema y solo puede modificarlo un administrador autorizado.',
    };
  }

  if (/(todos los clientes|otros usuarios|otro cliente|otro repartidor|datos de terceros|base de datos completa)/.test(normalized)
    && /(muestra|lista|entrega|exporta|dame|ver)/.test(normalized)) {
    return {
      blocked: true,
      reason: 'cross_user_data',
      riskLevel: 'high',
      message: 'No puedo mostrar información de otros usuarios. Solo puedo ayudarte con los datos y funciones autorizados para tu perfil.',
    };
  }

  return { blocked: false, riskLevel: 'low' };
}

export function detectDomiIntent(message: string) {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/ganancia|liquidacion|saldo|comision/.test(normalized)) return 'finance_question';
  if (/jornada|turno|abrir operacion|cerrar operacion/.test(normalized)) return 'operation_question';
  if (/carrito|cesta/.test(normalized)) return 'cart_question';
  if (/pedido|domicilio|entrega|estado/.test(normalized)) return 'order_question';
  if (/producto|inventario|catalogo|menu|buscar|restaurante|farmacia/.test(normalized)) return 'catalog_question';
  if (/recuerda|guardar|memoria|prefiero|me gusta/.test(normalized)) return 'memory_request';
  if (/ayuda|soporte|problema|error|reclamo/.test(normalized)) return 'support_question';
  return 'general_question';
}

export function detectMemoryCandidate(message: string): DomiMemoryCandidate | null {
  const explicit = message.match(/(?:recuerda|guarda|memoriza)(?:\s+que)?\s+(.{3,180})/i);
  if (explicit?.[1]) return { text: explicit[1].trim(), type: 'preference', explicitConsent: true };

  const preference = message.match(/(?:me gusta|prefiero)\s+(.{3,180})/i);
  if (preference?.[1]) return { text: preference[1].trim(), type: 'preference', explicitConsent: false };
  return null;
}

export function isMemoryConfirmation(message: string) {
  const normalized = message.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(si(?:\s*,?\s*(?:guardalo|recuerdalo|puedes guardarlo))?|confirmo|de acuerdo|guardalo|recuerdalo|puedes guardarlo)[.!\s]*$/.test(normalized);
}

export function isMemoryRejection(message: string) {
  const normalized = message.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(no|no gracias|no lo guardes|cancelar|cancela)[.!\s]*$/.test(normalized);
}

export function memoryKey(text: string) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 72) || 'preferencia';
  return `preference_${slug}`;
}
