import React, { useState } from 'react';

export default function AyushmanFooter({ className = '', style = {}, brandFirst = true, variant = 'default' }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <footer
        className={`ayushman-footer ${className}`}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 16px 20px',
          userSelect: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            backgroundColor: '#ffffff',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '10px 22px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            maxWidth: '92%',
          }}
        >
          {/* Line 1: Official Emblem + Brand Name | A rural health initiative */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              fontSize: '12.5px',
              color: '#334155',
            }}
          >
            <img
              src="/aarogya_flow_icon_transparent.png"
              alt="Aarogya Flow"
              style={{ width: '16px', height: '16px', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <strong
              style={{ color: '#043C2C', fontWeight: '800', cursor: 'pointer', letterSpacing: '-0.01em' }}
              onClick={() => setShowModal(true)}
            >
              Aarogya Flow
            </strong>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>A rural health initiative</span>
          </div>

          {/* Line 2: Signal strength + Works even on low internet */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: '#15803D',
              fontWeight: 600,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="#16A34A"
              style={{ flexShrink: 0 }}
            >
              <rect x="2" y="16" width="3.5" height="6" rx="1" />
              <rect x="7.5" y="12" width="3.5" height="10" rx="1" />
              <rect x="13" y="8" width="3.5" height="14" rx="1" />
              <rect x="18.5" y="4" width="3.5" height="18" rx="1" />
            </svg>
            <span>Works even on low internet</span>
          </div>
        </div>
      </footer>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '24px 22px 28px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/aarogya_flow_icon_transparent.png"
                  alt="Aarogya Flow"
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#043C2C', margin: 0 }}>
                  Aarogya Flow Initiative
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  fontSize: '15px',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              Aarogya Flow brings zero-wait digital OPD queue passes, emergency tracking, and ABDM Ayushman health records directly to rural clinics, community health centers, and district hospitals — optimized to perform reliably even in low connectivity zones.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
