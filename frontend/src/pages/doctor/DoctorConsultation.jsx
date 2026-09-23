import React, { useEffect, useState } from 'react';
import { courseApi, doctorApi, drugApi, hospitalApi, queueApi } from '../../api/client';
import { Button, Card, Field, Input, Modal, Select, Spinner, Textarea } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

function DrugInputWithLiveRegistry({ value, onChange, onSelectSuggestion }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await drugApi.search(query);
        setSuggestions(res || []);
        setOpen((res || []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <Input
        placeholder="Search Eka Care Registry (e.g. Paracetamol)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 60,
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, sIdx) => (
            <div
              key={sIdx}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '13px',
              }}
              onMouseDown={() => {
                onSelectSuggestion(s);
                setOpen(false);
              }}
            >
              <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{s.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    color: s.isNlem ? '#059669' : '#0284c7',
                    background: s.isNlem ? '#d1fae5' : '#e0f2fe',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {s.isNlem ? 'NLEM ESSENTIAL' : 'EKA CARE LIVE'}
                </span>
              </div>
              {s.genericName && (
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {s.genericName} {s.form ? `• ${s.form}` : ''} {s.strength ? `• ${s.strength}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LabInputWithLiveRegistry({ value, onChange, onSelectSuggestion }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await drugApi.searchLabs(query);
        setSuggestions(res || []);
        setOpen((res || []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <Input
        placeholder="Search Eka Care Labs (e.g. CBC, HbA1c, LFT, Sputum AFB)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 60,
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, sIdx) => (
            <div
              key={sIdx}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '13px',
              }}
              onMouseDown={() => {
                onSelectSuggestion(s);
                setOpen(false);
              }}
            >
              <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{s.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    color: s.isLive ? '#0284c7' : '#059669',
                    background: s.isLive ? '#e0f2fe' : '#d1fae5',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {s.isLive ? 'EKA CARE LIVE LAB' : 'STANDARD LAB'}
                </span>
              </div>
              {(s.commonName || s.category) && (
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {s.category ? `${s.category} ` : ''} {s.sampleType ? `• ${s.sampleType}` : ''} {s.defaultTurnaroundHours ? `• Turnaround: ~${s.defaultTurnaroundHours}h` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DoctorConsultation() {
  const [profile, setProfile] = useState(null);
  const [currentQueue, setCurrentQueue] = useState(null);
  const [activeToken, setActiveToken] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  // Encounter form state
  const [courseId, setCourseId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [examinationFindings, setExaminationFindings] = useState('');
  const [plan, setPlan] = useState('');
  
  // Prescriptions list state
  const [prescriptions, setPrescriptions] = useState([
    { drugName: 'Paracetamol', dosage: '500mg', frequency: 'TDS (1-1-1)', durationDays: 3, instructions: 'After meals' }
  ]);

  // Lab orders state (Eka Care Medical DB & standard diagnostics)
  const [labOrders, setLabOrders] = useState([]);

  function addLabOrderRow(testName = '', instructions = '') {
    setLabOrders((prev) => [...prev, { testName, instructions }]);
  }

  function updateLabOrder(index, field, value) {
    setLabOrders((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeLabOrderRow(index) {
    setLabOrders((prev) => prev.filter((_, i) => i !== index));
  }

  // Referral state
  const [enableReferral, setEnableReferral] = useState(false);
  const [targetHospitalId, setTargetHospitalId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('General Medicine');
  const [referralReason, setReferralReason] = useState('');
  const [priorityTier, setPriorityTier] = useState('urgent_7d');

  // Result dialog
  const [completedResult, setCompletedResult] = useState(null);
  const toast = useToast();

  async function loadData() {
    try {
      const me = await doctorApi.me();
      setProfile(me);
      if (me.hospitalId) {
        const q = await queueApi.getQueue(me.hospitalId, me.category);
        setCurrentQueue(q);
        const cur = await queueApi.current(me.hospitalId, me.category);
        setActiveToken(cur);
      }
      const hospList = await hospitalApi.list();
      setHospitals(hospList || []);
    } catch (err) {
      toast.error(err.message || 'Failed loading doctor consultation data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      if (profile?.hospitalId) {
        queueApi.getQueue(profile.hospitalId, profile.category).then(setCurrentQueue).catch(() => {});
        queueApi.current(profile.hospitalId, profile.category).then(setActiveToken).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hospitalId]);

  const [showQueueBoard, setShowQueueBoard] = useState(true);

  async function handleCallPatient(tokenId) {
    try {
      await queueApi.updateStatus(tokenId, 'serving');
      toast.success(`Patient #${tokenId} called into chair!`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to call patient.');
    }
  }

  async function handleNoShow(tokenId) {
    try {
      await queueApi.noShow(tokenId);
      toast.success(`Patient #${tokenId} demoted exponentially.`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to push back patient.');
    }
  }

  async function handleRequeue(tokenId) {
    try {
      await queueApi.requeueMissed(tokenId);
      toast.success(`Patient #${tokenId} requeued to front.`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to requeue patient.');
    }
  }

  function addPrescriptionRow() {
    setPrescriptions((prev) => [
      ...prev,
      { drugName: '', dosage: '', frequency: 'BD (1-0-1)', durationDays: 5, instructions: '' }
    ]);
  }

  function removePrescriptionRow(idx) {
    setPrescriptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePrescription(idx, field, value) {
    setPrescriptions((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  async function handleCompleteAndNext(e) {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      toast.error('Please enter the Chief Complaint.');
      return;
    }

    let targetCourseId = courseId;

    setActionBusy(true);
    try {
      // 1. If no course ID is entered, create one automatically
      if (!targetCourseId) {
        const newCourse = await courseApi.create({
          patientPhone: activeToken?.phone || '+919999999999',
          patientName: activeToken?.name || 'Walk-in Patient',
          title: `Consultation - ${chiefComplaint.slice(0, 30)}`,
          courseType: 'acute',
          targetDepartment: profile?.category || 'General Medicine',
          primaryDiagnosis: chiefComplaint,
        });
        targetCourseId = newCourse.id;
        setCourseId(newCourse.id);
      }

      // 2. Prepare payload for Complete & Next
      const validLabs = labOrders.filter((l) => l.testName && l.testName.trim());
      const effectivePlan = validLabs.length > 0
        ? [plan, `Diagnostic Labs Ordered: ${validLabs.map((l) => l.testName + (l.instructions ? ' [' + l.instructions + ']' : '')).join(', ')}`].filter(Boolean).join(' | ')
        : plan;

      const payload = {
        currentTokenId: activeToken?.id || null,
        chiefComplaint,
        clinicalNotes,
        examinationFindings,
        plan: effectivePlan,
        prescriptions: prescriptions.filter((p) => p.drugName && p.drugName.trim()),
        referral: enableReferral
          ? {
              toHospitalId: Number(targetHospitalId),
              targetDepartment: targetDepartment || 'General Medicine',
              reason: referralReason || chiefComplaint,
              priorityTier,
            }
          : null,
      };

      if (enableReferral && !targetHospitalId) {
        toast.error('Please choose a destination hospital for the referral.');
        setActionBusy(false);
        return;
      }

      const res = await courseApi.completeAndNext(targetCourseId, payload);
      setCompletedResult(res);
      toast.success(res.message || 'Consultation completed! Patient notified via WhatsApp.');

      // Reset form
      setChiefComplaint('');
      setClinicalNotes('');
      setExaminationFindings('');
      setPlan('');
      setCourseId('');
      setLabOrders([]);
      setEnableReferral(false);
      setReferralReason('');

      // Reload queue
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error processing consultation.');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading consultation console..." />;

  if (!profile?.hospitalId) {
    return (
      <div className="stack-lg">
        <h1>Doctor Consultation Room</h1>
        <Card title="Hospital Affiliation Required">
          <p className="muted-text">
            You must be linked to a hospital before opening the consultation workbench.
          </p>
          <Button variant="primary" onClick={() => window.location.assign('/doctor')}>
            Go to Profile & Join Hospital
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Doctor Consultation Workbench</h1>
          <p className="muted-text">
            {profile.hospitalName} &bull; Counter {profile.counterId || '1'} ({profile.category || 'General'})
          </p>
        </div>
        <div className="row-gap">
          <span className="badge badge-green">Live Counter Active</span>
        </div>
      </div>

      {/* Active Token Call Board - OPDX 4 Metric Cards */}
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="opdx-stat-card blue">
          <div className="opdx-stat-title">In Chair</div>
          <div className="opdx-stat-number">{activeToken ? `#${activeToken.dailyNumber || activeToken.id}` : '—'}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
            {activeToken ? `${activeToken.name || 'Walk-in'} (${activeToken.gender || 'M'}, ${activeToken.age || ''}y)` : 'No patient in chair'}
          </div>
        </div>

        <div className="opdx-stat-card amber">
          <div className="opdx-stat-title">Waiting</div>
          <div className="opdx-stat-number">{currentQueue?.stats?.waiting ?? 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>In queue line</div>
        </div>

        <div className="opdx-stat-card green">
          <div className="opdx-stat-title">Completed</div>
          <div className="opdx-stat-number">{currentQueue?.stats?.completed ?? 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Consultations done</div>
        </div>

        <div className="opdx-stat-card red">
          <div className="opdx-stat-title">Missed / No-Show</div>
          <div className="opdx-stat-number">{currentQueue?.stats?.missed ?? 0}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Skipped tokens</div>
        </div>
      </div>

      {/* 3-Section Live Queue Dashboard for Doctor */}
      <Card
        title="Live Department Queue (3-Sections)"
        actions={
          <div className="row-gap">
            <Button size="sm" variant="ghost" onClick={() => setShowQueueBoard(!showQueueBoard)}>
              {showQueueBoard ? 'Hide Queue ▲' : 'Show Queue ▼'}
            </Button>
            <Button size="sm" variant="secondary" onClick={loadData}>
              Refresh
            </Button>
          </div>
        }
      >
        {showQueueBoard && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', alignItems: 'start' }}>
            
            {/* 1. 🟡 RESERVED / BUFFER QUEUE */}
            <div style={{ background: '#fffbeb', borderRadius: '10px', border: '1.5px solid #fde68a', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fef3c7', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#92400e' }}>🟡 Reserved (En Route)</span>
                <span style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                  {currentQueue?.reserved?.length ?? 0}
                </span>
              </div>
              {(!currentQueue?.reserved || currentQueue.reserved.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#b45309', fontSize: '12px' }}>
                  No patients in travel buffer.
                </div>
              ) : (
                currentQueue.reserved.map((t) => (
                  <div key={t.id} style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #fde68a', padding: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#004D40' }}>{t.tokenCode || `AF-${t.dailyNumber || t.id}`}</strong>
                      <span style={{ fontSize: '10px', color: '#92400e', background: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>
                        Buffer Active
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>{t.name || 'Patient'}</div>
                    <div style={{ color: '#78350f', fontSize: '11px', marginTop: '2px' }}>
                      📍 En Route &bull; Priority check-in ready
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 2. 🔵 ACTIVE FIFO QUEUE */}
            <div style={{ background: '#eff6ff', borderRadius: '10px', border: '1.5px solid #bfdbfe', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dbeafe', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#1e40af' }}>🔵 Active Queue (FIFO)</span>
                <span style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                  {currentQueue?.tokens?.filter((t) => t.status === 'waiting').length ?? 0}
                </span>
              </div>
              {(!currentQueue?.tokens || currentQueue.tokens.filter((t) => t.status === 'waiting').length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#2563eb', fontSize: '12px' }}>
                  No patients waiting.
                </div>
              ) : (
                currentQueue.tokens.filter((t) => t.status === 'waiting').map((t, idx) => {
                  const pos = t.queuePosition || (idx + 1);
                  const isPos1 = pos === 1;
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '6px',
                        border: isPos1 ? (t.isVerified ? '2px solid #10b981' : '2px dashed #f59e0b') : '1px solid #dbeafe',
                        padding: '8px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '11px',
                            background: isPos1 ? (t.isVerified ? '#d1fae5' : '#fef3c7') : '#f1f5f9',
                            color: isPos1 ? (t.isVerified ? '#065f46' : '#92400e') : '#475569',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}>
                            Pos #{pos}
                          </span>
                          <strong style={{ color: '#004D40' }}>{t.tokenCode || `AF-${t.dailyNumber || t.id}`}</strong>
                        </div>
                        {t.isVerified ? (
                          <span style={{ fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            Verified ✅
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>
                            Unverified ⏳
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                        {t.name || 'Patient'} {t.age ? `(${t.gender || 'M'}, ${t.age}y)` : ''}
                      </div>

                      <div style={{ display: 'flex', gap: '5px', marginTop: '6px', justifyContent: 'flex-end' }}>
                        <Button size="sm" variant={isPos1 ? 'primary' : 'secondary'} onClick={() => handleCallPatient(t.id)}>
                          Call to Chair
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleNoShow(t.id)} title="Exponential demote">
                          Not Come Yet
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 3. 🔴 MISSED QUEUE */}
            <div style={{ background: '#fef2f2', borderRadius: '10px', border: '1.5px solid #fecaca', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fee2e2', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#991b1b' }}>🔴 Missed Queue</span>
                <span style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 800, fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                  {currentQueue?.missed?.length ?? 0}
                </span>
              </div>
              {(!currentQueue?.missed || currentQueue.missed.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#dc2626', fontSize: '12px' }}>
                  No missed patients.
                </div>
              ) : (
                currentQueue.missed.map((t) => (
                  <div key={t.id} style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #fecaca', padding: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#991b1b' }}>{t.tokenCode || `AF-${t.dailyNumber || t.id}`}</strong>
                      <span style={{ fontSize: '10px', color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>
                        Missed
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>{t.name || 'Patient'}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleRequeue(t.id)}>
                        Requeue to Front
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}
      </Card>

      {/* Clinical Documentation Workspace */}
      <Card title="Clinical Notes & Prescription">
        <form onSubmit={handleCompleteAndNext} className="stack-md">
          <div className="field-row">
            <Field label="Active Token Reference" hint="Optional queue token ID to advance">
              <Input
                type="text"
                placeholder="Token ID (Auto-populated)"
                value={activeToken ? `Token #${activeToken.id} - ${activeToken.name || 'Patient'}` : ''}
                readOnly
              />
            </Field>

            <Field label="Course ID (Optional)" hint="Leave blank to automatically create a new Care Episode">
              <Input
                type="number"
                placeholder="Auto-generate or enter Course ID"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Chief Complaint *" hint="Core symptom or presenting issue">
            <Input
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Acute chest discomfort radiating to left arm for 2 hours"
              required
            />
          </Field>

          <div className="field-row">
            <Field label="Clinical Notes / History">
              <Textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Brief history of present illness..."
              />
            </Field>

            <Field label="Examination Findings">
              <Textarea
                rows={2}
                value={examinationFindings}
                onChange={(e) => setExaminationFindings(e.target.value)}
                placeholder="BP 130/85, Pulse 82 bpm, S1S2 heard, clear chest..."
              />
            </Field>
          </div>

          <Field label="Care & Management Plan">
            <Input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Immediate rest, ECG screening, hydration, 7-day follow-up"
            />
          </Field>

          {/* Rx Prescriptions Section */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Prescriptions (Rx)</h4>
              <Button type="button" size="sm" variant="secondary" onClick={addPrescriptionRow}>
                + Add Medication
              </Button>
            </div>

            {prescriptions.map((rx, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.2fr 1fr 2fr auto',
                  gap: '8px',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <DrugInputWithLiveRegistry
                  value={rx.drugName}
                  onChange={(val) => updatePrescription(idx, 'drugName', val)}
                  onSelectSuggestion={(drug) => {
                    updatePrescription(idx, 'drugName', drug.name);
                    if (drug.strength) updatePrescription(idx, 'dosage', drug.strength);
                    if (drug.defaultDosage && !drug.strength) updatePrescription(idx, 'dosage', drug.defaultDosage);
                    if (drug.defaultFrequency) updatePrescription(idx, 'frequency', drug.defaultFrequency);
                    if (drug.defaultDurationDays) updatePrescription(idx, 'durationDays', drug.defaultDurationDays);
                    if (drug.defaultInstructions) updatePrescription(idx, 'instructions', drug.defaultInstructions);
                  }}
                />
                <Input
                  placeholder="Dosage (500mg)"
                  value={rx.dosage}
                  onChange={(e) => updatePrescription(idx, 'dosage', e.target.value)}
                />
                <Input
                  placeholder="Freq (TDS / BD)"
                  value={rx.frequency}
                  onChange={(e) => updatePrescription(idx, 'frequency', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Days"
                  value={rx.durationDays}
                  onChange={(e) => updatePrescription(idx, 'durationDays', Number(e.target.value))}
                />
                <Input
                  placeholder="Instructions (After meals)"
                  value={rx.instructions}
                  onChange={(e) => updatePrescription(idx, 'instructions', e.target.value)}
                />
                {prescriptions.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removePrescriptionRow(idx)}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Diagnostic Investigations / Lab Orders Section (Eka Care Live Medical DB) */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Diagnostic Investigations & Labs</h4>
                <p className="muted-text" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                  Standardized pathology and radiology orders backed by Eka Care Medical Database
                </p>
              </div>
              <div className="row-gap">
                <Button type="button" size="sm" variant="secondary" onClick={() => addLabOrderRow()}>
                  + Add Lab Test
                </Button>
              </div>
            </div>

            {/* Quick Add Presets for Indian Rural Healthcare */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>Quick Add:</span>
              {[
                { name: 'Complete Blood Count (CBC)', note: 'Routine fever / infection panel' },
                { name: 'Fasting Blood Sugar (FBS)', note: '10hr overnight fasting' },
                { name: 'Lipid Profile', note: 'Dyslipidemia screening' },
                { name: 'Liver Function Tests (LFT)', note: 'Hepatic workup' },
                { name: 'Sputum for AFB', note: 'Suspected Tuberculosis (2 samples)' },
                { name: 'Urine Routine & Microscopic', note: 'UTI screening' },
              ].map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => addLabOrderRow(preset.name, preset.note)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    color: '#334155',
                    fontWeight: 600,
                  }}
                >
                  + {preset.name}
                </button>
              ))}
            </div>

            {labOrders.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', color: '#94a3b8', fontSize: '13px' }}>
                No diagnostic investigations added. Click "+ Add Lab Test" or use a Quick Add preset above.
              </div>
            ) : (
              labOrders.map((lab, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 3fr auto',
                    gap: '8px',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <LabInputWithLiveRegistry
                    value={lab.testName}
                    onChange={(val) => updateLabOrder(idx, 'testName', val)}
                    onSelectSuggestion={(sug) => {
                      updateLabOrder(idx, 'testName', sug.name);
                      if (sug.instructions && !lab.instructions) {
                        updateLabOrder(idx, 'instructions', sug.instructions);
                      }
                    }}
                  />
                  <Input
                    placeholder="Instructions / Clinical indication (e.g. Fasting sample)"
                    value={lab.instructions}
                    onChange={(e) => updateLabOrder(idx, 'instructions', e.target.value)}
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeLabOrderRow(idx)}>
                    ✕
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Tiered Quota-Locked Referral */}
          <div
            style={{
              marginTop: '16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              background: enableReferral ? 'var(--secondary-tint)' : 'var(--surface-sunken)',
            }}
          >
            <label className="checkbox-label" style={{ fontWeight: 700, fontSize: '15px' }}>
              <input
                type="checkbox"
                checked={enableReferral}
                onChange={(e) => setEnableReferral(e.target.checked)}
              />
              Issue Priority Tiered Referral (Direct Quota Allocation)
            </label>

            {enableReferral && (
              <div className="stack-sm" style={{ marginTop: '14px' }}>
                <div className="field-row">
                  <Field label="Destination Hospital *">
                    <Select
                      value={targetHospitalId}
                      onChange={(e) => setTargetHospitalId(e.target.value)}
                      required={enableReferral}
                    >
                      <option value="">Select target hospital…</option>
                      {hospitals
                        .filter((h) => h.id !== profile.hospitalId)
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} (Urgent Quota: {h.urgentReferralQuota ?? 5}/day)
                          </option>
                        ))}
                    </Select>
                  </Field>

                  <Field label="Target Department">
                    <Select value={targetDepartment} onChange={(e) => setTargetDepartment(e.target.value)}>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="General Surgery">General Surgery</option>
                      <option value="General Medicine">General Medicine</option>
                    </Select>
                  </Field>

                  <Field label="Priority Tier">
                    <Select value={priorityTier} onChange={(e) => setPriorityTier(e.target.value)}>
                      <option value="emergency_immediate">🚨 Emergency (Immediate 24h)</option>
                      <option value="urgent_7d">⚡ Urgent (Strict 7-Day Quota)</option>
                      <option value="routine_30d">📋 Routine (30 Days)</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Reason for Transfer / Hospital Referral">
                  <Input
                    placeholder="e.g. Higher tertiary cardiac monitoring required"
                    value={referralReason}
                    onChange={(e) => setReferralReason(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Atomic Complete & Next Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <Button
              type="submit"
              size="lg"
              variant="primary"
              loading={actionBusy}
              style={{ minWidth: '240px', justifyContent: 'center' }}
            >
              ✓ Complete & Next Patient
            </Button>
          </div>
        </form>
      </Card>

      {/* Completion Summary Dialog */}
      {completedResult && (
        <Modal
          open={Boolean(completedResult)}
          title="Consultation Successfully Finalized"
          onClose={() => setCompletedResult(null)}
        >
          <div className="stack-md">
            <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontWeight: 700, color: '#047857' }}>
                🎉 Patient Record Synchronized & WhatsApp Summary Dispatched
              </div>
              <div style={{ fontSize: '13px', color: '#065f46', marginTop: '4px' }}>
                Prescriptions recorded, active queue token marked completed, and post-commit WhatsApp notification sent.
              </div>
            </div>

            {/* ABDM Official FHIR R4 Bundle Link */}
            <div style={{ border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0369a1' }}>
                  🏛️ ABDM M2 Care Context: Registered
                </span>
                <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  NRCES FHIR R4
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#0c4a6e', marginTop: '4px' }}>
                Official FHIR R4 Document Bundle generated (OPConsultRecord profile) for NHA Sandbox evaluation.
              </div>
              {completedResult.encounter && (
                <div style={{ marginTop: '8px' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const cId = completedResult.course?.id || completedResult.encounter?.courseId || courseId || 1;
                      window.open(`/api/abdm/courses/${cId}/encounters/${completedResult.encounter.id}/fhir`, '_blank');
                    }}
                  >
                    🔍 Inspect Official FHIR R4 Bundle (JSON)
                  </Button>
                </div>
              )}
            </div>

            {completedResult.referral && (
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>
                  🏥 Referral Issued: #{completedResult.referral.id}
                </div>
                <div className="muted-text" style={{ fontSize: '13px' }}>
                  Destination: {completedResult.referral.toHospitalName || 'Apex Hospital'} &bull; Tier: {completedResult.referral.priorityTier}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <img
                    src={referralApi.qrUrl(completedResult.referral.id)}
                    alt="Referral QR"
                    style={{ width: '130px', height: '130px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="primary"
              className="full-width"
              onClick={() => setCompletedResult(null)}
            >
              Continue with Next Patient
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
