import React, { useEffect, useState } from 'react';
import { ExternalLink, Smartphone, Globe, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const EXPO_INSTALL_URL = 'https://expo.dev/accounts/krishnacomp/projects/aarogya-flow/builds/3909839b-0b68-41d2-8905-0befe2a7f4fc';
const EXPO_WEB_URL = 'https://dist-beta-lemon-24.vercel.app';

export default function AshaApp() {
  const [countdown, setCountdown] = useState(3);
  const [autoRedirect, setAutoRedirect] = useState(true);

  // Auto-redirect to Expo app
  useEffect(() => {
    if (!autoRedirect) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      window.location.href = EXPO_WEB_URL;
    }
  }, [countdown, autoRedirect]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Return to Hospital Portal Button */}
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#94A3B8',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>Hospital Portal</span>
        </Link>
      </div>

      {/* Main Redirection Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#1E293B',
          borderRadius: '20px',
          padding: '36px 28px',
          border: '1px solid #334155',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo Badge with Aura */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            padding: '10px',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
            border: '3px solid #10B981',
          }}
        >
          <img
            src="/aarogya_flow_icon_transparent_hd.png"
            alt="Aarogya Flow Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/aarogya_flow_icon_transparent.png';
            }}
          />
        </div>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: '800',
            color: '#FFFFFF',
            margin: '0 0 6px',
            letterSpacing: '-0.02em',
          }}
        >
          आरोग्य प्रवाह • AarogyaFlow
        </h1>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#064E3B',
            color: '#34D399',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '700',
            marginBottom: '16px',
          }}
        >
          <ShieldCheck size={14} />
          <span>राष्ट्रीय स्वास्थ्य मिशन (NHM) ASHA Portal</span>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: '#94A3B8',
            lineHeight: 1.6,
            margin: '0 0 24px',
          }}
        >
          आशा कार्यकर्ता, एएनएम और सीएचओ के लिए समर्पित मोबाइल वर्कस्पेस पर रीडायरेक्ट किया जा रहा है...
        </p>

        {/* Countdown Badge */}
        {autoRedirect && (
          <div
            style={{
              marginBottom: '24px',
              padding: '8px 16px',
              borderRadius: '12px',
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              fontSize: '13px',
              color: '#38BDF8',
              fontWeight: '600',
            }}
          >
            स्वचालित रीडायरेक्शन: {countdown} सेकंड में...
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Primary: Open Live Web App */}
          <a
            href={EXPO_WEB_URL}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '14px 20px',
              backgroundColor: '#10B981',
              color: '#064E3B',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '15px',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Globe size={18} />
            <span>Open ASHA Web App Now</span>
            <ExternalLink size={16} />
          </a>

          {/* Secondary: Install Android APK via Expo EAS */}
          <a
            href={EXPO_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAutoRedirect(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '14px 20px',
              backgroundColor: '#334155',
              color: '#F8FAFC',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              textDecoration: 'none',
              border: '1px solid #475569',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Smartphone size={18} color="#38BDF8" />
            <span>Install Standalone Android APK (Expo EAS)</span>
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Feature List */}
        <div
          style={{
            marginTop: '28px',
            width: '100%',
            borderTop: '1px solid #334155',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#CBD5E1' }}>
            <CheckCircle2 size={14} color="#10B981" />
            <span>100% ऑफ़लाइन डेटा सिंकिंग (Zero-Internet Survey & Sync)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#CBD5E1' }}>
            <CheckCircle2 size={14} color="#10B981" />
            <span>सीएचओ द्वारा अनुमोदित मोबाइल लॉगिन (Phone + OTP)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#CBD5E1' }}>
            <CheckCircle2 size={14} color="#10B981" />
            <span>एनएचएम प्रशिक्षण मॉड्यूल (NHM Training Curriculum)</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div style={{ marginTop: '24px', fontSize: '12px', color: '#64748B' }}>
        राष्ट्रीय स्वास्थ्य मिशन • आयुष्मान भारत डिजिटल मिशन (ABDM)
      </div>
    </div>
  );
}
