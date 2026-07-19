'use client';

import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { DomiAssistantStable } from '@/components/domi/DomiAssistantStable';

interface DomiBoundaryState {
  failed: boolean;
  instance: number;
}

class DomiAssistantBoundary extends React.Component<React.PropsWithChildren, DomiBoundaryState> {
  state: DomiBoundaryState = {
    failed: false,
    instance: 0,
  };

  static getDerivedStateFromError(): Partial<DomiBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DomiAssistantBoundary] El asistente fue aislado para proteger la aplicación', {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private reset = () => {
    this.setState((current) => ({
      failed: false,
      instance: current.instance + 1,
    }));
  };

  render() {
    if (this.state.failed) {
      return (
        <button
          type="button"
          onClick={this.reset}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[1400] flex min-h-14 items-center gap-2 rounded-full border border-[#FFD400]/50 bg-[#17191F] px-4 text-white shadow-2xl lg:bottom-5"
          aria-label="Reiniciar Domi"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFD400] text-[#17191F]">
            <RotateCcw className="h-4 w-4" />
          </span>
          <span className="text-left">
            <strong className="block text-xs">Reiniciar Domi</strong>
            <span className="block text-[9px] text-white/60">La aplicación sigue protegida</span>
          </span>
        </button>
      );
    }

    return <React.Fragment key={this.state.instance}>{this.props.children}</React.Fragment>;
  }
}

export function DomiAssistantHost() {
  return (
    <DomiAssistantBoundary>
      <DomiAssistantStable />
      <span className="sr-only">
        <Sparkles aria-hidden="true" /> Asistente Domi activo
      </span>
    </DomiAssistantBoundary>
  );
}
