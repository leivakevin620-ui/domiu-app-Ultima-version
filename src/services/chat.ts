import { getBrowserClient } from '@/lib/db/supabase';
import type { Chat, Message } from '@/types/database';

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'customer' | 'courier';
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  courier_id: string;
  courier_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export const QUICK_REPLIES = [
  'Ya voy llegando',
  'Estoy en la entrada',
  '¿Puedes salir a recibir?',
  'Estoy recogiendo tu pedido',
  'Gracias por tu compra',
];

type MessageListener = (message: ChatMessage) => void;
const messageListeners: Set<MessageListener> = new Set();

async function getClient() {
  return getBrowserClient();
}

function mapMessageToUI(msg: Message, participant1Id: string, participant1Name: string, participant2Id: string, participant2Name: string): ChatMessage {
  const isSenderP1 = msg.sender_id === participant1Id;
  return {
    id: msg.id,
    chat_id: msg.chat_id,
    sender_id: msg.sender_id,
    sender_name: isSenderP1 ? participant1Name : participant2Name,
    sender_role: (isSenderP1 ? 'customer' : 'courier') as 'customer' | 'courier',
    content: msg.content,
    message_type: msg.message_type as 'text' | 'image' | 'file' | 'system',
    is_read: msg.is_read,
    read_at: msg.read_at,
    created_at: msg.created_at,
  };
}

export const chatService = {
  getOrCreateConversation: async (
    orderId: string,
    customerId: string,
    customerName: string,
    courierId: string,
    courierName: string,
  ): Promise<ChatConversation> => {
    const supabase = await getClient();

    // Try to find existing chat by order
    const { data: existingChat } = await supabase
      .from('chats')
      .select('*')
      .eq('order_id', orderId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingChat) {
      return buildConversation(existingChat, customerId, customerName, courierId, courierName);
    }

    // Check participant order: participant_1 < participant_2 alphabetically
    const [p1, p2] = customerId < courierId
      ? [customerId, courierId]
      : [courierId, customerId];

    // Also check by participants without order
    const { data: existingByParticipants } = await supabase
      .from('chats')
      .select('*')
      .eq('participant_1_id', p1)
      .eq('participant_2_id', p2)
      .eq('is_active', true)
      .maybeSingle();

    if (existingByParticipants) {
      return buildConversation(existingByParticipants, customerId, customerName, courierId, courierName);
    }

    // Create new chat
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({
        participant_1_id: p1,
        participant_2_id: p2,
        order_id: orderId,
        is_active: true,
      })
      .select()
      .single();

    if (error || !newChat) throw new Error(error?.message ?? 'Error al crear conversación');

    return buildConversation(newChat, customerId, customerName, courierId, courierName);
  },

  getConversationByOrder: async (orderId: string): Promise<ChatConversation | undefined> => {
    const supabase = await getClient();
    const { data: chat } = await supabase
      .from('chats')
      .select('*')
      .eq('order_id', orderId)
      .eq('is_active', true)
      .maybeSingle();
    if (!chat) return undefined;
    return buildConversationFromChat(chat);
  },

  getMessages: async (chatId: string): Promise<ChatMessage[]> => {
    const supabase = await getClient();

    const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
    if (!chat) return [];

    // Get participant names
    const [p1Profile, p2Profile] = await Promise.all([
      supabase.from('profiles').select('first_name, last_name').eq('id', chat.participant_1_id).single(),
      supabase.from('profiles').select('first_name, last_name').eq('id', chat.participant_2_id).single(),
    ]);

    const p1Name = [p1Profile.data?.first_name, p1Profile.data?.last_name].filter(Boolean).join(' ') || 'Usuario';
    const p2Name = [p2Profile.data?.first_name, p2Profile.data?.last_name].filter(Boolean).join(' ') || 'Usuario';

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (!msgs) return [];
    return (msgs as any[]).map((m: any) => mapMessageToUI(m, chat.participant_1_id, p1Name, chat.participant_2_id, p2Name));
  },

  sendMessage: async (input: {
    chatId: string;
    senderId: string;
    senderName: string;
    senderRole: 'customer' | 'courier';
    content: string;
  }): Promise<ChatMessage> => {
    const supabase = await getClient();

    const { data: chat } = await supabase.from('chats').select('*').eq('id', input.chatId).single();
    if (!chat) throw new Error('Conversación no encontrada');

    const receiverId = chat.participant_1_id === input.senderId ? chat.participant_2_id : chat.participant_1_id;

    const { data: msg, error } = await supabase
      .from('messages')
      .insert({
        chat_id: input.chatId,
        sender_id: input.senderId,
        receiver_id: receiverId,
        message_type: 'text',
        content: input.content,
        is_read: false,
      })
      .select()
      .single();

    if (error || !msg) throw new Error(error?.message ?? 'Error al enviar mensaje');

    // Update last_message_at on chat
    await supabase
      .from('chats')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', input.chatId);

    // Get participant names for mapping
    const [p1Profile, p2Profile] = await Promise.all([
      supabase.from('profiles').select('first_name, last_name').eq('id', chat.participant_1_id).single(),
      supabase.from('profiles').select('first_name, last_name').eq('id', chat.participant_2_id).single(),
    ]);
    const p1Name = [p1Profile.data?.first_name, p1Profile.data?.last_name].filter(Boolean).join(' ') || 'Usuario';
    const p2Name = [p2Profile.data?.first_name, p2Profile.data?.last_name].filter(Boolean).join(' ') || 'Usuario';

    const mapped = mapMessageToUI(msg, chat.participant_1_id, p1Name, chat.participant_2_id, p2Name);
    messageListeners.forEach((fn) => fn(mapped));
    return mapped;
  },

  markAsRead: async (chatId: string, userId: string): Promise<void> => {
    const supabase = await getClient();
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .neq('sender_id', userId)
      .eq('is_read', false);
  },

  subscribe: (listener: MessageListener): (() => void) => {
    messageListeners.add(listener);
    return () => messageListeners.delete(listener);
  },

  getUnreadCount: async (userId: string): Promise<number> => {
    const supabase = await getClient();
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false);
    return count ?? 0;
  },
};

