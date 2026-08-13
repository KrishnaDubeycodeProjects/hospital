import React from 'react';

export default function CurrentServing({ servingToken, onComplete, onMiss }) {
  if (!servingToken) {
    return (
      <div className="current-serving-empty card">
        <h3>Now Serving</h3>
        <p className="no-active">No token currently being served</p>
      </div>
    );
  }

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="current-serving-card card">
      <div className="serving-header">
        <span className="serving-indicator">●</span> NOW SERVING
      </div>
      <div className="serving-body">
        <div className="serving-token-number">#{servingToken.id}</div>
        <div className="serving-details">
          <h3>{servingToken.name}</h3>
          <p className="phone">📞 {servingToken.phone}</p>
          <p className="time">⏱️ Started: {formatTime(servingToken.servedAt)}</p>
        </div>
        <div className="serving-actions">
          <button 
            className="btn btn-success" 
            onClick={() => onComplete(servingToken.id)}
          >
            Complete
          </button>
          <button 
            className="btn btn-danger" 
            onClick={() => onMiss(servingToken.id)}
          >
            Missed
          </button>
        </div>
      </div>
    </div>
  );
}
