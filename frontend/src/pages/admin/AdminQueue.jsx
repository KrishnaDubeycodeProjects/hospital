import React, { useCallback, useEffect, useState } from 'react';
import { hospitalApi, queueApi } from '../../api/client';
import QrScanner from '../../components/QrScanner';
import { Button, Card, Field, Input, Modal, Select, Spinner, StatusBadge, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { Search, BarChart3, Users, Clock, CheckCircle2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'stats'

  // Independent search queries for each tab
  const [freezeSearch, setFreezeSearch] = useState('');
  const [waitingSearch, setWaitingSearch] = useState('');
  const [missedSearch, setMissedSearch] = useState('');

  const toast = useToast();

  useEffect(() => {
    hospitalApi.list().then((list) => {
      const arr = Array.isArray(list) ? list : list?.data || [];
      setHospitals(arr);
    }).catch(() => {});
    hospitalApi.categories().then((cats) => {
      const arr = Array.isArray(cats) ? cats : cats?.data || [];
      setCategories(arr);
    }).catch(() => {});
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
    if (e) e.preventDefault();
    if (!verifyId) return;
    try {
      const res = await queueApi.verify({ tokenId: Number(verifyId) });
      toast.success(res.message || 'Token verified successfully');
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

  // Filter lists based on independent search terms across all attributes
  function filterList(tokens, search) {
    if (!search || !search.trim()) return tokens;
    const q = search.toLowerCase().trim();
    return tokens.filter((t) => {
      const idStr = String(t.id || '');
      const numStr = String(t.dailyNumber || '');
      const codeStr = (t.tokenCode || '').toLowerCase();
      const nameStr = (t.name || '').toLowerCase();
      const phoneStr = (t.phone || '').toLowerCase();
      const catStr = (t.category || '').toLowerCase();
      return (
        idStr.includes(q) ||
        numStr.includes(q) ||
        codeStr.includes(q) ||
        nameStr.includes(q) ||
        phoneStr.includes(q) ||
        catStr.includes(q)
      );
    });
  }

  const filteredFrozen = filterList([...frozenTokens, ...reservedTokens], freezeSearch);
  const filteredWaiting = filterList(waitingTokens, waitingSearch);
  const filteredMissed = filterList(missedTokens, missedSearch);

  // Statistics calculation
  const totalAppointments = (queue?.stats?.total ?? (waitingTokens.length + reservedTokens.length + frozenTokens.length + missedTokens.length + (servingToken ? 1 : 0))) || 0;
  const walkinAppointments = waitingTokens.length + (servingToken ? 1 : 0);
  const onlineAppointments = frozenTokens.length + reservedTokens.length;
  const completedToday = queue?.stats?.completed ?? (queue?.historyCount || 0);

  return (
    <div className="stack-lg">
      {/* Top Header with Tab Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Hospital Queue &amp; Analytics</h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>Real-time synchronized control for OPD Flow and Operational Metrics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              style={{
                border: 'none',
                background: activeTab === 'queue' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'queue' ? '#0F172A' : '#64748B',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'queue' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Queue Board
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              style={{
                border: 'none',
                background: activeTab === 'stats' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'stats' ? '#0F172A' : '#64748B',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'stats' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <BarChart3 size={14} color="#2563EB" />
              <span>Statistics</span>
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={13} style={{ marginRight: '5px' }} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Shared Filters */}
      <Card title="Department &amp; Hospital Filters">
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

      {/* TAB 1: STATISTICS & ANALYTICS (Clean, Non-Overwhelming & Mobile-Friendly) */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Metric Cards matching Image 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #0284C7', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Appointments</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>{totalAppointments}</div>
              <div style={{ fontSize: '11.5px', color: '#0284C7', marginTop: '4px', fontWeight: 600 }}>Active patient load today</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #EF4444', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Online Appointments</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#EF4444', marginTop: '6px' }}>{onlineAppointments}</div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>WhatsApp / Digital token bookings</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #F59E0B', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Walk-in Appointments</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#F59E0B', marginTop: '6px' }}>{walkinAppointments}</div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>Checked in at reception desk</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', borderTop: '4px solid #25D366', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Completed Visits</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#16A34A', marginTop: '6px' }}>{completedToday}</div>
              <div style={{ fontSize: '11.5px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>Discharged / e-Prescription sent</div>
            </div>
          </div>

          {/* Visual Trend & Distribution Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <Card title="Appointment Flow Trends">
              <div style={{ height: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', padding: '20px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '120px', marginBottom: '16px' }}>
                  <div style={{ width: '28px', height: '65%', backgroundColor: '#0284C7', borderRadius: '4px 4px 0 0', title: 'Total' }} />
                  <div style={{ width: '28px', height: '35%', backgroundColor: '#EF4444', borderRadius: '4px 4px 0 0', title: 'Online' }} />
                  <div style={{ width: '28px', height: '50%', backgroundColor: '#F59E0B', borderRadius: '4px 4px 0 0', title: 'Walk-in' }} />
                  <div style={{ width: '28px', height: '80%', backgroundColor: '#25D366', borderRadius: '4px 4px 0 0', title: 'Completed' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11.5px', color: '#64748B', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284C7' }} /> Total
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> Online
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Walkin
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#25D366' }} /> Completed
                  </span>
                </div>
              </div>
            </Card>

            <Card title="Patient Queue Breakdown">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#166534' }}>Active Consultation</span>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#166534' }}>{servingToken ? 1 : 0} patient</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#1E40AF' }}>Waiting in OPD Lounge</span>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#1E40AF' }}>{waitingTokens.length} patients</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#6B21A8' }}>En Route &bull; Distant Frozen Buffer</span>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#6B21A8' }}>{frozenTokens.length + reservedTokens.length} patients</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B' }}>Missed / Requeue Required</span>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#991B1B' }}>{missedTokens.length} patients</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: QUEUE DASHBOARD (With Search Bars and 1.7x Height Container) */}
      {activeTab === 'queue' && (
        <>
          {/* Quick Reception Check-in: Verify Button */}
          <Card
            title="Quick Reception Check-in"
            actions={
              <Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
                Scan QR
              </Button>
            }
          >
            <form onSubmit={doVerify} className="row-gap" style={{ display: 'flex', gap: '8px' }}>
              <Input
                value={verifyId}
                onChange={(e) => setVerifyId(e.target.value)}
                placeholder="Enter Token ID (e.g. 15)"
                inputMode="numeric"
                style={{ flex: 1 }}
              />
              <Button
                type="submit"
                style={{
                  backgroundColor: '#25D366',
                  borderColor: '#25D366',
                  color: '#ffffff',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                Verify
              </Button>
            </form>
          </Card>

          <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan patient's QR code">
            {scanOpen && <QrScanner onResult={verifyFromQr} />}
          </Modal>

          {loading ? (
            <Spinner label="Synchronizing hospital queue..." />
          ) : (
            /* 3-Section Queue Dashboard Grid */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {/* SECTION 1: ❄️ FREEZE & RESERVED BUFFER (LEFT) */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>❄️</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#334155' }}>Freeze &amp; Buffer</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Traveling patients &bull; Auto-releases</span>
                    </div>
                  </div>
                  <span style={{ background: '#e2e8f0', color: '#334155', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px' }}>
                    {filteredFrozen.length}
                  </span>
                </div>

                {/* Individual Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={freezeSearch}
                    onChange={(e) => setFreezeSearch(e.target.value)}
                    placeholder="Search Freeze by name, ID, phone..."
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Scrollable Container with Height 1.7x of 1 Patient Container (~310px) */}
                <div
                  style={{
                    height: '310px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingRight: '4px',
                  }}
                >
                  {filteredFrozen.length === 0 ? (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                      {freezeSearch ? 'No matching frozen patients.' : 'No patients currently frozen or in buffer.'}
                    </div>
                  ) : (
                    filteredFrozen.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          padding: '10px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                                {t.tokenCode || `AF-${String(t.dailyNumber || t.id).padStart(2, '0')}`}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>#{t.id}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#1E293B', marginTop: '2px' }}>
                              {t.name || 'Patient'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {t.category} &bull; {t.phone}
                            </div>
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>
                            {t.status === 'frozen' ? 'Frozen ❄️' : 'Buffer 🟡'}
                          </span>
                        </div>

                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="primary" onClick={() => releaseFrozen(t.id)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                            Release
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => directVerifyToken(t.id)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                            Verify
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SECTION 2: 🔵 ACTIVE WAITING QUEUE (MIDDLE) */}
              <div
                style={{
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  border: '1.5px solid #bbf7d0',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🔵</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#166534' }}>Waiting Queue</h3>
                      <span style={{ fontSize: '11px', color: '#15803d' }}>Next in turn &bull; Main clinic FIFO</span>
                    </div>
                  </div>
                  <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px' }}>
                    {filteredWaiting.length}
                  </span>
                </div>

                {/* Individual Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={waitingSearch}
                    onChange={(e) => setWaitingSearch(e.target.value)}
                    placeholder="Search Waiting by name, ID, phone..."
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Scrollable Container with Height 1.7x of 1 Patient Container (~310px) */}
                <div
                  style={{
                    height: '310px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingRight: '4px',
                  }}
                >
                  {filteredWaiting.length === 0 ? (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: '#16a34a', fontSize: '12.5px' }}>
                      {waitingSearch ? 'No matching waiting patients.' : 'Waiting queue is clear.'}
                    </div>
                  ) : (
                    filteredWaiting.map((t, idx) => {
                      const pos = t.queuePosition || (idx + 1);
                      return (
                        <div
                          key={t.id}
                          style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: pos === 1 ? '1.5px solid #25D366' : '1px solid #dcfce7',
                            padding: '10px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontWeight: 800,
                                    fontSize: '11px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: pos === 1 ? '#dcfce7' : '#f1f5f9',
                                    color: pos === 1 ? '#15803d' : '#475569',
                                  }}
                                >
                                  #{pos}
                                </span>
                                <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                                  {t.tokenCode || `AF-${String(t.dailyNumber || t.id).padStart(2, '0')}`}
                                </span>
                              </div>
                              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#1E293B', marginTop: '2px' }}>
                                {t.name || 'Patient'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                {t.category} &bull; {t.phone}
                              </div>
                            </div>
                            <div>
                              {t.isVerified ? (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 5px', borderRadius: '4px', background: '#dcfce7', color: '#166534' }}>
                                  Verified ✓
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: '#fef3c7', color: '#92400e' }}>
                                  Unverified
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setStatus(t.id, 'serving')}
                              style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: '#25D366', borderColor: '#25D366' }}
                            >
                              Call
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => noShow(t.id)}
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                            >
                              Push Back
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setStatus(t.id, 'missed')}
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                            >
                              Missed
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECTION 3: 🔴 MISSED QUEUE (RIGHT) */}
              <div
                style={{
                  background: '#fef2f2',
                  borderRadius: '12px',
                  border: '1.5px solid #fecaca',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🔴</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>Missed Queue</h3>
                      <span style={{ fontSize: '11px', color: '#dc2626' }}>Patients needing requeue</span>
                    </div>
                  </div>
                  <span style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '12px', padding: '2px 8px', borderRadius: '12px' }}>
                    {filteredMissed.length}
                  </span>
                </div>

                {/* Individual Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={missedSearch}
                    onChange={(e) => setMissedSearch(e.target.value)}
                    placeholder="Search Missed by name, ID, phone..."
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Scrollable Container with Height 1.7x of 1 Patient Container (~310px) */}
                <div
                  style={{
                    height: '310px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingRight: '4px',
                  }}
                >
                  {filteredMissed.length === 0 ? (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: '#dc2626', fontSize: '12.5px' }}>
                      {missedSearch ? 'No matching missed patients.' : 'No missed patients.'}
                    </div>
                  ) : (
                    filteredMissed.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #fee2e2',
                          padding: '10px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, fontSize: '14px', color: '#991B1B' }}>
                                {t.tokenCode || `AF-${String(t.dailyNumber || t.id).padStart(2, '0')}`}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>#{t.id}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#1E293B', marginTop: '2px' }}>
                              {t.name || 'Patient'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {t.category} &bull; {t.phone}
                            </div>
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: '#fee2e2', color: '#991b1b' }}>
                            Missed
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="primary" onClick={() => requeueMissed(t.id)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                            Requeue
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => rejectMissed(t.id)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
