'use client';

import React from 'react';
import type { ChatConversation } from '@/services/chat';
import { MessageCircle, X } from 'lucide-react';

interface ConversationHeaderProps {
  conversation: ChatConversation;
  userRole: 'customer' | 'courier';
  onClose: () => void;
}

export function ConversationHeader({ conversation, userRole, onClose }: ConversationHeaderProps) {
  const otherName = userRole === 'customer' ? conversation.courier_name : conversation.customer_name;
  const otherRole = userRole === 'customer' ? 'Repartidor' : 'Cliente';

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {otherName.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{otherName}</p>
          <p className="text-xs text-muted-foreground">{otherRole}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
