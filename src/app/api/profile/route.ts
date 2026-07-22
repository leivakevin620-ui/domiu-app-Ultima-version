import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { logger } from '@/lib/logger';

interface ErrorResponse {
  error: string;
  message: string;
  status: number;
}

function errorResponse(error: string, message: string, status: number): NextResponse<ErrorResponse> {
  return NextResponse.json({ error, message, status }, { status });
}

async function getUserFromToken(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id, email: user.email || '' };
}

const profileCreateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  email: z.string().email().optional(),
});

const profileUpdateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  email: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  logger.debug('[API Profile] GET');
  const auth = await getUserFromToken(req);
  if (!auth) {
    logger.debug('[API Profile] GET unauthorized');
    return errorResponse('Unauthorized', 'No autenticado', 401);
  }
  const serviceClient = getServiceClient();
  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', auth.userId)
    .single();
  if (error || !profile) {
    logger.debug('[API Profile] GET not found');
    return errorResponse('NotFound', 'Perfil no encontrado', 404);
  }
  logger.debug('[API Profile] GET success');
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  logger.debug('[API Profile] POST');
  try {
    const auth = await getUserFromToken(req);
    if (!auth) {
      logger.debug('[API Profile] POST unauthorized');
      return errorResponse('Unauthorized', 'No autenticado', 401);
    }

    const body = await req.json();
    if ((body.role && body.role !== 'customer') || (body.status && body.status !== 'active')) {
      logger.debug('[API Profile] POST forbidden role/status', { role: body.role, status: body.status });
      return errorResponse(
        'Forbidden',
        'El autorregistro solo puede crear clientes activos. Los demás roles se asignan desde Administración.',
        403,
      );
    }

    const parsed = profileCreateSchema.safeParse(body);
    if (!parsed.success) {
      logger.debug('[API Profile] POST validation error');
      return errorResponse('ValidationError', 'Datos inválidos', 422);
    }

    const serviceClient = getServiceClient();
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id,role')
      .eq('id', auth.userId)
      .maybeSingle();

    const safeProfileData = {
      ...parsed.data,
      email: auth.email || parsed.data.email,
    };

    if (existingProfile) {
      logger.debug('[API Profile] POST updating existing safe fields');
      const { data, error } = await serviceClient
        .from('profiles')
        .update(safeProfileData)
        .eq('id', auth.userId)
        .select()
        .single();
      if (error) return errorResponse('InternalError', error.message, 500);
      return NextResponse.json({ profile: data });
    }

    logger.debug('[API Profile] POST creating customer profile');
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .insert({
        id: auth.userId,
        ...safeProfileData,
        role: 'customer',
        status: 'active',
      })
      .select()
      .single();

    if (error) return errorResponse('InternalError', error.message, 500);
    if (profile.role !== 'customer') {
      return errorResponse('InternalError', 'La base de datos no confirmó el rol de cliente.', 500);
    }
    logger.debug('[API Profile] POST success');
    return NextResponse.json({ profile });
  } catch {
    return errorResponse('InternalError', 'Error interno del servidor', 500);
  }
}

export async function PATCH(req: NextRequest) {
  logger.debug('[API Profile] PATCH');
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return errorResponse('Unauthorized', 'No autenticado', 401);

    const body = await req.json();
    if (body.role || body.status) {
      logger.debug('[API Profile] PATCH forbidden role/status change');
      return errorResponse('Forbidden', 'No puedes modificar rol o estado', 403);
    }

    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      logger.debug('[API Profile] PATCH validation error');
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
    logger.debug('[API Profile] PATCH success');
    return NextResponse.json({ profile });
  } catch {
    return errorResponse('InternalError', 'Error interno del servidor', 500);
  }
}
