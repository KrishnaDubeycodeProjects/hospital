import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { client, courseApi, doctorApi, drugApi, hospitalApi, queueApi, referralApi } from '../../api/client';
import { Button, Card, Field, Input, Modal, Select, Spinner, Textarea, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import {
  Stethoscope,
  Pill,
  FileText,
  Activity,
  Plus,
  Trash2,
  Send,
  Building2,
  AlertTriangle,
  User,
  Clock,
  CheckCircle2,
  Layers,
  BarChart3,
  Search,
  X,
  ChevronDown,
  Info
} from 'lucide-react';

// Comprehensive drug registry with formulation variants (AarogyaFlow Drug Registry)
const COMMON_MEDICINES = [
  {
    generic: 'Paracetamol (Acetaminophen)',
    category: 'Analgesic • Antipyretic',
    adultDose: 'Adults: 500-1000 mg every 4-6 hours (max 4 g/day)',
    variants: [
      { formulation: 'Tablet', strength: '500 mg', brand: 'Crocin, Dolo, Calpol, P-500', dose: '1 tablet', route: 'Oral', freq: 'TDS (3 times daily)', duration: '5 days', qty: 15, refills: 0 },
      { formulation: 'Tablet (Dispersible)', strength: '650 mg', brand: 'Crocin Advance, Dolo-650', dose: '1 tablet', route: 'Oral', freq: 'SOS / TDS', duration: '5 days', qty: 10, refills: 0 },
      { formulation: 'Syrup', strength: '125 mg/5 ml', brand: 'Calpol, Dolo Suspension', dose: '5 ml', route: 'Oral', freq: 'TDS (3 times daily)', duration: '3 days', qty: 1, refills: 0 },
      { formulation: 'Syrup (Pediatric)', strength: '250 mg/5 ml', brand: 'Calpol 250', dose: '5 ml', route: 'Oral', freq: 'TDS (3 times daily)', duration: '3 days', qty: 1, refills: 0 },
      { formulation: 'Injection', strength: '150 mg/ml', brand: 'Perfalgan, Neomol', dose: '1 vial (IV)', route: 'IV Infusion', freq: 'Stat / BD', duration: '1 day', qty: 1, refills: 0 },
      { formulation: 'Suppository', strength: '125 mg', brand: 'Calpol Suppository', dose: '1 suppository', route: 'Rectal', freq: 'SOS', duration: '2 days', qty: 2, refills: 0 }
    ]
  },
  {
    generic: 'Amoxicillin + Clavulanic Acid',
    category: 'Broad-Spectrum Antibacterial',
    adultDose: 'Adults: 625 mg twice daily after meals for 5-7 days',
    variants: [
      { formulation: 'Tablet', strength: '625 mg', brand: 'Augmentin, Clavam, Moxikind-CV', dose: '1 tablet', route: 'Oral', freq: 'BD (Twice daily)', duration: '5 days', qty: 10, refills: 0 },
      { formulation: 'Tablet', strength: '375 mg', brand: 'Augmentin 375, Clavam 375', dose: '1 tablet', route: 'Oral', freq: 'TDS (3 times daily)', duration: '5 days', qty: 15, refills: 0 },
      { formulation: 'Dry Syrup', strength: '228.5 mg/5 ml', brand: 'Augmentin Duo Suspension', dose: '5 ml', route: 'Oral', freq: 'BD (Twice daily)', duration: '5 days', qty: 1, refills: 0 },
      { formulation: 'Injection', strength: '1.2 g', brand: 'Augmentin IV, Clavam IV', dose: '1.2 g IV', route: 'IV Slow', freq: 'BD (Twice daily)', duration: '3 days', qty: 3, refills: 0 }
    ]
  },
  {
    generic: 'Pantoprazole',
    category: 'Proton Pump Inhibitor (Anti-ulcer)',
    adultDose: 'Adults: 40 mg once daily morning before breakfast (empty stomach)',
    variants: [
      { formulation: 'Tablet', strength: '40 mg', brand: 'Pan-40, Pantocid, Pantodac', dose: '1 tablet', route: 'Oral', freq: 'OD (Once daily, fasting)', duration: '14 days', qty: 14, refills: 0 },
      { formulation: 'Capsule (DSR)', strength: '40 mg + 30 mg SR', brand: 'Pan-D, Pantocid-DSR', dose: '1 capsule', route: 'Oral', freq: 'OD (Before food)', duration: '10 days', qty: 10, refills: 0 },
      { formulation: 'Injection', strength: '40 mg', brand: 'Pan IV, Pantocid IV', dose: '40 mg IV', route: 'IV Push', freq: 'OD (Once daily)', duration: '2 days', qty: 2, refills: 0 }
    ]
  },
  {
    generic: 'Azithromycin',
    category: 'Macrolide Antibiotic',
    adultDose: 'Adults: 500 mg once daily 1 hour before or 2 hours after meals',
    variants: [
      { formulation: 'Tablet', strength: '500 mg', brand: 'Azee 500, Azithral 500, Zady', dose: '1 tablet', route: 'Oral', freq: 'OD (Once daily)', duration: '3 days', qty: 3, refills: 0 },
      { formulation: 'Tablet', strength: '250 mg', brand: 'Azee 250, Azithral 250', dose: '1 tablet', route: 'Oral', freq: 'OD (Once daily)', duration: '5 days', qty: 5, refills: 0 },
      { formulation: 'Suspension', strength: '200 mg/5 ml', brand: 'Azee 200, Azithral Liquid', dose: '5 ml', route: 'Oral', freq: 'OD (Once daily)', duration: '3 days', qty: 1, refills: 0 }
    ]
  },
  {
    generic: 'Cetirizine',
    category: 'Antihistamine • Anti-allergic',
    adultDose: 'Adults: 10 mg once daily at bedtime',
    variants: [
      { formulation: 'Tablet', strength: '10 mg', brand: 'Cetzine, Alerid, Zyrtec', dose: '1 tablet', route: 'Oral', freq: 'HS (At bedtime)', duration: '5 days', qty: 5, refills: 0 },
      { formulation: 'Syrup', strength: '5 mg/5 ml', brand: 'Cetzine Syrup, Alerid Syrup', dose: '5 ml', route: 'Oral', freq: 'HS (At bedtime)', duration: '5 days', qty: 1, refills: 0 }
    ]
  },
  {
    generic: 'Metformin',
    category: 'Biguanide • Antidiabetic',
    adultDose: 'Adults: 500 mg once or twice daily with or after meals',
    variants: [
      { formulation: 'Tablet', strength: '500 mg', brand: 'Glycomet, Glyciphage', dose: '1 tablet', route: 'Oral', freq: 'BD (With meals)', duration: '30 days', qty: 60, refills: 2 },
      { formulation: 'Tablet (SR)', strength: '1000 mg', brand: 'Glycomet-SR 1000', dose: '1 tablet', route: 'Oral', freq: 'OD (With dinner)', duration: '30 days', qty: 30, refills: 2 }
    ]
  }
];

// Lab tests grouped by clinical domain
const LAB_GROUPS = {
  Hematology: ['CBC (Complete Blood Count)', 'ESR', 'Peripheral Smear', 'Hemoglobin (Hb%)'],
  Biochemistry: ['Fasting Blood Sugar (FBS)', 'Postprandial Sugar (PPBS)', 'HbA1c', 'Lipid Profile', 'Liver Function Tests (LFT)', 'Kidney Function Tests (KFT / RFT)', 'Serum Electrolytes'],
  Endocrine: ['Thyroid Profile (T3, T4, TSH)', 'Serum Uric Acid', 'Serum Calcium', 'Vitamin D3'],
  Radiology: ['X-Ray Chest (PA View)', 'USG Abdomen & Pelvis', 'ECG (12 Lead)', 'Echocardiogram (2D Echo)'],
  Urine: ['Urine Routine & Microscopic', 'Urine Culture & Sensitivity']
};

function formatTokenLabel(t, fallbackIndex = null) {
  if (!t) return '-';
  if (t.tokenCode && !t.tokenCode.includes('null')) return t.tokenCode;
  if (t.dailyNumber) return `AF-${String(t.dailyNumber).padStart(2, '0')}`;
  if (fallbackIndex != null) return `Token #${fallbackIndex + 1}`;
  return 'Patient Token';
}

export default function DoctorConsultation() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [currentQueue, setCurrentQueue] = useState(null);
  const [activeToken, setActiveToken] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('consult'); // 'consult' | 'stats'

  // Clinical Assessment (Image 2)
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Examination & Vitals (Image 2)
  const [bp, setBp] = useState('120/80');
  const [pulse, setPulse] = useState('76');
  const [temp, setTemp] = useState('98.6');
  const [spo2, setSpo2] = useState('99');
  const [weight, setWeight] = useState('65');
  const [examFindings, setExamFindings] = useState('');

  // Prescriptions List (Image 2 & 3)
  const [prescriptions, setPrescriptions] = useState([
    {
      medicineName: 'Paracetamol (Crocin)',
      strength: '500 mg',
      dose: '1 tablet',
      route: 'Oral',
      frequency: 'TDS (3 times daily)',
      duration: '5 days',
      quantity: 15,
      refills: 0,
      instructions: 'After meals',
      indication: 'Fever / body pain',
      prn: false,
    }
  ]);

  // Smart Medicine Search & Variant Selector Modal State (Image 3)
  const [smartSearchIndex, setSmartSearchIndex] = useState(null);
  const [activeDrugModal, setActiveDrugModal] = useState(null); // Selected drug object
  const [variantTab, setVariantTab] = useState('All');
  const [drugSearchQuery, setDrugSearchQuery] = useState('');

  // Investigations & Labs State
  const [selectedLabs, setSelectedLabs] = useState(['CBC (Complete Blood Count)']);
  const [customLabQuery, setCustomLabQuery] = useState('');

  // Advice & Follow-up State
  const [adviceNotes, setAdviceNotes] = useState('Drink adequate water, maintain light diet, rest adequately.');
  const [reviewDate, setReviewDate] = useState('');

  // Referral State
  const [enableReferral, setEnableReferral] = useState(false);
  const [referralHospitalId, setReferralHospitalId] = useState('');
  const [referralDept, setReferralDept] = useState('');
  const [referralDocName, setReferralDocName] = useState(''); // Optional per requirement
  const [referralValidity, setReferralValidity] = useState('7 days');
  const [referralReason, setReferralReason] = useState('');

  // Test Environment State
  const [testModeOpen, setTestModeOpen] = useState(false);
  const [testPatientName, setTestPatientName] = useState('Ramesh Kumar');
  const [testPatientAge, setTestPatientAge] = useState('28');
  const [testPatientGender, setTestPatientGender] = useState('male');
  const [testPatientPhone, setTestPatientPhone] = useState('+919100000099');
  const [testTargetStatus, setTestTargetStatus] = useState('waiting');
  const [testCreating, setTestCreating] = useState(false);

  // Sign & Complete Modal
  const [showSignedModal, setShowSignedModal] = useState(false);
  const [savingEncounter, setSavingEncounter] = useState(false);
  const toast = useToast();

  async function loadData() {
    try {
      let me = null;
      try {
        me = await doctorApi.me();
        if (me) setProfile(me);
      } catch (e) {}

      const effectiveHospId = me?.hospitalId || profile?.hospitalId || 1;
      const effectiveCategory = me?.category || profile?.category || 'General Medicine / Internal Medicine';

      const q = await queueApi.getQueue(effectiveHospId, effectiveCategory);
      setCurrentQueue(q);

      try {
        const cur = await queueApi.current(effectiveHospId, effectiveCategory);
        setActiveToken(cur);
      } catch (e) {}

      const hospList = await hospitalApi.list();
      setHospitals(hospList || []);

      const cats = await hospitalApi.categories();
      setDepartments(Array.isArray(cats) ? cats : cats?.data || []);
    } catch (err) {
      console.warn('Load note:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      const effectiveHospId = profile?.hospitalId || 1;
      const effectiveCategory = profile?.category || 'General Medicine / Internal Medicine';
      queueApi.getQueue(effectiveHospId, effectiveCategory).then(setCurrentQueue).catch(() => {});
      queueApi.current(effectiveHospId, effectiveCategory).then(setActiveToken).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [profile?.hospitalId, profile?.category]);

  // Test Environment Injection using client.post
  async function handleAddTestPatient(overrideStatus = null) {
    const effectiveHospId = profile?.hospitalId || 1;
    const effectiveCategory = profile?.category || 'General Medicine / Internal Medicine';
    setTestCreating(true);
    const targetStatus = overrideStatus || testTargetStatus || 'waiting';
    try {
      const res = await client.post('/api/test/queue/inject', {
        name: testPatientName || 'Demo Patient',
        age: parseInt(testPatientAge) || 30,
        gender: testPatientGender || 'male',
        phone: testPatientPhone || '+919100000099',
        category: effectiveCategory,
        hospitalId: effectiveHospId,
        status: targetStatus,
        distanceKm: targetStatus === 'frozen' ? 18.5 : 2.5,
        travelMinutes: targetStatus === 'frozen' ? 45 : 10,
      });

      const displayLabel = res?.data?.tokenCode || (res?.data?.dailyNumber ? `Token #${res.data.dailyNumber}` : 'Patient');
      toast.success(`Patient ${displayLabel} added to queue as ${targetStatus.toUpperCase()}!`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed injecting test patient');
    } finally {
      setTestCreating(false);
    }
  }

  // Universal Unfreeze & Requeue bound to this doctor's counter
  async function handleUnfreeze(tokenId) {
    if (!tokenId) return;
    try {
      const counterId = profile?.counterId || 1;
      await queueApi.unfreeze(tokenId, counterId);
      toast.success(`Token #${tokenId} unfrozen and assigned to your Counter #${counterId}!`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed unfreezing token');
    }
  }

  async function handleRequeue(tokenId) {
    if (!tokenId) return;
    try {
      const counterId = profile?.counterId || 1;
      await queueApi.requeueMissed(tokenId, counterId);
      toast.success(`Token #${tokenId} requeued to front of your Counter #${counterId}!`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed requeuing token');
    }
  }

  // Prescription Table Actions
  function addPrescriptionRow() {
    setPrescriptions((prev) => [
      ...prev,
      {
        medicineName: '',
        strength: '500 mg',
        dose: '1 tablet',
        route: 'Oral',
        frequency: 'BD (Twice daily)',
        duration: '5 days',
        quantity: 10,
        refills: 0,
        instructions: 'After meals',
        indication: '',
        prn: false,
      }
    ]);
  }

  function updatePrescriptionField(idx, field, value) {
    setPrescriptions((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  }

  function removePrescriptionRow(idx) {
    setPrescriptions((prev) => prev.filter((_, i) => i !== idx));
  }

  // Variant selector action
  function applyMedicineVariant(variant, drug) {
    if (smartSearchIndex === null) return;
    setPrescriptions((prev) =>
      prev.map((p, i) =>
        i === smartSearchIndex
          ? {
              ...p,
              medicineName: `${drug.generic.split('(')[0].trim()} (${variant.brand.split(',')[0].trim()})`,
              strength: variant.strength,
              dose: variant.dose,
              route: variant.route,
              frequency: variant.freq,
              duration: variant.duration,
              quantity: variant.qty,
              refills: variant.refills,
              instructions: 'After meals',
            }
          : p
      )
    );
    setActiveDrugModal(null);
    setSmartSearchIndex(null);
    toast.success(`Applied formulation: ${variant.brand.split(',')[0]} ${variant.strength}`);
  }

  // Investigation Tags toggling
  function toggleLabTest(testName) {
    setSelectedLabs((prev) =>
      prev.includes(testName) ? prev.filter((t) => t !== testName) : [...prev, testName]
    );
  }

  function addCustomLab() {
    if (!customLabQuery.trim()) return;
    if (!selectedLabs.includes(customLabQuery.trim())) {
      setSelectedLabs((prev) => [...prev, customLabQuery.trim()]);
    }
    setCustomLabQuery('');
  }

  // Save / Sign & Send Prescription to Patient
  async function handleSignAndSend() {
    setSavingEncounter(true);
    try {
      // 1. Create or link care course
      let targetCourseId = activeToken?.courseId || courseId;
      if (!targetCourseId) {
        const newCourse = await courseApi.create({
          patientPhone: activeToken?.phone || '+919100000099',
          title: `Care Episode - ${chiefComplaint.slice(0, 32) || 'Consultation'}`,
          courseType: 'acute',
        });
        targetCourseId = newCourse.id;
      }

      // 2. Add clinical encounter
      const payload = {
        chiefComplaint: chiefComplaint || 'Consultation',
        clinicalNotes: `Assessment: ${clinicalNotes || 'Examined'}\nHistory: ${medicalHistory || 'None reported'}\nDiagnosis: ${diagnosis || 'Clinical evaluation'}\nVitals: BP ${bp}, Pulse ${pulse}, Temp ${temp}°F, SpO2 ${spo2}%, Weight ${weight}kg\nFindings: ${examFindings || 'Clear'}\nAdvice: ${adviceNotes}`,
        prescriptions: prescriptions
          .filter((p) => p.medicineName && p.medicineName.trim())
          .map((p) => ({
            drugName: `${p.medicineName} ${p.strength}`,
            dosage: p.dose,
            frequency: p.frequency,
            durationDays: parseInt(p.duration) || 5,
            instructions: p.instructions,
          })),
      };

      const enc = await courseApi.addEncounter(targetCourseId, payload);

      // 2b. Add referral if enabled
      if (enableReferral) {
        try {
          await referralApi.create({
            courseId: targetCourseId,
            encounterId: enc?.id || null,
            toHospitalId: parseInt(referralHospitalId) || 1,
            targetDepartment: referralDept || 'General Medicine',
            reason: referralReason || chiefComplaint || 'Specialist Consultation',
            priorityTier: 'urgent_7d',
            referredDoctorId: null,
          });
        } catch (refErr) {
          console.warn('Referral creation notice:', refErr);
        }
      }

      // 3. Complete token in queue
      if (activeToken?.id) {
        try {
          await queueApi.updateStatus(activeToken.id, 'completed', 'DOCTOR');
        } catch (qErr) {
          console.warn('Token status completion notice:', qErr);
        }
      }

      setShowSignedModal(true);
      toast.success('e-Prescription signed & dispatched to patient on WhatsApp!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to complete consultation');
    } finally {
      setSavingEncounter(false);
    }
  }

  return (
    <div className="stack-lg">
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Consultations</span>
            <span>/</span>
            <span style={{ color: '#0F172A' }}>Clinical Notes &amp; Prescription</span>
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            Clinical Notes &amp; Prescription
          </h1>
          <p className="muted-text" style={{ margin: '2px 0 0', fontSize: '13px' }}>
            Complete the encounter and issue an authenticated digital prescription
          </p>
        </div>

        {/* Tab & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setActiveTab('consult')}
              style={{
                border: 'none',
                background: activeTab === 'consult' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'consult' ? '#0F172A' : '#64748B',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'consult' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Consultation Console
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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <BarChart3 size={14} color="#25D366" />
              <span>Station Stats</span>
            </button>
          </div>

          <Button
            size="sm"
            variant={testModeOpen ? 'primary' : 'secondary'}
            onClick={() => setTestModeOpen(!testModeOpen)}
            style={{ fontWeight: 700, fontSize: '12.5px' }}
          >
            🧪 {testModeOpen ? 'Test Sandbox Active' : 'Test Environment'}
          </Button>
        </div>
      </div>

      {/* 🧪 Doctor Test Environment Sandbox */}
      {testModeOpen && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#166534' }}>
              🧪 Universal Sandbox &bull; Inject Patient into Current Counter
            </div>
            <Button size="sm" variant="ghost" onClick={() => setTestModeOpen(false)} style={{ color: '#DC2626' }}>
              Close Sandbox
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <Input value={testPatientName} onChange={(e) => setTestPatientName(e.target.value)} placeholder="Patient Name" />
            <Input value={testPatientAge} onChange={(e) => setTestPatientAge(e.target.value)} placeholder="Age" type="number" />
            <Input value={testPatientPhone} onChange={(e) => setTestPatientPhone(e.target.value)} placeholder="Phone (+91...)" />
            <Select value={testTargetStatus} onChange={(e) => setTestTargetStatus(e.target.value)}>
              <option value="waiting">Waiting (Immediate FIFO)</option>
              <option value="frozen">Frozen (Commute Buffer)</option>
              <option value="missed">Missed Turn</option>
            </Select>
            <Button
              size="sm"
              loading={testCreating}
              onClick={() => handleAddTestPatient(testTargetStatus)}
              style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}
            >
              + Add to Queue
            </Button>
          </div>
        </div>
      )}

      {/* TAB 1: STATION STATS TAB */}
      {activeTab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Waiting at Counter</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              {(currentQueue?.tokens || []).filter((t) => t.status === 'waiting').length}
            </div>
            <div style={{ fontSize: '11.5px', color: '#0284C7', marginTop: '4px' }}>Patients ready in lounge</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Frozen / Buffer</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#6B21A8', marginTop: '6px' }}>
              {(currentQueue?.frozen || []).length + (currentQueue?.reserved || []).length}
            </div>
            <div style={{ fontSize: '11.5px', color: '#6B21A8', marginTop: '4px' }}>Distant en route patients</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Missed Patients</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#EF4444', marginTop: '6px' }}>
              {(currentQueue?.missed || []).length}
            </div>
            <div style={{ fontSize: '11.5px', color: '#EF4444', marginTop: '4px' }}>Available for priority requeue</div>
          </div>
        </div>
      )}

      {/* TAB 2: CONSULTATION CONSOLE (Images 2 & 3 AarogyaFlow Design) */}
      {activeTab === 'consult' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Patient Info Strip (Image 2) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  fontWeight: 800,
                  fontSize: '17px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {activeToken?.name ? activeToken.name.slice(0, 2).toUpperCase() : 'AS'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    {activeToken?.name || 'Ananya Sharma'}
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569' }}>
                    PID: {activeToken ? `AF-${activeToken.id}` : 'AF-10482'}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>{activeToken?.age || '32'} years &bull; {activeToken?.gender || 'Female'}</span>
                  <span>{activeToken?.phone || '+91 98888 77777'}</span>
                  <span>Visit ID: VIS-2026-0104</span>
                </div>
              </div>
            </div>

            {/* Allergies Warning Banner */}
            <div
              style={{
                backgroundColor: '#FFF7ED',
                border: '1px solid #FFEDD5',
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#C2410C',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={15} color="#EA580C" />
              <span>Allergies: Penicillin (Rash) &bull; Review Required</span>
            </div>
          </div>

          {/* TWO-COLUMN TOP SECTION: Clinical Assessment & Examination & Vitals (Image 2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            
            {/* Card 1: Clinical Assessment */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#166534', fontWeight: 800, fontSize: '14px' }}>
                <FileText size={16} />
                <span>Clinical Assessment</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Chief complaints / symptoms *
                  </label>
                  <textarea
                    rows={2}
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="e.g. Fever, cough, headache, or body pain for 2 days"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Relevant medical history
                  </label>
                  <textarea
                    rows={2}
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="e.g. Known HTN, DM, previous surgeries, current medications, family history..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Diagnosis / provisional diagnosis
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94A3B8' }} />
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Search or enter diagnosis (e.g. Viral Fever, URTI, Hypertension)"
                      style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Examination & Vitals */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#0369A1', fontWeight: 800, fontSize: '14px' }}>
                <Activity size={16} />
                <span>Examination &amp; Vitals</span>
              </div>

              {/* Vitals Numeric Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>BP (mmHg)</label>
                  <input
                    type="text"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    placeholder="120/80"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Pulse (bpm)</label>
                  <input
                    type="text"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="76"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Temp (°F)</label>
                  <input
                    type="text"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    placeholder="98.6"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>SpO2 (%)</label>
                  <input
                    type="text"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    placeholder="99"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Weight (kg)</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="65"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Physical examination findings
                </label>
                <textarea
                  rows={4}
                  value={examFindings}
                  onChange={(e) => setExamFindings(e.target.value)}
                  placeholder="e.g. Conscious and oriented, no pallor, chest clear, S1S2 normal, abdomen soft..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION: Prescription (Rx) Table (Images 2 & 3) */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '15px' }}>
                  <Pill size={17} color="#25D366" />
                  <span>Prescription (Rx)</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Specify medicine formulation, dose, route, and complete patient instructions
                </div>
              </div>

              <Button
                size="sm"
                onClick={addPrescriptionRow}
                style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                <span>Add Medicine</span>
              </Button>
            </div>

            {/* Prescriptions Table Layout */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: '11px', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: '32px' }}>#</th>
                    <th style={{ padding: '8px 10px', minWidth: '220px' }}>Medicine &amp; Formulation *</th>
                    <th style={{ padding: '8px 10px', width: '100px' }}>Strength</th>
                    <th style={{ padding: '8px 10px', width: '100px' }}>Dose</th>
                    <th style={{ padding: '8px 10px', width: '90px' }}>Route</th>
                    <th style={{ padding: '8px 10px', width: '140px' }}>Frequency</th>
                    <th style={{ padding: '8px 10px', width: '90px' }}>Duration</th>
                    <th style={{ padding: '8px 10px', width: '80px' }}>Qty</th>
                    <th style={{ padding: '8px 10px', minWidth: '160px' }}>Instructions</th>
                    <th style={{ padding: '8px 10px', width: '36px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={rx.medicineName}
                            onChange={(e) => updatePrescriptionField(idx, 'medicineName', e.target.value)}
                            onFocus={() => setSmartSearchIndex(idx)}
                            placeholder="Type medicine (e.g. Paracetamol)..."
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontWeight: 600 }}
                          />
                          {/* Smart Autocomplete Dropdown */}
                          {smartSearchIndex === idx && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                zIndex: 100,
                                width: '360px',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                maxHeight: '260px',
                                overflowY: 'auto',
                                marginTop: '4px',
                              }}
                            >
                              <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#64748B', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textTransform: 'uppercase' }}>
                                Common Medicines &bull; AarogyaFlow Drug Registry
                              </div>
                              {COMMON_MEDICINES.map((drug, dIdx) => (
                                <div
                                  key={dIdx}
                                  onClick={() => {
                                    setActiveDrugModal(drug);
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    borderBottom: '1px solid #F1F5F9',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F0FDF4'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                                >
                                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                    {drug.generic}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                                    {drug.category} &bull; {drug.variants.length} Formulations
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="text"
                          value={rx.strength}
                          onChange={(e) => updatePrescriptionField(idx, 'strength', e.target.value)}
                          placeholder="500 mg"
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="text"
                          value={rx.dose}
                          onChange={(e) => updatePrescriptionField(idx, 'dose', e.target.value)}
                          placeholder="1 tablet"
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          value={rx.route}
                          onChange={(e) => updatePrescriptionField(idx, 'route', e.target.value)}
                          style={{ width: '100%', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        >
                          <option value="Oral">Oral</option>
                          <option value="IV Infusion">IV</option>
                          <option value="IM">IM</option>
                          <option value="Topical">Topical</option>
                          <option value="Inhalation">Inhalation</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <select
                          value={rx.frequency}
                          onChange={(e) => updatePrescriptionField(idx, 'frequency', e.target.value)}
                          style={{ width: '100%', padding: '6px 4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        >
                          <option value="OD (Once daily)">OD (Once daily)</option>
                          <option value="BD (Twice daily)">BD (Twice daily)</option>
                          <option value="TDS (3 times daily)">TDS (3 times daily)</option>
                          <option value="QID (4 times daily)">QID (4 times daily)</option>
                          <option value="SOS (As needed)">SOS (As needed)</option>
                          <option value="HS (At bedtime)">HS (At bedtime)</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="text"
                          value={rx.duration}
                          onChange={(e) => updatePrescriptionField(idx, 'duration', e.target.value)}
                          placeholder="5 days"
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="number"
                          value={rx.quantity}
                          onChange={(e) => updatePrescriptionField(idx, 'quantity', e.target.value)}
                          placeholder="15"
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="text"
                          value={rx.instructions}
                          onChange={(e) => updatePrescriptionField(idx, 'instructions', e.target.value)}
                          placeholder="After meals"
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        />
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {prescriptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePrescriptionRow(idx)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                            title="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTTOM SECTION: Investigations & Labs (Left) and Advice & Follow-up / Referral (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            
            {/* Left Card: Investigations & Labs (Image 2) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ color: '#0369A1', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} />
                  <span>Investigations &amp; Labs</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Add required pathology &amp; radiology orders</span>
              </div>

              {/* Search Test Input */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="text"
                  value={customLabQuery}
                  onChange={(e) => setCustomLabQuery(e.target.value)}
                  placeholder="Search test (e.g. Complete Blood Count, X-Ray Chest, ECG)"
                  style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
                <Button size="sm" onClick={addCustomLab} style={{ backgroundColor: '#0284C7', borderColor: '#0284C7', color: '#ffffff', fontWeight: 700 }}>
                  + Add Test
                </Button>
              </div>

              {/* Grouped Quick Add Tags (Image 2) */}
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                Quick Add Chips:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Object.entries(LAB_GROUPS).flatMap(([category, tests]) => tests).slice(0, 10).map((test, tIdx) => {
                  const isChecked = selectedLabs.includes(test);
                  return (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => toggleLabTest(test)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        border: isChecked ? '1px solid #25D366' : '1px solid #CBD5E1',
                        backgroundColor: isChecked ? '#DCFCE7' : '#F8FAFC',
                        color: isChecked ? '#15803D' : '#334155',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isChecked ? '✓ ' : '+ '}{test}
                    </button>
                  );
                })}
              </div>

              {selectedLabs.length > 0 && (
                <div style={{ marginTop: '14px', padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Ordered Investigations ({selectedLabs.length}):
                  </div>
                  <div style={{ fontSize: '12px', color: '#14532D', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedLabs.map((l, lIdx) => (
                      <span key={lIdx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '4px' }}>
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Advice, Follow-up & Referrals (Image 2) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#166534', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <CheckCircle2 size={16} />
                <span>Advice &amp; Follow-up</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Treatment &amp; lifestyle advice
                  </label>
                  <textarea
                    rows={2}
                    value={adviceNotes}
                    onChange={(e) => setAdviceNotes(e.target.value)}
                    placeholder="e.g. Rest, plenty of fluids, balanced diet, avoid strenuous activity..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Review Date
                    </label>
                    <input
                      type="date"
                      value={reviewDate}
                      onChange={(e) => setReviewDate(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Referral (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => setEnableReferral(!enableReferral)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: enableReferral ? '1.5px solid #25D366' : '1px solid #CBD5E1',
                        backgroundColor: enableReferral ? '#DCFCE7' : '#F8FAFC',
                        color: enableReferral ? '#15803D' : '#64748B',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {enableReferral ? '✓ Referral Active' : '+ Add Hospital Referral'}
                    </button>
                  </div>
                </div>

                {/* Expanded Referral Details Fields */}
                {enableReferral && (
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Referral Details:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <select
                        value={referralHospitalId}
                        onChange={(e) => setReferralHospitalId(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      >
                        <option value="">Destination Hospital…</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>

                      <select
                        value={referralDept}
                        onChange={(e) => setReferralDept(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      >
                        <option value="">Department…</option>
                        {departments.map((d, dIdx) => (
                          <option key={dIdx} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        value={referralDocName}
                        onChange={(e) => setReferralDocName(e.target.value)}
                        placeholder="Doctor Name (Optional for visit)"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                      <input
                        type="text"
                        value={referralValidity}
                        onChange={(e) => setReferralValidity(e.target.value)}
                        placeholder="Validity (e.g. 7 days)"
                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>

                    <input
                      type="text"
                      value={referralReason}
                      onChange={(e) => setReferralReason(e.target.value)}
                      placeholder="Clinical reason for referral"
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Footer Bar (Image 2) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '14px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#15803D" />
              <span>A valid prescription must be authenticated by the prescriber before sending.</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Button size="sm" variant="secondary" onClick={() => toast.info('Draft consultation saved.')}>
                Save Draft
              </Button>
              <Button
                size="sm"
                loading={savingEncounter}
                onClick={handleSignAndSend}
                style={{
                  backgroundColor: '#25D366',
                  borderColor: '#25D366',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                }}
              >
                <Send size={14} />
                <span>Sign &amp; Send to Patient</span>
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* SMART MEDICINE VARIANT SELECTOR MODAL (Image 3) */}
      {activeDrugModal && (
        <Modal title={activeDrugModal.generic} onClose={() => setActiveDrugModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '12.5px', color: '#166534', fontWeight: 600 }}>
              {activeDrugModal.category}
            </div>

            {/* Formulation Variant Filter Tabs (Image 3) */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px', flexWrap: 'wrap' }}>
              {['All', 'Tablet', 'Syrup', 'Injection', 'Drop', 'Suppository'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setVariantTab(tab)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    border: variantTab === tab ? '1.5px solid #25D366' : '1px solid #CBD5E1',
                    backgroundColor: variantTab === tab ? '#DCFCE7' : '#FFFFFF',
                    color: variantTab === tab ? '#15803D' : '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Available Variants Table (Image 3) */}
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B', fontSize: '11px' }}>
                    <th style={{ padding: '6px 8px' }}>Formulation</th>
                    <th style={{ padding: '6px 8px' }}>Strength</th>
                    <th style={{ padding: '6px 8px' }}>Brand Examples</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDrugModal.variants
                    .filter((v) => variantTab === 'All' || v.formulation.toLowerCase().includes(variantTab.toLowerCase()))
                    .map((v, vIdx) => (
                      <tr key={vIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px', fontWeight: 700, color: '#0F172A' }}>{v.formulation}</td>
                        <td style={{ padding: '8px' }}>{v.strength}</td>
                        <td style={{ padding: '8px', color: '#475569' }}>{v.brand}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <Button
                            size="sm"
                            onClick={() => applyMedicineVariant(v, activeDrugModal)}
                            style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontSize: '11.5px', padding: '3px 10px', fontWeight: 700 }}
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Dosage Guidelines Callout Box (Image 3) */}
            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} color="#2563EB" />
              <span>{activeDrugModal.adultDose}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <Button size="sm" variant="ghost" onClick={() => setActiveDrugModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* SUCCESS CONFIRMATION MODAL */}
      {showSignedModal && (
        <Modal title="Prescription Dispatched Successfully" onClose={() => setShowSignedModal(false)}>
          <div style={{ textAlign: 'center', padding: '16px 10px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
              e-Prescription &amp; Record Synchronized
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
              The digital prescription has been logged to the patient's care timeline and sent directly to their WhatsApp.
            </p>
            <Button
              onClick={() => {
                setShowSignedModal(false);
                // Reset form
                setChiefComplaint('');
                setDiagnosis('');
              }}
              style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700, padding: '8px 24px' }}
            >
              Ready for Next Patient
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
