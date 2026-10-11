import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doctorApi, otpApi, queueApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, Input } from '../components/ui';
import AyushmanFooter from '../components/AyushmanFooter';
import { Stethoscope, UserCheck, Building2, KeyRound, ShieldCheck, Sparkles, Phone, CheckCircle2, Users } from 'lucide-react';
import { WhatsAppIcon } from '../components/Icons';

const TABS = [
  { key: 'patient', label: 'Patient Portal', icon: UserCheck },
  { key: 'doctor', label: 'Doctor Portal', icon: Stethoscope },
  { key: 'admin', label: 'Hospital Staff', icon: Building2 },
  { key: 'asha', label: 'ASHA Worker', icon: Users },
];

export default function Login() {
  const { role = 'patient' } = useParams();
  const navigate = useNavigate();

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div className="auth-card-wrap" style={{ width: '100%', maxWidth: '520px' }}>
          <div className="auth-header">
            <Link to="/" className="auth-back">
              ← Back to Arogya Flow
            </Link>
            <div className="auth-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src="/aarogya_flow_icon_transparent.png"
                alt="Aarogya Flow"
                style={{ width: '44px', height: '44px', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <div className="brand-name" style={{ color: '#185a44', fontWeight: 800, fontSize: '20px' }}>
                  Aarogya Flow
                </div>
                <div className="brand-sub" style={{ color: '#4b5d54', fontSize: '12px', fontWeight: 500 }}>
                  Care Closer. Healthier Tomorrow.
                </div>
              </div>
            </div>
          </div>

          <div className="auth-tabs" style={{ marginBottom: '14px' }}>
            {TABS.map((t) => {
              const IconComp = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`auth-tab ${role === t.key ? 'active' : ''}`}
                  onClick={() => navigate(`/login/${t.key}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <IconComp size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick link to ASHA Worker Portal */}
          <div style={{ marginBottom: '18px', textAlign: 'center' }}>
            <Link
              to="/asha"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#DCFCE7',
                border: '1px solid #86EFAC',
                color: '#15803D',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                textDecoration: 'none',
              }}
            >
              <span>🌿 Looking for ASHA Worker Hub? Open ASHA App &rarr;</span>
            </Link>
          </div>

          {role === 'admin' && <AdminLogin />}
          {role === 'patient' && <OtpAuthFlow kind="patient" />}
          {role === 'doctor' && <OtpAuthFlow kind="doctor" />}
          {role === 'asha' && <AshaLoginFlow />}
        </div>
      </div>
      <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#ffffff' }} />
    </div>
  );
}

/** Dedicated ASHA Worker & Community Health Officer Flow */
function AshaLoginFlow() {
  const navigate = useNavigate();

  return (
    <Card className="stack-lg">
      <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 4px 12px rgba(21, 128, 61, 0.15)',
          }}
        >
          <Users size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#15803D', margin: '0 0 6px' }}>
          ASHA &amp; CHO Community Hub
        </h2>
        <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
          Household village surveys, maternal HRP tracking, offline rural care sync, and remote CHO teleconsultation reviews.
        </p>
      </div>

      <div
        style={{
          backgroundColor: '#F0FDF4',
          border: '1.5px solid #86EFAC',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: '700', fontSize: '13.5px' }}>
          <ShieldCheck size={16} />
          <span>Accredited Healthcare Worker Console</span>
        </div>
        <div style={{ fontSize: '12.5px', color: '#15803D', lineHeight: 1.5 }}>
          Authorized for ASHA Workers, ANMs, and Community Health Officers (CHOs). No complex passwords required.
        </div>
      </div>

      <Button
        type="button"
        className="full-width"
        onClick={() => navigate('/asha')}
        style={{
          backgroundColor: '#15803D',
          color: '#ffffff',
          fontWeight: '700',
          padding: '13px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(21, 128, 61, 0.25)',
          cursor: 'pointer',
        }}
      >
        <Sparkles size={16} />
        <span>Open ASHA &amp; CHO Workspace &rarr;</span>
      </Button>
    </Card>
  );
}

/** Staff / Admin Sign In component */
function AdminLogin() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
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
      {/* Authorized Admin Credentials Box */}
      <div
        style={{
          backgroundColor: '#F0FDF4',
          border: '1.5px solid #86EFAC',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={15} color="#15803D" />
            Authorized Admin Credentials
          </span>
          <span style={{ fontSize: '10.5px', fontWeight: '700', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px' }}>
            ACTIVE
          </span>
        </div>
        <div style={{ fontSize: '12.5px', color: '#15803D', lineHeight: 1.5 }}>
          Username: <code style={{ backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: '#065F46' }}>admin</code> &bull; Password: <code style={{ backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: '#065F46' }}>admin123</code>
        </div>
        <button
          type="button"
          onClick={() => {
            setUsername('admin');
            setPassword('admin123');
            toast.info('Admin credentials auto-filled.');
          }}
          style={{
            marginTop: '8px',
            width: '100%',
            backgroundColor: '#16A34A',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={14} />
          Auto-Fill Staff Credentials
        </button>
      </div>

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
 * Supports both Sign In & Sign Up with 1-click Test Environment Auto-Fill
 */
function OtpAuthFlow({ kind }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [phoneDigits, setPhoneDigits] = useState(kind === 'doctor' ? '9888877777' : '9100000099');
  const [code, setCode] = useState('');
  const [displayedOtp, setDisplayedOtp] = useState('');
  const [name, setName] = useState('');
  const [stage, setStage] = useState('phone'); // 'phone' -> 'otp' -> 'profile' (for signup)
  const [resendTimer, setResendTimer] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const fullPhone = '+91' + phoneDigits;

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  async function handleSendOtp(e) {
    e?.preventDefault();
    if (!phoneDigits || phoneDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setSending(true);
    try {
      const res = await otpApi.send(fullPhone);
      const codeReceived = res?.otp || res?.data?.otp || (typeof res?.message === 'string' && res.message.match(/\b\d{6}\b/) ? res.message.match(/\b\d{6}\b/)[0] : '123456');
      setDisplayedOtp(codeReceived || '123456');
      toast.success(res?.message || 'OTP verification code sent via WhatsApp & SMS!');
      setStage('otp');
      setResendTimer(30);
    } catch (err) {
      // Dev mode fallback
      setDisplayedOtp('123456');
      setStage('otp');
      toast.info('OTP code dispatched (Code: 123456)');
      setResendTimer(30);
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
      const res = await otpApi.verify(fullPhone, code);
      
      if (kind === 'patient') {
        login('PATIENT', res.token);
        toast.success('Authentication successful! Welcome to ArogyaFlow.');
        navigate('/patient');
        return;
      }

      // Doctor flow
      if (mode === 'login') {
        try {
          const docRes = await doctorApi.login(fullPhone);
          login('DOCTOR', docRes.token);
          toast.success(docRes.message || 'Welcome back, Doctor!');
          navigate('/doctor/consultation');
        } catch (err) {
          toast.info('No existing doctor account found with this number. Please complete registration below.');
          setMode('signup');
          setStage('profile');
        }
      } else {
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
      const res = await doctorApi.register(name.trim(), fullPhone);
      login('DOCTOR', res.token);
      toast.success(res.message || 'Doctor account created successfully!');
      navigate('/doctor/consultation');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setVerifying(false);
    }
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
        <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <WhatsAppIcon size={14} color="#15803D" />
          <span>WhatsApp &amp; SMS OTP</span>
        </span>
      }
    >
      {/* 🧪 Demo / Test User Card */}
      {stage === 'phone' && (
        <div
          style={{
            marginBottom: '18px',
            padding: '14px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '10px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#15803D" />
              {kind === 'doctor' ? 'Demo Doctor Credentials' : 'Demo Patient Credentials'}
            </span>
            <span style={{ fontSize: '11px', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 7px', borderRadius: '4px', fontWeight: '700' }}>
              ONE-CLICK
            </span>
          </div>
          <div style={{ color: '#15803D', fontSize: '12.5px', marginBottom: '10px', lineHeight: '1.4' }}>
            {kind === 'doctor' ? (
              <>
                <strong>Dr. Rajesh Sharma</strong> &bull; General Medicine<br />
                Phone: <code style={{ background: '#DCFCE7', padding: '1px 5px', borderRadius: '3px' }}>+91 98888 77777</code> &bull; OTP: <code>123456</code>
              </>
            ) : (
              <>
                <strong>Ramesh Kumar</strong> &bull; Ayushman ABHA Linked<br />
                Phone: <code style={{ background: '#DCFCE7', padding: '1px 5px', borderRadius: '3px' }}>+91 91000 00099</code> &bull; OTP: <code>123456</code>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (kind === 'doctor') {
                setPhoneDigits('9888877777');
                setCode('123456');
                setDisplayedOtp('123456');
                setStage('otp');
                toast.success('Auto-filling Doctor credentials...');
                try {
                  const res = await otpApi.verify('+919888877777', '123456');
                  const docRes = await doctorApi.login('+919888877777');
                  login('DOCTOR', docRes.token);
                  toast.success('Logged in as Dr. Rajesh Sharma');
                  navigate('/doctor/consultation');
                } catch (e) {
                  toast.error(e.message || 'Auto-login error');
                }
              } else {
                setPhoneDigits('9100000099');
                setCode('123456');
                setDisplayedOtp('123456');
                setStage('otp');
                toast.success('Seeding & Logging in Demo Patient...');
                try {
                  await fetch('/api/test/patient/seed?phone=%2B919100000099', { method: 'POST' });
                  const res = await otpApi.verify('+919100000099', '123456');
                  login('PATIENT', res.token);
                  toast.success('Logged in as Ramesh Kumar (Demo)');
                  navigate('/patient');
                } catch (e) {
                  toast.error(e.message || 'Auto-login error');
                }
              }
            }}
            style={{
              width: '100%',
              backgroundColor: '#16A34A',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Sparkles size={14} />
            {kind === 'doctor' ? 'Auto-Fill & Doctor Login' : 'Auto-Fill & Patient Login'}
          </button>
        </div>
      )}

      {/* Mode Switcher: Sign In vs Sign Up */}
      <div className="auth-mode-toggle">
        <button
          className={`auth-mode-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setMode('login');
            setStage('phone');
          }}
        >
          Sign In
        </button>
        <button
          className={`auth-mode-btn ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => {
            setMode('signup');
            setStage('phone');
          }}
        >
          New User Sign Up
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

      {/* STEP 1: Phone input with separate non-editable +91 prefix */}
      {stage === 'phone' && (
        <form onSubmit={handleSendOtp} className="stack-md">
          <p className="muted-text">
            {mode === 'login'
              ? 'Enter your mobile number to receive a secure 6-digit WhatsApp & SMS OTP.'
              : 'Sign up in seconds! Enter your mobile number to get started.'}
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Mobile Phone Number *
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#ffffff',
                padding: '6px 10px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: '800',
                  color: '#0f172a',
                  backgroundColor: '#F1F5F9',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  userSelect: 'none',
                }}
              >
                +91
              </span>
              <input
                type="tel"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                maxLength={10}
                required
                autoFocus
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#0f172a',
                  width: '100%',
                  padding: '6px 4px',
                  letterSpacing: '0.04em',
                }}
              />
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px' }}>
              Country code (+91) is pre-entered. Enter your 10-digit mobile number.
            </div>
          </div>

          <Button type="submit" loading={sending} className="full-width" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <WhatsAppIcon size={18} color="#ffffff" />
            <span>Send Verification Code</span>
          </Button>

          <div className="auth-help-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#15803D" />
            <span>Safe &amp; Secure. Instant OTP via WhatsApp and SMS.</span>
          </div>
        </form>
      )}

      {/* STEP 2: OTP Verification input */}
      {stage === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="stack-md">
          {/* OTP Code Display Box */}
          <div
            style={{
              backgroundColor: '#ECFDF5',
              border: '1.5px solid #10B981',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontWeight: '700', fontSize: '13.5px' }}>
              <WhatsAppIcon size={18} />
              <span>OTP sent on WhatsApp (+91 {phoneDigits}) and SMS</span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#065F46', fontWeight: '500' }}>
              Your 6-Digit Verification Code:
            </div>
            <div style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '6px', color: '#043C2C', margin: '6px 0' }}>
              {displayedOtp || '123456'}
            </div>
            <button
              type="button"
              onClick={() => {
                setCode(displayedOtp || '123456');
                toast.success('OTP auto-filled!');
              }}
              style={{
                backgroundColor: '#10B981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <Sparkles size={14} />
              Auto-Fill Code ({displayedOtp || '123456'})
            </button>
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
              Verify &amp; Proceed
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
