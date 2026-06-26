'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  name?: string;
}

interface State {
  error: Error | null;
  info: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    console.error(`[ErrorBoundary:${this.props.name ?? '?'}]`, error.message);
    console.error(`[ErrorBoundary:${this.props.name ?? '?'}] componentStack:`, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, margin: 8, border: '1px solid red', borderRadius: 8, background: '#1a1a1a', color: '#ff4444', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <strong>ErrorBoundary {this.props.name ?? ''}</strong>
          <div>{this.state.error.message}</div>
          {this.state.info && (
            <details>
              <summary>componentStack</summary>
              {this.state.info.componentStack}
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
