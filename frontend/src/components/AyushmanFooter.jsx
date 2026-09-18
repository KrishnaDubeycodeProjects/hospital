import React, { useState } from 'react';

export default function AyushmanFooter({ className = '', style = {}, brandFirst = false }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className={`flex flex-col items-center justify-center gap-1.5 text-center select-none ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          padding: '10px 16px 14px',
          userSelect: 'none',
          ...style,
        }}
      >
        {/* Line 1: Leaf + Brand | A rural health initiative */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          {/* Green Leaf Icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="#16a34a"
            style={{ flexShrink: 0 }}
          >
            <path d="M17 3c-4.5.5-8 4-8.5 8.5C8 10 6.5 8 3 8c0 5.5 3.5 10 9 10 0 2-1 3-2 3h4c0-2 1-4 3-6 4-4 4.5-9.5 0-12z" />
          </svg>
          {brandFirst ? (
            <span>
              <strong
                style={{ color: '#043c2c', fontWeight: '700', cursor: 'pointer' }}
                onClick={() => setShowModal(true)}
              >
                Aarogya Flow
              </strong>
              {' '}<span style={{ color: '#d1d5db', margin: '0 4px' }}>|</span> A rural health initiative
            </span>
          ) : (
            <span>
              A rural health initiative <span style={{ color: '#d1d5db', margin: '0 2px' }}>|</span> Powered by{' '}
              <strong
                style={{ color: '#043c2c', fontWeight: '700', cursor: 'pointer' }}
                onClick={() => setShowModal(true)}
              >
                Aarogya Flow
              </strong>
            </span>
          )}
        </div>

        {/* Line 2: Signal bars + Works even on low internet */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '11.5px',
            color: '#9ca3af',
          }}
        >
          {/* Green Signal Strength Bars */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="#16a34a"
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
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '24px 20px 28px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#15803d' }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#043c2c', margin: 0 }}>
                  Aarogya Flow Initiative
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
              Aarogya Flow brings seamless digital OPD queue passes, emergency tracking, and ABDM health records directly to rural clinics and community health centers — optimized to perform reliably even in low connectivity zones.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
