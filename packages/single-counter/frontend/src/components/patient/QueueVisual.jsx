import React from 'react';

export default function QueueVisual({ tokens, currentTokenId }) {
  // Show only serving and waiting tokens for visual simplicity
  const activeTokens = tokens
    .filter(t => t.status === 'serving' || t.status === 'waiting')
    .sort((a, b) => a.id - b.id);

  if (activeTokens.length === 0) {
    return (
      <div className="queue-visual card">
        <h3>Queue Status</h3>
        <p className="no-active">Queue is currently empty</p>
      </div>
    );
  }

  return (
    <div className="queue-visual card">
      <h3>Queue Status</h3>
      <div className="visual-list">
        {activeTokens.map((t) => {
          const isUserToken = t.id === Number(currentTokenId);
          const isServing = t.status === 'serving';
          
          return (
            <div 
              key={t.id} 
              className={`visual-node 
                ${isServing ? 'node-serving' : 'node-waiting'} 
                ${isUserToken ? 'node-user' : ''}
              `}
            >
              <div className="node-number">#{t.id}</div>
              <div className="node-label">
                {isServing ? 'Serving' : 'Waiting'}
                {isUserToken && ' (You)'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
