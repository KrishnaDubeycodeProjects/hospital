import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hospitalApi, otpApi, queueApi } from '../api/client';
import { Button, Card, Field, Input, Select } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Book() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', age: '', gender: '', category: '', phone: '' });
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
        toast.success('Location captured.');
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || 'Could not get your location.');
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
      toast.success(res.message || 'OTP sent.');
      setOtpStage('sent');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    setOtpBusy(true);
    try {
      const res = await otpApi.verify(form.phone, otpCode);
      login('PATIENT', res.token);
      setOtpStage('verified');
      toast.success('Phone verified.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        category: form.category,
        phone: form.phone,
        ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
      };
      const res = await queueApi.create(payload);
      toast.success(res.alreadyExists ? 'You already have an active token — showing it below.' : 'Token booked!');
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
      <Card title="Book a token" className="narrow-card">
        <form onSubmit={submit} className="stack-md">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </Field>
          <div className="field-row">
            <Field label="Age">
              <Input type="number" min="0" max="120" value={form.age} onChange={(e) => update('age', e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
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
          <Field label="Phone number" hint="Include country code, e.g. +919876543210">
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
              <span className="badge badge-green">Phone verified</span>
            ) : otpStage === 'sent' ? (
              <div className="row-gap">
                <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="OTP code" inputMode="numeric" />
                <Button type="button" variant="secondary" size="sm" onClick={verifyOtp} loading={otpBusy}>
                  Verify
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={sendOtp} loading={otpBusy}>
                Verify phone with OTP (optional)
              </Button>
            )}
          </div>

          <Field label="Location" hint="Optional — lets us estimate your travel time and tell you when to head out.">
            <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} loading={locating}>
              {location ? 'Location captured ✓' : 'Share my current location'}
            </Button>
          </Field>

          <Button type="submit" loading={submitting}>
            Book token
          </Button>
        </form>
      </Card>
    </div>
  );
}
