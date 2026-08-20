import React, { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  admin: [
    { to: '/admin', label: 'Live Queue', end: true },
    { to: '/admin/counters', label: 'Counters' },
    { to: '/admin/missed', label: 'Missed Queue' },
    { to: '/admin/history', label: 'Visit History' },
    { to: '/admin/hospitals', label: 'Hospitals' },
  ],
  patient: [
    { to: '/patient', label: 'My Queue', end: true },
    { to: '/patient/history', label: 'Visit History' },
    { to: '/patient/documents', label: 'Documents' },
    { to: '/patient/access', label: 'Doctor Access' },
  ],
  doctor: [
    { to: '/doctor', label: 'Profile', end: true },
    { to: '/doctor/access', label: 'Request Access' },
    { to: '/doctor/patients', label: 'My Patients' },
  ],
};

const ROLE_TITLE = { admin: 'Staff Console', patient: 'Patient Portal', doctor: 'Doctor Portal' };

export function RoleShell({ role }) {
  const { admin, patient, doctor, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const session = { admin, patient, doctor }[role];
  if (!session) return <Navigate to={`/login/${role}`} replace />;

  const identityLabel = role === 'admin' ? session.subject : session.subject;

  function handleLogout() {
    logout(role.toUpperCase());
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">AF</span>
          <div>
            <div className="brand-name">ArogyaFlow</div>
            <div className="brand-sub">{ROLE_TITLE[role]}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV[role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="identity-pill" title={identityLabel}>
            {identityLabel}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
            ☰
          </button>
          <NavLink to="/" className="topbar-home">
            ← Public site
          </NavLink>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
