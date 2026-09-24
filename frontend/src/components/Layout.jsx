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
    <div className="arogyaflow-backdrop">
      <main
        className="arogyaflow-phone-frame"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          justifyContent: 'space-between',
          height: '100dvh',
          maxHeight: '100dvh',
          overflow: 'hidden',
        }}
      >
        {/* Top App Bar Header */}
        <header
          style={{
            padding: '14px 18px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #F1F5F9',
            flexShrink: 0,
          }}
        >
          {/* Left: Circular back button */}
          <button
            type="button"
            onClick={() => {
              if (location.pathname === '/patient') {
                navigate('/');
              } else {
                navigate(-1);
              }
            }}
            aria-label="Back"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#F3F4F6',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1F2937',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Center: Title + Subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#004D40',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {getTitle()}
            </h1>
            <span style={{ fontSize: '11.5px', color: '#6B7280', fontWeight: '500' }}>
              {session.subject || 'Aarogya Flow Patient'}
            </span>
          </div>

          {/* Right: Circular Log out button */}
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#DC2626',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </header>

        {/* Scrollable Main Body Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 20px',
            backgroundColor: '#ffffff',
          }}
        >
          <Outlet />
        </div>

        {/* Bottom Mobile Navigation Tabs */}
        <nav
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #F1F5F9',
            padding: '8px 10px 4px',
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
                  borderRadius: '12px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.renderIcon(isActive)}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#004D40' : '#6B7280',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Pinned Standard Footer */}
        <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '6px 16px 14px' }} />
      </main>
    </div>
  );
}

