import React, { useCallback, useEffect, useState } from 'react';
import { hospitalApi, queueApi } from '../../api/client';
import QrScanner from '../../components/QrScanner';
import { Button, Card, Field, Input, Modal, Select, Spinner, StatusBadge, Table, fmtDateTime, fmtMinutes } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminQueue() {
  const [hospitals, setHospitals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hospitalId, setHospitalId] = useState('');
  const [category, setCategory] = useState('');
  const [queue, setQueue] = useState(null);
  const [anomaly, setAnomaly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyId, setVerifyId] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    hospitalApi.list().then(setHospitals).catch(() => {});
    hospitalApi.categories().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [q, a] = await Promise.all([
        queueApi.getQueue(hospitalId || undefined, category || undefined),
        queueApi.anomalyControl(hospitalId || undefined, category || undefined).catch(() => []),
      ]);
      setQueue(q);
      setAnomaly(a);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, category, toast]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function doVerify(e) {
    e.preventDefault();
    if (!verifyId) return;
    try {
      const res = await queueApi.verify({ tokenId: Number(verifyId) });
      toast.success(res.message);
      setVerifyId('');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function verifyFromQr(qrData) {
    setScanOpen(false);
    try {
      const res = await queueApi.verify({ qrData });
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function setStatus(id, status) {
    try {
      await queueApi.updateStatus(id, status);
      toast.success(`Token #${id} marked ${status}.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function noShow(id) {
    try {
      await queueApi.noShow(id);
      toast.success(`Token #${id} pushed back.`);
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
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Checked in', render: (r) => fmtDateTime(r.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="row-gap">
          {r.status === 'waiting' && (
            <>
              <Button size="sm" onClick={() => setStatus(r.id, 'serving')}>
                Call
              </Button>
              <Button size="sm" variant="ghost" onClick={() => noShow(r.id)}>
                Not come yet
              </Button>
              <Button size="sm" variant="danger" onClick={() => setStatus(r.id, 'missed')}>
                Missed
              </Button>
            </>
          )}
          {r.status === 'serving' && (
            <Button size="sm" onClick={() => setStatus(r.id, 'completed')}>
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="stack-lg">
      <h1>Live Queue</h1>

      <Card title="Filters">
        <div className="field-row">
          <Field label="Hospital">
            <Select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">All hospitals</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All departments</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Verify a patient" actions={<Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>Scan QR</Button>}>
        <form onSubmit={doVerify} className="row-gap">
          <Input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} placeholder="Token ID" inputMode="numeric" />
          <Button type="submit">Verify check-in</Button>
        </form>
      </Card>

      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan patient's QR code">
        {scanOpen && <QrScanner onResult={verifyFromQr} />}
      </Modal>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="opdx-stat-card slate">
              <div className="opdx-stat-title">Total Patients</div>
              <div className="opdx-stat-number">{queue?.stats?.total ?? 0}</div>
            </div>
            <div className="opdx-stat-card amber">
              <div className="opdx-stat-title">Waiting</div>
              <div className="opdx-stat-number">{queue?.stats?.waiting ?? 0}</div>
            </div>
            <div className="opdx-stat-card blue">
              <div className="opdx-stat-title">Now Serving</div>
              <div className="opdx-stat-number">{queue?.stats?.serving ?? 0}</div>
            </div>
            <div className="opdx-stat-card green">
              <div className="opdx-stat-title">Completed</div>
              <div className="opdx-stat-number">{queue?.stats?.completed ?? 0}</div>
            </div>
            <div className="opdx-stat-card red">
              <div className="opdx-stat-title">Missed / Skipped</div>
              <div className="opdx-stat-number">{queue?.stats?.missed ?? 0}</div>
            </div>
          </div>

          <Card title="Queue" actions={<Button size="sm" variant="ghost" onClick={load}>Refresh</Button>}>
            <Table columns={columns} rows={queue?.tokens} emptyText="No tokens in the queue." />
          </Card>

          {anomaly?.length > 0 && (
            <Card title="Heading-to-hospital grace window">
              <Table
                columns={[
                  { key: 'id', header: 'ID', render: (r) => `#${r.id}` },
                  { key: 'name', header: 'Name' },
                  { key: 'travelMinutes', header: 'Travel ETA', render: (r) => fmtMinutes(r.travelMinutes) },
                  { key: 'anomalyControlUntil', header: 'Grace until', render: (r) => fmtDateTime(r.anomalyControlUntil) },
                ]}
                rows={anomaly}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
