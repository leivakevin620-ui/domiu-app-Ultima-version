import type { UserRole } from '@/types/auth';

export interface DomiNavigationLink {
  label: string;
  href: string;
}

export interface DomiClientMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  suggestedActions?: string[];
  navigation?: DomiNavigationLink[];
}

export interface DomiCartSnapshot {
  businessId: string | null;
  items: Array<{ productId: string; quantity: number }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

const ADMIN_ROLES = new Set<UserRole>([
  'super_admin',
  'admin_general',
  'admin_financiero',
  'admin_operativo',
  'admin_comercial',
  'admin_soporte',
  'admin',
]);

export function isDomiUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function getDomiRoleBasePath(role: UserRole | string): string | null {
  if (ADMIN_ROLES.has(role as UserRole)) return '/admin';
  if (role === 'business' || role === 'merchant') return '/negocio';
  if (role === 'courier') return '/repartidor';
  if (role === 'customer') return '/cliente';
  return null;
}

function isAllowedPath(pathname: string, role: UserRole | string): boolean {
  const basePath = getDomiRoleBasePath(role);
  if (!basePath) return false;

  const allowedPrefixes = [basePath, '/notificaciones', '/soporte'];
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function sanitizeDomiNavigation(
  value: unknown,
  role: UserRole | string,
): DomiNavigationLink[] {
  if (!Array.isArray(value)) return [];

  const links: DomiNavigationLink[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { label?: unknown; href?: unknown };
    if (typeof candidate.label !== 'string' || typeof candidate.href !== 'string') continue;

    const label = candidate.label.trim().slice(0, 60);
    const href = candidate.href.trim();
    if (!label || !href.startsWith('/') || href.startsWith('//')) continue;
    if (href.includes('\\') || CONTROL_CHARACTERS.test(href)) continue;

    let parsed: URL;
    try {
      parsed = new URL(href, 'https://domiu.local');
    } catch {
      continue;
    }

    if (parsed.origin !== 'https://domiu.local' || !isAllowedPath(parsed.pathname, role)) continue;

    const safeHref = `${parsed.pathname}${parsed.search}${parsed.hash}`.slice(0, 240);
    if (seen.has(safeHref)) continue;

    seen.add(safeHref);
    links.push({ label, href: safeHref });
    if (links.length >= 4) break;
  }

  return links;
}

export function normalizeDomiMessages(
  value: unknown,
  role: UserRole | string,
): DomiClientMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: DomiClientMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (candidate.role !== 'user' && candidate.role !== 'assistant') continue;

    const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';
    if (!content) continue;

    messages.push({
      id: typeof candidate.id === 'string' ? candidate.id : undefined,
      role: candidate.role,
      content: content.slice(0, 12_000),
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
      suggestedActions: Array.isArray(candidate.suggestedActions)
        ? candidate.suggestedActions
            .filter((action): action is string => typeof action === 'string')
            .map((action) => action.trim().slice(0, 90))
            .filter(Boolean)
            .slice(0, 3)
        : [],
      navigation: sanitizeDomiNavigation(candidate.navigation, role),
    });

    if (messages.length >= 200) break;
  }

  return messages;
}

export function sanitizeDomiCart(input: {
  businessId: unknown;
  items: Array<{ product?: { id?: unknown }; quantity?: unknown }>;
}): DomiCartSnapshot {
  const items = input.items
    .filter(
      (item) =>
        isDomiUuid(item.product?.id) &&
        Number.isInteger(item.quantity) &&
        Number(item.quantity) >= 1 &&
        Number(item.quantity) <= 99,
    )
    .slice(0, 25)
    .map((item) => ({
      productId: String(item.product?.id),
      quantity: Number(item.quantity),
    }));

  return {
    businessId: isDomiUuid(input.businessId) ? input.businessId : null,
    items,
  };
}

export class DomiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DomiRequestError';
    this.status = status;
  }
}

function payloadError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

export async function requestDomiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  const raw = await response.text();
  let payload: unknown = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const serverMessage = payloadError(payload);
    const fallback =
      response.status === 401
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : response.status === 403
          ? 'Tu perfil no tiene permiso para realizar esta acción.'
          : response.status === 429
            ? 'Has enviado varios mensajes muy rápido. Espera un momento.'
            : response.status >= 500
              ? 'Domi tuvo un problema temporal. Intenta nuevamente.'
              : 'No fue posible completar la solicitud.';
    throw new DomiRequestError(serverMessage || fallback, response.status);
  }

  if (!raw || !payload || typeof payload !== 'object') {
    throw new DomiRequestError('Domi devolvió una respuesta inválida.', 502);
  }

  return payload as T;
}
