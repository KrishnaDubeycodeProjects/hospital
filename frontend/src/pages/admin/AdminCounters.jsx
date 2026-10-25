import React, { useEffect, useState } from 'react';
import { counterApi, hospitalApi } from '../../api/client';
import { Button, Card, EmptyState, Field, Select, Spinner, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { X, RefreshCw } from 'lucide-react';

export default function AdminCounters() {
  const [hospitals, setHospitals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hospitalId, setHospitalId] = useState('');
  const [category, setCategory] = useState('');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    hospitalApi.list().then((list) => {
      const arr = Array.isArray(list) ? list : list?.data || [];
      setHospitals(arr);
      if (arr.length > 0 && !hospitalId) {
        setHospitalId(String(arr[0].id));
      }
    }).catch(() => {});

    hospitalApi.categories().then((cats) => {
      const arr = Array.isArray(cats) ? cats : cats?.data || [];
      setCategories(arr);
      if (arr.length > 0 && !category) {
        setCategory(arr[0]);
      }
    }).catch(() => {});
  }, []);

  async function load() {
    if (!hospitalId || !category) return;
    setLoading(true);
    try {
      const data = await counterApi.board(hospitalId, category);
      setBoard(data);
    } catch (err) {
      toast.error(err.message || 'Failed loading counter board');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hospitalId && category) {
      load();
    }
  }, [hospitalId, category]);

  async function complete(counterId) {
    try {
      const data = await counterApi.complete(counterId, hospitalId, category);
      setBoard(data);
      toast.success(`Counter ${counterId} consultation completed & freed.`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function miss(counterId) {
    try {
      const data = await counterApi.miss(counterId, hospitalId, category);
      setBoard(data);
      toast.success(`Counter ${counterId} patient marked missed.`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="stack-lg">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Counters Management</h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>Multi-counter live display and department station controller</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} />
            Refresh Board
          </Button>
        </div>
      </div>

      <Card title="Station Filter">
        <div className="field-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Field label="Selected Hospital">
            <Select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">Select Hospital…</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Clinical Department">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select Department…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {loading && <Spinner label="Loading live counter status..." />}

      {!loading && board && (
        <div className="counter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {board.counters.map((c) => (
            <Card key={c.counterId} title={`Station #${c.counterId}`}>
              {c.servingToken ? (
                <div className="stack-sm">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="token-number" style={{ fontSize: '22px', fontWeight: 800, color: '#25D366' }}>
                      #{c.servingToken.id}
                    </div>
                    <StatusBadge status={c.servingToken.status} />
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                    {c.servingToken.name || 'Patient'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Age: {c.servingToken.age || '—'} &bull; Gender: {c.servingToken.gender || '—'}
                  </div>
                  <div className="row-gap" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <Button size="sm" onClick={() => complete(c.counterId)} style={{ flex: 1, backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}>
                      Complete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => miss(c.counterId)} style={{ flex: 1, color: '#DC2626' }}>
                      Missed
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#94A3B8' }}>
                    ✓
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#64748B' }}>Idle Counter</div>
                  <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>Waiting for next patient in line</div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {!loading && !board && hospitalId && category && (
        <EmptyState title="No active counters found for this department." />
      )}
    </div>
  );
}
