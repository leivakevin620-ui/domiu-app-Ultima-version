'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES } from '@/types/auth';

const businessIdSchema = z.string().uuid('Identificador de negocio inválido');
const ownerIdSchema = z.string().uuid('Identificador de propietario inválido');

const statusSchema = z.object({
  businessId: businessIdSchema,
  isActive: z.boolean(),
  reason: z.string().trim().min(3, 'Debes indicar un motivo').max(500),
});

const assignOwnerSchema = z.object({
  businessId: businessIdSchema,
  ownerId: ownerIdSchema,
  reason: z.string().trim().min(3, 'Debes indicar un motivo').max(500),
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function requireAdmin() {
  const result = await requireAuth();
  if (result.error || !result.session) {
    return { error: result.error?.message || 'No autenticado', session: null };
  }

  if (!ADMIN_ROLES.includes(result.session.profile.role)) {
    return { error: 'Solo un administrador puede realizar esta acción', session: null };
  }

  return { error: null, session: result.session };
}

export async function setBusinessActiveStateAction(input: z.infer<typeof statusSchema>) {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }

  const auth = await requireAdmin();
  if (auth.error || !auth.session) return { error: auth.error };

  const supabase = getServiceClient();
  const { businessId, isActive, reason } = parsed.data;

  const { data: current, error: currentError } = await supabase
    .from('businesses')
    .select('id, name, owner_id, is_active, metadata, deleted_at')
    .eq('id', businessId)
    .maybeSingle();

  if (currentError) return { error: 'No se pudo consultar el negocio: ' + currentError.message };
  if (!current || current.deleted_at) return { error: 'Negocio no encontrado' };
  if (current.is_active === isActive) {
    return { success: true, unchanged: true, business: current };
  }

  const now = new Date().toISOString();
  const lifecycleChange = {
    changed_by: auth.session.user.id,
    changed_at: now,
    reason,
    previous_state: current.is_active,
    new_state: isActive,
  };
  const metadata = {
    ...asRecord(current.metadata),
    last_lifecycle_change: lifecycleChange,
  };

  const { data: updated, error: updateError } = await supabase
    .from('businesses')
    .update({
      is_active: isActive,
      updated_at: now,
      metadata,
    })
    .eq('id', businessId)
    .select('id, name, owner_id, is_active, updated_at')
    .single();

  if (updateError) return { error: 'No se pudo actualizar el estado: ' + updateError.message };

  await supabase.from('notifications').insert({
    recipient_id: current.owner_id,
    sender_id: auth.session.user.id,
    notification_type: 'system_alert',
    title: isActive ? 'Negocio reactivado' : 'Negocio suspendido',
    message: isActive
      ? `Tu negocio "${current.name}" fue reactivado. Motivo: ${reason}`
      : `Tu negocio "${current.name}" fue suspendido. Motivo: ${reason}`,
    action_url: '/negocio/configuracion',
    is_read: false,
    channels: ['in_app'],
  });

  await serverAudit.logAction(
    auth.session.user.id,
    auth.session.user.email,
    auth.session.profile.role,
    isActive ? 'reactivate_business' : 'suspend_business',
    'businesses',
    businessId,
    lifecycleChange,
  );

  return { success: true, business: updated };
}

export async function assignBusinessOwnerAction(input: z.infer<typeof assignOwnerSchema>) {
  const parsed = assignOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }

  const auth = await requireAdmin();
  if (auth.error || !auth.session) return { error: auth.error };

  const supabase = getServiceClient();
  const { businessId, ownerId, reason } = parsed.data;

  const [{ data: business, error: businessError }, { data: owner, error: ownerError }] =
    await Promise.all([
      supabase
        .from('businesses')
        .select('id, name, owner_id, deleted_at')
        .eq('id', businessId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, status, metadata, deleted_at')
        .eq('id', ownerId)
        .maybeSingle(),
    ]);

  if (businessError) return { error: 'No se pudo consultar el negocio: ' + businessError.message };
  if (!business || business.deleted_at) return { error: 'Negocio no encontrado' };
  if (ownerError) return { error: 'No se pudo consultar el propietario: ' + ownerError.message };
  if (!owner || owner.deleted_at) return { error: 'Propietario no encontrado' };
  if (owner.status !== 'active') return { error: 'El propietario seleccionado no está activo' };
  if (!['merchant', 'customer'].includes(owner.role)) {
    return { error: 'Solo se puede asignar un usuario cliente o negocio como propietario' };
  }

  if (business.owner_id === ownerId) {
    return { success: true, unchanged: true };
  }

  const now = new Date().toISOString();
  const previousOwnerId = business.owner_id;
  const { data: previousOwner } = await supabase
    .from('profiles')
    .select('id, metadata')
    .eq('id', previousOwnerId)
    .maybeSingle();

  const { error: updateBusinessError } = await supabase
    .from('businesses')
    .update({ owner_id: ownerId, updated_at: now })
    .eq('id', businessId);

  if (updateBusinessError) {
    return { error: 'No se pudo asignar el propietario: ' + updateBusinessError.message };
  }

  const nextOwnerMetadata = {
    ...asRecord(owner.metadata),
    business_id: businessId,
    assigned_as_business_owner_at: now,
    assigned_by: auth.session.user.id,
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: 'merchant',
      updated_at: now,
      metadata: nextOwnerMetadata,
    })
    .eq('id', ownerId);

  if (profileError) {
    await supabase
      .from('businesses')
      .update({ owner_id: previousOwnerId, updated_at: now })
      .eq('id', businessId);
    return { error: 'No se pudo actualizar el perfil del propietario: ' + profileError.message };
  }

  if (previousOwner && previousOwner.id !== ownerId) {
    const previousMetadata = { ...asRecord(previousOwner.metadata) };
    if (previousMetadata.business_id === businessId) {
      delete previousMetadata.business_id;
      previousMetadata.last_business_reassignment_at = now;
      await supabase
        .from('profiles')
        .update({ metadata: previousMetadata, updated_at: now })
        .eq('id', previousOwner.id);
    }

    await supabase.from('notifications').insert({
      recipient_id: previousOwner.id,
      sender_id: auth.session.user.id,
      notification_type: 'system_alert',
      title: 'Negocio reasignado',
      message: `Ya no eres el propietario asignado de "${business.name}". Motivo: ${reason}`,
      action_url: '/cliente',
      is_read: false,
      channels: ['in_app'],
    });
  }

  await supabase.from('notifications').insert({
    recipient_id: ownerId,
    sender_id: auth.session.user.id,
    notification_type: 'system_alert',
    title: 'Negocio asignado',
    message: `Ahora eres propietario de "${business.name}". Motivo: ${reason}`,
    action_url: '/negocio',
    is_read: false,
    channels: ['in_app'],
  });

  const auditData = {
    previous_owner_id: previousOwnerId,
    new_owner_id: ownerId,
    reason,
    changed_at: now,
  };

  await serverAudit.logAction(
    auth.session.user.id,
    auth.session.user.email,
    auth.session.profile.role,
    'assign_business_owner',
    'businesses',
    businessId,
    auditData,
  );

  return {
    success: true,
    owner: {
      id: owner.id,
      email: owner.email,
      name: [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email,
    },
  };
}

export async function getAssignableBusinessOwnersAction(search?: string) {
  const auth = await requireAdmin();
  if (auth.error || !auth.session) return [];

  const supabase = getServiceClient();
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, status')
    .in('role', ['merchant', 'customer'])
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('first_name', { ascending: true })
    .limit(100);

  if (search?.trim()) {
    const safe = search.trim().replace(/[%_]/g, '');
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map((profile) => ({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email,
  }));
}
