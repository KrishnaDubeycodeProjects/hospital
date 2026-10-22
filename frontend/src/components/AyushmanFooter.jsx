import React, { useState } from 'react';

export default function AyushmanFooter({ className = '', style = {}, brandFirst = true, variant = 'default' }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <footer
        className={`ayushman-footer ${className}`}
        style={{
          width: '100%',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: 'transparent',
          padding: '16px 20px',
          userSelect: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Brand & Rural Health Initiative */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#334155',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                border: '1px solid #E2E8F0',
                flexShrink: 0,
              }}
            >
              <img
                src="/aarogya_flow_icon_transparent_hd.png"
                alt="Aarogya Flow"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/aarogya_flow_icon_transparent.png';
                }}
              />
            </div>
            <strong
              style={{ color: '#043C2C', fontWeight: '800', cursor: 'pointer', letterSpacing: '-0.01em' }}
              onClick={() => setShowModal(true)}
            >
              Aarogya Flow
            </strong>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>Ayushman Bharat Rural &amp; ABDM Initiative</span>
          </div>

          {/* Low internet & offline indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#15803D',
              fontWeight: 600,
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              padding: '4px 12px',
              borderRadius: '20px',
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
            <span>Works even on low internet (2G / Offline Ready)</span>
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
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #E2E8F0',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/aarogya_flow_icon_transparent_hd.png"
                    alt="Aarogya Flow"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/aarogya_flow_icon_transparent.png';
                    }}
                  />
                </div>
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
