'use client';

import React from 'react';

interface ErrorBoundaryProps {
  fallback?: React.ReactElement<{ resetErrorBoundary?: () => void }>;
  onReset?: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, error.stack, info.componentStack);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const logError = {
        message: this.state.error?.message,
        name: this.state.error?.name,
        stack: this.state.error?.stack,
      };
      if (this.props.fallback) {
        return React.cloneElement(this.props.fallback, {
          resetErrorBoundary: this.resetErrorBoundary,
          error: logError,
        });
      }
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
          <h2 className="text-lg font-semibold text-destructive">Algo sali&oacute; mal</h2>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            onClick={this.resetErrorBoundary}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function getErrorMetadata(error: unknown): { message: string; name: string; stack: string | undefined } | null {
  if (!error) return null;
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }
  return { message: String(error), name: 'Unknown', stack: undefined };
}
