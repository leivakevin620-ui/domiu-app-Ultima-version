'use client';

import React from 'react';
import { QUICK_REPLIES } from '@/services/chat';
import { Zap } from 'lucide-react';

interface QuickRepliesProps {
  onSelect: (content: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="h-3 w-3" />
        Respuestas rápidas
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            onClick={() => onSelect(reply)}
            className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}
