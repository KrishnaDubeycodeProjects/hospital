import React from 'react';
import StatusBadge from '../common/StatusBadge';

export default function TokenDisplay({ token }) {
  if (!token) return null;

  const qrUrl = `/api/queue/qr/${token.id}`;

  return (
    <div className="patient-token-card card" style={{ textAlign: 'center' }}>
      <div className="card-header">YOUR OFFICIAL HOSPITAL TOKEN</div>
      <div className="token-number" style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0.2rem 0' }}>
        #{token.id}
      </div>
      <div className="patient-name" style={{ fontSize: '1.25rem', fontWeight: 600 }}>{token.name}</div>
      
      <div className="token-status-badge" style={{ margin: '0.75rem 0' }}>
        <StatusBadge status={token.status} />
        {token.isVerified ? (
          <span style={{
            display: 'inline-block',
            marginTop: '0.4rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: '#dcfce7',
            color: '#15803d',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 700
          }}>
            ✅ Verified & Checked-In at Reception
          </span>
        ) : (
          <span style={{
            display: 'inline-block',
            marginTop: '0.4rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            📍 Show QR at Reception Desk
          </span>
        )}
      </div>

      {/* Official Token QR Code */}
      <div className="qr-code-section" style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        display: 'inline-block'
      }}>
        <img 
          src={qrUrl} 
          alt={`QR Code for Token #${token.id}`}
          style={{ width: '180px', height: '180px', borderRadius: '8px', display: 'block', margin: '0 auto' }}
        />
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>
          📱 Scan at Hospital Entrance / Reception
        </div>
      </div>
    </div>
  );
}
