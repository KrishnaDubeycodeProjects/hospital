import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { familyApi, hospitalApi, queueApi } from '../../api/client';
import TokenCard from '../../components/TokenCard';
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function PatientQueue() {
  const { patient } = useAuth();
  const phone = patient?.subject;
  const navigate = useNavigate();
  const [token, setToken] = useState(undefined); // undefined = loading, null = none

  const load = useCallback(async () => {
    try {
      const data = await queueApi.position(phone);
      setToken(data);
    } catch {
      setToken(null);
    }
  }, [phone]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="stack-lg">
      {token === undefined && <Spinner />}
      {token === null && <BookForm phone={phone} onBooked={load} />}
      {token && (
        <Card title={`Token #${token.dailyNumber ?? token.id}`}>
          <TokenCard token={token} onRefresh={load} />
          <button
            type="button"
            onClick={() => navigate(`/token/${token.id}`)}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '13px',
              backgroundColor: '#004D40',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '14.5px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0, 77, 64, 0.2)',
            }}
          >
            <span>Open Live Token Screen & QR Code</span>
            <span style={{ fontSize: '16px' }}>→</span>
          </button>
        </Card>
      )}
    </div>
  );
}

function BookForm({ phone, onBooked }) {
  const [categories, setCategories] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [form, setForm] = useState({ name: '', age: '', gender: '', category: '' });
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    hospitalApi
      .categories()
      .then(setCategories)
      .catch(() => {});
    familyApi
      .listMembers()
      .then(setFamilyMembers)
      .catch(() => {});
  }, []);

  function handleMemberSelect(e) {
    const memberId = e.target.value;
    if (!memberId) return;
    const member = familyMembers.find((m) => String(m.id) === String(memberId));
    if (member) {
      setForm((f) => ({
        ...f,
        name: member.name,
        age: member.age || '',
        gender: member.gender || '',
      }));
    }
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
        toast.error(err.message || 'Could not capture location.');
      }
    );
  }

  async function submit(e) {
    e.preventDefault();

    if (!location) {
      toast.error('Location share is compulsory. Please click "Share my current location".');
      return;
    }

    setSubmitting(true);
    try {
      await queueApi.create({
        name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        category: form.category,
        phone,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      toast.success('Token booked!');
      onBooked();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="You don't have an active token">
      <EmptyState title="Book a new token to join the queue." />
      <form onSubmit={submit} className="stack-md">
        {familyMembers.length > 0 && (
          <Field label="Quick Select Family Member" hint="Auto-fill details from your registered family unit">
            <Select onChange={handleMemberSelect}>
              <option value="">— Or enter patient manually below —</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.relationship || 'Member'}{m.age ? `, ${m.age} yrs` : ''})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Full Name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>

        <div className="field-row">
          <Field label="Age">
            <Input type="number" min="0" max="120" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} required />
          </Field>

          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} required>
              <option value="">Select gender…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>

        <Field label="Department">
          <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} required>
            <option value="">Select a department…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Location Share (Compulsory)" hint="Required — captures your location to estimate travel time & counter turn.">
          <Button type="button" variant={location ? 'secondary' : 'primary'} size="sm" onClick={useMyLocation} loading={locating}>
            {location ? '✓ Location Captured' : '📍 Share My Current Location (Compulsory)'}
          </Button>
        </Field>

        <Button type="submit" loading={submitting}>
          Book Token
        </Button>
      </form>
    </Card>
  );
}
