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
      toast.success(`Token #${id} demoted exponentially.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function requeueMissed(id) {
    try {
      await queueApi.requeueMissed(id);
      toast.success(`Token #${id} requeued to front of queue.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function rejectMissed(id) {
    try {
      await queueApi.rejectMissed(id);
      toast.success(`Token #${id} dismissed.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function directVerifyToken(id) {
    try {
      const res = await queueApi.verify({ tokenId: Number(id) });
      toast.success(res.message || `Token #${id} verified.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function releaseFrozen(id) {
    try {
      await queueApi.unfreeze(id);
      toast.success(`Token #${id} released into active waiting queue.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const reservedTokens = queue?.reserved?.length ? queue.reserved : (queue?.tokens || []).filter((t) => t.status === 'reserved');
  const waitingTokens = (queue?.tokens || []).filter((t) => t.status === 'waiting');
  const missedTokens = queue?.missed?.length ? queue.missed : (queue?.tokens || []).filter((t) => t.status === 'missed');
  const frozenTokens = queue?.frozen?.length ? queue.frozen : (queue?.tokens || []).filter((t) => t.status === 'frozen');
  const servingToken = (queue?.tokens || []).find((t) => t.status === 'serving');

  return (
    <div className="stack-lg">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1>Queue Management Dashboard</h1>
          <p className="muted-text">Real-time synchronized control for Travel Deficit (Frozen), Reserved Buffer, Active Queue, and Missed Patients</p>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>Refresh Data</Button>
      </div>

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

      <Card title="Quick Reception Check-in" actions={<Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>Scan QR</Button>}>
        <form onSubmit={doVerify} className="row-gap">
          <Input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} placeholder="Enter Token ID (e.g. 15)" inputMode="numeric" />
          <Button type="submit">Verify & Award Max Priority</Button>
        </form>
      </Card>

      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan patient's QR code">
        {scanOpen && <QrScanner onResult={verifyFromQr} />}
      </Modal>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Top Stat Metrics */}
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="opdx-stat-card slate">
              <div className="opdx-stat-title">Total Active</div>
              <div className="opdx-stat-number">{queue?.stats?.total ?? 0}</div>
            </div>
            <div className="opdx-stat-card purple" style={{ borderColor: '#c084fc', background: '#faf5ff' }}>
              <div className="opdx-stat-title" style={{ color: '#7e22ce' }}>❄️ Frozen (Commute)</div>
              <div className="opdx-stat-number" style={{ color: '#6b21a8' }}>{frozenTokens.length}</div>
            </div>
            <div className="opdx-stat-card amber">
              <div className="opdx-stat-title">🟡 Reserved Buffer</div>
              <div className="opdx-stat-number">{reservedTokens.length}</div>
            </div>
            <div className="opdx-stat-card blue">
              <div className="opdx-stat-title">🔵 Active Waiting</div>
              <div className="opdx-stat-number">{waitingTokens.length}</div>
            </div>
            <div className="opdx-stat-card green">
              <div className="opdx-stat-title">🟢 Now Serving</div>
              <div className="opdx-stat-number">{servingToken ? `#${servingToken.dailyNumber || servingToken.id}` : 'None'}</div>
            </div>
            <div className="opdx-stat-card red">
              <div className="opdx-stat-title">🔴 Missed</div>
              <div className="opdx-stat-number">{missedTokens.length}</div>
            </div>
          </div>

          {/* Frozen / Travel-Deficit Section if any */}
          {frozenTokens.length > 0 && (
            <div style={{ background: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ddd6fe', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ede9fe', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>❄️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#6b21a8' }}>Frozen Tokens &bull; Scheduled Queue</h3>
                    <span style={{ fontSize: '11px', color: '#7c3aed' }}>Scheduled appointments &bull; Auto-releases as clinic approaches turn</span>
                  </div>
                </div>
                <span style={{ background: '#ede9fe', color: '#6b21a8', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                  {frozenTokens.length} Scheduled
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {frozenTokens.map((t) => (
                  <div key={t.id} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #ddd6fe', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '15px', color: '#6b21a8' }}>
                            {t.tokenCode || `Draft #${t.id}`}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{t.name || 'Patient'}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{t.category} &bull; {t.phone}</div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ede9fe', color: '#6b21a8' }}>
                        Frozen ❄️
                      </span>
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#5b21b6', background: '#faf5ff', padding: '6px 8px', borderRadius: '6px', border: '1px dashed #ddd6fe' }}>
                      ⏳ Scheduled Arrival: <strong>{t.targetArrivalTime ? fmtDateTime(t.targetArrivalTime) : 'Pending activation'}</strong>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="primary" onClick={() => releaseFrozen(t.id)}>
                        Release to Queue 🔓
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => directVerifyToken(t.id)}>
                        ✓ Verify & Check-in
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-Section Queue Dashboard Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
            
            {/* SECTION 1: 🟡 RESERVED / BUFFER QUEUE (LEFT) */}
            <div style={{ background: '#fffbeb', borderRadius: '12px', border: '1.5px solid #fde68a', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fef3c7', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🟡</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#92400e' }}>Reserved / Buffer</h3>
                    <span style={{ fontSize: '11px', color: '#b45309' }}>En route &bull; Check-in awards Pos #1</span>
                  </div>
                </div>
                <span style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  {reservedTokens.length}
                </span>
              </div>

              {reservedTokens.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#b45309', fontSize: '13px' }}>
                  No patients currently in travel buffer.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reservedTokens.map((t) => (
                    <div key={t.id} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #fde68a', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '15px', color: '#004D40' }}>
                              {t.tokenCode || `AF-${String(t.dailyNumber || t.id).padStart(2, '0')}`}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{t.id}</span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{t.name || 'Patient'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{t.category} &bull; {t.phone}</div>
                        </div>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                          Buffer Active
                        </span>
                      </div>

                      <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#78350f', background: '#fffbeb', padding: '6px 8px', borderRadius: '6px', border: '1px dashed #fde68a' }}>
                        📍 En Route &bull; Priority check-in ready at reception
                      </div>

                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="secondary" onClick={() => directVerifyToken(t.id)}>
                          ✓ Verify Check-in
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: 🔵 ACTIVE QUEUE - MAIN FIFO (MIDDLE) */}
            <div style={{ background: '#eff6ff', borderRadius: '12px', border: '1.5px solid #bfdbfe', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dbeafe', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔵</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e40af' }}>Active Queue (FIFO)</h3>
                    <span style={{ fontSize: '11px', color: '#2563eb' }}>Pos #1 must be verified to call</span>
                  </div>
                </div>
                <span style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  {waitingTokens.length}
                </span>
              </div>

              {waitingTokens.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#3b82f6', fontSize: '13px' }}>
                  Active queue is empty.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {waitingTokens.map((t, idx) => {
                    const pos = t.queuePosition || (idx + 1);
                    const isPos1 = pos === 1;
                    return (
                      <div
                        key={t.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '8px',
                          border: isPos1 ? (t.isVerified ? '2px solid #10b981' : '2px dashed #f59e0b') : '1px solid #bfdbfe',
                          padding: '12px',
                          boxShadow: isPos1 ? '0 4px 12px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontWeight: 900,
                                fontSize: '13px',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: isPos1 ? (t.isVerified ? '#d1fae5' : '#fef3c7') : '#f1f5f9',
                                color: isPos1 ? (t.isVerified ? '#065f46' : '#92400e') : '#475569',
                              }}>
                                Pos #{pos}
                              </span>
                              <span style={{ fontWeight: 800, fontSize: '15px', color: '#004D40' }}>
                                {t.tokenCode || `AF-${String(t.dailyNumber || t.id).padStart(2, '0')}`}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{t.id}</span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#1e293b', marginTop: '3px' }}>
                              {t.name || 'Patient'} {t.age ? `(${t.gender || 'M'}, ${t.age}y)` : ''}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{t.category} &bull; {t.phone}</div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            {t.isVerified ? (
                              <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: '#dcfce7', color: '#15803D' }}>
                                Verified ✅
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#fef3c7', color: '#b45309' }}>
                                Unverified ⏳
                              </span>
                            )}
                            {t.noShowCount > 0 && (
                              <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 700, marginTop: '3px' }}>
                                Demoted {t.noShowCount}x
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <Button
                            size="sm"
                            variant={isPos1 ? 'primary' : 'secondary'}
                            onClick={() => setStatus(t.id, 'serving')}
                          >
                            Call Patient
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => noShow(t.id)}
                            title="Exponential demotion: drops 1, 2, 4, 8, 16 positions"
                          >
                            Not Come Yet
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setStatus(t.id, 'missed')}
                          >
                            Missed
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 3: 🔴 MISSED QUEUE (RIGHT) */}
            <div style={{ background: '#fef2f2', borderRadius: '12px', border: '1.5px solid #fecaca', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fee2e2', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔴</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#991b1b' }}>Missed Queue</h3>
                    <span style={{ fontSize: '11px', color: '#dc2626' }}>Exhausted demotions or skipped</span>
                  </div>
                </div>
                <span style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                  {missedTokens.length}
                </span>
              </div>

              {missedTokens.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#dc2626', fontSize: '13px' }}>
                  No missed patients.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {missedTokens.map((t) => (
                    <div key={t.id} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #fecaca', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '15px', color: '#991b1b' }}>
                              {t.tokenCode || `AF-${String(t.dailyNumber || t.id).padStart(2, '0')}`}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{t.id}</span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{t.name || 'Patient'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{t.category} &bull; {t.phone}</div>
                        </div>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fee2e2', color: '#991b1b' }}>
                          Missed
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="primary" onClick={() => requeueMissed(t.id)}>
                          Requeue to Front
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => rejectMissed(t.id)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {anomaly?.length > 0 && (
            <Card title="Heading-to-hospital grace window">
              <Table
                columns={[
                  { key: 'id', header: 'ID', render: (r) => `#${r.id}` },
                  { key: 'name', header: 'Name' },
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
