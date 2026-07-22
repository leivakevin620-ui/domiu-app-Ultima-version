'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES, type UserRole } from '@/types/auth';

const roleSchema = z.enum([
  'super_admin',
  'admin_general',
  'admin_financiero',
  'admin_operativo',
  'admin_comercial',
  'admin_soporte',
  'admin',
  'merchant',
  'courier',
  'customer',
]);

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'domiumagdalena@gmail.com';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function setExactUserRoleAction(userId: string, requestedRole: string) {
  const parsedRole = roleSchema.safeParse(requestedRole);
  if (!parsedRole.success) return { success: false, error: 'El rol seleccionado no es válido.' };

  const auth = await requireAuth();
  if (auth.error || !auth.session) {
    return { success: false, error: auth.error?.message || 'No autenticado.' };
  }

  const actorRole = auth.session.profile.role;
  const actorEmail = String(auth.session.user.email || '').toLowerCase();
  if (!ADMIN_ROLES.includes(actorRole)) {
    return { success: false, error: 'Solo un administrador puede asignar roles.' };
  }

  const role = parsedRole.data as UserRole;
  if (ADMIN_ROLES.includes(role) && actorEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: 'Solo el administrador principal puede otorgar roles administrativos.' };
  }

  const supabase = getServiceClient();
  const { data: current, error: currentError } = await supabase
    .from('profiles')
    .select('id,email,role,metadata,deleted_at')
    .eq('id', userId)
    .maybeSingle();

  if (currentError) return { success: false, error: currentError.message };
  if (!current || current.deleted_at) return { success: false, error: 'Usuario no encontrado.' };
  if (String(current.email).toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: 'El rol del administrador principal no puede modificarse.' };
  }

  if (current.role === role) return { success: true, role };

  const now = new Date().toISOString();
  const previousRole = current.role as UserRole;
  const previousMetadata = current.metadata;
  const { data: authUserResult } = await supabase.auth.admin.getUserById(userId);
  const previousAuthMetadata = asRecord(authUserResult.user?.user_metadata);

  const profileMetadata = {
    ...asRecord(previousMetadata),
    assigned_role: role,
    role_assigned_at: now,
    role_assigned_by: auth.session.user.id,
  };

  const rollback = async () => {
    await supabase
      .from('profiles')
      .update({ role: previousRole, metadata: previousMetadata, updated_at: new Date().toISOString() })
      .eq('id', userId);
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...previousAuthMetadata, role: previousRole },
    });
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role, metadata: profileMetadata, updated_at: now })
    .eq('id', userId);

  if (profileError) return { success: false, error: 'No se pudo asignar el rol: ' + profileError.message };

  const { error: authMetadataError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { ...previousAuthMetadata, role },
  });

  if (authMetadataError) {
    await rollback();
    return { success: false, error: 'No se pudo sincronizar el rol de autenticación: ' + authMetadataError.message };
  }

  if (role === 'courier') {
    // El trigger de perfiles crea el registro operativo del repartidor. Se verifica para no dejar una cuenta incompleta.
    const { data: driver, error: driverReadError } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (driverReadError || !driver) {
      await rollback();
      return {
        success: false,
        error: 'El rol no fue aplicado porque no se pudo crear el perfil operativo del repartidor.',
      };
    }

    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        deleted_at: null,
        status: 'offline',
        is_active: false,
        is_available: false,
        updated_at: now,
      })
      .eq('id', userId);

    if (driverError) {
      await rollback();
      return { success: false, error: 'No se pudo preparar el perfil del repartidor: ' + driverError.message };
    }
  } else if (previousRole === 'courier') {
    // El historial del repartidor se conserva, pero queda fuera de operación al cambiar de rol.
    await supabase
      .from('drivers')
      .update({ status: 'offline', is_active: false, is_available: false, updated_at: now })
      .eq('id', userId);
  }

  const { data: verified, error: verifyError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (verifyError || verified?.role !== role) {
    await rollback();
    return { success: false, error: 'La base de datos no confirmó el rol exacto seleccionado.' };
  }

  await serverAudit.logAction(
    auth.session.user.id,
    auth.session.user.email,
    actorRole,
    'set_exact_user_role',
    'profiles',
    userId,
    { previousRole, role },
  );

  return { success: true, role };
}
