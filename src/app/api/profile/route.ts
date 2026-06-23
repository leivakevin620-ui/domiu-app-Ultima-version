import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { logger } from '@/lib/logger';
import { ADMIN_ROLES, type UserRole } from '@/types/auth';

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

const profileCreateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

const profileUpdateSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  email: z.string().email().optional(),
});

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'domiumagdalena@gmail.com';

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
    const parsed = profileCreateSchema.safeParse(body);
    if (!parsed.success) {
      logger.debug('[API Profile] POST validation error');
      return errorResponse('ValidationError', 'Datos inválidos', 422);
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.slice(7) || '';
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    const userEmail = user?.email || '';

    if (parsed.data.role && ADMIN_ROLES.includes(parsed.data.role as UserRole) && userEmail !== SUPER_ADMIN_EMAIL) {
      logger.debug('[API Profile] POST forbidden admin role', { role: parsed.data.role });
      return errorResponse('Forbidden', 'No autorizado para crear este tipo de cuenta', 403);
    }

    const serviceClient = getServiceClient();
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', auth.userId)
      .maybeSingle();

    if (existingProfile) {
      logger.debug('[API Profile] POST updating existing profile');
      const { data, error } = await serviceClient
        .from('profiles')
        .update(parsed.data)
        .eq('id', auth.userId)
        .select()
        .single();
      if (error) return errorResponse('InternalError', error.message, 500);
      return NextResponse.json({ profile: data });
    }

    logger.debug('[API Profile] POST creating profile');
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .insert({ id: auth.userId, ...parsed.data })
      .select()
      .single();

    if (error) return errorResponse('InternalError', error.message, 500);
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
