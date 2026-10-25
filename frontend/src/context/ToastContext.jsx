import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Info, CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message, tone = 'info') => {
      const id = nextId++;
      setToasts((t) => [...t, { id, message, tone }]);
      timers.current[id] = setTimeout(() => dismiss(id), 5000);
      return id;
    },
    [dismiss]
  );

  const toast = useMemoToast(push);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-popup-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-popup-card" onClick={() => dismiss(t.id)}>
            <div className="toast-popup-icon-container">
              {t.tone === 'success' && <CheckCircle2 size={18} color="#2563EB" strokeWidth={2.4} />}
              {t.tone === 'error' && <AlertCircle size={18} color="#2563EB" strokeWidth={2.4} />}
              {t.tone === 'warning' && <AlertTriangle size={18} color="#2563EB" strokeWidth={2.4} />}
              {t.tone === 'info' && <Info size={18} color="#2563EB" strokeWidth={2.4} />}
            </div>
            <div className="toast-popup-content">
              <div className="toast-popup-title">
                {t.tone === 'success' ? 'Success Notification' : t.tone === 'error' ? 'System Notice' : 'Information Log'}
              </div>
              <div className="toast-popup-message">{t.message}</div>
            </div>
            <button
              type="button"
              className="toast-popup-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useMemoToast(push) {
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = {
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
      warning: (m) => push(m, 'warning'),
    };
  }
  return ref.current;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
