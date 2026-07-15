'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { chatService, type ChatMessage, type ChatConversation } from '@/services/chat';
import { getBrowserClient } from '@/lib/db/supabase';

interface ChatContextValue {
  conversations: ChatConversation[];
  currentMessages: ChatMessage[];
  currentConversation: ChatConversation | null;
  unreadTotal: number;
  openConversation: (orderId: string, customerId: string, customerName: string, courierId: string, courierName: string) => Promise<void>;
  closeConversation: () => void;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: () => Promise<void>;
  loading: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  userId,
  userRole,
}: {
  children: React.ReactNode;
  userId: string;
  userRole: 'customer' | 'courier';
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [currentConv, setCurrentConv] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = chatService.subscribe((msg) => {
      setCurrentMessages((prev) => {
        if (msg.chat_id !== currentConv?.id || prev.some((item) => item.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === msg.chat_id
            ? {
                ...conversation,
                last_message: msg.content,
                last_message_at: msg.created_at,
                unread_count: conversation.unread_count + (msg.sender_id !== userId ? 1 : 0),
              }
            : conversation,
        ),
      );
    });
    return unsub;
  }, [currentConv?.id, userId]);

  useEffect(() => {
    if (!currentConv?.id) return;
    const chatId = currentConv.id;
    const supabase = getBrowserClient();

    const reloadMessages = async () => {
      const rows = await chatService.getMessages(chatId);
      setCurrentMessages(rows);
    };

    const channel = supabase
      .channel(`delivery-chat-${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => void reloadMessages(),
      )
      .subscribe();

    const polling = window.setInterval(() => void reloadMessages(), 4_000);
    return () => {
      window.clearInterval(polling);
      void supabase.removeChannel(channel);
    };
  }, [currentConv?.id]);

  const openConversation = useCallback(async (
    orderId: string,
    customerId: string,
    customerName: string,
    courierId: string,
    courierName: string,
  ) => {
    setLoading(true);
    try {
      const conversation = await chatService.getOrCreateConversation(
        orderId,
        customerId,
        customerName,
        courierId,
        courierName,
      );
      const messages = await chatService.getMessages(conversation.id);
      setCurrentConv(conversation);
      setCurrentMessages(messages);
      await chatService.markAsRead(conversation.id, userId);
      setConversations((prev) => {
        const index = prev.findIndex((item) => item.id === conversation.id);
        if (index < 0) return [...prev, { ...conversation, unread_count: 0 }];
        const next = [...prev];
        next[index] = { ...conversation, unread_count: 0 };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const closeConversation = useCallback(() => {
    setCurrentConv(null);
    setCurrentMessages([]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentConv || !content.trim()) return;
    const senderName = userRole === 'courier' ? currentConv.courier_name : currentConv.customer_name;
    await chatService.sendMessage({
      chatId: currentConv.id,
      senderId: userId,
      senderName,
      senderRole: userRole,
      content: content.trim(),
    });
  }, [currentConv, userId, userRole]);

  const markAsRead = useCallback(async () => {
    if (!currentConv) return;
    await chatService.markAsRead(currentConv.id, userId);
    setConversations((prev) =>
      prev.map((item) => (item.id === currentConv.id ? { ...item, unread_count: 0 } : item)),
    );
  }, [currentConv, userId]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0),
    [conversations],
  );

  const value = useMemo(
    () => ({
      conversations,
      currentMessages,
      currentConversation: currentConv,
      unreadTotal,
      openConversation,
      closeConversation,
      sendMessage,
      markAsRead,
      loading,
    }),
    [conversations, currentMessages, currentConv, unreadTotal, openConversation, closeConversation, sendMessage, markAsRead, loading],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
