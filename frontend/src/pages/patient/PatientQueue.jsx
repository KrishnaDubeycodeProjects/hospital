import React, { useCallback, useEffect, useState } from 'react';
import { hospitalApi, queueApi } from '../../api/client';
import TokenCard from '../../components/TokenCard';
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function PatientQueue() {
  const { patient } = useAuth();
  const phone = patient?.subject;
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
      <h1>My Queue</h1>
      {token === undefined && <Spinner />}
      {token === null && <BookForm phone={phone} onBooked={load} />}
      {token && (
        <Card title={`Token #${token.id}`}>
          <TokenCard token={token} onRefresh={load} />
        </Card>
      )}
    </div>
  );
}

function BookForm({ phone, onBooked }) {
  const [categories, setCategories] = useState([]);
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
  }, []);

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
      },
      (err) => {
        setLocating(false);
        toast.error(err.message);
      }
    );
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await queueApi.create({
        name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        category: form.category,
        phone,
        ...(location || {}),
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
        <Field label="Full name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>
        <div className="field-row">
          <Field label="Age">
            <Input type="number" min="0" max="120" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">Prefer not to say</option>
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
        <Field label="Location" hint="Optional — lets us estimate your travel time.">
          <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} loading={locating}>
            {location ? 'Location captured ✓' : 'Share my current location'}
          </Button>
        </Field>
        <Button type="submit" loading={submitting}>
          Book token
        </Button>
      </form>
    </Card>
  );
}