async function buildConversation(
  chat: Chat,
  customerId: string,
  customerName: string,
  courierId: string,
  courierName: string,
): Promise<ChatConversation> {
  const supabase = await getClient();

  // Count unread messages for the non-initiating user
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chat.id)
    .eq('is_read', false);

  // Get last message
  const { data: lastMsg } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    id: chat.id,
    order_id: chat.order_id ?? '',
    customer_id: customerId,
    customer_name: customerName,
    courier_id: courierId,
    courier_name: courierName,
    last_message: lastMsg?.content ?? null,
    last_message_at: lastMsg?.created_at ?? chat.last_message_at,
    unread_count: count ?? 0,
    created_at: chat.created_at,
  };
}

async function buildConversationFromChat(chat: Chat): Promise<ChatConversation> {
  const supabase = await getClient();

  const [p1Profile, p2Profile] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name').eq('id', chat.participant_1_id).single(),
    supabase.from('profiles').select('first_name, last_name').eq('id', chat.participant_2_id).single(),
  ]);

  const p1Name = [p1Profile.data?.first_name, p1Profile.data?.last_name].filter(Boolean).join(' ') || 'Usuario';
  const p2Name = [p2Profile.data?.first_name, p2Profile.data?.last_name].filter(Boolean).join(' ') || 'Usuario';

  // Count unread
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chat.id)
    .eq('is_read', false);

  // Get last message
  const { data: lastMsg } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    id: chat.id,
    order_id: chat.order_id ?? '',
    customer_id: chat.participant_1_id,
    customer_name: p1Name,
    courier_id: chat.participant_2_id,
    courier_name: p2Name,
    last_message: lastMsg?.content ?? null,
    last_message_at: lastMsg?.created_at ?? chat.last_message_at,
    unread_count: count ?? 0,
    created_at: chat.created_at,
  };
}
