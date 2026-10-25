import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AarogyaFlow Error Boundary Caught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            padding: '20px',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '28px 24px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
              border: '1px solid #E2E8F0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🩺</div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
              Something went wrong loading this screen
            </h2>
            <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px' }}>
              {this.state.error?.message || (typeof this.state.error === 'string' ? this.state.error : 'An unexpected error occurred. Please refresh or navigate back.')}
            </p>
            {this.state.error?.stack && (
              <details style={{ textAlign: 'left', marginBottom: '16px', background: '#F1F5F9', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', color: '#475569', overflowX: 'auto', maxHeight: '120px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#0369A1' }}>View Error Details</summary>
                <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error.stack}</pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.clear();
                    if ('caches' in window) {
                      caches.keys().then((names) => {
                        for (const name of names) caches.delete(name);
                      });
                    }
                  } catch (e) {}
                  window.location.href = window.location.pathname + '?reload=' + Date.now();
                }}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔄 Refresh Page
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.assign('/');
                }}
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
