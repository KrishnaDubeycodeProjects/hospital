import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doctorApi, otpApi, queueApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, Input } from '../components/ui';

const TABS = [
  { key: 'patient', label: 'Patient Portal', icon: '🩺' },
  { key: 'doctor', label: 'Doctor Portal', icon: '👨‍⚕️' },
  { key: 'admin', label: 'Hospital Staff', icon: '🏥' },
];

export default function Login() {
  const { role = 'patient' } = useParams();
  const navigate = useNavigate();

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
function OtpAuthFlow({ kind }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [phone, setPhone] = useState('');
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
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid mobile number with country code (e.g., +91 9876543210)');
      return;
    }

    const formatted = cleanPhone(phone);
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
