import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doctorApi, otpApi, queueApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AppHeader from '../components/AppHeader';
import AyushmanFooter from '../components/AyushmanFooter';
import {
  Stethoscope,
  UserCheck,
  Building2,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  Smartphone,
  Activity,
  FileText
} from 'lucide-react';
import { WhatsAppIcon } from '../components/Icons';

const ROLES = [
  { key: 'patient', label: 'Patient', icon: UserCheck },
  { key: 'doctor', label: 'Doctor', icon: Stethoscope },
  { key: 'admin', label: 'Hospital Staff', icon: Building2 },
  { key: 'asha', label: 'ASHA Worker', icon: Users },
];

export default function Login() {
  const { role = 'patient' } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      <AppHeader
        activeNav={role === 'doctor' ? 'doctor' : role === 'asha' ? 'asha' : 'patient'}
        backTo="/"
        backLabel="Home"
        title="Healthcare Gateway"
        subtitle={`${role.charAt(0).toUpperCase() + role.slice(1)} Portal Authentication`}
      />
      <div className="pro-auth-container" style={{ flex: 1 }}>
      {/* Left Showcase Panel (Desktop) */}
      <aside className="pro-auth-sidebar">
        <div>
          <div className="pro-auth-sidebar-brand">
            <div className="pro-auth-brand-logo">
              <img
                src="/aarogya_flow_icon_transparent.png"
                alt="Aarogya Flow"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Aarogya Flow
              </div>
              <div style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 600 }}>
                Ayushman Digital Health Portal
              </div>
            </div>
          </div>
        </div>

        <div className="pro-auth-sidebar-body">
          <div className="pro-auth-pill-badge">
            <ShieldCheck size={14} />
            <span>ABDM &amp; Ayushman Bharat Certified</span>
          </div>

          <h1 className="pro-auth-headline">
            Digital Healthcare, <br />
            Closer to Every Citizen.
          </h1>

          <p className="pro-auth-subtext">
            Streamlined OPD consultations, zero-wait live queue tracking, and complete family health records integrated directly with WhatsApp and ABHA ID.
          </p>

          <div className="pro-auth-feature-list">
            <div className="pro-auth-feature-item">
              <div className="pro-auth-feature-icon-wrap">
                <Smartphone size={16} />
              </div>
              <div>
                <div className="pro-auth-feature-title">Real-Time WhatsApp Queue Tracking</div>
                <div className="pro-auth-feature-desc">Live OPD token alerts, ETA updates, and instant digital prescription slips.</div>
              </div>
            </div>

            <div className="pro-auth-feature-item">
              <div className="pro-auth-feature-icon-wrap">
                <FileText size={16} />
              </div>
              <div>
                <div className="pro-auth-feature-title">Verified ABHA Health Records Hub</div>
                <div className="pro-auth-feature-desc">Access doctor notes, diagnostic lab reports, and longitudinal care history securely.</div>
              </div>
            </div>

            <div className="pro-auth-feature-item">
              <div className="pro-auth-feature-icon-wrap">
                <Activity size={16} />
              </div>
              <div>
                <div className="pro-auth-feature-title">Unified Rural &amp; Clinical Care Continuum</div>
                <div className="pro-auth-feature-desc">Synchronized coordination between ASHA field workers, ANMs, and hospital specialists.</div>
              </div>
            </div>
          </div>

          <div className="pro-auth-metrics-row">
            <div className="pro-auth-metric-card">
              <div className="pro-auth-metric-num">48+</div>
              <div className="pro-auth-metric-lbl">Hospitals Active</div>
            </div>
            <div className="pro-auth-metric-card">
              <div className="pro-auth-metric-num">120K+</div>
              <div className="pro-auth-metric-lbl">Patient Visits</div>
            </div>
            <div className="pro-auth-metric-card">
              <div className="pro-auth-metric-num">&lt; 10s</div>
              <div className="pro-auth-metric-lbl">WhatsApp Sync</div>
            </div>
          </div>
        </div>

        <div className="pro-auth-sidebar-footer">
          <Lock size={13} />
          <span>256-Bit Encrypted &bull; ISO 27001 Certified &bull; NHA Standard Compliant</span>
        </div>
      </aside>

      {/* Right Authentication Chamber */}
      <main className="pro-auth-main">
        <div className="pro-auth-box">
          <div className="pro-auth-top-nav">
            <Link to="/" className="pro-auth-back-link">
              <ArrowLeft size={16} />
              <span>Back to AarogyaFlow</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#15803D', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '9999px', fontWeight: 700 }}>
              <ShieldCheck size={13} />
              <span>Official Healthcare Gateway</span>
            </div>
          </div>

          <div className="pro-auth-card">
            {/* Role Switcher Tabs */}
            <div className="pro-role-tabs">
              {ROLES.map((t) => {
                const IconComp = t.icon;
                const isActive = role === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`pro-role-tab ${isActive ? 'active' : ''} ${t.key === 'asha' ? 'asha' : ''}`}
                    onClick={() => navigate(`/login/${t.key}`)}
                  >
                    <IconComp size={15} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Auth Body Rendered By Role */}
            {role === 'patient' && <OtpAuthForm kind="patient" />}
            {role === 'doctor' && <OtpAuthForm kind="doctor" />}
            {role === 'admin' && <AdminAuthForm />}
            {role === 'asha' && <AshaAuthForm />}
          </div>

          {/* Quick Demo Credentials Assistant */}
          <DemoCredentialsQuickBar currentRole={role} />
        </div>
      </main>
    </div>
  );
}

