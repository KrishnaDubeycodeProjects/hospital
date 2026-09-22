import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doctorApi, otpApi, queueApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, Input } from '../components/ui';
import AyushmanFooter from '../components/AyushmanFooter';

const TABS = [
  { key: 'patient', label: 'Patient Portal', icon: '🩺' },
  { key: 'doctor', label: 'Doctor Portal', icon: '👨‍⚕️' },
  { key: 'admin', label: 'Hospital Staff', icon: '🏥' },
];

export default function Login() {
  const { role = 'patient' } = useParams();
  const navigate = useNavigate();

  if (role === 'patient') {
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
            height: '100dvh',
            maxHeight: '100dvh',
            overflow: 'hidden',
          }}
        >
          {/* Top App Bar Header */}
          <header
            style={{
              padding: '16px 20px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #F1F5F9',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/')}
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
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <h1
              style={{
                margin: 0,
                fontSize: '19px',
                fontWeight: '800',
                color: '#004D40',
                letterSpacing: '-0.02em',
                textAlign: 'center',
              }}
            >
              Patient Sign In
            </h1>

            <button
              type="button"
              onClick={() => navigate('/login/admin')}
              title="Staff Login"
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#004D40',
                backgroundColor: '#E8F5E9',
                border: 'none',
                borderRadius: '10px',
                padding: '7px 12px',
                cursor: 'pointer',
              }}
            >
              Staff
            </button>
          </header>

          {/* Scrollable Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 20px 16px',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <OtpAuthFlow kind="patient" isMobile />
          </div>

          {/* Pinned Standard Footer */}
          <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '8px 16px 18px' }} />
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card-wrap">
        <div className="auth-header">
          <Link to="/" className="auth-back">
            ← Back to ArogyaFlow
          </Link>
          <div className="auth-brand">
            <div className="brand-mark">AF</div>
            <div>
              <div className="brand-name">ArogyaFlow</div>
              <div className="brand-sub">Smart Healthcare Access</div>
            </div>
          </div>
        </div>

        <div className="auth-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`auth-tab ${role === t.key ? 'active' : ''}`}
              onClick={() => navigate(`/login/${t.key}`)}
            >
              <span style={{ marginRight: '6px' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {role === 'admin' && <AdminLogin />}
        {role === 'patient' && <OtpAuthFlow kind="patient" />}
        {role === 'doctor' && <OtpAuthFlow kind="doctor" />}
      </div>
    </div>
  );
}

/** Staff / Admin Sign In component */
function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await queueApi.login(username, password);
      login('ADMIN', res.token);
      toast.success('Welcome back to ArogyaFlow Admin.');
      navigate('/admin');
    } catch (err) {
      toast.error(err.message || 'Invalid staff credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Hospital Staff & Admin Sign In">
      <form onSubmit={submit} className="stack-md">
        <Field label="Username or Staff ID">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin"
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>
        <Button type="submit" loading={loading} className="full-width">
          Sign In as Staff
        </Button>
      </form>
    </Card>
  );
}

/** 
 * Comprehensive Phone + OTP Authentication & Sign-Up Component
 * Supports both Sign In (Existing User) & Sign Up (New User registration)
 */
