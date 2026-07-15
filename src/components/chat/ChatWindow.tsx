'use client';

import React, { useEffect, useRef } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { ConversationHeader } from '@/components/chat/ConversationHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { QuickReplies } from '@/components/chat/QuickReplies';
import { Loader2, MessageCircle } from 'lucide-react';

interface ChatWindowProps {
  userRole: 'customer' | 'courier';
  showQuickReplies?: boolean;
  onClose: () => void;
}

export function ChatWindow({ userRole, showQuickReplies = false, onClose }: ChatWindowProps) {
  const { currentConversation, currentMessages, sendMessage, markAsRead, loading } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentMessages.length]);

  useEffect(() => {
    void markAsRead().catch(() => undefined);
  }, [currentMessages.length, markAsRead]);

  if (!currentConversation) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">Selecciona una conversación</p>
        <p className="mt-1 text-xs text-muted-foreground">El chat se habilita durante una entrega activa.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[min(70dvh,620px)] min-h-[430px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg sm:rounded-3xl">
      <ConversationHeader conversation={currentConversation} userRole={userRole} onClose={onClose} />

      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3 sm:p-4">
        {currentMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><MessageCircle className="h-6 w-6 text-primary" /></div>
            <p className="mt-3 text-sm font-bold">Inicia la conversación</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Usa este chat para coordinar la recogida o la entrega de tu pedido.</p>
          </div>
        ) : (
          currentMessages.map((message) => (
            <MessageBubble key={message.id} message={message} isOwn={message.sender_role === userRole} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {showQuickReplies && userRole === 'courier' && <QuickReplies onSelect={(content) => void sendMessage(content)} />}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
