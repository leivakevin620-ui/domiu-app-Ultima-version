'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { ADMIN_ROLES, type UserRole } from '@/types/auth';
import { serverAudit } from '@/lib/audit/server-audit';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['customer', 'business', 'merchant', 'courier']),
});

const updateProfileSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
});

const createDriverSchema = z.object({
  license_number: z.string().min(1),
  vehicle_type: z.enum(['bike', 'motorcycle', 'car', 'van']),
  vehicle_plate: z.string().min(1),
});

export async function registerUserAction(data: z.infer<typeof registerSchema>) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Datos inválidos');
  }

  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);

  if (!ADMIN_ROLES.includes(result.session.profile.role)) {
    await serverAudit.logError(result.session.user.id, result.session.user.email, result.session.profile.role, 'register_user', 'user', 'Solo administradores pueden registrar usuarios');
    throw new Error('Solo administradores pueden registrar usuarios');
  }

  const supabase = getServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { firstName: parsed.data.firstName, lastName: parsed.data.lastName },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('No se pudo crear el usuario');

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    email: parsed.data.email,
    role: parsed.data.role,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    status: 'active',
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(profileError.message);
  }

  await serverAudit.logAction(result.session.user.id, result.session.user.email, result.session.profile.role, 'register_user', 'profile', authData.user.id, { email: parsed.data.email, role: parsed.data.role });

  return { userId: authData.user.id };
}

export async function updateUserProfileAction(userId: string, updates: z.infer<typeof updateProfileSchema>) {
  const parsed = updateProfileSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error('Datos inválidos');
  }

  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);

  const { session } = result;
  if (!ADMIN_ROLES.includes(session.profile.role as UserRole) && session.user.id !== userId) {
    throw new Error('No autorizado para actualizar este perfil');
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', userId);

  if (error) throw new Error(error.message);

  await serverAudit.logAction(session.user.id, session.user.email, session.profile.role, 'update_profile', 'profile', userId);
}

export async function createDriverProfileAction(
  userId: string,
  data: z.infer<typeof createDriverSchema>,
) {
  const parsed = createDriverSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Datos inválidos');
  }

  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);

  const { session } = result;
  if (!ADMIN_ROLES.includes(session.profile.role as UserRole) && session.user.id !== userId) {
    throw new Error('No autorizado para crear perfil de repartidor');
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from('drivers').insert({
    id: userId,
    license_number: parsed.data.license_number,
    vehicle_type: parsed.data.vehicle_type,
    vehicle_plate: parsed.data.vehicle_plate,
    status: 'offline',
    is_active: false,
    is_verified: false,
    total_deliveries: 0,
    completed_deliveries: 0,
    rating: 0,
    total_ratings: 0,
    avg_rating: 0,
  });

  if (error) throw new Error(error.message);

  await serverAudit.logAction(session.user.id, session.user.email, session.profile.role, 'create_driver', 'driver', userId);
}
