import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const JSON_BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function normalizedOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function trustedOrigins(request: NextRequest) {
  const values = [
    request.nextUrl.origin,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  ];

  if (process.env.NODE_ENV !== 'production') {
    values.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  return new Set(values.map(normalizedOrigin).filter((value): value is string => Boolean(value)));
}

export interface MutationRequestValidation {
  ok: boolean;
  reason: 'safe_method' | 'same_origin' | 'invalid_content_type' | 'cross_site' | 'missing_origin';
}

export function validateMutationRequest(request: NextRequest): MutationRequestValidation {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return { ok: true, reason: 'safe_method' };
  }

  if (JSON_BODY_METHODS.has(method)) {
    const contentType = request.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.startsWith('application/json')) {
      return { ok: false, reason: 'invalid_content_type' };
    }
  }

  const allowed = trustedOrigins(request);
  const origin = normalizedOrigin(request.headers.get('origin'));
  if (origin) {
    return allowed.has(origin)
      ? { ok: true, reason: 'same_origin' }
      : { ok: false, reason: 'cross_site' };
  }

  const referer = normalizedOrigin(request.headers.get('referer'));
  if (referer) {
    return allowed.has(referer)
      ? { ok: true, reason: 'same_origin' }
      : { ok: false, reason: 'cross_site' };
  }

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (fetchSite === 'same-origin') {
    return { ok: true, reason: 'same_origin' };
  }
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
    return { ok: false, reason: 'cross_site' };
  }

  return { ok: false, reason: 'missing_origin' };
}

export function rejectUnsafeMutation(request: NextRequest) {
  const validation = validateMutationRequest(request);
  if (validation.ok) return null;

  return NextResponse.json(
    { error: 'La solicitud no superó la validación de seguridad.' },
    {
      status: validation.reason === 'invalid_content_type' ? 415 : 403,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Security': validation.reason,
      },
    },
  );
}
