import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { otpApi, doctorApi } from '../api/client';
import AyushmanFooter from '../components/AyushmanFooter';

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const [demoLoading, setDemoLoading] = useState(false);

  const services = [
    {
      id: 'book',
      title: 'Book OPD Token',
      subtitle: 'Select department, check hospital distance & book online',
      icon: '📅',
      color: '#E0F2FE',
      border: '#BAE6FD',
      route: '/find-hospital',
    },
    {
      id: 'track',
      title: 'Track Live Queue',
      subtitle: 'Watch your exact position, wait time & travel buffer in real-time',
      icon: '⏱️',
      color: '#FFEDD5',
      border: '#FED7AA',
      route: '/track',
    },
    {
      id: 'records',
      title: 'Ayushman Health Vault',
      subtitle: 'Prescriptions, CBC blood reports, lab findings & referrals',
      icon: '📑',
      color: '#F3E8FF',
      border: '#E9D5FF',
      route: '/login/patient',
    },
    {
      id: 'hospitals',
      title: 'Find Hospitals & Counters',
      subtitle: 'Locate nearby OPDs with live counter load & timings',
      icon: '🏥',
      color: '#DCFCE7',
      border: '#BBF7D0',
      route: '/find-hospital',
    },
    {
      id: 'family',
      title: 'Family Members & ABHA',
      subtitle: 'Link 14-digit ABHA IDs and manage dependents seamlessly',
      icon: '👨‍👩‍👧',
      color: '#FFE4E6',
      border: '#FECDD3',
      route: '/login/patient',
    },
    {
      id: 'doctor',
      title: 'Doctor Consultation Room',
      subtitle: 'Electronic health records, e-prescriptions & live queue calling',
      icon: '👨‍⚕️',
      color: '#E0E7FF',
      border: '#C7D2FE',
      route: '/login/doctor',
    },
  ];

  async function handleLaunchDemoPatient() {
    setDemoLoading(true);
    try {
      await fetch('/api/test/patient/seed?phone=%2B919100000099', { method: 'POST' });
      const res = await otpApi.verify('+919100000099', '123456');
      login('PATIENT', res.token);
      toast.success('Logged in as Ramesh Kumar (Demo Patient)');
      navigate('/patient');
    } catch (e) {
      toast.error(e.message || 'Demo activation error');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      {/* Website Top Navigation Header */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #E2E8F0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Brand */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #004D40, #059669)',
                color: '#ffffff',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: '0 2px 8px rgba(0, 77, 64, 0.25)',
              }}
            >
              +
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#004D40', fontWeight: '800', fontSize: '20px', letterSpacing: '-0.02em' }}>
                  AarogyaFlow
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    backgroundColor: '#E8F5E9',
                    color: '#004D40',
                    border: '1px solid #C8E6C9',
                    padding: '2px 7px',
                    borderRadius: '6px',
                  }}
                >
                  ABDM CERTIFIED
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Smart Healthcare & Zero-Wait OPD Access
              </div>
            </div>
          </Link>

          {/* Center Navigation Links (Hidden on small mobile) */}
          <nav className="desktop-patient-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link to="/find-hospital" style={{ color: '#334155', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600 }}>
              Find Hospital
            </Link>
            <Link to="/track" style={{ color: '#334155', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600 }}>
              Track Queue
            </Link>
            <Link to="/login/patient" style={{ color: '#334155', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600 }}>
              Patient Portal
            </Link>
            <Link to="/login/doctor" style={{ color: '#334155', textDecoration: 'none', fontSize: '13.5px', fontWeight: 600 }}>
              Doctor Portal
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleLaunchDemoPatient}
              disabled={demoLoading}
              style={{
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🧪 {demoLoading ? 'Loading...' : 'Try Demo Mode'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login/patient')}
              style={{
                backgroundColor: '#004D40',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Website Content */}
      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section
          style={{
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
            borderBottom: '1px solid #E2E8F0',
            padding: '50px 20px 40px',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#004D40',
                backgroundColor: '#E8F5E9',
                border: '1px solid #C8E6C9',
                padding: '4px 12px',
                borderRadius: '20px',
                marginBottom: '16px',
              }}
            >
              <span>🏛️</span> National Health Authority &bull; ABDM Integrated OPD System
            </span>
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 44px)',
                fontWeight: '900',
                color: '#004D40',
                margin: '0 0 16px',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
              }}
            >
              Smart, Zero-Wait Hospital OPDs <br />
              <span style={{ color: '#059669' }}>For Every Indian Citizen</span>
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: '#475569',
                maxWidth: '680px',
                margin: '0 auto 28px',
                lineHeight: 1.6,
              }}
            >
              Experience seamless queue management with live digital tokens, Ayushman Bharat ABHA Health Vault, and automated WhatsApp access.
            </p>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '36px' }}>
              <button
                type="button"
                onClick={() => navigate('/find-hospital')}
                style={{
                  backgroundColor: '#004D40',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0, 77, 64, 0.2)',
                }}
              >
                <span>📅</span> Book OPD Appointment
              </button>
              <button
                type="button"
                onClick={() => navigate('/track')}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '12px 22px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⏱️</span> Track Active Token
              </button>
              <button
                type="button"
                onClick={handleLaunchDemoPatient}
                disabled={demoLoading}
                style={{
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #86EFAC',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🧪</span> 1-Click Demo Sandbox
              </button>
            </div>

            {/* Stat Badges */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                maxWidth: '900px',
                margin: '0 auto',
              }}
            >
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#004D40' }}>33+</div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Medical Specialties</div>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669' }}>&lt; 15 min</div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Average Queue Wait</div>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#2563EB' }}>100%</div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>ABDM Paperless Vault</div>
              </div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#D97706' }}>24 &times; 7</div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>WhatsApp Assistance</div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Services Section */}
        <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#004D40', margin: '0 0 8px' }}>
              Comprehensive Healthcare Services
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Access everything from hospital discovery to longitudinal digital care records in one unified platform.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {services.map((svc) => (
              <div
                key={svc.id}
                onClick={() => navigate(svc.route)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = svc.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: svc.color,
                    border: `1px solid ${svc.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    flexShrink: 0,
                  }}
                >
                  {svc.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: '#1E293B' }}>
                    {svc.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
                    {svc.subtitle}
                  </p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '12px', fontSize: '12.5px', fontWeight: '700', color: '#004D40' }}>
                    Open Service &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Role Portals Quick Switcher */}
        <section style={{ backgroundColor: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '40px 20px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1E293B', margin: '0 0 6px' }}>
                Dedicated Stakeholder Portals
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Tailored interfaces for patients, clinicians, and hospital administrative staff.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '22px', border: '1px solid #CBD5E1' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🩺</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: '#004D40' }}>Patient Portal</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5 }}>
                  View active queue token slips, access CBC and prescription vaults, and manage family ABHA cards.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/patient')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#E8F5E9', color: '#004D40', border: '1px solid #C8E6C9', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Enter Patient Portal &rarr;
                </button>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '22px', border: '1px solid #CBD5E1' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>👨‍⚕️</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: '#1D4ED8' }}>Doctor Portal</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5 }}>
                  Call patients into the chair, generate e-prescriptions with Eka Care registry, and manage clinical care courses.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/doctor')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Enter Doctor Portal &rarr;
                </button>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '22px', border: '1px solid #CBD5E1' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏥</div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: '#0F766E' }}>Hospital Admin & Counters</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5 }}>
                  Manage department counters, handle missed and exponentially penalized tokens, and inspect hospital metrics.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/admin')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#F0FDFA', color: '#0F766E', border: '1px solid #99F6E4', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Enter Staff Console &rarr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* WhatsApp Notification & AI Assistant Banner */}
        <section style={{ backgroundColor: '#ffffff', borderTop: '1px solid #E2E8F0', padding: '36px 20px' }}>
          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto',
              backgroundColor: '#F0FDF4',
              border: '2px solid #86EFAC',
              borderRadius: '16px',
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  flexShrink: 0,
                }}
              >
                💬
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: '#166534' }}>
                  AarogyaFlow 24/7 WhatsApp AI Assistant
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#15803D' }}>
                  Book OPDs, track tokens, upload prescriptions and test demo mode directly on WhatsApp: <strong>+91 91201 23877</strong>
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/919120123877?text=Hi"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#16A34A',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
              }}
            >
              <span>📲</span> Open WhatsApp Bot
            </a>
          </div>
        </section>
      </main>

      {/* Official Ayushman Footer */}
      <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '24px 20px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }} />
    </div>
  );
}
