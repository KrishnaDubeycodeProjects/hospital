import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { queueApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cleanPhone } from '../utils/helpers';
import AyushmanFooter from '../components/AyushmanFooter';

function extract10Digits(input) {
  if (!input) return '';
  const digits = String(input).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export default function Track() {
  const params = useParams();
  const { patient } = useAuth();
  const navigate = useNavigate();

  const savedPhone = localStorage.getItem('last_tracked_phone') || '8850934544';
  const initialRaw = params.phone || patient?.subject || savedPhone;

  const [phoneDigits, setPhoneDigits] = useState(() => extract10Digits(initialRaw));
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const isEligible = phoneDigits.trim().length === 10;

  useEffect(() => {
    if (params.phone) {
      handleLookup(params.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.phone]);

  async function handleLookup(p = phoneDigits) {
    const cleaned = cleanPhone(p);
    if (!cleaned || cleaned.replace(/\D/g, '').length < 10) return;
    setLoading(true);
    setNotFound(false);
    localStorage.setItem('last_tracked_phone', cleaned);
    try {
      const data = await queueApi.position(cleaned);
      if (data && data.id) {
        navigate(`/token/${data.id}`);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (isEligible) {
      handleLookup(phoneDigits.trim());
    }
  }

  return (
    <div className="arogyaflow-backdrop">
      <main
        className="arogyaflow-phone-frame"
        style={{
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        {/* Top Sheet Drag Indicator Bar */}
        <div className="arogyaflow-drag-handle">
          <div className="arogyaflow-drag-bar" />
        </div>

        {/* 1. Top Section (Header & Typography) */}
        <div
          style={{
            padding: '16px 20px 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top Left: Circular, light gray button with a dark gray back arrow (<) */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#F1F5F9',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#0f172a',
              transition: 'background-color 0.15s ease',
              marginBottom: '26px',
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          {/* Above the title: Small, bold green text "Track My Turn" */}
          <div
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: '#00684A',
              marginBottom: '6px',
              letterSpacing: '-0.01em',
            }}
          >
            Track My Turn
          </div>

          {/* Main Title: Large, bold, dark text "Check Your Token Status" */}
          <h1
            style={{
              fontSize: '32px',
              fontWeight: '900',
              color: '#0f172a',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              margin: '0 0 12px',
            }}
          >
            Check Your Token Status
          </h1>

          {/* Subtitle: Regular, gray text */}
          <p
            style={{
              fontSize: '16px',
              color: '#64748b',
              lineHeight: 1.45,
              margin: '0 0 32px',
            }}
          >
            Enter the mobile number used to get your hospital token.
          </p>

          {/* 2. Mobile Number Input Field */}
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {/* Section Label: Bold, dark text "Mobile Number" */}
            <label
              htmlFor="mobile-input"
              style={{
                display: 'block',
                fontSize: '16.5px',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '10px',
                letterSpacing: '-0.01em',
              }}
            >
              Mobile Number
            </label>

            {/* Input Box: Full-width, clean input field with subtle light gray border and rounded corners (12px) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '13px 16px',
                borderRadius: '12px',
                border: isFocused ? '1.5px solid #00684A' : '1.5px solid #CBD5E1',
                backgroundColor: '#ffffff',
                boxShadow: isFocused ? '0 0 0 3px rgba(0, 104, 74, 0.1)' : 'none',
                transition: 'all 0.15s ease',
                marginBottom: '20px',
              }}
            >
              {/* Left side: Clear, dark gray SVG phone/call icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ color: '#1e293b', flexShrink: 0 }}
              >
                <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.72 11.72 0 0 0 3.66.59 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.66 1 1 0 0 1-.24 1.02l-2.23 2.11z" />
              </svg>

              {/* Prefix: The country code +91 pre-filled and non-editable */}
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#0f172a',
                  userSelect: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                +91
              </span>

              {/* User typed 10-digit number */}
              <input
                id="mobile-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Enter 10-digit number"
                value={phoneDigits}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhoneDigits(val);
                  if (notFound) setNotFound(false);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#0f172a',
                  letterSpacing: '0.02em',
                  backgroundColor: 'transparent',
                  padding: 0,
                }}
                required
              />
            </div>

            {/* 3. Action Button: Transitions to solid green when 10 numbers are entered, otherwise unclicked background */}
            <button
              type="submit"
              disabled={!isEligible || loading}
              style={{
                width: '100%',
                padding: '15px 20px',
                borderRadius: '12px',
                backgroundColor: isEligible ? '#00684A' : '#E2E8F0',
                color: isEligible ? '#ffffff' : '#94A3B8',
                fontSize: '17px',
                fontWeight: '700',
                border: 'none',
                cursor: isEligible ? (loading ? 'wait' : 'pointer') : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: isEligible ? '0 4px 14px rgba(0, 104, 74, 0.22)' : 'none',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <div
                  className="spinner"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderColor: '#ffffff',
                    borderTopColor: 'transparent',
                  }}
                />
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isEligible ? '#ffffff' : '#94A3B8'}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
              <span>{loading ? 'Checking status…' : 'Check Status'}</span>
            </button>
          </form>

          {/* Not Found Feedback Card */}
          {notFound && (
            <div
              style={{
                marginTop: '18px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>🎟️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#991B1B' }}>
                  No Active Token Found
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#7F1D1D',
                    marginTop: '2px',
                    lineHeight: 1.4,
                  }}
                >
                  No active token found for +91 {phoneDigits} today. Please check the number or book a new token.
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/find-hospital')}
                  style={{
                    marginTop: '10px',
                    padding: '8px 14px',
                    backgroundColor: '#00684A',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Book OPD Token Now →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Bottom Section: Ample empty white space, then pinned footer */}
        <div style={{ flex: 1, minHeight: '80px' }} />

        <AyushmanFooter brandFirst={true} />
      </main>
    </div>
  );
}
