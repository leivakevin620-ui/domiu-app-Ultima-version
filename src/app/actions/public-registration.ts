'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  location: z.object({
    streetAddress: z.string().min(3),
    city: z.string().min(1),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
  }).optional(),
});

export async function selfRegisterWithLocationAction(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(', '));

  const supabase = getServiceClient();
  const data = parsed.data;
  const { data: existing } = await supabase.from('profiles').select('id').eq('email', data.email).maybeSingle();
  if (existing) throw new Error('Este correo ya está registrado.');

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { firstName: data.firstName, lastName: data.lastName },
  });
  if (authError || !authData.user) throw new Error(authError?.message || 'No se pudo crear el usuario');

  const userId = authData.user.id;
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    email: data.email,
    role: 'customer',
    first_name: data.firstName,
    last_name: data.lastName,
    status: 'active',
    metadata: { registration_location_shared: Boolean(data.location) },
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  if (data.location) {
    const { error: addressError } = await supabase.from('addresses').insert({
      user_id: userId,
      type: 'home',
      label: 'Casa',
      street_address: data.location.streetAddress,
      city: data.location.city,
      state_province: data.location.state || 'Magdalena',
      country: data.location.country || 'Colombia',
      postal_code: data.location.postalCode || null,
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      is_primary: true,
      metadata: {
        location_accuracy_meters: data.location.accuracy ?? null,
        coordinates_source: 'registration',
      },
    });
    if (addressError) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
      throw new Error('No se pudo guardar la ubicación: ' + addressError.message);
    }
  }

  return { userId };
}
