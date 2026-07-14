'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';
import { ADMIN_ROLES } from '@/types/auth';

const uuid = z.string().uuid('Solicitud inválida');

async function adminSession() {
  const auth = await requireAuth();
  if (auth.error || !auth.session) return null;
  return ADMIN_ROLES.includes(auth.session.profile.role) ? auth.session : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function baseSlug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'negocio'
  );
}

async function uniqueSlug(name: string) {
  const db = getServiceClient();
  const base = baseSlug(name);
  for (let i = 0; i < 30; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await db.from('businesses').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function releaseApprovalClaim(applicationId: string, adminId: string, claimedAt: string) {
  const db = getServiceClient();
  await db
    .from('business_applications')
    .update({ reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('status', 'pending')
    .eq('reviewed_by', adminId)
    .eq('reviewed_at', claimedAt);
}

export async function approveBusinessApplicationSafe(applicationId: string, adminNote?: string) {
  const validId = uuid.safeParse(applicationId);
  if (!validId.success) return { error: validId.error.issues[0]?.message || 'Solicitud inválida' };
  if (adminNote && adminNote.trim().length > 1000) return { error: 'La nota es demasiado larga' };

  const session = await adminSession();
  if (!session) return { error: 'No autorizado' };

  const db = getServiceClient();
  const claimedAt = new Date().toISOString();

  const { data: claimedApplication, error: claimError } = await db
    .from('business_applications')
    .update({
      reviewed_by: session.user.id,
      reviewed_at: claimedAt,
      updated_at: claimedAt,
    })
    .eq('id', applicationId)
    .eq('status', 'pending')
    .is('reviewed_by', null)
    .select('*')
    .maybeSingle();

  if (claimError) return { error: 'No se pudo bloquear la solicitud: ' + claimError.message };

  if (!claimedApplication) {
    const { data: current } = await db
      .from('business_applications')
      .select('id, status')
      .eq('id', applicationId)
      .maybeSingle();

    if (!current) return { error: 'Solicitud no encontrada' };

    const { data: existing } = await db
      .from('businesses')
      .select('id, deleted_at')
      .contains('metadata', { application_id: applicationId })
      .maybeSingle();

    if (current.status === 'approved' && existing && !existing.deleted_at) {
      return { success: true, unchanged: true, businessId: existing.id };
    }

    if (current.status === 'pending') {
      return { error: 'La solicitud está siendo procesada por otro administrador' };
    }

    return { error: 'La solicitud ya fue procesada' };
  }

  const app = claimedApplication;

  if (!app.address?.trim() || !app.city?.trim()) {
    await releaseApprovalClaim(app.id, session.user.id, claimedAt);
    return { error: 'La solicitud está incompleta: falta dirección o ciudad' };
  }

  const { data: owner } = await db
    .from('profiles')
    .select('id, role, status, metadata, deleted_at')
    .eq('id', app.user_id)
    .maybeSingle();

  if (!owner || owner.deleted_at) {
    await releaseApprovalClaim(app.id, session.user.id, claimedAt);
    return { error: 'El propietario no existe' };
  }

  if (owner.status !== 'active') {
    await releaseApprovalClaim(app.id, session.user.id, claimedAt);
    return { error: 'El propietario no está activo' };
  }

  const previousRole = owner.role;
  const previousMetadata = owner.metadata;
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from('businesses')
    .select('id, deleted_at')
    .contains('metadata', { application_id: app.id })
    .maybeSingle();

  if (existing && !existing.deleted_at) {
    const mergedMetadata = {
      ...asRecord(previousMetadata),
      business_application_id: app.id,
      business_id: existing.id,
      approved_as_business_at: now,
    };

    await db
      .from('profiles')
      .update({ role: 'merchant', updated_at: now, metadata: mergedMetadata })
      .eq('id', app.user_id);

    const { error: recoverError } = await db
      .from('business_applications')
      .update({
        status: 'approved',
        admin_notes: adminNote?.trim() || null,
        reviewed_by: session.user.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', app.id)
      .eq('status', 'pending')
      .eq('reviewed_by', session.user.id)
      .eq('reviewed_at', claimedAt);

    if (recoverError) {
      await releaseApprovalClaim(app.id, session.user.id, claimedAt);
      return { error: 'No se pudo recuperar la aprobación: ' + recoverError.message };
    }

    return { success: true, unchanged: true, businessId: existing.id };
  }

  const slug = await uniqueSlug(app.business_name);
  const { data: business, error: businessError } = await db
    .from('businesses')
    .insert({
      owner_id: app.user_id,
      name: app.business_name,
      slug,
      description: app.description || null,
      logo_url: app.logo_url || null,
      banner_url: app.banner_url || null,
      cuisine_type: app.category || null,
      business_type: app.business_type || 'restaurant',
      phone: app.phone || null,
      email: app.email || null,
      is_verified: true,
      is_active: true,
      metadata: {
        application_id: app.id,
        owner_name: app.owner_name,
        owner_document: app.owner_document,
        whatsapp: app.whatsapp || null,
        rut_url: app.rut_url || null,
        approved_by: session.user.id,
        approved_at: now,
      },
    })
    .select('id')
    .single();

  if (businessError || !business) {
    await releaseApprovalClaim(app.id, session.user.id, claimedAt);

    if (businessError?.code === '23505') {
      const { data: duplicate } = await db
        .from('businesses')
        .select('id')
        .contains('metadata', { application_id: app.id })
        .maybeSingle();
      if (duplicate) return { success: true, unchanged: true, businessId: duplicate.id };
    }

    return {
      error: 'No se pudo crear el negocio: ' + (businessError?.message || 'Error desconocido'),
    };
  }

  const undo = async () => {
    await db.from('business_hours').delete().eq('business_id', business.id);
    await db.from('business_addresses').delete().eq('business_id', business.id);
    await db.from('businesses').delete().eq('id', business.id);
    await db
      .from('profiles')
      .update({ role: previousRole, metadata: previousMetadata, updated_at: new Date().toISOString() })
      .eq('id', app.user_id);
    await releaseApprovalClaim(app.id, session.user.id, claimedAt);
  };

  const { error: addressError } = await db.from('business_addresses').insert({
    business_id: business.id,
    street_address: app.address,
    city: app.city,
    country: 'Colombia',
    latitude: app.lat ?? null,
    longitude: app.lng ?? null,
    phone: app.phone || null,
    is_primary: true,
    delivery_available: app.accepts_delivery ?? true,
  });

  if (addressError) {
    await undo();
    return { error: 'No se pudo crear la dirección: ' + addressError.message };
  }

  const hours = Array.from({ length: 7 }, (_, day) => ({
    business_id: business.id,
    day_of_week: day,
    opens_at: '08:00',
    closes_at: '22:00',
    is_closed: false,
  }));
  const { error: hoursError } = await db.from('business_hours').insert(hours);

  if (hoursError) {
    await undo();
    return { error: 'No se pudieron crear los horarios: ' + hoursError.message };
  }

  const mergedMetadata = {
    ...asRecord(previousMetadata),
    business_application_id: app.id,
    business_id: business.id,
    approved_as_business_at: now,
  };

  const { error: profileError } = await db
    .from('profiles')
    .update({ role: 'merchant', updated_at: now, metadata: mergedMetadata })
    .eq('id', app.user_id);

  if (profileError) {
    await undo();
    return { error: 'No se pudo actualizar el propietario: ' + profileError.message };
  }

  const { data: finalized, error: finalError } = await db
    .from('business_applications')
    .update({
      status: 'approved',
      admin_notes: adminNote?.trim() || null,
      reviewed_by: session.user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', app.id)
    .eq('status', 'pending')
    .eq('reviewed_by', session.user.id)
    .eq('reviewed_at', claimedAt)
    .select('id')
    .maybeSingle();

  if (finalError || !finalized) {
    await undo();
    return {
      error: 'No se pudo finalizar la aprobación: ' + (finalError?.message || 'La solicitud cambió de estado'),
    };
  }

  await db.from('notifications').insert({
    recipient_id: app.user_id,
    sender_id: session.user.id,
    notification_type: 'system_alert',
    title: 'Solicitud aprobada',
    message: `Tu solicitud para registrar ${app.business_name} fue aprobada.`,
    action_url: '/negocio',
    is_read: false,
    channels: ['in_app'],
  });

  await serverAudit.logAction(
    session.user.id,
    session.user.email,
    session.profile.role,
    'approve_business_application',
    'business_applications',
    app.id,
    { userId: app.user_id, businessId: business.id, note: adminNote || null },
  );

  return { success: true, businessId: business.id };
}

export async function rejectBusinessApplicationSafe(applicationId: string, reason: string) {
  const validId = uuid.safeParse(applicationId);
  if (!validId.success) return { error: 'Solicitud inválida' };

  const cleanReason = reason.trim();
  if (cleanReason.length < 5 || cleanReason.length > 1000) {
    return { error: 'El motivo debe tener entre 5 y 1000 caracteres' };
  }

  const session = await adminSession();
  if (!session) return { error: 'No autorizado' };

  const db = getServiceClient();
  const now = new Date().toISOString();
  const { data: rejected, error } = await db
    .from('business_applications')
    .update({
      status: 'rejected',
      admin_notes: cleanReason,
      reviewed_by: session.user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', applicationId)
    .eq('status', 'pending')
    .is('reviewed_by', null)
    .select('id, user_id, business_name')
    .maybeSingle();

  if (error) return { error: 'No se pudo rechazar la solicitud: ' + error.message };
  if (!rejected) {
    const { data: current } = await db
      .from('business_applications')
      .select('status')
      .eq('id', applicationId)
      .maybeSingle();
    if (!current) return { error: 'Solicitud no encontrada' };
    if (current.status === 'pending') return { error: 'La solicitud está siendo procesada' };
    return { error: 'La solicitud ya fue procesada' };
  }

  await db.from('notifications').insert({
    recipient_id: rejected.user_id,
    sender_id: session.user.id,
    notification_type: 'system_alert',
    title: 'Solicitud rechazada',
    message: `Tu solicitud para registrar ${rejected.business_name} fue rechazada. Motivo: ${cleanReason}`,
    action_url: '/cliente/solicitudes',
    is_read: false,
    channels: ['in_app'],
  });

  await serverAudit.logAction(
    session.user.id,
    session.user.email,
    session.profile.role,
    'reject_business_application',
    'business_applications',
    rejected.id,
    { userId: rejected.user_id, reason: cleanReason },
  );

  return { success: true };
}
