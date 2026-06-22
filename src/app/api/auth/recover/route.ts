import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/db/supabase';
import { logger } from '@/lib/logger';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Servicio no disponible' }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    logger.debug('[Auth Recover] buscando usuario', { email });

    const { data: usersData, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) {
      logger.error('[Auth Recover] error listando usuarios', listErr);
      return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }

    let userRecord = usersData.users.find((u) => u.email === email);
    let created = false;

    if (userRecord) {
      logger.debug('[Auth Recover] usuario existe, actualizando contraseña');
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(userRecord.id, {
        password,
        email_confirm: true,
      });
      if (pwErr) {
        logger.error('[Auth Recover] error actualizando contraseña', pwErr);
        return NextResponse.json({ error: 'Error al recuperar cuenta' }, { status: 500 });
      }
    } else {
      logger.debug('[Auth Recover] usuario no existe, creando');
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        logger.error('[Auth Recover] error creando usuario', createErr);
        return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
      }
      userRecord = newUser.user;
      created = true;
    }

    const userId = userRecord!.id;

    const serviceClient = getServiceClient();
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      logger.debug('[Auth Recover] creando profile');
      const { error: profileErr } = await serviceClient
        .from('profiles')
        .insert({
          id: userId,
          email,
          role: 'customer',
          first_name: email.split('@')[0],
          status: 'active',
        });
      if (profileErr) {
        logger.error('[Auth Recover] error creando profile', profileErr);
      }
    }

    logger.debug('[Auth Recover] éxito', { email, created });
    return NextResponse.json({ success: true, created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    logger.error('[Auth Recover] error inesperado', { message: msg });
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
