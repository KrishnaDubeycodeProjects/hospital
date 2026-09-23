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
  const tokenCode = token.tokenCode || (token.dailyNumber != null ? `AF-${String(token.dailyNumber).padStart(2, '0')}` : `#${token.id || 1}`);
  const aheadCount = token.status === 'serving' ? 0 : (token.peopleAhead ?? (token.queuePosition != null ? Math.max(0, token.queuePosition - 1) : 0));
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
      dotColor: '#3B82F6',
      textColor: '#1D4ED8',
      label: 'Waiting in Queue',
    },
    reserved: {
      dotColor: '#F59E0B',
      textColor: '#B45309',
      label: 'En Route (Buffer Active)',
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
      <main
        className="arogyaflow-phone-frame"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          justifyContent: 'space-between',
        }}
      >
        {/* Top App Bar (Header) */}
        <header
          style={{
            padding: '16px 20px 8px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            {/* Left: Circular light gray button with dark gray back arrow (<) */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              style={{
                width: '42px',
                height: '42px',
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Center: Bold, dark text "Live Token Status" */}
            <h1
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '800',
                color: '#004D40',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              Live Token Status
            </h1>

            {/* Right: Circular light green button with dark green refresh icon */}
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh Queue"
              style={{
                width: '42px',
                height: '42px',
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
                width="19"
                height="19"
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
          </div>

          {/* Below the header: Centered status indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '6px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: status.dotColor,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: status.textColor,
                letterSpacing: '-0.01em',
              }}
            >
              {status.label}
            </span>
          </div>
        </header>

        {/* Scrollable / Flexible Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 24px 8px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            backgroundColor: '#ffffff',
          }}
        >
          {/* 2. Top Metrics Section: Hero metric is 'Ahead of You', Token code in right card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '4px 0 8px',
            }}
          >
            {/* Left Column: Hero Spotlight Metric: Ahead of You */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '13px',
                  color: '#065F46',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {token.status === 'serving' ? 'Current Turn' : 'Ahead of You'}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '2px 0 6px' }}>
                <span
                  style={{
                    fontSize: token.status === 'serving' ? '44px' : '56px',
                    fontWeight: '900',
                    color: '#004D40',
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {token.status === 'serving' ? 'NOW' : aheadCount}
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#065F46',
                  }}
                >
                  {token.status === 'serving' ? 'Serving' : (aheadCount === 1 ? 'patient' : 'patients')}
                </span>
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '800',
                  color: '#111827',
                  letterSpacing: '-0.01em',
                }}
              >
                {hospitalName}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  fontWeight: '500',
                  marginTop: '1px',
                }}
              >
                {departmentName}
              </div>
            </div>

            {/* Right Column: Dynamic Token Code Card with Reception Check-in Status */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 14px',
                backgroundColor: '#F8FBF9',
                border: '2px solid #DAEAE3',
                borderRadius: '16px',
                minWidth: '120px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                Token Code
              </span>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: '900',
                  color: '#004D40',
                  margin: '3px 0 4px',
                  letterSpacing: '-0.02em',
                }}
              >
                {tokenCode}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: token.isVerified ? '#DCFCE7' : (token.status === 'reserved' ? '#FEF3C7' : '#F1F5F9'),
                  color: token.isVerified ? '#15803D' : (token.status === 'reserved' ? '#92400E' : '#475569'),
                  whiteSpace: 'nowrap',
                }}
              >
                {token.isVerified ? 'Checked In ✅' : (token.status === 'reserved' ? 'Buffer Active ⏳' : 'Pending Check-in')}
              </span>
            </div>
          </div>

          {/* 3. QR Code Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              margin: '8px 0',
            }}
          >
            <h2
              style={{
                fontSize: '17px',
                fontWeight: '800',
                color: '#004D40',
                textAlign: 'center',
                margin: '0 0 16px',
                letterSpacing: '-0.01em',
              }}
            >
              Show this QR at reception
            </h2>

            {/* Large sharp QR code on clean white background */}
            <div
              style={{
                width: '215px',
                height: '215px',
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
                    imageRendering: 'pixelated',
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
                    color: '#94A3B8',
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
                margin: '12px 0 0',
                fontSize: '12.5px',
                color: '#6B7280',
                fontWeight: '400',
                textAlign: 'center',
              }}
            >
              Scannable by OPD Desk Counter
            </p>
          </div>

          {/* 4. Patient Details Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0 10px',
            }}
          >
            {/* Left: Avatar + Center Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Circular avatar with light green background & dark green person icon */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: '#E8F5E9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="#004D40"
                >
                  <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>

              {/* Center: Patient name + demographics */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: '#111827',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {patientName}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    fontWeight: '500',
                    marginTop: '2px',
                  }}
                >
                  {gender}, {age} years
                </span>
              </div>
            </div>

            {/* Right: Button with light green background and dark green text "Details >" */}
            <button
              type="button"
              onClick={() => setShowDetailsModal(true)}
              style={{
                backgroundColor: '#E8F5E9',
                color: '#004D40',
                border: 'none',
                borderRadius: '12px',
                padding: '9px 16px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Details</span>
              <span style={{ fontSize: '14px', lineHeight: 1 }}>&gt;</span>
            </button>
          </div>
        </div>

        {/* Pinned Standard Footer */}
        <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '8px 16px 18px' }} />

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
                  <span style={{ color: '#64748b' }}>Token Code</span>
                  <strong style={{ color: '#004D40', fontSize: '16px', fontWeight: '800' }}>{tokenCode}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>Check-in Status</span>
                  <strong style={{ color: token.isVerified ? '#15803D' : (token.status === 'reserved' ? '#92400E' : '#475569'), fontSize: '14px' }}>
                    {token.isVerified ? 'Checked In ✅' : (token.status === 'reserved' ? 'Buffer Active ⏳' : 'Pending Check-in')}
                  </strong>
                </div>

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
