import React from 'react';
import StatusBadge from '../common/StatusBadge';

export default function QueueTable({ tokens, onServe, onVerify }) {
  if (tokens.length === 0) {
    return (
      <div className="table-empty card">
        <p>No tokens issued yet today</p>
      </div>
    );
  }

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="queue-table-container card">
      <h3>Active Queue</h3>
      <div className="table-wrapper">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Check-In QR</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id} className={`status-row-${token.status}`}>
                <td><strong className="token-number-cell">#{token.id}</strong></td>
                <td>{token.name}</td>
                <td>{token.phone}</td>
                <td>
                  <StatusBadge status={token.status} />
                </td>
                <td>
                  {token.isVerified ? (
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      backgroundColor: '#dcfce7', 
                      color: '#15803d', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}>
                      ✅ Verified
                    </span>
                  ) : (
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      backgroundColor: '#f1f5f9', 
                      color: '#64748b', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem'
                    }}>
                      ⏳ Pending
                    </span>
                  )}
                </td>
                <td>{formatTime(token.createdAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {token.status === 'waiting' && (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => onServe(token.id)}
                      >
                        Serve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
