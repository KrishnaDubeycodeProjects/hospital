import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { hospitalApi, otpApi, queueApi } from '../api/client';
import { Button, Card, Field, Input, Select } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Book() {
  const [params] = useSearchParams();
  const hospitalId = params.get('hospitalId') ? Number(params.get('hospitalId')) : null;
  const hospitalName = params.get('hospitalName') || '';

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '',
    category: params.get('category') || '',
    phone: '',
  });
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpStage, setOtpStage] = useState('idle'); // idle -> sent -> verified
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const { login, patient } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    hospitalApi
      .categories()
      .then(setCategories)
      .catch(() => {});
    if (patient?.subject) {
      setForm((f) => ({ ...f, phone: patient.subject }));
      setOtpStage('verified');
    }
  }, [patient]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
        toast.success('Location captured successfully.');
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || 'Could not capture location.');
      }
    );
  }

  async function sendOtp() {
    if (!form.phone) {
      toast.error('Enter your phone number first.');
      return;
    }
    setOtpBusy(true);
    try {
      const res = await otpApi.send(form.phone);
      toast.success(res.message || 'OTP sent to your phone number.');
      setOtpStage('sent');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    if (!otpCode.trim()) {
      toast.error('Enter the OTP code received.');
      return;
    }
    setOtpBusy(true);
    try {
      const res = await otpApi.verify(form.phone, otpCode);
      login('PATIENT', res.token);
      setOtpStage('verified');
      toast.success('Phone number verified successfully.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.phone.trim()) {
      toast.error('Phone number is compulsory.');
      return;
    }

    if (otpStage !== 'verified' && !patient?.subject) {
      toast.error('Phone OTP verification is compulsory. Please verify your phone number with OTP.');
      return;
    }

    if (!location) {
      toast.error('Location share is compulsory. Please click "Share my current location".');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        category: form.category,
        phone: form.phone,
        ...(hospitalId ? { hospitalId } : {}),
        latitude: location.latitude,
        longitude: location.longitude,
      };
      const res = await queueApi.create(payload);
      toast.success(res.alreadyExists ? 'Active token found — showing details.' : 'Token booked successfully!');
      navigate(`/token/${res.data.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="public-page">
      <Link to="/" className="auth-back">
        ← Back to home
      </Link>
      <Card title="Book an OPD Token" className="narrow-card">
        {hospitalId ? (
          <div className="callout callout-ok" style={{ marginBottom: '16px' }}>
            🏥 Booking at <strong>{hospitalName || `hospital #${hospitalId}`}</strong> ·{' '}
            <Link to="/find-hospital">Change hospital</Link>
          </div>
        ) : (
          <p className="muted-text" style={{ marginBottom: '16px' }}>
            Pick a hospital from the <Link to="/find-hospital">hospital directory</Link> or book into the default center below.
          </p>
        )}

        <form onSubmit={submit} className="stack-md">
          <Field label="Full Name">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </Field>

          <div className="field-row">
            <Field label="Age">
              <Input type="number" min="0" max="120" value={form.age} onChange={(e) => update('age', e.target.value)} required />
            </Field>

            <Field label="Gender">
              <Select value={form.gender} onChange={(e) => update('gender', e.target.value)} required>
                <option value="">Select gender…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>

          <Field label="Department">
            <Select value={form.category} onChange={(e) => update('category', e.target.value)} required>
              <option value="">Select a department…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Phone Number (Compulsory)" hint="Required for OPD queue updates & SMS alerts.">
            <Input
              value={form.phone}
              onChange={(e) => {
                update('phone', e.target.value);
                setOtpStage('idle');
              }}
              placeholder="+91XXXXXXXXXX"
              required
            />
          </Field>

          <div className="otp-inline">
            {otpStage === 'verified' ? (
              <span className="badge badge-green">✓ Phone Verified</span>
            ) : otpStage === 'sent' ? (
              <div className="row-gap">
                <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter 6-digit OTP" inputMode="numeric" required />
                <Button type="button" variant="secondary" size="sm" onClick={verifyOtp} loading={otpBusy}>
                  Verify OTP
                </Button>
              </div>
            ) : (
              <Button type="button" variant="secondary" size="sm" onClick={sendOtp} loading={otpBusy}>
                🔐 Verify Phone via OTP (Compulsory)
              </Button>
            )}
          </div>

          <Field label="Location Share (Compulsory)" hint="Required — captures your location to estimate travel time & counter turn.">
            <Button type="button" variant={location ? 'secondary' : 'primary'} size="sm" onClick={useMyLocation} loading={locating}>
              {location ? '✓ Location Captured' : '📍 Share My Current Location (Compulsory)'}
            </Button>
          </Field>

          <Button type="submit" loading={submitting} size="lg" style={{ marginTop: '8px' }}>
            Book OPD Token
          </Button>
        </form>
      </Card>
    </div>
  );
}
