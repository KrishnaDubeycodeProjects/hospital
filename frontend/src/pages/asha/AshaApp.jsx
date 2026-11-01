import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Download, Smartphone, ArrowLeft, Activity, ShieldCheck, HeartPulse, Building2, CheckCircle2 } from 'lucide-react';
import AshaFieldWorkerApp from '../admin/AshaFieldWorkerApp';

export default function AshaApp() {
  const navigate = useNavigate();

  const handleDownloadApk = () => {
    // Initiate direct download of the APK file
    const link = document.createElement('a');
    link.href = '/downloads/aarogya-flow-asha.apk';
    link.setAttribute('download', 'AarogyaFlow-ASHA-v1.0.apk');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* 1. TOP DEDICATED APP HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: '#064e3b',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          borderBottom: '2px solid #059669',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Brand info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#a7f3d0',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '600',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                transition: 'background-color 0.15s ease',
              }}
              title="Return to Aarogya Flow Hospital Portal"
            >
              <ArrowLeft size={16} />
              <span>Hospital Portal</span>
            </Link>

            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
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

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Aarogya Flow
                </span>
                <span
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  ASHA Field App
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#a7f3d0' }}>
                राष्ट्रीय स्वास्थ्य मिशन • सामुदायिक स्वास्थ्य कार्यकर्ता मॉड्यूल
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Download APK Button */}
            <a
              href="/downloads/aarogya-flow-asha.apk"
              download="AarogyaFlow-ASHA-v1.0.apk"
              onClick={(e) => {
                // If direct link works, allow native download; also trigger programmatic helper
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: '#fbbf24',
                color: '#78350f',
                fontWeight: '800',
                fontSize: '13px',
                borderRadius: '10px',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(251, 191, 36, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Smartphone size={16} />
              <span>Download Android APK (.apk)</span>
              <Download size={14} />
            </a>

            {/* CHO Dashboard Link */}
            <button
              type="button"
              onClick={() => navigate('/asha-dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                fontWeight: '700',
                fontSize: '12px',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              <Building2 size={14} />
              <span>CHO Dashboard (सीएचओ)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. PERSISTENT APK DOWNLOAD NOTIFICATION BANNER */}
      <div
        style={{
          backgroundColor: '#fef3c7',
          borderBottom: '1px solid #fde68a',
          padding: '10px 16px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#fde68a',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Smartphone size={18} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#92400e' }}>
                Offline Android App (.apk) Ready for Mobile Field Visits
              </div>
              <div style={{ fontSize: '11px', color: '#b45309' }}>
                Install on Android phones for zero-internet household surveys, maternal visit scheduling, and offline ANM QR data transmission.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href="/downloads/aarogya-flow-asha.apk"
              download="AarogyaFlow-ASHA-v1.0.apk"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#d97706',
                color: '#ffffff',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Download size={13} />
              <span>Direct Download (.apk)</span>
            </a>
          </div>
        </div>
      </div>

      {/* 3. MAIN ASHA FIELD WORKER CONTENT CONTAINER */}
      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          padding: '16px',
          flex: 1,
        }}
      >
        <AshaFieldWorkerApp onSwitchRole={() => navigate('/asha-dashboard')} />
      </main>

      {/* 4. FOOTER */}
      <footer
        style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '20px 16px',
          marginTop: 'auto',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontWeight: '700', fontSize: '13px' }}>
            <ShieldCheck size={16} />
            <span>Ayushman Bharat Digital Mission (ABDM) • Comprehensive Primary Health Care (CPHC)</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Aarogya Flow ASHA Field Platform • Offline Encrypted Storage • Android APK v1.0.0
          </div>
        </div>
      </footer>
    </div>
  );
}
