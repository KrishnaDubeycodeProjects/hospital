import React, { useCallback, useEffect, useState } from 'react';
import { hospitalApi, queueApi } from '../../api/client';
import { Button, Card, Field, Input, Select, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminMissed() {
  const [hospitals, setHospitals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hospitalId, setHospitalId] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    hospitalApi.list().then(setHospitals).catch(() => {});
    hospitalApi.categories().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = query
        ? await queueApi.missedSearch(query, hospitalId || undefined, category || undefined)
        : await queueApi.missed(hospitalId || undefined, category || undefined);
      setRows(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, category, query, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function requeue(id) {
    try {
      await queueApi.requeueMissed(id);
      toast.success(`Token #${id} moved to the front of the waiting line.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function reject(id) {
    try {
      await queueApi.rejectMissed(id);
      toast.success(`Token #${id} rejected.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const columns = [
    { key: 'id', header: 'ID', render: (r) => `#${r.id}` },
    { key: 'name', header: 'Name', render: (r) => r.name || '—' },
    { key: 'phone', header: 'Phone' },
    { key: 'category', header: 'Department', render: (r) => r.category || '—' },
    { key: 'missedAt', header: 'Missed at', render: (r) => fmtDateTime(r.missedAt) },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="row-gap">
          <Button size="sm" onClick={() => requeue(r.id)}>
            Requeue to front
          </Button>
          <Button size="sm" variant="danger" onClick={() => reject(r.id)}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="stack-lg">
      <h1>Missed Queue</h1>
      <Card title="Filters">
        <div className="field-row">
          <Field label="Search (id or phone)">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 42 or +9198…" />
          </Field>
          <Field label="Hospital">
            <Select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">All</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>
      {loading ? <Spinner /> : <Card title="Missed tokens"><Table columns={columns} rows={rows} emptyText="No missed tokens." /></Card>}
    </div>
  );
}
