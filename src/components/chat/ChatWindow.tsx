'use client';

import React, { useEffect, useRef } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { ConversationHeader } from '@/components/chat/ConversationHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { QuickReplies } from '@/components/chat/QuickReplies';
import { MessageCircle, Loader2 } from 'lucide-react';

interface ChatWindowProps {
  userRole: 'customer' | 'courier';
  showQuickReplies?: boolean;
  onClose: () => void;
}

export function ChatWindow({ userRole, showQuickReplies = false, onClose }: ChatWindowProps) {
  const { currentConversation, currentMessages, sendMessage, markAsRead, loading } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  useEffect(() => {
    markAsRead();
  }, [currentMessages.length]);

  if (!currentConversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">Selecciona una conversación</p>
        <p className="mt-1 text-xs text-muted-foreground">
          El chat se abrirá automáticamente cuando tengas un pedido activo
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <ConversationHeader
        conversation={currentConversation}
        userRole={userRole}
        onClose={onClose}
      />

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {currentMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No hay mensajes aún. Envía el primero.</p>
          </div>
        ) : (
          currentMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_role === userRole}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {showQuickReplies && userRole === 'courier' && (
        <QuickReplies onSelect={(content) => sendMessage(content)} />
      )}

      <MessageInput onSend={(content) => sendMessage(content)} />
    </div>
  );
}
