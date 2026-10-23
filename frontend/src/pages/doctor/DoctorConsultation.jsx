import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseApi, doctorApi, drugApi, hospitalApi, queueApi } from '../../api/client';
import { Button, Card, Field, Input, Modal, Select, Spinner, Textarea, fmtDateTime, fmtMinutes } from '../../components/ui';
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
        placeholder="Search medicines (e.g. Paracetamol)"
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
        placeholder="Search lab tests (e.g. Blood Test, CBC, Sugar, Urine)"
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

function formatTokenLabel(t, fallbackIndex = null) {
  if (!t) return '-';
  if (t.tokenCode && !t.tokenCode.includes('null')) return t.tokenCode;
  if (t.dailyNumber) return `AF-${String(t.dailyNumber).padStart(2, '0')}`;
  if (fallbackIndex != null) return `Buffer #${fallbackIndex + 1}`;
  return 'Buffer Token';
}

export default function DoctorConsultation() {
  const navigate = useNavigate();
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
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const toast = useToast();

  async function loadData() {
    try {
      let me = null;
      try {
        me = await doctorApi.me();
        if (me) setProfile(me);
      } catch (e) {
        console.warn('Doctor profile load note:', e);
      }
      const effectiveHospId = me?.hospitalId || profile?.hospitalId || 1;
      const effectiveCategory = me?.category || profile?.category || 'General Medicine';

      const q = await queueApi.getQueue(effectiveHospId, effectiveCategory);
      setCurrentQueue(q);
      try {
        const cur = await queueApi.current(effectiveHospId, effectiveCategory);
        setActiveToken(cur);
      } catch (e) {}

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
      const effectiveHospId = profile?.hospitalId || 1;
      const effectiveCategory = profile?.category || 'General Medicine';
      queueApi.getQueue(effectiveHospId, effectiveCategory).then(setCurrentQueue).catch(() => {});
      queueApi.current(effectiveHospId, effectiveCategory).then(setActiveToken).catch(() => {});
    }, 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hospitalId, profile?.category]);

  const [showQueueBoard, setShowQueueBoard] = useState(true);

  // Doctor Test Environment Sandbox State
  const [testModeOpen, setTestModeOpen] = useState(false);
  const [testPatientName, setTestPatientName] = useState('Ramesh Kumar');
  const [testPatientAge, setTestPatientAge] = useState('28');
  const [testPatientGender, setTestPatientGender] = useState('male');
  const [testPatientPhone, setTestPatientPhone] = useState('+919100000099');
  const [testDistanceKm, setTestDistanceKm] = useState('18.5');
  const [testTravelMinutes, setTestTravelMinutes] = useState('45');
  const [testTargetStatus, setTestTargetStatus] = useState('waiting');
  const [testSelectedTokenId, setTestSelectedTokenId] = useState('');
  const [testCreating, setTestCreating] = useState(false);

  async function handleAddTestPatient(overrideStatus = null) {
    const effectiveHospId = profile?.hospitalId || 1;
    const effectiveCategory = profile?.category || 'General Medicine';
    setTestCreating(true);
    const targetStatus = overrideStatus || testTargetStatus || 'waiting';
    try {
      const resp = await fetch('/api/test/queue/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testPatientName || 'Demo Patient',
          age: parseInt(testPatientAge) || 30,
          gender: testPatientGender || 'male',
          phone: testPatientPhone || '+919100000099',
          category: effectiveCategory,
          hospitalId: effectiveHospId,
          status: targetStatus,
          distanceKm: testDistanceKm ? parseFloat(testDistanceKm) : (targetStatus === 'frozen' ? 18.5 : 2.5),
          travelMinutes: testTravelMinutes ? parseInt(testTravelMinutes) : (targetStatus === 'frozen' ? 45 : 10),
        }),
      });
      const data = await resp.json();
      if (data.success) {
        const displayLabel = data.data?.tokenCode || (data.data?.dailyNumber ? `Token #${data.data.dailyNumber}` : 'Buffer Token');
        toast.success(`Patient ${displayLabel} (${testPatientName}) added to queue as ${targetStatus.toUpperCase()}!`);
        if (data.data?.id) {
          setTestSelectedTokenId(String(data.data.id));
        }
        setShowQueueBoard(true);
        await loadData();
      } else {
        toast.error(data.message || 'Failed to inject test patient');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to inject test patient');
    } finally {
      setTestCreating(false);
    }
  }

  async function handleUnfreeze(tokenId) {
    if (!tokenId) {
      toast.error('Please select a token to unfreeze');
      return;
    }
    try {
      const res = await queueApi.unfreeze(tokenId);
      const code = res?.data?.tokenCode || (res?.data?.dailyNumber ? `Token #${res.data.dailyNumber}` : `Token #${tokenId}`);
      toast.success(`${code} unfrozen & moved to Active FIFO queue!`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to unfreeze token');
    }
  }

  async function handleDirectCheckIn(tokenId) {
    if (!tokenId) {
      toast.error('Please select a token to check in');
      return;
    }
    try {
      const resp = await fetch('/api/queue/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: parseInt(tokenId) }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(data.message || `Token #${tokenId} checked in and verified successfully!`);
        loadData();
      } else {
        toast.error(data.message || 'Verification failed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to check in token');
    }
  }

  async function handleQuickStatusChange(tokenId, status) {
    if (!tokenId) {
      toast.error('Please select a token');
      return;
    }
    try {
      await queueApi.updateStatus(tokenId, status);
      toast.success(`Token #${tokenId} status changed to ${status}!`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Status update failed');
    }
  }

  async function handleCallPatient(tokenId) {
    try {
      await queueApi.updateStatus(tokenId, 'serving');
      toast.success(`Patient #${tokenId} called into chair! Redirecting to Serving Console...`);
      navigate(`/doctor/serve/${tokenId}`);
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
          <h1>Doctor Consultation Room</h1>
          <p className="muted-text">
            {profile.hospitalName} &bull; Counter {profile.counterId || '1'} ({profile.category || 'General'})
          </p>
        </div>
        <div className="row-gap">
          <Button
            size="sm"
            variant={testModeOpen ? 'primary' : 'secondary'}
            onClick={() => setTestModeOpen(!testModeOpen)}
            style={{
              backgroundColor: testModeOpen ? '#059669' : '#F0FDF4',
              color: testModeOpen ? '#ffffff' : '#166534',
              border: '1px solid #BBF7D0',
              fontWeight: 700,
            }}
          >
            🧪 {testModeOpen ? 'Test Sandbox Active' : 'Test Environment'}
          </Button>
          <span className="badge badge-green">Live Counter Active</span>
        </div>
      </div>

      {/* 🧪 Doctor Test Environment Sandbox */}
      {testModeOpen && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '2px solid #86EFAC',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #BBF7D0', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🧪</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                  Doctor Queue Sandbox & Simulation Control
                </h3>
                <span style={{ fontSize: '12px', color: '#15803D' }}>
                  Inject test patients, select & reserve custom tokens, trigger 1-click check-ins, or manipulate queue states.
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setTestModeOpen(false)}
              style={{ fontWeight: 700 }}
            >
              ❌ Exit Test Mode
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Box 1: Add Test Patient */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#166534', marginBottom: '10px' }}>
                ➕ Add / Inject Test Patient
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Input
                  value={testPatientName}
                  onChange={(e) => setTestPatientName(e.target.value)}
                  placeholder="Patient Name"
                  style={{ fontSize: '13px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Input
                    value={testPatientAge}
                    onChange={(e) => setTestPatientAge(e.target.value)}
                    placeholder="Age"
                    type="number"
                    style={{ fontSize: '13px' }}
                  />
                  <Select
                    value={testPatientGender}
                    onChange={(e) => setTestPatientGender(e.target.value)}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <Input
                  value={testPatientPhone}
                  onChange={(e) => setTestPatientPhone(e.target.value)}
                  placeholder="Phone (+91...)"
                  style={{ fontSize: '13px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Input
                    value={testDistanceKm}
                    onChange={(e) => setTestDistanceKm(e.target.value)}
                    placeholder="Distance (km, e.g. 18.5)"
                    type="number"
                    step="0.1"
                    style={{ fontSize: '13px' }}
                    title="Distance in km"
                  />
                  <Input
                    value={testTravelMinutes}
                    onChange={(e) => setTestTravelMinutes(e.target.value)}
                    placeholder="Travel (min, e.g. 45)"
                    type="number"
                    style={{ fontSize: '13px' }}
                    title="Estimated travel time in minutes"
                  />
                </div>
                <Select
                  value={testTargetStatus}
                  onChange={(e) => setTestTargetStatus(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 600 }}
                >
                  <option value="waiting">🔵 Initial State: Waiting in Clinic</option>
                  <option value="frozen">❄️ Initial State: Distant Patient (Traveling)</option>
                  <option value="reserved">🟡 Initial State: Arriving Soon</option>
                  <option value="serving">🪑 Initial State: In Consultation</option>
                  <option value="missed">🔴 Initial State: Missed Turn</option>
                </Select>
                <Button
                  size="sm"
                  variant="primary"
                  loading={testCreating}
                  onClick={() => handleAddTestPatient(testTargetStatus)}
                  style={{ width: '100%', fontWeight: 700, fontSize: '12px', marginTop: '2px' }}
                >
                  ➕ Add to Queue ({testTargetStatus.toUpperCase()})
                </Button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '2px' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={testCreating}
                    onClick={() => handleAddTestPatient('waiting')}
                    style={{ fontSize: '11px', fontWeight: 700, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1e40af' }}
                  >
                    🔵 Waiting
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={testCreating}
                    onClick={() => handleAddTestPatient('frozen')}
                    style={{ fontSize: '11px', fontWeight: 700, border: '1px solid #99f6e4', backgroundColor: '#f0fdfa', color: '#0f766e' }}
                  >
                    ❄️ Frozen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={testCreating}
                    onClick={() => handleAddTestPatient('reserved')}
                    style={{ fontSize: '11px', fontWeight: 700, border: '1px solid #fde68a', backgroundColor: '#fffbeb', color: '#92400e' }}
                  >
                    🟡 Reserved
                  </Button>
                </div>
              </div>
            </div>

            {/* Box 2: Select Token & 1-Click Actions */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#166534', marginBottom: '10px' }}>
                🎯 Select Token & 1-Click Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Select
                  value={testSelectedTokenId}
                  onChange={(e) => setTestSelectedTokenId(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="">-- Choose Token from Any Queue --</option>
                  {(currentQueue?.frozen || []).map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      ❄️ {formatTokenLabel(t, idx)} - {t.name} (Frozen Buffer - {t.distanceKm ? t.distanceKm + 'km' : 'Far'})
                    </option>
                  ))}
                  {(currentQueue?.tokens?.filter((t) => t.status === 'waiting') || []).map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      🔵 {formatTokenLabel(t, idx)} - {t.name} (Waiting FIFO - Pos #{t.queuePosition || idx + 1})
                    </option>
                  ))}
                  {(currentQueue?.reserved || []).map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      🟡 {formatTokenLabel(t, idx)} - {t.name} (Reserved Buffer)
                    </option>
                  ))}
                  {(currentQueue?.missed || []).map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      🔴 {formatTokenLabel(t, idx)} - {t.name} (Missed Queue)
                    </option>
                  ))}
                </Select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!testSelectedTokenId}
                    onClick={() => handleDirectCheckIn(testSelectedTokenId)}
                    style={{ fontSize: '12px', fontWeight: 700 }}
                  >
                    ✅ 1-Click Check-In
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!testSelectedTokenId}
                    onClick={() => handleUnfreeze(testSelectedTokenId)}
                    style={{ fontSize: '12px', fontWeight: 700, backgroundColor: '#E0F2FE', color: '#0369A1' }}
                  >
                    ⚡ Move to Waiting
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!testSelectedTokenId}
                  onClick={() => handleCallPatient(testSelectedTokenId)}
                  style={{ width: '100%', fontSize: '12.5px', fontWeight: 700 }}
                >
                  📞 Call Selected Patient to Chair
                </Button>
              </div>
            </div>

            {/* Box 3: Quick Status Override */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#166534', marginBottom: '10px' }}>
                🔄 Queue Status Transition Override
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px' }}>
                Quickly test edge cases and state machine transitions for Token #{testSelectedTokenId || activeToken?.id || '—'}:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleQuickStatusChange(testSelectedTokenId || activeToken?.id, 'waiting')}
                  disabled={!testSelectedTokenId && !activeToken?.id}
                  style={{ fontSize: '11.5px', border: '1px solid #cbd5e1' }}
                >
                  Set: Waiting
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleQuickStatusChange(testSelectedTokenId || activeToken?.id, 'frozen')}
                  disabled={!testSelectedTokenId && !activeToken?.id}
                  style={{ fontSize: '11.5px', border: '1px solid #99f6e4', color: '#0f766e', backgroundColor: '#f0fdfa' }}
                >
                  Set: Frozen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleQuickStatusChange(testSelectedTokenId || activeToken?.id, 'serving')}
                  disabled={!testSelectedTokenId && !activeToken?.id}
                  style={{ fontSize: '11.5px', border: '1px solid #93c5fd', color: '#1d4ed8' }}
                >
                  Set: Serving
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleQuickStatusChange(testSelectedTokenId || activeToken?.id, 'completed')}
                  disabled={!testSelectedTokenId && !activeToken?.id}
                  style={{ fontSize: '11.5px', border: '1px solid #86efac', color: '#15803d' }}
                >
                  Set: Completed
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleQuickStatusChange(testSelectedTokenId || activeToken?.id, 'missed')}
                  disabled={!testSelectedTokenId && !activeToken?.id}
                  style={{ fontSize: '11.5px', border: '1px solid #fca5a5', color: '#b91c1c' }}
                >
                  Set: Missed
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleQuickStatusChange(testSelectedTokenId || activeToken?.id, 'reserved')}
                  disabled={!testSelectedTokenId && !activeToken?.id}
                  style={{ fontSize: '11.5px', border: '1px solid #fde68a', color: '#92400e' }}
                >
                  Set: Reserved
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 Live Serving Patient Banner if active in chair */}
      {activeToken && (
        <div
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #e0f2fe 100%)',
            border: '2px solid #10b981',
            borderRadius: '12px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🪑</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>PATIENT IN CONSULTATION: #{activeToken.dailyNumber || activeToken.queuePosition || 1} ({activeToken.name || 'Patient'})</span>
                <span className="badge badge-green" style={{ fontSize: '11px', animation: 'pulse 1.5s infinite' }}>Serving Active</span>
              </div>
              <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                Phone: {activeToken.phone || '—'} &bull; Department: {activeToken.category || profile.category} &bull; Check-in: {fmtDateTime(activeToken.createdAt)}
              </div>
            </div>
          </div>
          <Button
            size="md"
            variant="primary"
            onClick={() => navigate(`/doctor/serve/${activeToken.id}`)}
            style={{
              fontWeight: 800,
              backgroundColor: '#10b981',
              borderColor: '#10b981',
              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
            }}
          >
            Open Consultation (Prescription & Records) →
          </Button>
        </div>
      )}

      {/* Active Token Call Board - OPDX 4 Metric Cards */}
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="opdx-stat-card blue" style={{ position: 'relative' }}>
          <div className="opdx-stat-title">In Chair</div>
          <div className="opdx-stat-number">{activeToken ? `#${activeToken.dailyNumber || activeToken.id}` : '—'}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
            {activeToken ? `${activeToken.name || 'Walk-in'} (${activeToken.gender || 'M'}, ${activeToken.age || ''}y)` : 'No patient in chair'}
          </div>
          {activeToken && (
            <div style={{ marginTop: '10px' }}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate(`/doctor/serve/${activeToken.id}`)}
                style={{ width: '100%', fontWeight: 800, backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                🩺 Open Consultation
              </Button>
            </div>
          )}
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

      {/* 4-Section Live Queue Dashboard for Doctor */}
      <Card
        title="Live Patient Queue"
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px', alignItems: 'start' }}>

            {/* 1. ❄️ FROZEN / TRAVEL BUFFER QUEUE */}
            <div style={{ background: '#f0fdfa', borderRadius: '10px', border: '1.5px solid #99f6e4', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccfbf1', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f766e' }}>❄️ Traveling Patients (Distant)</span>
                <span style={{ background: '#ccfbf1', color: '#0f766e', fontWeight: 800, fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                  {currentQueue?.frozen?.length ?? 0}
                </span>
              </div>
              {(!currentQueue?.frozen || currentQueue.frozen.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#0d9488', fontSize: '12px' }}>
                  No traveling patients waiting.
                </div>
              ) : (
                currentQueue.frozen.map((t) => (
                  <div key={t.id} style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #99f6e4', padding: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#0f766e' }}>{formatTokenLabel(t)}</strong>
                      <span style={{ fontSize: '10px', color: '#0f766e', background: '#ccfbf1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                        ❄️ Frozen Buffer
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
                      {t.name || 'Patient'} {t.age ? `(${t.gender || 'M'}, ${t.age}y)` : ''}
                    </div>
                    <div style={{ color: '#0d9488', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
                      📍 {t.distanceKm != null ? `${t.distanceKm} km` : '18.5 km'} &bull; {t.travelMinutes != null ? `${t.travelMinutes}m ETA` : '45m buffer'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleUnfreeze(t.id)} style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', flex: '1 1 auto', padding: '4px 8px' }}>
                        Unfreeze
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCallPatient(t.id)} style={{ fontSize: '11px', flex: '1 1 auto', padding: '4px 8px' }}>
                        Call Patient
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 2. 🟡 RESERVED / BUFFER QUEUE */}
            <div style={{ background: '#fffbeb', borderRadius: '10px', border: '1.5px solid #fde68a', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fef3c7', paddingBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#92400e' }}>🟡 Traveling / Arriving Soon</span>
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
                      <strong style={{ color: '#004D40' }}>{formatTokenLabel(t)}</strong>
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
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#1e40af' }}>🔵 Waiting in Clinic</span>
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
                          <strong style={{ color: '#004D40' }}>{formatTokenLabel(t)}</strong>
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

                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button size="sm" variant={isPos1 ? 'primary' : 'secondary'} onClick={() => handleCallPatient(t.id)} style={{ fontSize: '11px', flex: '1 1 auto', padding: '4px 8px' }}>
                          Call Patient
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleNoShow(t.id)} title="Move to later" style={{ fontSize: '11px', flex: '1 1 auto', padding: '4px 8px' }}>
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
                      <strong style={{ color: '#991b1b' }}>{formatTokenLabel(t)}</strong>
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
            <Field label="Current Patient" hint="Patient in consultation">
              <Input
                type="text"
                placeholder="Token ID (Auto-populated)"
                value={activeToken ? `${formatTokenLabel(activeToken)} - ${activeToken.name || 'Patient'}` : ''}
                readOnly
              />
            </Field>

            <Field label="Visit ID (Optional)" hint="Leave blank to create a new visit record">
              <Input
                type="number"
                placeholder="Auto-generate or enter Course ID"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Main Health Concern / Symptoms *" hint="What the patient came in for">
            <Input
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Fever, cough, headache, or body pain for 2 days"
              required
            />
          </Field>

          <div className="field-row">
            <Field label="Doctor's Notes & Medical History">
              <Textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Brief history of present illness..."
              />
            </Field>

            <Field label="Physical Checkup Findings">
              <Textarea
                rows={2}
                value={examinationFindings}
                onChange={(e) => setExaminationFindings(e.target.value)}
                placeholder="BP 130/85, Pulse 82 bpm, S1S2 heard, clear chest..."
              />
            </Field>
          </div>

          <Field label="Doctor Advice & Treatment Plan">
            <Input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Rest, plenty of water, follow-up in 5 days"
            />
          </Field>

          {/* Rx Prescriptions Section */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Prescriptions (Medicines)</h4>
                <p className="muted-text" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                  Standardized formulation, dosage, frequency, and instructions
                </p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={addPrescriptionRow}>
                + Add Medication
              </Button>
            </div>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '6px' }}>
              <div style={{ minWidth: '760px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 2fr 36px', gap: '8px', padding: '0 4px 6px', fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.04em' }}>
                  <span>MEDICATION & FORMULATION *</span>
                  <span>DOSAGE</span>
                  <span>FREQUENCY</span>
                  <span>DAYS</span>
                  <span>SPECIAL INSTRUCTIONS</span>
                  <span></span>
                </div>

                {prescriptions.map((rx, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 2fr 36px',
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
                      placeholder="How often (e.g. Twice daily)"
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
                      <Button type="button" size="sm" variant="ghost" onClick={() => removePrescriptionRow(idx)} style={{ padding: '4px' }}>
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
              Refer Patient to Another Hospital (Specialist Transfer)
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

                  <Field label="Urgency">
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
                  📋 Digital Health Record Saved
                </span>
                <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  Ayushman Health Network
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#0c4a6e', marginTop: '4px' }}>
                Consultation summary and prescriptions saved to the patient's Ayushman health record.
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
                    📄 View Health Record Data (FHIR)
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

      {/* Quick Prescription & Consultation Modal for Patient in Chair */}
      {showPrescriptionModal && (
        <Modal
          open={showPrescriptionModal}
          title={`Prescription & Care Plan: ${activeToken ? (activeToken.name || 'Patient') : 'Patient in Chair'}`}
          onClose={() => setShowPrescriptionModal(false)}
        >
          <div className="stack-md" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
            <div style={{ background: '#F0FDF4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #BBF7D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#166534', fontSize: '14px' }}>
                  Patient: {activeToken?.name || 'Walk-in'} ({activeToken?.gender || 'M'}, {activeToken?.age || '28'}y)
                </strong>
                <div style={{ fontSize: '11.5px', color: '#15803D', marginTop: '2px' }}>
                  Queue Token #{activeToken?.dailyNumber || activeToken?.id || '—'} &bull; Phone: {activeToken?.phone || '+91 9100000099'}
                </div>
              </div>
              <span className="badge badge-green">In Chair</span>
            </div>

            <form
              onSubmit={(e) => {
                setShowPrescriptionModal(false);
                handleCompleteAndNext(e);
              }}
              className="stack-md"
            >
              <Field label="Main Health Concern / Symptoms *" hint="What the patient came in for">
                <Input
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Mild fever, dry cough, throat irritation for 2 days"
                  required
                />
              </Field>

              <div className="field-row">
                <Field label="Doctor's Notes">
                  <Textarea
                    rows={2}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Patient reports symptom onset 48 hours ago..."
                  />
                </Field>

                <Field label="Physical Checkup Findings">
                  <Textarea
                    rows={2}
                    value={examinationFindings}
                    onChange={(e) => setExaminationFindings(e.target.value)}
                    placeholder="BP 120/80, SpO2 98%, chest clear..."
                  />
                </Field>
              </div>

              {/* Rx Prescriptions Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Prescription (Rx)</h4>
                  <Button type="button" size="sm" variant="secondary" onClick={addPrescriptionRow}>
                    + Add Medicine
                  </Button>
                </div>

                {prescriptions.map((rx, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                      gap: '6px',
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
                      }}
                    />
                    <Input
                      placeholder="Dose (500mg)"
                      value={rx.dosage}
                      onChange={(e) => updatePrescription(idx, 'dosage', e.target.value)}
                    />
                    <Input
                      placeholder="Freq (1-0-1)"
                      value={rx.frequency}
                      onChange={(e) => updatePrescription(idx, 'frequency', e.target.value)}
                    />
                    <Input
                      placeholder="Days (3)"
                      type="number"
                      value={rx.durationDays}
                      onChange={(e) => updatePrescription(idx, 'durationDays', Number(e.target.value))}
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removePrescriptionRow(idx)}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>

              <Field label="Doctor Advice & Instructions">
                <Input
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Drink warm water, rest for 2 days, review if fever persists"
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <Button type="button" variant="ghost" onClick={() => setShowPrescriptionModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={actionBusy}>
                  ✓ Save Prescription & Complete Visit
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
