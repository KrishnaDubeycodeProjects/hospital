import React from 'react';

export default function StatsCards({ stats }) {
  return (
    <div className="stats-container">
      <div className="stat-card card">
        <div className="stat-value">{stats.total || 0}</div>
        <div className="stat-label">Total Tokens</div>
      </div>
      <div className="stat-card card border-waiting">
        <div className="stat-value text-waiting">{stats.waiting || 0}</div>
        <div className="stat-label">Waiting</div>
      </div>
      <div className="stat-card card border-serving">
        <div className="stat-value text-serving">{stats.serving || 0}</div>
        <div className="stat-label">Serving</div>
      </div>
      <div className="stat-card card border-completed">
        <div className="stat-value text-completed">{stats.completed || 0}</div>
        <div className="stat-label">Served</div>
      </div>
      <div className="stat-card card border-missed">
        <div className="stat-value text-missed">{stats.missed || 0}</div>
        <div className="stat-label">Missed</div>
      </div>
    </div>
  );
}
