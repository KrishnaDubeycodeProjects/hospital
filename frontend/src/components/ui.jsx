import React from 'react';

export function Card({ title, actions, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', ...props }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, id }) {
  return (
    <label className="field" htmlFor={id}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return <textarea className="input" {...props} />;
}

const STATUS_TONE = {
  waiting: 'amber',
  serving: 'blue',
  completed: 'green',
  missed: 'red',
  rejected: 'red',
  registering_name: 'gray',
  pending: 'amber',
  claimed: 'green',
  expired: 'gray',
};

export function Badge({ tone, children }) {
  return <span className={`badge badge-${tone || 'gray'}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  const tone = STATUS_TONE[status] || 'gray';
  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>;
}

export function StatCard({ label, value, tone = 'blue' }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="loading-row">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Modal({ open = true, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Table({ columns, rows, keyField = 'id', emptyText = 'Nothing to show yet.' }) {
  if (!rows || rows.length === 0) return <EmptyState title={emptyText} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function fmtDateTime(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export function fmtMinutes(v) {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v);
  return n < 60 ? `${n} min` : `${Math.floor(n / 60)}h ${n % 60}m`;
}
