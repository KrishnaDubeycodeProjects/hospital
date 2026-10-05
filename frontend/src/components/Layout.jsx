import React, { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AyushmanFooter from './AyushmanFooter';

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

  if (role === 'patient') {
    return <PatientMobileShell session={session} onLogout={() => { logout('PATIENT'); navigate('/'); }} />;
  }

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
                  AarogyaFlow
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

        {/* User Session Footer (OPD Exit) */}
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
                flexShrink: 0,
              }}
            >
              {role === 'doctor' ? 'DR' : role === 'admin' ? 'AD' : 'PT'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#F1F5F9', wordBreak: 'break-word' }}>
                {identityLabel}
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>{role.toUpperCase()} SESSION</div>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', color: '#fca5a5', border: '1px solid #334155', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            🚪 OPD Exit / Log out
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

/**
 * Mobile-aligned native phone frame for the entire Patient Portal.
 * Matches ArogyaFlow mobile aesthetic: clean white header, green accent palette,
 * bottom tabs, and pinned AyushmanFooter.
 */
function PatientMobileShell({ session, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/patient') return 'My Live Queue';
    if (path.startsWith('/patient/family')) return 'Family & ABHA';
    if (path.startsWith('/patient/records')) return 'Health Records';
    if (path.startsWith('/patient/access')) return 'Doctor Access';
    if (path.startsWith('/patient/courses')) return 'Care Episodes';
    if (path.startsWith('/patient/referrals')) return 'Referrals';
    if (path.startsWith('/patient/history')) return 'Visit History';
    if (path.startsWith('/patient/documents')) return 'My Documents';
    return 'Patient Portal';
  };

  const patientTabs = [
    {
      to: '/patient',
      label: 'My Queue',
      end: true,
      renderIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      ),
    },
    {
      to: '/patient/family',
      label: 'Family & ABHA',
      renderIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: '/patient/records',
      label: 'Records',
      renderIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      to: '/patient/access',
      label: 'Access',
      renderIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="arogyaflow-backdrop" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Modern Responsive Top Website Navigation */}
      <header
        style={{
          width: '100%',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #E2E8F0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/patient')}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #004D40, #059669)',
                color: '#ffffff',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 2px 6px rgba(0, 77, 64, 0.25)',
              }}
            >
              +
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#004D40', fontWeight: '800', fontSize: '18px', letterSpacing: '-0.02em' }}>
                  AarogyaFlow
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '700',
                    backgroundColor: '#E8F5E9',
                    color: '#004D40',
                    border: '1px solid #C8E6C9',
                    padding: '1px 7px',
                    borderRadius: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  ABDM PORTAL
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                {getTitle()} &bull; <strong style={{ color: '#334155' }}>{session.subject || 'Patient'}</strong>
              </div>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="desktop-patient-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {patientTabs.map((tab) => {
              const isActive = tab.end
                ? location.pathname === tab.to
                : location.pathname.startsWith(tab.to);

              return (
                <button
                  key={tab.to}
                  type="button"
                  onClick={() => navigate(tab.to)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isActive ? '#E8F5E9' : 'transparent',
                    border: isActive ? '1px solid #C8E6C9' : '1px solid transparent',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#004D40' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.renderIcon(isActive)}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action: Return Home & Log out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              title="AarogyaFlow Home"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#475569',
                backgroundColor: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '7px 12px',
                cursor: 'pointer',
              }}
            >
              🏠 Home
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#DC2626',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '7px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Content Container */}
      <main
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          flex: 1,
          padding: '24px 20px',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Outlet />
      </main>

      {/* Mobile Navigation Tabs (visible only on small screens) */}
      <nav
        className="mobile-patient-bottom-nav"
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #E2E8F0',
          padding: '8px 12px 6px',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        }}
      >
        {patientTabs.map((tab) => {
          const isActive = tab.end
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to);

          return (
            <button
              key={tab.to}
              type="button"
              onClick={() => navigate(tab.to)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                backgroundColor: isActive ? '#E8F5E9' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {tab.renderIcon(isActive)}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#004D40' : '#6B7280',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Pinned Standard Website Footer */}
      <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '16px 20px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }} />
    </div>
  );
}

