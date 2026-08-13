import React from 'react';

export default function QueuePosition({ token, currentServing }) {
  if (!token) return null;

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const getEstWaitTime = (peopleAhead) => {
    const wait = peopleAhead * 5 + 5;
    return `${wait - 5}-${wait} minutes`;
  };

  if (token.status === 'serving') {
    return (
      <div className="queue-position-card card serving-highlight">
        <h3>📢 It's Your Turn!</h3>
        <p className="serving-msg">Please proceed to the counter immediately.</p>
      </div>
    );
  }

  if (token.status === 'completed') {
    return (
      <div className="queue-position-card card completed-highlight">
        <h3>✅ Served</h3>
        <p className="completed-msg">You have been attended to. Thank you!</p>
      </div>
    );
  }

  if (token.status === 'missed') {
    return (
      <div className="queue-position-card card missed-highlight">
        <h3>❌ Missed Turn</h3>
        <p className="missed-msg">You missed your turn. Please check with reception or reply "Hi" on WhatsApp to join the queue again.</p>
      </div>
    );
  }

  return (
    <div className="queue-position-card card">
      <div className="pos-item">
        <div className="pos-label">Position in Queue</div>
        <div className="pos-value">{getOrdinal(token.position)}</div>
      </div>
      <div className="pos-divider"></div>
      <div className="pos-item">
        <div className="pos-label">People Ahead</div>
        <div className="pos-value">{token.peopleAhead}</div>
      </div>
      <div className="pos-divider"></div>
      <div className="pos-item">
        <div className="pos-label">Estimated Wait</div>
        <div className="pos-value">{getEstWaitTime(token.peopleAhead)}</div>
      </div>
    </div>
  );
}
