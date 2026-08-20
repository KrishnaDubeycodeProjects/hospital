import React from 'react';

export default function StatusBadge({ status }) {
  const normalizedStatus = status ? status.toLowerCase() : '';

  const getStatusClass = () => {
    switch (normalizedStatus) {
      case 'serving':
        return 'badge-serving';
      case 'waiting':
        return 'badge-waiting';
      case 'completed':
        return 'badge-completed';
      case 'missed':
        return 'badge-missed';
      default:
        return 'badge-default';
    }
  };

  const getStatusLabel = () => {
    switch (normalizedStatus) {
      case 'serving':
        return '▶ SERVING';
      case 'waiting':
        return '⏳ WAITING';
      case 'completed':
        return '✅ COMPLETED';
      case 'missed':
        return '❌ MISSED';
      default:
        return status || 'UNKNOWN';
    }
  };

  return (
    <span className={`status-badge ${getStatusClass()}`}>
      {getStatusLabel()}
    </span>
  );
}
