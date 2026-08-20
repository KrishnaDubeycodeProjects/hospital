import React from 'react';

export default function Header({ subtitle }) {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="logo-section">
          <span className="logo-icon">🏥</span>
          <h1>Clinic Queue</h1>
        </div>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
    </header>
  );
}
