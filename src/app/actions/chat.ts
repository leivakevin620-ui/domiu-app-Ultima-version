'use server';

import { getServiceClient } from '@/lib/db/supabase';

export async function sendMessageAction(
  chatId: string,
  senderId: string,
  content: string,
) {
  const supabase = await getServiceClient();

  const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
  if (!chat) throw new Error('Conversación no encontrada');

  const receiverId = chat.participant_1_id === senderId
    ? chat.participant_2_id
    : chat.participant_1_id;

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      receiver_id: receiverId,
      message_type: 'text',
      content,
      is_read: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from('chats')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', chatId);

  return message;
}

export async function markMessagesAsReadAction(chatId: string, userId: string) {
  const supabase = await getServiceClient();

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
  const supabase = await getServiceClient();

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
