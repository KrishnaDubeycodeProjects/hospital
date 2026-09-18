import React, { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  admin: [
    { to: '/admin', label: 'Live Queue', icon: '📊', end: true },
    { to: '/admin/counters', label: 'Counters', icon: '🔢' },
    { to: '/admin/missed', label: 'Missed Queue', icon: '❌' },
    { to: '/admin/history', label: 'Visit History', icon: '📜' },
    { to: '/admin/hospitals', label: 'Hospitals', icon: '🏛️' },
  ],
  patient: [
    { to: '/patient', label: 'My Queue', icon: '🎟️', end: true },
    { to: '/patient/family', label: 'Family & ABHA', icon: '👥' },
    { to: '/patient/records', label: 'Records Hub', icon: '📋' },
    { to: '/patient/access', label: 'Doctor Access', icon: '🔑' },
  ],
  doctor: [
    { to: '/doctor', label: 'Profile', icon: '👤', end: true },
    { to: '/doctor/consultation', label: 'Consultation Room', icon: '💊' },
    { to: '/doctor/courses', label: 'Care Episodes', icon: '📋' },
    { to: '/doctor/referrals', label: 'Referrals & Triage', icon: '🔄' },
    { to: '/doctor/patients', label: 'My Patients', icon: '👥' },
    { to: '/doctor/access', label: 'Request Access', icon: '🔑' },
  ],
};

const ROLE_TITLE = {
  admin: 'OPDX Staff Console',
  patient: 'Ayushman Patient Portal',
  doctor: 'OPDX Doctor Portal',
};

export function RoleShell({ role }) {
  const { admin, patient, doctor, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const session = { admin, patient, doctor }[role];
  if (!session) return <Navigate to={`/login/${role}`} replace />;

  const identityLabel = session.subject || 'Active User';

  function handleLogout() {
    logout(role.toUpperCase());
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar opdx-sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #14b8a6)',
                color: '#ffffff',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              +
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#ffffff', fontWeight: '800', fontSize: '16px', letterSpacing: '-0.02em' }}>
                  ArogyaFlow
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    backgroundColor: 'rgba(37, 99, 235, 0.25)',
                    color: '#60a5fa',
                    border: '1px solid rgba(37, 99, 235, 0.4)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  OPDX
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{ROLE_TITLE[role]}</div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          {NAV[role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span style={{ fontSize: '16px', marginRight: '6px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Session Footer */}
        <div className="sidebar-foot" style={{ borderTop: '1px solid #1E293B', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9999px',
                backgroundColor: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '12px',
              }}
            >
              {role === 'doctor' ? 'DR' : role === 'admin' ? 'AD' : 'PT'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#F1F5F9', truncate: true }}>
                {identityLabel}
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>{role.toUpperCase()} SESSION</div>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', color: '#94A3B8' }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
            ☰
          </button>
          <NavLink to="/" className="topbar-home" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>←</span>
            <span>Public Services</span>
          </NavLink>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
