import React, { useState } from 'react';
import { PhoneCall } from 'lucide-react';

export default function AyushmanFooter({
  className = '',
  style = {},
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <footer
        className={`ayushman-footer-small ${className}`}
        style={{
          width: '100%',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          padding: '10px 16px',
          boxSizing: 'border-box',
          fontSize: '12px',
          color: '#64748B',
          userSelect: 'none',
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
            gap: '8px 16px',
          }}
        >
          {/* Left Brand & Tagline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              onClick={() => setShowModal(true)}
            >
              <img
                src="/aarogya_flow_icon_transparent.png"
                alt="Aarogya Flow"
                style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <strong style={{ color: '#0F172A', fontWeight: 800, fontSize: '13px', letterSpacing: '-0.01em' }}>
                Aarogya Flow
              </strong>
            </div>

            <span style={{ color: '#CBD5E1', display: 'inline-block' }}>|</span>

            <span style={{ color: '#475569', fontSize: '11.5px', fontWeight: 500 }}>
              Care closer. Healthier tomorrow.
            </span>
          </div>

          {/* Right Status, Emergency & Copyright */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11.5px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16A34A', fontWeight: 600 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#25D366', display: 'inline-block' }} />
              <span>OPD Active</span>
            </span>

            <span style={{ color: '#E2E8F0' }}>&bull;</span>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontWeight: 600 }}>
              <PhoneCall size={11} />
              <span>108 / 112</span>
            </span>

            <span style={{ color: '#E2E8F0' }}>&bull;</span>

            <span style={{ color: '#94A3B8' }}>&copy; 2026 Aarogya Flow</span>
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
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
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
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '20px 22px',
          boxShadow: '0 20px 35px rgba(0,0,0,0.15)',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/aarogya_flow_icon_transparent.png"
              alt="Aarogya Flow"
              style={{ width: '24px', height: '24px', objectFit: 'contain' }}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Aarogya Flow Platform
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.55, margin: '0 0 14px' }}>
          Aarogya Flow is a smart outpatient hospital queue automation and patient continuum platform integrated with live WhatsApp OPD token tracking and real-time appointment management.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#166534', backgroundColor: '#F0FDF4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #BBF7D0', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Care closer. Healthier tomorrow.</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            backgroundColor: '#25D366',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 14px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
