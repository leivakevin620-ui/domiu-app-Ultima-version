import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';

interface ErrorResponse {
  error: string;
  message: string;
  status: number;
}

function errorResponse(error: string, message: string, status: number): NextResponse<ErrorResponse> {
  return NextResponse.json({ error, message, status }, { status });
}

async function getUserFromToken(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id };
}

const profileUpdateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  email: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getUserFromToken(req);
  if (!auth) {
    return errorResponse('Unauthorized', 'No autenticado', 401);
  }
  const serviceClient = getServiceClient();
  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', auth.userId)
    .single();
  if (error || !profile) {
    return errorResponse('NotFound', 'Perfil no encontrado', 404);
  }
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) {
      return errorResponse('Unauthorized', 'No autenticado', 401);
    }

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('ValidationError', 'Datos inválidos', 422);
    }

    const serviceClient = getServiceClient();
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', auth.userId)
      .maybeSingle();

    if (existingProfile) {
      const { data, error } = await serviceClient
        .from('profiles')
        .update(parsed.data)
        .eq('id', auth.userId)
        .select()
        .single();
      if (error) return errorResponse('InternalError', error.message, 500);
      return NextResponse.json({ profile: data });
    }

    const { data: profile, error } = await serviceClient
      .from('profiles')
      .insert({ id: auth.userId, ...parsed.data })
      .select()
      .single();

    if (error) return errorResponse('InternalError', error.message, 500);
    return NextResponse.json({ profile });
  } catch {
    return errorResponse('InternalError', 'Error interno del servidor', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return errorResponse('Unauthorized', 'No autenticado', 401);

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('ValidationError', 'Datos inválidos', 422);
    }

    const serviceClient = getServiceClient();
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .update(parsed.data)
      .eq('id', auth.userId)
      .select()
      .single();
    if (error) return errorResponse('InternalError', error.message, 500);
    return NextResponse.json({ profile });
  } catch {
    return errorResponse('InternalError', 'Error interno del servidor', 500);
  }
}
