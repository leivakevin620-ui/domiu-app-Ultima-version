'use server';

import { z } from 'zod';
import { getServiceClient } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth/server-auth';
import { serverAudit } from '@/lib/audit/server-audit';

async function assertChatParticipant(chatId: string, userId: string) {
  const supabase = getServiceClient();
  const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
  if (!chat) throw new Error('Conversación no encontrada');
  if (chat.participant_1_id !== userId && chat.participant_2_id !== userId) {
    throw new Error('No eres participante de esta conversación');
  }
  return chat;
}

const sendMessageSchema = z.object({
  chatId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export async function sendMessageAction(
  chatId: string,
  senderId: string,
  content: string,
) {
  const parsed = sendMessageSchema.safeParse({ chatId, senderId, content });
  if (!parsed.success) {
    throw new Error('Datos inválidos');
  }

  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);
  if (result.session.user.id !== parsed.data.senderId) {
    throw new Error('No autorizado para enviar mensajes como otro usuario');
  }

  const chat = await assertChatParticipant(parsed.data.chatId, parsed.data.senderId);
  const supabase = getServiceClient();

  const receiverId = chat.participant_1_id === parsed.data.senderId
    ? chat.participant_2_id
    : chat.participant_1_id;

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: parsed.data.chatId,
      sender_id: parsed.data.senderId,
      receiver_id: receiverId,
      message_type: 'text',
      content: parsed.data.content,
      is_read: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from('chats')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', parsed.data.chatId);

  await serverAudit.logAction(result.session.user.id, result.session.user.email, result.session.profile.role, 'send_message', 'message', message?.id, { chatId: parsed.data.chatId });

  return message;
}

export async function markMessagesAsReadAction(chatId: string, userId: string) {
  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);
  if (result.session.user.id !== userId) {
    throw new Error('No autorizado para marcar mensajes de otro usuario');
  }

  await assertChatParticipant(chatId, userId);
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .neq('sender_id', userId)
    .eq('is_read', false);

  if (error) throw new Error(error.message);
}

export async function getOrCreateChatAction(
  orderId: string,
  participant1Id: string,
  participant2Id: string,
) {
  const result = await requireAuth();
  if (result.error) throw new Error(result.error.message);

  const { session } = result;
  if (session.user.id !== participant1Id && session.user.id !== participant2Id) {
    throw new Error('No autorizado para acceder a este chat');
  }

  const supabase = getServiceClient();
  const [p1, p2] = [participant1Id, participant2Id].sort();

  const { data: existing } = await supabase
    .from('chats')
    .select('*')
    .eq('order_id', orderId)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) return existing;

  const { data: chat, error } = await supabase
    .from('chats')
    .insert({
      participant_1_id: p1,
      participant_2_id: p2,
      order_id: orderId,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return chat;
}
