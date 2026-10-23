import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WhatsAppIcon } from './Icons';
import {
  Menu,
  X,
  ChevronLeft,
  Calendar,
  Clock,
  Building2,
  UserCheck,
  Stethoscope,
  Users,
  ShieldCheck,
  Home,
  LogIn,
} from 'lucide-react';

export default function AppHeader({
  activeNav,
  backTo,
  backLabel = 'Back',
  title,
  subtitle,
  maxWidth = '1200px',
  hideNavLinks = false,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, patient, doctor } = useAuth();

  const handleBack = () => {
    if (typeof backTo === 'function') {
      backTo();
    } else if (typeof backTo === 'string') {
      navigate(backTo);
    } else if (backTo === -1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const navItems = [
    { to: '/find-hospital', label: 'Find Hospital', id: 'hospitals' },
    { to: '/track', label: 'Track Queue', id: 'track' },
    { to: patient ? '/patient' : '/login/patient', label: 'Patient Portal', id: 'patient' },
    { to: doctor ? '/doctor' : '/login/doctor', label: 'Doctor Desk', id: 'doctor' },
    { to: '/asha', label: 'ASHA Hub', id: 'asha', badge: true },
  ];

  return (
    <header
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Main Global Navbar Row */}
      <div
        style={{
          maxWidth,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                border: '1px solid #E2E8F0',
                flexShrink: 0,
              }}
            >
              <img
                src="/aarogya_flow_icon_transparent.png"
                alt="Aarogya Flow"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    color: '#0F4C3A',
                    fontWeight: '800',
                    fontSize: '19px',
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Aarogya Flow
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748B',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  display: 'none',
                }}
                className="header-brand-subtitle"
              >
                Hospital Queue &amp; Care Platform
              </div>
            </div>
          </Link>
        </div>

        {/* Center Desktop Navigation Links */}
        {!hideNavLinks && (
          <nav
            className="desktop-patient-nav"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
            }}
          >
            {navItems.map((item) => {
              const isActive =
                activeNav === item.id ||
                location.pathname === item.to ||
                (item.to !== '/' && location.pathname.startsWith(item.to));

              if (item.badge) {
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={{
                      color: '#15803D',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#DCFCE7',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #86EFAC',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.id}
                  to={item.to}
                  style={{
                    color: isActive ? '#0F4C3A' : '#334155',
                    textDecoration: 'none',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 700 : 600,
                    borderBottom: isActive ? '2px solid #0F4C3A' : '2px solid transparent',
                    paddingBottom: '2px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Desktop Actions & Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* WhatsApp Support Bot Button */}
          <button
            type="button"
            onClick={() => window.open('https://wa.me/919120123877?text=Hi', '_blank')}
            className="header-whatsapp-btn"
            style={{
              backgroundColor: '#F0FDF4',
              color: '#15803D',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            title="Open WhatsApp Support Bot"
          >
            <WhatsAppIcon size={14} color="#15803D" />
            <span>WhatsApp Access</span>
          </button>

          {/* User Session / Sign In Button */}
          {patient ? (
            <button
              type="button"
              onClick={() => navigate('/patient')}
              style={{
                backgroundColor: '#E8F5E9',
                color: '#0F4C3A',
                border: '1px solid #C8E6C9',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserCheck size={14} />
              <span>Patient Hub</span>
            </button>
          ) : doctor ? (
            <button
              type="button"
              onClick={() => navigate('/doctor')}
              style={{
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Stethoscope size={14} />
              <span>Doctor Desk</span>
            </button>
          ) : admin ? (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              style={{
                backgroundColor: '#F0FDFA',
                color: '#0F766E',
                border: '1px solid #99F6E4',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Building2 size={14} />
              <span>Staff Console</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login/patient')}
              style={{
                backgroundColor: '#0F4C3A',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}

          {/* Mobile Menu Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            style={{
              display: 'none',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: mobileMenuOpen ? '#F1F5F9' : '#FFFFFF',
              border: '1px solid #E2E8F0',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155',
            }}
            className="header-mobile-toggle"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sub-bar for Flow Pages (Back button + Page title / breadcrumb) */}
      {(backTo || title) && (
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #F1F5F9',
            padding: '8px 20px',
          }}
        >
          <div
            style={{
              maxWidth,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            {backTo ? (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={16} />
                <span>{backLabel}</span>
              </button>
            ) : (
              <div />
            )}

            {title && (
              <div style={{ textAlign: 'right', flex: 1 }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F4C3A' }}>
                  {title}
                </span>
                {subtitle && (
                  <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>
                    &bull; {subtitle}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Responsive Mobile Menu Drawer / Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E2E8F0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
          className="header-mobile-drawer"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: location.pathname === '/' ? '#E8F5E9' : 'transparent',
                color: location.pathname === '/' ? '#0F4C3A' : '#334155',
                textDecoration: 'none',
                fontWeight: location.pathname === '/' ? 700 : 600,
                fontSize: '14px',
              }}
            >
              <Home size={18} style={{ color: '#0F4C3A' }} />
              <span>Home &amp; Services</span>
            </Link>

            <Link
              to="/find-hospital"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: location.pathname === '/find-hospital' ? '#E8F5E9' : 'transparent',
                color: location.pathname === '/find-hospital' ? '#0F4C3A' : '#334155',
                textDecoration: 'none',
                fontWeight: location.pathname === '/find-hospital' ? 700 : 600,
                fontSize: '14px',
              }}
            >
              <Building2 size={18} style={{ color: '#0F4C3A' }} />
              <span>Find Hospital &amp; Book Token</span>
            </Link>

            <Link
              to="/track"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: location.pathname.startsWith('/track') ? '#E8F5E9' : 'transparent',
                color: location.pathname.startsWith('/track') ? '#0F4C3A' : '#334155',
                textDecoration: 'none',
                fontWeight: location.pathname.startsWith('/track') ? 700 : 600,
                fontSize: '14px',
              }}
            >
              <Clock size={18} style={{ color: '#0F4C3A' }} />
              <span>Track Live Queue Turn</span>
            </Link>

            <Link
              to="/login/patient"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: location.pathname.startsWith('/patient') || location.pathname === '/login/patient' ? '#E8F5E9' : 'transparent',
                color: '#334155',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <UserCheck size={18} style={{ color: '#059669' }} />
              <span>Patient &amp; Family Records</span>
            </Link>

            <Link
              to="/login/doctor"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: location.pathname.startsWith('/doctor') || location.pathname === '/login/doctor' ? '#EFF6FF' : 'transparent',
                color: '#334155',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <Stethoscope size={18} style={{ color: '#2563EB' }} />
              <span>Doctor Consultation Desk</span>
            </Link>

            <Link
              to="/login/admin"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: location.pathname.startsWith('/admin') || location.pathname === '/login/admin' ? '#F0FDFA' : 'transparent',
                color: '#334155',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <Building2 size={18} style={{ color: '#0F766E' }} />
              <span>Hospital Staff Console</span>
            </Link>

            <Link
              to="/asha"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                border: '1px solid #86EFAC',
              }}
            >
              <Users size={18} style={{ color: '#15803D' }} />
              <span>ASHA Community Worker App</span>
            </Link>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                window.open('https://wa.me/919120123877?text=Hi', '_blank');
              }}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#F0FDF4',
                color: '#15803D',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <WhatsAppIcon size={16} color="#15803D" />
              <span>WhatsApp Assistant Bot</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
