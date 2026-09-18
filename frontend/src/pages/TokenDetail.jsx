import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAsObjectUrl, queueApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import AyushmanFooter from '../components/AyushmanFooter';

export default function TokenDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const load = useCallback(async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const data = await queueApi.tokenDetails(id);
      setToken(data);
      if (showToast) toast.success('Queue status refreshed');
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(false), 8000);
    return () => clearInterval(interval);
  }, [load]);

  // Fetch QR Code safely as blob from backend
  useEffect(() => {
    let cancelled = false;
    let url = null;
    if (id) {
      fetchAsObjectUrl(queueApi.qrUrl(id))
        .then((objUrl) => {
          if (!cancelled) {
            url = objUrl;
            setQrUrl(objUrl);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="arogyaflow-backdrop">
        <main className="arogyaflow-phone-frame" style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <div className="spinner" />
          <div style={{ marginTop: '14px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
            Loading live token…
          </div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="arogyaflow-backdrop">
        <main className="arogyaflow-phone-frame" style={{ padding: '24px', textAlign: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Token Not Found</h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: '8px 0 24px' }}>
            This token does not exist or may have expired.
          </p>
          <button
            type="button"
            onClick={() => navigate('/find-hospital')}
            style={{
              padding: '13px 20px',
              backgroundColor: '#004D40',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Find Hospital & Book
          </button>
        </main>
      </div>
    );
  }

  // Database fields
  const tokenNum = token.dailyNumber ?? token.id ?? 1;
  const aheadCount = token.peopleAhead ?? 0;
  const hospitalName = token.hospitalName || 'Aastha Hospital';
  const departmentName = token.category || 'Cardiology';
  const patientName = token.name || token.patientName || 'Kavish Ahuja';
  const gender = token.gender
    ? token.gender.charAt(0).toUpperCase() + token.gender.slice(1).toLowerCase()
    : 'Male';
  const age = token.age || 20;

  // Status mapping
  const statusConfig = {
    waiting: {
      dotColor: '#F59E0B',
      textColor: '#E65100',
      label: 'Waiting in Queue',
    },
    serving: {
      dotColor: '#10B981',
      textColor: '#047857',
      label: 'Now Serving',
    },
    completed: {
      dotColor: '#059669',
      textColor: '#065F46',
      label: 'Completed',
    },
    missed: {
      dotColor: '#EF4444',
      textColor: '#DC2626',
      label: 'Missed Call',
    },
  };

  const status = statusConfig[token.status] || statusConfig.waiting;

  return (
    <div className="arogyaflow-backdrop">
      <main className="arogyaflow-phone-frame" style={{ position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
        {/* Top Sheet Drag Indicator Bar */}
        <div className="arogyaflow-drag-handle">
          <div className="arogyaflow-drag-bar" />
        </div>

        {/* 1. Top App Bar (Header) */}
        <header
          style={{
            padding: '12px 18px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #F1F5F9',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            flexShrink: 0,
          }}
        >
          {/* Left: Circular, light gray button with dark gray back arrow (<) */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#F1F5F9',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Center: Bold, dark text "Live Token Status" + Centered Status Indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#004D40',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              Live Token Status
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: status.dotColor,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: status.textColor,
                }}
              >
                {status.label}
              </span>
            </div>
          </div>

          {/* Right: Circular, light green button with dark green refresh icon */}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh Queue"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#E8F5E9',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              color: '#004D40',
              flexShrink: 0,
              transition: 'all 0.15s ease',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: refreshing ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.4s ease',
              }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </header>

        {/* Scrollable Main Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            backgroundColor: '#ffffff',
          }}
        >
          {/* 2. Top Metrics Section (Critical Data) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '0 2px',
            }}
          >
            {/* Left Side: Label "Token", large bold "#1", Hospital, Department */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '12.5px',
                  color: '#64748b',
                  fontWeight: '500',
                  letterSpacing: '0.01em',
                }}
              >
                Token
              </span>
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: '900',
                  color: '#004D40',
                  lineHeight: 1.05,
                  margin: '2px 0 4px',
                  letterSpacing: '-0.02em',
                }}
              >
                #{tokenNum}
              </div>
              <div
                style={{
                  fontSize: '15.5px',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                {hospitalName}
              </div>
              <div
                style={{
                  fontSize: '13.5px',
                  color: '#64748b',
                  fontWeight: '500',
                  marginTop: '1px',
                }}
              >
                {departmentName}
              </div>
            </div>

            {/* Right Side: Label "Ahead of you", large bold "0", and Details Button below it */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                minWidth: '95px',
              }}
            >
              <span
                style={{
                  fontSize: '12.5px',
                  color: '#64748b',
                  fontWeight: '500',
                  letterSpacing: '0.01em',
                }}
              >
                Ahead of you
              </span>
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: '900',
                  color: '#004D40',
                  lineHeight: 1.05,
                  margin: '2px 0 10px',
                  letterSpacing: '-0.02em',
                }}
              >
                {aheadCount}
              </div>

              {/* Details Button in between Ahead of you and QR section on the right */}
              <button
                type="button"
                onClick={() => setShowDetailsModal(true)}
                style={{
                  backgroundColor: '#E8F5E9',
                  color: '#005A43',
                  border: '1px solid #C8E6C9',
                  borderRadius: '12px',
                  padding: '6px 13px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 3px rgba(0, 77, 64, 0.08)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Details</span>
                <span style={{ fontSize: '13px', lineHeight: 1 }}>&gt;</span>
              </button>
            </div>
          </div>

          {/* 3. QR Code Section (Spacious & Clean as it was) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: '6px',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: '800',
                color: '#004D40',
                textAlign: 'center',
                margin: '0 0 14px',
                letterSpacing: '-0.01em',
              }}
            >
              Show this QR at reception
            </h2>

            {/* Centered QR code placed with fine space */}
            <div
              style={{
                width: '195px',
                height: '195px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`Token QR #${tokenNum}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    gap: '8px',
                  }}
                >
                  <div className="spinner" style={{ width: '22px', height: '22px' }} />
                  <span style={{ fontSize: '11.5px' }}>Loading QR Code…</span>
                </div>
              )}
            </div>

            <p
              style={{
                margin: '8px 0 0',
                fontSize: '12px',
                color: '#64748b',
                fontWeight: '400',
                textAlign: 'center',
              }}
            >
              Scannable by OPD Desk Counter
            </p>
          </div>
        </div>

        {/* 5. Bottom Action & Footer */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderTop: '1px solid #F1F5F9',
            padding: '14px 20px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Full-width solid dark green button: "Go to Home" with a home icon */}
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: '#005A43',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(0, 77, 64, 0.22)',
              transition: 'all 0.15s ease',
            }}
          >
            {/* White Home Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span>Go to Home</span>
          </button>
        </div>

        {/* Pinned Standard Footer */}
        <AyushmanFooter brandFirst={true} />

        {/* Modal: Full Appointment Details Sheet */}
        {showDetailsModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 90,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
            onClick={() => setShowDetailsModal(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px 20px 0 0',
                maxHeight: '82%',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.18)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag bar */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '9999px', backgroundColor: '#CBD5E1' }} />
              </div>

              {/* Modal Header */}
              <div
                style={{
                  padding: '12px 20px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Token Details
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#F1F5F9',
                    border: 'none',
                    fontSize: '14px',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content: strictly name, age, gender, hospital, department, phone */}
              <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Name</span>
                  <strong style={{ color: '#0f172a', fontSize: '15px' }}>{patientName}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Age</span>
                  <strong style={{ color: '#0f172a', fontSize: '15px' }}>{age} yrs</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Gender</span>
                  <strong style={{ color: '#0f172a', fontSize: '15px' }}>{gender}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Hospital</span>
                  <strong style={{ color: '#0f172a', fontSize: '15px', textAlign: 'right', maxWidth: '60%' }}>
                    {hospitalName}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Department</span>
                  <strong style={{ color: '#0f172a', fontSize: '15px' }}>{departmentName}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Phone</span>
                  <strong style={{ color: '#0f172a', fontSize: '15px' }}>{token.phone || '+918850934544'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