function OtpAuthFlow({ kind, isMobile = false }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [phone, setPhone] = useState('');
  const [rawDigits, setRawDigits] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [stage, setStage] = useState('phone'); // 'phone' -> 'otp' -> 'profile' (for signup)
  const [resendTimer, setResendTimer] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const cleanPhone = (val) => {
    let cleaned = val.replace(/[^\d+]/g, '');
    if (cleaned && !cleaned.startsWith('+')) {
      cleaned = '+91' + cleaned;
    }
    return cleaned;
  };

  async function handleSendOtp(e) {
    e?.preventDefault();
    const targetPhone = isMobile ? `+91${rawDigits}` : phone;
    if (!targetPhone || targetPhone.length < 12) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    const formatted = cleanPhone(targetPhone);
    setPhone(formatted);
    setSending(true);
    try {
      const res = await otpApi.send(formatted);
      toast.success(res.message || 'OTP verification code sent via SMS!');
      setStage('otp');
      setResendTimer(30);
    } catch (err) {
      toast.error(err.message || 'Failed to send OTP. Please check mobile number.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!code || code.length < 4) {
      toast.error('Please enter the 6-digit OTP code');
      return;
    }

    setVerifying(true);
    try {
      const res = await otpApi.verify(phone, code);
      
      if (kind === 'patient') {
        login('PATIENT', res.token);
        toast.success('Authentication successful! Welcome to ArogyaFlow.');
        navigate('/patient');
        return;
      }

      // Doctor flow
      if (mode === 'login') {
        try {
          const docRes = await doctorApi.login(phone);
          login('DOCTOR', docRes.token);
          toast.success(docRes.message || 'Welcome back, Doctor!');
          navigate('/doctor');
        } catch (err) {
          // If login fails because doctor isn't registered, prompt to complete registration
          toast.info('No existing doctor account found with this number. Please complete registration below.');
          setMode('signup');
          setStage('profile');
        }
      } else {
        // Sign up mode for doctor
        setStage('profile');
      }
    } catch (err) {
      toast.error(err.message || 'Invalid or expired OTP code');
    } finally {
      setVerifying(false);
    }
  }

  async function handleDoctorRegister(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setVerifying(true);
    try {
      const res = await doctorApi.register(name.trim(), phone);
      login('DOCTOR', res.token);
      toast.success(res.message || 'Doctor account created successfully!');
      navigate('/doctor');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setVerifying(false);
    }
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {stage === 'phone' && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#004D40',
                  backgroundColor: '#E8F5E9',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  display: 'inline-block',
                  marginBottom: '8px',
                }}
              >
                Patient Verification
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Enter Mobile Number
              </h2>
              <p style={{ fontSize: '13.5px', color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                Enter the mobile number linked with your hospital tokens, family ABHA cards, and health records.
              </p>
            </div>

            {/* Mobile number input field with +91 prefix and phone icon */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Mobile Number
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '52px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '0 14px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#111827', marginRight: '8px' }}>
                  +91
                </span>
                <span style={{ color: '#CBD5E1', marginRight: '10px' }}>|</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={rawDigits}
                  onChange={(e) => setRawDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Submit button: turns active dark green when 10 digits entered */}
            <button
              type="submit"
              disabled={rawDigits.length !== 10 || sending}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: rawDigits.length === 10 ? '#004D40' : '#E2E8F0',
                color: rawDigits.length === 10 ? '#ffffff' : '#94A3B8',
                fontSize: '15.5px',
                fontWeight: '700',
                border: 'none',
                cursor: rawDigits.length === 10 && !sending ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px',
              }}
            >
              {sending ? 'Sending OTP…' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {stage === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#004D40',
                  backgroundColor: '#E8F5E9',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  display: 'inline-block',
                  marginBottom: '8px',
                }}
              >
                OTP Verification
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Enter OTP Code
              </h2>
              <p style={{ fontSize: '13.5px', color: '#6B7280', margin: 0 }}>
                We sent a 6-digit code to <strong style={{ color: '#111827' }}>{phone}</strong>
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                6-Digit Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                autoFocus
                style={{
                  width: '100%',
                  height: '52px',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '12px',
                  textAlign: 'center',
                  fontSize: '22px',
                  letterSpacing: '0.3em',
                  fontWeight: '800',
                  color: '#004D40',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={code.length < 4 || verifying}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: code.length >= 4 ? '#004D40' : '#E2E8F0',
                color: code.length >= 4 ? '#ffffff' : '#94A3B8',
                fontSize: '15.5px',
                fontWeight: '700',
                border: 'none',
                cursor: code.length >= 4 && !verifying ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              {verifying ? 'Verifying…' : 'Verify & Enter Portal'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setStage('phone')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#004D40',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ← Change Number
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || sending}
                onClick={handleSendOtp}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendTimer > 0 ? '#94A3B8' : '#004D40',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: resendTimer > 0 ? 'default' : 'pointer',
                  padding: 0,
                }}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <Card
      title={
        kind === 'patient'
          ? mode === 'login'
            ? 'Patient Sign In'
            : 'Patient Quick Sign Up'
          : mode === 'login'
          ? 'Doctor Sign In'
          : 'Doctor Registration'
      }
      extra={
        <span className="badge badge-blue">
          📲 SMS OTP
        </span>
      }
    >
      {/* Mode Switcher: Sign In vs Sign Up */}
      <div className="auth-mode-toggle">
        <button
          className={`auth-mode-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setMode('login');
            setStage('phone');
          }}
        >
          🔑 Sign In
        </button>
        <button
          className={`auth-mode-btn ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => {
            setMode('signup');
            setStage('phone');
          }}
        >
          ✨ New User Sign Up
        </button>
      </div>

      {/* Stepper visual guide */}
      <div className="auth-stepper">
        <div className={`step-dot ${stage === 'phone' ? 'active' : 'completed'}`}>1. Mobile</div>
        <div className="step-line" />
        <div className={`step-dot ${stage === 'otp' ? 'active' : stage === 'profile' ? 'completed' : ''}`}>2. OTP Code</div>
        {stage === 'profile' && (
          <>
            <div className="step-line" />
            <div className="step-dot active">3. Profile</div>
          </>
        )}
      </div>

      {/* STEP 1: Phone input */}
      {stage === 'phone' && (
        <form onSubmit={handleSendOtp} className="stack-md">
          <p className="muted-text">
            {mode === 'login'
              ? 'Enter your mobile number to receive a secure 6-digit SMS OTP.'
              : 'Sign up in seconds! Enter your mobile number to get started.'}
          </p>
          <Field label="Mobile Phone Number" hint="Default format: +91 9876543210">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              required
              autoFocus
            />
          </Field>

          <Button type="submit" loading={sending} className="full-width">
            Send SMS Verification Code
          </Button>

          <div className="auth-help-hint">
            🔒 Safe & Secure. We will send an instant code via SMS.
          </div>
        </form>
      )}

      {/* STEP 2: OTP Verification input */}
      {stage === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="stack-md">
          <div className="callout callout-ok" style={{ marginTop: 0 }}>
            📲 Code sent to <strong>{phone}</strong>
          </div>
          
          <Field label="Enter 6-Digit OTP Code">
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 123456"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              style={{ fontSize: '20px', letterSpacing: '0.2em', textAlign: 'center' }}
            />
          </Field>

          <div className="row-gap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="submit" loading={verifying}>
              Verify & Proceed
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={resendTimer > 0 || sending}
              onClick={handleSendOtp}
            >
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend Code'}
            </Button>
          </div>

          <button
            type="button"
            className="auth-link-btn"
            onClick={() => setStage('phone')}
          >
            ← Change phone number
          </button>
        </form>
      )}

      {/* STEP 3: Complete Doctor Registration Profile */}
      {stage === 'profile' && kind === 'doctor' && (
        <form onSubmit={handleDoctorRegister} className="stack-md">
          <p className="muted-text">Phone verified! Complete your doctor profile to register.</p>
          <Field label="Full Name with Title">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Rajesh Kumar"
              required
              autoFocus
            />
          </Field>

          <div className="row-gap">
            <Button type="submit" loading={verifying} className="full-width">
              Create Doctor Account
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