/** 
 * Professional Phone + WhatsApp Real Backend OTP Component
 */
function OtpAuthForm({ kind }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [phone, setPhone] = useState(kind === 'doctor' ? '9888877777' : '9100000099');
  const [stage, setStage] = useState('phone'); // 'phone' | 'otp' | 'profile'
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [sandboxOtp, setSandboxOtp] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const inputRefs = useRef([]);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const fullPhone = '+91' + phone.trim();

  // Handle Resend Countdown
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Clean error on input
  function handlePhoneChange(e) {
    setErrorMsg('');
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
  }

  // 1. Send OTP via Real Backend (/api/auth/otp/send)
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    if (!phone || phone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    setErrorMsg('');
    setSending(true);
    try {
      const res = await otpApi.send(fullPhone);
      // Capture OTP returned by backend in test/sandbox mode
      const receivedOtp = res?.otp || (typeof res?.message === 'string' && res.message.match(/\b\d{6}\b/) ? res.message.match(/\b\d{6}\b/)[0] : '');
      if (receivedOtp) {
        setSandboxOtp(receivedOtp);
      }
      toast.success(res?.message || 'Verification OTP dispatched to your WhatsApp and SMS!');
      setStage('otp');
      setResendTimer(30);
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch OTP. Please check your connection.');
    } finally {
      setSending(false);
    }
  }

  // Handle 6-Digit Individual Cell Input
  function handleDigitChange(index, val) {
    const char = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMsg('');

    // Advance focus
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits entered
    if (char && index === 5 && newDigits.every((d) => d !== '')) {
      triggerVerify(newDigits.join(''));
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;
    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasteData[i] || '';
    }
    setDigits(newDigits);
    if (pasteData.length === 6) {
      inputRefs.current[5]?.focus();
      triggerVerify(pasteData);
    } else {
      inputRefs.current[pasteData.length]?.focus();
    }
  }

  // 2. Verify OTP via Real Backend (/api/auth/otp/verify)
  async function triggerVerify(codeToVerify) {
    const fullCode = codeToVerify || digits.join('');
    if (fullCode.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit verification code');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await otpApi.verify(fullPhone, fullCode);

      if (kind === 'patient') {
        login('PATIENT', res.token);
        toast.success('Authenticated successfully! Welcome to AarogyaFlow.');
        navigate('/patient');
        return;
      }

      // Doctor Verification & Login
      if (mode === 'login') {
        try {
          const docRes = await doctorApi.login(fullPhone);
          login('DOCTOR', docRes.token);
          toast.success(docRes.message || 'Welcome back, Doctor!');
          navigate('/doctor/consultation');
        } catch (docErr) {
          toast.info('No registered doctor profile found with this phone. Please complete your registration.');
          setMode('signup');
          setStage('profile');
        }
      } else {
        setStage('profile');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  // 3. Register Doctor Profile
  async function handleDoctorRegister(e) {
    e.preventDefault();
    if (!doctorName.trim()) {
      setErrorMsg('Please enter your full name with professional credentials.');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await doctorApi.register(doctorName.trim(), fullPhone);
      login('DOCTOR', res.token);
      toast.success(res.message || 'Doctor account registered successfully!');
      navigate('/doctor/consultation');
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <div className="pro-card-header">
        <h2 className="pro-card-title">
          {kind === 'patient'
            ? mode === 'login'
              ? 'Patient Sign In'
              : 'New Patient Registration'
            : mode === 'login'
            ? 'Doctor Clinical Sign In'
            : 'Doctor Account Registration'}
        </h2>
        <p className="pro-card-subtitle">
          {stage === 'phone' && 'Access your digital health portal securely with phone & WhatsApp OTP.'}
          {stage === 'otp' && `Enter the 6-digit verification code sent to +91 ${phone}.`}
          {stage === 'profile' && 'Complete your professional credentials to finalize your doctor account.'}
        </p>
      </div>

      {/* Mode Switcher (Sign In vs Sign Up) */}
      {stage === 'phone' && (
        <div className="pro-mode-pills">
          <button
            type="button"
            className={`pro-mode-pill ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`pro-mode-pill ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Create Account
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="pro-auth-alert">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STAGE 1: PHONE NUMBER INPUT */}
      {stage === 'phone' && (
        <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Mobile Phone Number *
            </label>
            <div className="pro-phone-field">
              <div className="pro-country-prefix">
                <span role="img" aria-label="India flag">🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="98765 43210"
                maxLength={10}
                required
                autoFocus
                className="pro-phone-input"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
              <WhatsAppIcon size={14} color="#15803D" />
              <span>We will deliver a 6-digit one-time passcode directly to your WhatsApp.</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || phone.length !== 10}
            className={`pro-primary-btn ${kind === 'doctor' ? '' : 'emerald'}`}
          >
            {sending ? (
              <span>Sending OTP Code...</span>
            ) : (
              <>
                <WhatsAppIcon size={18} color="#ffffff" />
                <span>Send WhatsApp Verification Code</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            <Lock size={12} />
            <span>Encrypted with ABDM Compliant Security</span>
          </div>
        </form>
      )}

      {/* STAGE 2: 6-DIGIT OTP VERIFICATION CELLS */}
      {stage === 'otp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                6-Digit Verification Code *
              </label>
              <button
                type="button"
                onClick={() => {
                  setStage('phone');
                  setErrorMsg('');
                }}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Change Phone
              </button>
            </div>

            {/* 6 Digit Input Cells */}
            <div className="pro-otp-grid" onPaste={handlePaste}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`pro-otp-cell ${digit ? 'filled' : ''}`}
                  autoFocus={idx === 0}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={verifying || digits.some((d) => !d)}
            onClick={() => triggerVerify()}
            className={`pro-primary-btn ${kind === 'doctor' ? '' : 'emerald'}`}
          >
            {verifying ? (
              <span>Verifying Code with Backend...</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Verify &amp; Enter Portal</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '4px' }}>
            <div style={{ color: '#64748B' }}>
              {resendTimer > 0 ? (
                <span>Resend OTP in <strong>{resendTimer}s</strong></span>
              ) : (
                <span>Didn't receive the code?</span>
              )}
            </div>
            <button
              type="button"
              disabled={resendTimer > 0 || sending}
              onClick={handleSendOtp}
              style={{
                background: 'none',
                border: 'none',
                color: resendTimer > 0 ? '#94a3b8' : '#0284c7',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Resend via WhatsApp
            </button>
          </div>

          {/* Sandbox Helper Pill (Discreet for testing) */}
          {sandboxOtp && (
            <div className="pro-sandbox-pill">
              <div>
                <span>Backend OTP: </span>
                <span className="pro-sandbox-code">{sandboxOtp}</span>
              </div>
              <button
                type="button"
                className="pro-sandbox-btn"
                onClick={() => {
                  const arr = sandboxOtp.split('');
                  setDigits(arr);
                  triggerVerify(sandboxOtp);
                }}
              >
                Auto-Fill Code
              </button>
            </div>
          )}
        </div>
      )}

      {/* STAGE 3: DOCTOR PROFILE REGISTRATION */}
      {stage === 'profile' && kind === 'doctor' && (
        <form onSubmit={handleDoctorRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Doctor Full Name &amp; Credentials *
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Sharma, MD"
              required
              autoFocus
              className="pro-phone-input"
              style={{
                width: '100%',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            />
          </div>

          <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
            Verified Phone Number: <strong style={{ color: '#0F172A' }}>+91 {phone}</strong>
          </div>

          <button
            type="submit"
            disabled={verifying || !doctorName.trim()}
            className="pro-primary-btn"
          >
            {verifying ? 'Registering Doctor...' : 'Complete Doctor Registration &rarr;'}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Hospital Staff & Admin Authentication Component
 */
function AdminAuthForm() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await queueApi.login(username, password);
      login('ADMIN', res.token);
      toast.success('Welcome back to ArogyaFlow Hospital Administration.');
      navigate('/admin');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid username or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="pro-card-header">
        <h2 className="pro-card-title">Hospital Staff &amp; Admin Sign In</h2>
        <p className="pro-card-subtitle">
          Manage OPD counters, triage queues, doctor room assignments, and hospital throughput.
        </p>
      </div>

      {errorMsg && (
        <div className="pro-auth-alert">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
            Staff Username or ID *
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin"
            required
            autoFocus
            className="pro-phone-input"
            style={{
              width: '100%',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '12px 14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
            Password *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="pro-phone-input"
              style={{
                width: '100%',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px 42px 12px 14px',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="pro-primary-btn"
        >
          {loading ? 'Authenticating Staff...' : 'Sign In as Staff'}
        </button>
      </form>
    </div>
  );
}

/**
 * ASHA Worker & Community Healthcare Officer Workspace Component
 */
function AshaAuthForm() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="pro-card-header" style={{ textAlign: 'center', padding: '10px 0' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
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
        <h2 className="pro-card-title" style={{ color: '#15803D' }}>
          ASHA &amp; CHO Community Care Portal
        </h2>
        <p className="pro-card-subtitle">
          Household village censuses, maternal ANC/PNC monitoring, offline sync, and remote CHO teleconsultation reviews.
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
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, fontSize: '13.5px' }}>
          <ShieldCheck size={16} />
          <span>Accredited Healthcare Worker Console</span>
        </div>
        <div style={{ fontSize: '12.5px', color: '#15803D', lineHeight: 1.5 }}>
          Authorized for ASHA Workers, Auxiliary Nurse Midwives (ANMs), and Community Health Officers (CHOs). Full offline capability with direct database synchronization upon network recovery.
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/asha')}
        className="pro-primary-btn emerald"
        style={{ padding: '14px 18px' }}
      >
        <Sparkles size={16} />
        <span>Open ASHA &amp; CHO Mobile Workspace &rarr;</span>
      </button>
    </div>
  );
}

/**
 * Discreet Demo / Evaluation Quick-Fill Bar
 */
function DemoCredentialsQuickBar({ currentRole }) {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function loginAsDemoPatient() {
    toast.success('Auto-filling demo patient (Ramesh Kumar)...');
    try {
      await fetch('/api/test/patient/seed?phone=%2B919100000099', { method: 'POST' });
      const res = await otpApi.verify('+919100000099', '123456');
      login('PATIENT', res.token);
      toast.success('Signed in as Ramesh Kumar (Demo)');
      navigate('/patient');
    } catch (e) {
      toast.error(e.message || 'Error signing in demo patient');
    }
  }

  async function loginAsDemoDoctor() {
    toast.success('Auto-filling demo doctor (Dr. Rajesh Sharma)...');
    try {
      await otpApi.verify('+919888877777', '123456');
      const docRes = await doctorApi.login('+919888877777');
      login('DOCTOR', docRes.token);
      toast.success('Signed in as Dr. Rajesh Sharma');
      navigate('/doctor/consultation');
    } catch (e) {
      toast.error(e.message || 'Error signing in demo doctor');
    }
  }

  async function loginAsDemoStaff() {
    toast.success('Auto-filling staff admin credentials...');
    try {
      const res = await queueApi.login('admin', 'admin123');
      login('ADMIN', res.token);
      toast.success('Signed in as Hospital Staff Admin');
      navigate('/admin');
    } catch (e) {
      toast.error(e.message || 'Error signing in admin');
    }
  }

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#64748B',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
        <Sparkles size={14} color="#0284C7" />
        <span>1-Click Evaluator Access:</span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={loginAsDemoPatient}
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Patient
        </button>
        <button
          type="button"
          onClick={loginAsDemoDoctor}
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Doctor
        </button>
        <button
          type="button"
          onClick={loginAsDemoStaff}
          style={{
            background: '#FAF5FF',
            border: '1px solid #E9D5FF',
            color: '#7E22CE',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Staff Admin
        </button>
      </div>
    </div>
  );
}
