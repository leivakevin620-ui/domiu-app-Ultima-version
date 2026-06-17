'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { chatService, type ChatMessage, type ChatConversation } from '@/services/chat';

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
        if (msg.chat_id === currentConv?.id) {
          return [...prev, msg];
        }
        return prev;
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.chat_id
            ? { ...c, last_message: msg.content, last_message_at: msg.created_at, unread_count: c.unread_count + (msg.sender_id !== userId ? 1 : 0) }
            : c,
        ),
      );
    });
    return unsub;
  }, [currentConv?.id, userId]);

  const openConversation = useCallback(async (
    orderId: string,
    customerId: string,
    customerName: string,
    courierId: string,
    courierName: string,
  ) => {
    setLoading(true);
    const conv = await chatService.getOrCreateConversation(orderId, customerId, customerName, courierId, courierName);
    const msgs = await chatService.getMessages(conv.id);
    setCurrentConv(conv);
    setCurrentMessages(msgs);
    await chatService.markAsRead(conv.id, userId);
    setConversations((prev) => {
      const exists = prev.findIndex((c) => c.id === conv.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = { ...conv, unread_count: 0 };
        return next;
      }
      return [...prev, { ...conv, unread_count: 0 }];
    });
    setLoading(false);
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
      prev.map((c) => (c.id === currentConv.id ? { ...c, unread_count: 0 } : c)),
    );
  }, [currentConv, userId]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread_count, 0),
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
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
