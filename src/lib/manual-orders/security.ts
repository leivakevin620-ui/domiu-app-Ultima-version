import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth, type AuthSession } from '@/lib/auth/server-auth';

export type ManualOrderActorRole = 'admin' | 'merchant';

export interface ManualOrderActor {
  session: AuthSession;
  role: ManualOrderActorRole;
}

export class ManualOrderError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'manual_order_error',
  ) {
    super(message);
    this.name = 'ManualOrderError';
  }
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  const fetchSite = request.headers.get('sec-fetch-site');

  if (fetchSite === 'cross-site') {
    throw new ManualOrderError('Solicitud bloqueada por seguridad.', 403, 'cross_site_request');
  }
  if (!origin) return;
  if (!host) throw new ManualOrderError('No se pudo validar el origen de la solicitud.', 403, 'origin_missing_host');

  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ManualOrderError('Origen de solicitud inválido.', 403, 'invalid_origin');
  }
  if (originHost !== host) {
    throw new ManualOrderError('Solicitud bloqueada por seguridad.', 403, 'origin_mismatch');
  }
}

export async function requireManualOrderActor(): Promise<ManualOrderActor> {
  const auth = await requireAuth();
  if (auth.error) throw new ManualOrderError(auth.error.message, auth.error.status, 'authentication_required');
  const role = auth.session.profile.role;
  if (role !== 'admin' && role !== 'merchant') {
    throw new ManualOrderError('No tienes permiso para administrar pedidos manuales.', 403, 'role_forbidden');
  }
  if (auth.session.profile.status !== 'active') {
    throw new ManualOrderError('La cuenta no está activa.', 403, 'inactive_account');
  }
  return { session: auth.session, role };
}

export async function assertBusinessAccess(
  supabase: SupabaseClient,
  actor: ManualOrderActor,
  businessId: string,
) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id,owner_id,name,is_active,is_verified,is_accepting_orders,operations_status,allow_custom_manual_products,allow_manual_delivery_fee_override,metadata,deleted_at')
    .eq('id', businessId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new ManualOrderError('No se pudo validar el negocio.', 500, 'business_lookup_failed');
  if (!data) throw new ManualOrderError('El negocio no existe.', 404, 'business_not_found');
  if (actor.role === 'merchant' && data.owner_id !== actor.session.user.id) {
    throw new ManualOrderError('No puedes crear pedidos para otro negocio.', 403, 'tenant_mismatch');
  }
  return data;
}

export async function consumeManualOrderRateLimit(args: {
  supabase: SupabaseClient;
  actor: ManualOrderActor;
  action: 'quote' | 'draft' | 'confirm' | 'search';
  limit?: number;
}) {
  const limit = args.limit ?? (args.action === 'confirm' ? 8 : 40);
  const since = new Date(Date.now() - 60_000).toISOString();
  const action = `manual_order.${args.action}`;
  const { count, error } = await args.supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', args.actor.session.user.id)
    .eq('action', action)
    .gte('created_at', since);
  if (!error && Number(count || 0) >= limit) {
    throw new ManualOrderError('Has realizado demasiadas solicitudes. Espera un minuto.', 429, 'rate_limit');
  }

  await args.supabase.from('audit_log').insert({
    user_id: args.actor.session.user.id,
    user_email: args.actor.session.user.email || null,
    user_role: args.actor.role,
    action,
    entity_type: 'manual_order_request',
    details: { consumed: true },
    result: 'success',
    metadata: { rate_limit_window_seconds: 60, rate_limit: limit },
  });
}

export function manualOrderResponseHeaders() {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}
