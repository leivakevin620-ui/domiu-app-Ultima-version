import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import {
  getDomiUserSettings,
  updateDomiUserSettings,
} from '@/lib/domi/user-settings';

export const runtime = 'nodejs';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).nullable();
const updateSchema = z.object({
  memoryEnabled: z.boolean().optional(),
  proactiveEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  speechOutputEnabled: z.boolean().optional(),
  learningEnabled: z.boolean().optional(),
  proactiveFrequency: z.enum(['off', 'important_only', 'daily', 'realtime']).optional(),
  proactiveChannel: z.enum(['in_app', 'push', 'email']).optional(),
  quietHoursStart: timeSchema.optional(),
  quietHoursEnd: timeSchema.optional(),
  preferredLanguage: z.string().trim().min(2).max(24).optional(),
}).strict();

function headers() {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }
  try {
    const settings = await getDomiUserSettings(getServiceClient(), auth.session.user.id);
    return NextResponse.json({ settings }, { headers: headers() });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar las preferencias de Domi.' }, { status: 500, headers: headers() });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status, headers: headers() });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers: headers() });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Las preferencias enviadas no son válidas.' }, { status: 400, headers: headers() });
  }

  try {
    const settings = await updateDomiUserSettings(
      getServiceClient(),
      auth.session.user.id,
      parsed.data,
    );
    return NextResponse.json({ settings }, { headers: headers() });
  } catch {
    return NextResponse.json({ error: 'No se pudieron guardar las preferencias de Domi.' }, { status: 500, headers: headers() });
  }
}
