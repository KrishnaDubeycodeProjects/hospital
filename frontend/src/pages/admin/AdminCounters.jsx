import React, { useEffect, useState } from 'react';
import { counterApi, hospitalApi } from '../../api/client';
import { Button, Card, EmptyState, Field, Select, Spinner, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminCounters() {
  const [hospitals, setHospitals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hospitalId, setHospitalId] = useState('');
  const [category, setCategory] = useState('');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    hospitalApi.list().then(setHospitals).catch(() => {});
    hospitalApi.categories().then(setCategories).catch(() => {});
  }, []);

  async function load() {
    if (!hospitalId || !category) return;
    setLoading(true);
    try {
      const data = await counterApi.board(hospitalId, category);
      setBoard(data);
    } catch (err) {
      toast.error(err.message);
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId, category]);

  async function complete(counterId) {
    try {
      const data = await counterApi.complete(counterId, hospitalId, category);
      setBoard(data);
      toast.success(`Counter ${counterId} freed.`);
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
      <h1>Counters</h1>
      <Card title="Choose a department">
        <div className="field-row">
          <Field label="Hospital">
            <Select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">Select…</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {loading && <Spinner />}

      {!loading && board && (
        <div className="counter-grid">
          {board.counters.map((c) => (
            <Card key={c.counterId} title={`Counter ${c.counterId}`}>
              {c.servingToken ? (
                <div className="stack-sm">
                  <div className="token-number">#{c.servingToken.id}</div>
                  <div>{c.servingToken.name || 'Unnamed patient'}</div>
                  <StatusBadge status={c.servingToken.status} />
                  <div className="row-gap">
                    <Button size="sm" onClick={() => complete(c.counterId)}>
                      Complete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => miss(c.counterId)}>
                      Missed
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState title="Idle — no one waiting to pull in." />
              )}
            </Card>
          ))}
        </div>
      )}

      {!loading && !board && hospitalId && category && <EmptyState title="No counter data yet." />}
    </div>
  );
}
