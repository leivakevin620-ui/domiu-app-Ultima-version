'use server';

import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server-auth';
import { getServiceClient } from '@/lib/db/supabase';
import { serverAudit } from '@/lib/audit/server-audit';

const statusSchema = z.enum(['available', 'busy', 'offline', 'on_break']);

export async function setCourierOperationalStatusAction(input: { status: string }) {
  const parsed = statusSchema.safeParse(input.status);
  if (!parsed.success) return { success: false as const, error: 'Estado inválido' };

  const auth = await requireAuth();
  if (auth.error) return { success: false as const, error: auth.error.message };
  if (auth.session.profile.role !== 'courier') {
    return { success: false as const, error: 'Solo un repartidor puede cambiar su jornada' };
  }

  const courierId = auth.session.user.id;
  const status = parsed.data;
  const supabase = getServiceClient();

  if (status === 'offline') {
    const { count, error: activeError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'accepted', 'picked_up', 'in_transit'])
      .is('deleted_at', null);
    if (activeError) return { success: false as const, error: activeError.message };
    if ((count ?? 0) > 0) {
      return {
        success: false as const,
        error: 'No puedes cerrar tu jornada mientras tengas un domicilio activo',
      };
    }
  }

  const { error: driverError } = await supabase
    .from('drivers')
    .update({
      status,
      is_active: status !== 'offline',
      is_available: status === 'available',
      updated_at: new Date().toISOString(),
    })
    .eq('id', courierId);
  if (driverError) return { success: false as const, error: driverError.message };

  const { data: openSession, error: sessionError } = await supabase
    .from('operation_sessions')
    .select('id,opened_at')
    .eq('actor_id', courierId)
    .eq('session_type', 'courier')
    .eq('status', 'open')
    .maybeSingle();
  if (sessionError) return { success: false as const, error: sessionError.message };

  let auditSessionId = openSession?.id ? String(openSession.id) : courierId;

  if (status === 'offline' && openSession) {
    const closedAt = new Date();
    const seconds = Math.max(
      0,
      Math.floor((closedAt.getTime() - new Date(openSession.opened_at).getTime()) / 1000),
    );
    const { error } = await supabase
      .from('operation_sessions')
      .update({
        status: 'closed',
        closed_at: closedAt.toISOString(),
        online_seconds: seconds,
        closed_by: courierId,
        closing_note: 'Jornada cerrada desde el dashboard del repartidor',
        updated_at: closedAt.toISOString(),
      })
      .eq('id', openSession.id);
    if (error) return { success: false as const, error: error.message };
  }

  if (status !== 'offline' && !openSession) {
    const { data: createdSession, error } = await supabase
      .from('operation_sessions')
      .insert({
        session_type: 'courier',
        actor_id: courierId,
        status: 'open',
        opened_by: courierId,
        opening_note: 'Jornada abierta desde el dashboard del repartidor',
        metadata: { initial_status: status },
      })
      .select('id')
      .single();
    if (error) return { success: false as const, error: error.message };
    auditSessionId = String(createdSession.id);
  }

  await serverAudit.logAction(
    courierId,
    auth.session.user.email,
    'courier',
    status === 'offline' ? 'close_courier_shift' : 'set_courier_status',
    'operation_sessions',
    auditSessionId,
    { status },
  );

  return { success: true as const, status };
}
