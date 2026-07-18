import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/auth';
import {
  DOMI_ROLE_CAPABILITIES,
  normalizeDomiRole,
  sanitizeDomiClientContext,
  type DomiClientContext,
  type DomiClientContextInput,
  type DomiRole,
} from '@/lib/domi/security';

export interface DomiServerContext {
  requestId: string;
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: DomiRole;
  sourceRole: string;
  permissions: string[];
  tenantId: string;
  tenantType: 'platform' | 'business' | 'user';
  tenantLabel: string;
  accountStatus: string;
  client: DomiClientContext;
  ipAddress: string | null;
  userAgent: string | null;
}

function validRequestId(value?: string | null) {
  if (!value) return null;
  const cleaned = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null;
}

function deriveSessionId(request: NextRequest, userId: string) {
  const authCookies = request.cookies
    .getAll()
    .filter((cookie) => cookie.name.includes('auth-token'))
    .map((cookie) => `${cookie.name}:${cookie.value}`)
    .join('|');
  const source = `${userId}|${authCookies}|${request.headers.get('user-agent') || 'unknown'}`;
  return createHash('sha256').update(source).digest('hex').slice(0, 32);
}

function extractIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const value = forwarded || realIp || null;
  return value?.slice(0, 64) || null;
}

async function resolveTenant(supabase: SupabaseClient, userId: string, role: DomiRole) {
  if (role === 'admin') {
    return { tenantId: 'platform', tenantType: 'platform' as const, tenantLabel: 'DomiU Magdalena' };
  }

  if (role === 'merchant') {
    const { data } = await supabase
      .from('businesses')
      .select('id,name')
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return {
        tenantId: String(data.id),
        tenantType: 'business' as const,
        tenantLabel: String(data.name || 'Comercio DomiU'),
      };
    }
  }

  return { tenantId: userId, tenantType: 'user' as const, tenantLabel: 'Cuenta personal' };
}

export async function buildDomiServerContext(args: {
  request: NextRequest;
  supabase: SupabaseClient;
  profile: UserProfile;
  user: { id: string; email: string };
  clientContext?: DomiClientContextInput | null;
  requestId?: string | null;
}): Promise<DomiServerContext> {
  const role = normalizeDomiRole(args.profile.role);
  const tenant = await resolveTenant(args.supabase, args.user.id, role);
  const name = [args.profile.first_name, args.profile.last_name].filter(Boolean).join(' ').trim()
    || args.profile.email
    || 'Usuario DomiU';

  return {
    requestId: validRequestId(args.requestId) || randomUUID(),
    sessionId: deriveSessionId(args.request, args.user.id),
    userId: args.user.id,
    email: args.user.email || args.profile.email || '',
    name,
    role,
    sourceRole: String(args.profile.role),
    permissions: [...DOMI_ROLE_CAPABILITIES[role]],
    tenantId: tenant.tenantId,
    tenantType: tenant.tenantType,
    tenantLabel: tenant.tenantLabel,
    accountStatus: String(args.profile.status || 'active'),
    client: sanitizeDomiClientContext(role, args.clientContext),
    ipAddress: extractIp(args.request),
    userAgent: args.request.headers.get('user-agent')?.slice(0, 500) || null,
  };
}
