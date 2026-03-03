'use client';

// ============================================================
// 🏴‍☠️ ErrorBoundary — React Error Boundary (Pirate-themed)
// ============================================================
// Catches rendering errors from any descendant component and
// shows a pirate-flavoured crash screen instead of a blank page.
//
// Usage:
//   <ErrorBoundary>
//     <MyRiskyComponent />
//   </ErrorBoundary>
//
// ============================================================

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback override */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleDismiss = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error } = this.state;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #010810 0%, #0a1628 60%, #0d0008 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            width: '100%',
            border: '2px solid #c0392b',
            borderRadius: '12px',
            padding: '2.5rem',
            background: 'rgba(10, 22, 40, 0.95)',
            boxShadow: '0 0 40px rgba(192, 57, 43, 0.3)',
            textAlign: 'center',
          }}
        >
          {/* Skull + Crossbones header */}
          <div
            style={{
              fontSize: '4rem',
              marginBottom: '0.5rem',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 12px rgba(192,57,43,0.6))',
            }}
            aria-hidden="true"
          >
            ☠️
          </div>

          <h1
            style={{
              color: '#e74c3c',
              fontSize: '1.6rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
            }}
          >
            Ye Ship Has Sunk!
          </h1>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.95rem',
              marginBottom: '1.5rem',
              lineHeight: 1.6,
            }}
          >
            A treacherous render error has sent yer crew to Davy Jones&apos; Locker. The
            quartermaster has logged the damage below.
          </p>

          {/* Error message */}
          {error && (
            <div
              style={{
                background: '#0f1e35',
                border: '1px solid #1e3a5f',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              <p
                style={{
                  color: '#f87171',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                🗺 Damage Report
              </p>
              <pre
                style={{
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {error.message || String(error)}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={this.handleReload}
              style={{
                background: '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.4rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => ((e.target as HTMLButtonElement).style.background = '#e74c3c')}
              onMouseOut={(e) => ((e.target as HTMLButtonElement).style.background = '#c0392b')}
            >
              ⚓ Reload Ship
            </button>

            <button
              onClick={this.handleDismiss}
              style={{
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #1e3a5f',
                borderRadius: '8px',
                padding: '0.6rem 1.4rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseOver={(e) => {
                const btn = e.target as HTMLButtonElement;
                btn.style.color = '#94a3b8';
                btn.style.borderColor = '#2d5986';
              }}
              onMouseOut={(e) => {
                const btn = e.target as HTMLButtonElement;
                btn.style.color = '#64748b';
                btn.style.borderColor = '#1e3a5f';
              }}
            >
              🏳 Dismiss
            </button>
          </div>

          <p
            style={{
              color: '#334155',
              fontSize: '0.72rem',
              marginTop: '1.5rem',
            }}
          >
            🏴‍☠️ &quot;Even the boldest pirate sometimes runs aground.&quot;
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
