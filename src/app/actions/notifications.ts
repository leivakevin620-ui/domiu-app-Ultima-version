'use server';

import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';

export async function getMyNotificationsAction(limit = 20) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message, data: [] };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { success: false, error: 'Error al cargar notificaciones', data: [] };

  return { success: true, data: data || [] };
}

export async function markNotificationReadAction(notificationId: string) {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };

  const userId = result.session.user.id;
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_id', userId);

  if (error) return { success: false, error: 'Error al marcar notificación' };

  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const result = await requireAuth();
  if (result.error) return { success: false, error: result.error.message };

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', result.session.user.id)
    .is('is_read', false);

  if (error) return { success: false, error: 'Error al marcar notificaciones' };

  return { success: true };
}
