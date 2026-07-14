'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES } from '@/types/auth';

const optionalEmail = z.string().trim().email('Correo inválido').or(z.literal(''));

const createSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  description: z.string().trim().max(1200).optional().default(''),
  cuisineType: z.string().trim().max(100).optional().default(''),
  businessType: z.string().trim().min(1).default('restaurant'),
  phone: z.string().trim().max(30).optional().default(''),
  email: optionalEmail.optional().default(''),
  website: z.string().trim().max(250).optional().default(''),
  ownerId: z.string().uuid('Propietario inválido'),
  address: z.string().trim().min(5, 'Dirección requerida').max(250),
  city: z.string().trim().min(2, 'Ciudad requerida').max(100),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isVerified: z.boolean().default(false),
});

const updateSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1200).optional().default(''),
  cuisineType: z.string().trim().max(100).optional().default(''),
  businessType: z.string().trim().min(1),
  phone: z.string().trim().max(30).optional().default(''),
  email: optionalEmail.optional().default(''),
  website: z.string().trim().max(250).optional().default(''),
  isVerified: z.boolean(),
  addressId: z.string().uuid(),
  address: z.string().trim().min(5).max(250),
  city: z.string().trim().min(2).max(100),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

async function requireAdmin() {
  const result = await requireAuth();
  if (result.error || !result.session) return { error: result.error?.message || 'No autenticado', session: null };
  if (!ADMIN_ROLES.includes(result.session.profile.role)) return { error: 'Acceso denegado', session: null };
  return { error: null, session: result.session };
}

async function uniqueSlug(base: string, excludeId?: string) {
  const supabase = getServiceClient();
  let candidate = base;
  let suffix = 1;
  while (true) {
    let query = supabase.from('businesses').select('id').eq('slug', candidate).is('deleted_at', null);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error('No se pudo validar el slug: ' + error.message);
    if (!data) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export async function createBusinessCompleteAction(input: z.infer<typeof createSchema>) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map(i => i.message).join(', ') };
  const auth = await requireAdmin();
  if (auth.error || !auth.session) return { error: auth.error };

  const supabase = getServiceClient();
  const data = parsed.data;
  const now = new Date().toISOString();

  const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('id, role, status, deleted_at')
    .eq('id', data.ownerId)
    .maybeSingle();
  if (ownerError) return { error: 'No se pudo validar el propietario: ' + ownerError.message };
  if (!owner || owner.deleted_at || owner.status !== 'active') return { error: 'El propietario no existe o no está activo' };
  if (!['customer', 'merchant'].includes(owner.role)) return { error: 'El usuario seleccionado no puede ser propietario' };

  let businessId: string | null = null;
  try {
    const slug = await uniqueSlug(data.slug);
    const { data: business, error: businessError } = await supabase.from('businesses').insert({
      owner_id: data.ownerId,
      name: data.name,
      slug,
      description: data.description || null,
      cuisine_type: data.cuisineType || null,
      business_type: data.businessType,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      is_verified: data.isVerified,
      is_active: true,
      created_at: now,
      updated_at: now,
    }).select('id, slug').single();
    if (businessError || !business) throw new Error('No se pudo crear el negocio: ' + (businessError?.message || ''));
    businessId = business.id;

    const { data: address, error: addressError } = await supabase.from('business_addresses').insert({
      business_id: business.id,
      street_address: data.address,
      city: data.city,
      country: 'Colombia',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      is_primary: true,
      delivery_available: true,
      phone: data.phone || null,
    }).select('id').single();
    if (addressError || !address) throw new Error('No se pudo crear la dirección: ' + (addressError?.message || ''));

    const hours = Array.from({ length: 7 }, (_, day) => ({
      business_id: business.id,
      day_of_week: day,
      opens_at: '08:00',
      closes_at: '22:00',
      is_closed: false,
    }));
    const { error: hoursError } = await supabase.from('business_hours').insert(hours);
    if (hoursError) throw new Error('No se pudieron crear los horarios: ' + hoursError.message);

    const { error: profileError } = await supabase.from('profiles').update({
      role: 'merchant',
      updated_at: now,
      metadata: { business_id: business.id, assigned_by: auth.session.user.id, assigned_at: now },
    }).eq('id', data.ownerId);
    if (profileError) throw new Error('No se pudo actualizar el propietario: ' + profileError.message);

    await serverAudit.logAction(auth.session.user.id, auth.session.user.email, auth.session.profile.role,
      'create_business_complete', 'businesses', business.id, { ownerId: data.ownerId, slug, addressId: address.id });

    return { success: true, businessId: business.id, slug };
  } catch (error) {
    if (businessId) await supabase.from('businesses').delete().eq('id', businessId);
    return { error: error instanceof Error ? error.message : 'Error creando negocio' };
  }
}

export async function updateBusinessCompleteAction(input: z.infer<typeof updateSchema>) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues.map(i => i.message).join(', ') };
  const auth = await requireAdmin();
  if (auth.error || !auth.session) return { error: auth.error };
  const supabase = getServiceClient();
  const data = parsed.data;
  const now = new Date().toISOString();

  const { data: current, error: currentError } = await supabase.from('businesses')
    .select('id, name, description, cuisine_type, business_type, phone, email, website, is_verified')
    .eq('id', data.businessId).is('deleted_at', null).maybeSingle();
  if (currentError) return { error: 'No se pudo consultar el negocio: ' + currentError.message };
  if (!current) return { error: 'Negocio no encontrado' };

  const { data: currentAddress, error: currentAddressError } = await supabase.from('business_addresses')
    .select('*').eq('id', data.addressId).eq('business_id', data.businessId).maybeSingle();
  if (currentAddressError) return { error: 'No se pudo consultar la dirección: ' + currentAddressError.message };
  if (!currentAddress) return { error: 'Dirección no encontrada' };

  const { error: businessError } = await supabase.from('businesses').update({
    name: data.name,
    description: data.description || null,
    cuisine_type: data.cuisineType || null,
    business_type: data.businessType,
    phone: data.phone || null,
    email: data.email || null,
    website: data.website || null,
    is_verified: data.isVerified,
    updated_at: now,
  }).eq('id', data.businessId);
  if (businessError) return { error: 'No se pudo actualizar el negocio: ' + businessError.message };

  const { error: addressError } = await supabase.from('business_addresses').update({
    street_address: data.address,
    city: data.city,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    phone: data.phone || null,
  }).eq('id', data.addressId).eq('business_id', data.businessId);

  if (addressError) {
    await supabase.from('businesses').update(current).eq('id', data.businessId);
    return { error: 'No se pudo actualizar la dirección: ' + addressError.message };
  }

  await serverAudit.logAction(auth.session.user.id, auth.session.user.email, auth.session.profile.role,
    'update_business_complete', 'businesses', data.businessId, { before: current, after: data });
  return { success: true };
}
