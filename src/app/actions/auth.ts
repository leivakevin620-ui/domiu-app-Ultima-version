'use server';

import { getServiceClient } from '@/lib/db/supabase';

export async function registerUserAction(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'merchant' | 'courier';
}) {
  const supabase = await getServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { firstName: data.firstName, lastName: data.lastName },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('No se pudo crear el usuario');

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    email: data.email,
    role: data.role,
    first_name: data.firstName,
    last_name: data.lastName,
    status: 'active',
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(profileError.message);
  }

  return { userId: authData.user.id };
}

export async function updateUserProfileAction(userId: string, updates: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}) {
  const supabase = await getServiceClient();

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

export async function createDriverProfileAction(
  userId: string,
  data: {
    license_number: string;
    vehicle_type: 'bike' | 'motorcycle' | 'car' | 'van';
    vehicle_plate: string;
  },
) {
  const supabase = await getServiceClient();

  const { error } = await supabase.from('drivers').insert({
    id: userId,
    license_number: data.license_number,
    vehicle_type: data.vehicle_type,
    vehicle_plate: data.vehicle_plate,
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
}
