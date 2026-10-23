import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { WhatsAppIcon } from './Icons';
import {
  ShieldCheck,
  Activity,
  PhoneCall,
  Calendar,
  Clock,
  Building2,
  UserCheck,
  Stethoscope,
  Users,
  ExternalLink,
  Wifi,
  CheckCircle2,
} from 'lucide-react';

export default function AyushmanFooter({
  className = '',
  style = {},
  compact = false,
  variant = 'default',
}) {
  const [showModal, setShowModal] = useState(false);

  if (compact) {
    return (
      <>
        <footer
          className={`ayushman-footer-compact ${className}`}
          style={{
            width: '100%',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#ffffff',
            padding: '12px 20px',
            userSelect: 'none',
            boxSizing: 'border-box',
            fontSize: '12.5px',
            ...style,
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src="/aarogya_flow_icon_transparent.png"
                alt="Aarogya Flow"
                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <strong
                style={{ color: '#0F4C3A', fontWeight: '800', cursor: 'pointer' }}
                onClick={() => setShowModal(true)}
              >
                Aarogya Flow
              </strong>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <span style={{ color: '#64748B' }}>Hospital Outpatient &amp; Digital Health Platform</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#64748B', fontSize: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#15803D', fontWeight: 600 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
                <span>OPD Systems Active</span>
              </span>
              <span>&copy; 2026 Aarogya Flow</span>
            </div>
          </div>
        </footer>
        {showModal && <AboutModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <footer
        className={`ayushman-footer ${className}`}
        style={{
          width: '100%',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          userSelect: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        {/* Main Footer Multi-Column Section */}
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '40px 20px 28px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '32px',
              marginBottom: '32px',
            }}
          >
            {/* Column 1: Brand & Overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                onClick={() => setShowModal(true)}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
                  <div style={{ color: '#0F4C3A', fontWeight: '800', fontSize: '18px', letterSpacing: '-0.02em' }}>
                    Aarogya Flow
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                    Care Closer. Healthier Tomorrow.
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: '1.55' }}>
                Modern outpatient queue automation, digital token tracking, and longitudinal health record coordination designed for district hospitals, CHCs, and rural clinics across India.
              </p>

              {/* Status Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#15803D',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    padding: '3px 9px',
                    borderRadius: '16px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                  <span>OPD Systems Active</span>
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#0284C7',
                    backgroundColor: '#F0F9FF',
                    border: '1px solid #BAE6FD',
                    padding: '3px 9px',
                    borderRadius: '16px',
                  }}
                >
                  <Wifi size={11} />
                  <span>2G / Offline Ready</span>
                </span>
              </div>
            </div>

            {/* Column 2: Citizen & Patient Services */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E293B', marginBottom: '14px', letterSpacing: '-0.01em' }}>
                Citizen Services
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <li>
                  <Link
                    to="/find-hospital"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Calendar size={13} style={{ color: '#0F4C3A' }} />
                    <span>Book OPD Token</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/track"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Clock size={13} style={{ color: '#0F4C3A' }} />
                    <span>Track Active Queue</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/find-hospital"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Building2 size={13} style={{ color: '#0F4C3A' }} />
                    <span>Participating Hospitals</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login/patient"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <UserCheck size={13} style={{ color: '#0F4C3A' }} />
                    <span>Digital Health Records</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login/patient"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Users size={13} style={{ color: '#0F4C3A' }} />
                    <span>Family Health Profiles</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Portals & Staff */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E293B', marginBottom: '14px', letterSpacing: '-0.01em' }}>
                Healthcare Portals
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <li>
                  <Link
                    to="/login/patient"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <UserCheck size={13} style={{ color: '#059669' }} />
                    <span>Patient &amp; Family Portal</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login/doctor"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Stethoscope size={13} style={{ color: '#2563EB' }} />
                    <span>Doctor Consultation Desk</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login/admin"
                    style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Building2 size={13} style={{ color: '#0F766E' }} />
                    <span>Hospital Staff Console</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/asha"
                    style={{ color: '#15803D', textDecoration: 'none', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Users size={13} style={{ color: '#15803D' }} />
                    <span>ASHA Community Worker App</span>
                  </Link>
                </li>
                <li>
                  <span
                    onClick={() => setShowModal(true)}
                    style={{ color: '#64748B', cursor: 'pointer', fontSize: '12.5px', textDecoration: 'underline' }}
                  >
                    Platform Architecture Info
                  </span>
                </li>
              </ul>
            </div>

            {/* Column 4: WhatsApp Bot & Helplines */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E293B', marginBottom: '14px', letterSpacing: '-0.01em' }}>
                Emergency &amp; Support
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href="https://wa.me/919120123877?text=Hi"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    color: '#15803D',
                    fontSize: '12.5px',
                    fontWeight: 600,
                  }}
                >
                  <WhatsAppIcon size={16} color="#15803D" />
                  <div>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>WhatsApp Queue Bot</div>
                    <div>+91 91201 23877</div>
                  </div>
                </a>

                <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PhoneCall size={12} style={{ color: '#DC2626' }} />
                    <span>National Emergency: <strong>112</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PhoneCall size={12} style={{ color: '#DC2626' }} />
                    <span>Ambulance Service: <strong>108</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PhoneCall size={12} style={{ color: '#0284C7' }} />
                    <span>National Health Helpline: <strong>1075</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Footer Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            padding: '14px 20px',
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
              color: '#64748B',
            }}
          >
            <div>
              &copy; 2026 Aarogya Flow. Designed for Public Healthcare &amp; Hospital Systems.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0F4C3A',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                About Initiative
              </button>
              <span>&bull;</span>
              <span>Low-Bandwidth Optimized</span>
              <span>&bull;</span>
              <span style={{ color: '#15803D', fontWeight: 600 }}>2G / Offline Ready</span>
            </div>
          </div>
        </div>
      </footer>

      {showModal && <AboutModal onClose={() => setShowModal(false)} />}
    </>
  );
}

function AboutModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/aarogya_flow_icon_transparent.png"
              alt="Aarogya Flow"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
            />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F4C3A', margin: 0 }}>
              Aarogya Flow Platform
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              minWidth: '32px',
              minHeight: '32px',
              aspectRatio: '1 / 1',
              padding: 0,
              fontSize: '16px',
              color: '#64748B',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.6', margin: '0 0 14px' }}>
          Aarogya Flow provides transparent digital OPD queue passes, live wait-time tracking, and longitudinal digital health records across community clinics, district hospitals, and primary health centers.
        </p>

        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px', fontSize: '12.5px', color: '#166534', lineHeight: 1.5 }}>
          <strong>⚡ Engineered for Resilience:</strong> Functions seamlessly across low-connectivity regions, supporting 2G speeds, offline data collection for field workers, and automated WhatsApp queue alerts.
        </div>

        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#0F4C3A',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
