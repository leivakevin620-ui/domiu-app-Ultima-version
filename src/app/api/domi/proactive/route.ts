import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { buildDomiServerContext } from '@/lib/domi/server-context';
import { getDomiUserSettings } from '@/lib/domi/user-settings';
import { rejectUnsafeMutation } from '@/lib/http/request-security';
import {
  generateDomiProactiveEvents,
  listDomiProactiveEvents,
} from '@/lib/domi/agent/proactive-service';

export const runtime = 'nodejs';

const patchSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(['read', 'dismissed']),
}).strict();

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error.message },
      { status: auth.error.status, headers: responseHeaders },
    );
  }

  try {
    const supabase = getServiceClient();
    const settings = await getDomiUserSettings(supabase, auth.session.user.id);
    const context = await buildDomiServerContext({
      request,
      supabase,
      profile: auth.session.profile,
      user: auth.session.user,
    });
    await generateDomiProactiveEvents({ supabase, context, settings });
    const events = await listDomiProactiveEvents({
      supabase,
      userId: auth.session.user.id,
      limit: 5,
    });
    return NextResponse.json({ events, settings }, { headers: responseHeaders });
  } catch (cause) {
    console.error('[Domi] Proactive events failed', cause);
    return NextResponse.json(
      { error: 'No se pudieron revisar los avisos de Domi.' },
      { status: 500, headers: responseHeaders },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;

  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error.message },
      { status: auth.error.status, headers: responseHeaders },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers: responseHeaders });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'El aviso enviado no es válido.' }, { status: 400, headers: responseHeaders });
  }

  const now = new Date().toISOString();
  const updates = parsed.data.status === 'read'
    ? { status: 'read', read_at: now, updated_at: now }
    : { status: 'dismissed', dismissed_at: now, updated_at: now };
  const { data, error } = await getServiceClient()
    .from('domi_proactive_events')
    .update(updates)
    .eq('id', parsed.data.eventId)
    .eq('user_id', auth.session.user.id)
    .select('id')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar el aviso.' }, { status: 500, headers: responseHeaders });
  }
  if (!data) {
    return NextResponse.json({ error: 'El aviso no existe para esta cuenta.' }, { status: 404, headers: responseHeaders });
  }
  return NextResponse.json({ ok: true }, { headers: responseHeaders });
}
