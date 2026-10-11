import React, { useState } from 'react';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  PhoneCall,
  Check,
  X,
  Building2,
  Calendar,
  Activity,
  ShieldAlert,
  Volume2,
  RefreshCw,
  Wifi,
  Baby,
  ChevronRight,
  UserCheck,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function AshaAdminDashboard() {
  const { admin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Active Tab: 'Overview' | 'Workers' | 'Referrals'
  const [activeTab, setActiveTab] = useState('Workers');

  // Selected ASHA Worker for drilldown modal
  const [selectedWorker, setSelectedWorker] = useState(null);

  // Teleconsultation & Approval Modal State
  const [teleconsultPatient, setTeleconsultPatient] = useState(null);
  const [approvedReferralIds, setApprovedReferralIds] = useState(new Set());
  const [doctorNotes, setDoctorNotes] = useState('');
  const [showNotesSuccess, setShowNotesSuccess] = useState(false);
  const [bottomNav, setBottomNav] = useState('dashboard');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ASHA Workers Data
  const workers = [
    {
      id: 'w1',
      avatar: 'SD',
      avatarBg: '#dcfce7',
      avatarColor: '#15803d',
      name: 'Sunita Devi',
      village: 'Chandpur',
      phone: '+91 98765 43210',
      families: 24,
      surveys: 7,
      referrals: 4,
      hrpCount: 2,
      ncdCount: 5,
      lastActive: '10 मिनट पहले',
    },
    {
      id: 'w2',
      avatar: 'MK',
      avatarBg: '#dcfce7',
      avatarColor: '#15803d',
      name: 'Meera Kumari',
      village: 'Rampur',
      phone: '+91 98765 43211',
      families: 18,
      surveys: 24,
      referrals: 2,
      hrpCount: 1,
      ncdCount: 4,
      lastActive: '25 मिनट पहले',
    },
    {
      id: 'w3',
      avatar: 'LB',
      avatarBg: '#dcfce7',
      avatarColor: '#15803d',
      name: 'Lalita Bai',
      village: 'Kheda',
      phone: '+91 98765 43212',
      families: 22,
      surveys: 31,
      referrals: 4,
      hrpCount: 1,
      ncdCount: 6,
      lastActive: '1 घंटा पहले',
    },
    {
      id: 'w4',
      avatar: 'PS',
      avatarBg: '#dcfce7',
      avatarColor: '#15803d',
      name: 'Pooja Sharma',
      village: 'Barkheda',
      phone: '+91 98765 43213',
      families: 20,
      surveys: 19,
      referrals: 1,
      hrpCount: 0,
      ncdCount: 3,
      lastActive: '2 घंटे पहले',
    },
  ];

  // Critical Referrals List
  const criticalReferrals = [
    {
      id: 'ref-1',
      name: 'Sita Bai',
      age: 26,
      gender: 'महिला',
      houseNo: 14,
      village: 'Chandpur',
      workerName: 'Sunita Devi',
      reason: 'गंभीर एनीमिया (Hb 6.8 g/dL) - उच्च जोखिम गर्भावस्था (HRP)',
      tier: 'urgent_7d',
      daysLeft: 2,
      condition: 'Severe Anaemia in 3rd Trimester',
      vitals: 'BP 108/68 · Hb 6.8 g/dL · FHR 142 bpm',
    },
    {
      id: 'ref-2',
      name: 'Ram Prasad',
      age: 58,
      gender: 'पुरुष',
      houseNo: 22,
      village: 'Rampur',
      workerName: 'Meera Kumari',
      reason: 'अनियंत्रित उच्च रक्तचाप (BP 185/110 mmHg) - स्ट्रोक जोखिम',
      tier: 'urgent_7d',
      daysLeft: 1,
      condition: 'Severe Hypertension Stage 2',
      vitals: 'BP 185/110 mmHg · Pulse 88 · RBS 164 mg/dL',
    },
    {
      id: 'ref-3',
      name: 'Radha Bai',
      age: 29,
      gender: 'महिला',
      houseNo: 9,
      village: 'Kheda',
      workerName: 'Lalita Bai',
      reason: 'गर्भावधि मधुमेह (Gestational Diabetes) - RBS 218 mg/dL',
      tier: 'semi_urgent_14d',
      daysLeft: 5,
      condition: 'Gestational Diabetes Mellitus',
      vitals: 'RBS 218 mg/dL · Urine Albumin Nil · BP 122/80',
    },
    {
      id: 'ref-4',
      name: 'Anita Sharma',
      age: 3,
      gender: 'बालक',
      houseNo: 17,
      village: 'Barkheda',
      workerName: 'Pooja Sharma',
      reason: 'गंभीर तीव्र कुपोषण (SAM) - MUAC < 11.5 सेमी',
      tier: 'urgent_7d',
      daysLeft: 3,
      condition: 'Severe Acute Malnutrition',
      vitals: 'Weight 9.2 kg · MUAC 11.2 cm · Bilateral Edema+',
    },
  ];

  const handleApproveReferral = (id) => {
    setApprovedReferralIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.success('रेफरल सफलतापूर्वक स्वीकृत किया गया।');
  };

  const handleSaveTeleconsultAdvice = () => {
    if (teleconsultPatient) {
      handleApproveReferral(teleconsultPatient.id);
      setShowNotesSuccess(true);
      setTimeout(() => {
        setShowNotesSuccess(false);
        setTeleconsultPatient(null);
        setDoctorNotes('');
      }, 1200);
    }
  };

  const playVoiceBanner = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      const utter = new SpeechSynthesisUtterance('सीएचओ सेक्टर अवलोकन। आयुष्मान आरोग्य मंदिर पोर्टल।');
      utter.lang = 'hi-IN';
      utter.rate = 0.95;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    } else {
      toast.info('सीएचओ सेक्टर अवलोकन: आशा कार्यकर्ताओं की कार्य प्रगति सक्रिय है।');
    }
  };

  const handleLogout = () => {
    logout('ADMIN');
    navigate('/login/admin');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          position: 'relative',
        }}
      >
        {/* TOP BRAND HEADER */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#004d40',
                color: '#ffffff',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
              }}
            >
              +
            </div>
            <div>
              <div style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Aarogya Flow
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
                Care Closer. Healthier Tomorrow.
              </div>
            </div>
          </div>

          {/* Right Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
              }}
            >
              <Wifi size={13} color="#059669" />
              <span>Online</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
              }}
              title="Community Health Officer"
            >
              <Users size={13} color="#334155" />
              <span>CHO</span>
              <RefreshCw size={11} color="#64748b" style={{ marginLeft: '2px' }} />
            </div>
          </div>
        </header>

        {/* SCROLLABLE MAIN BODY */}
        <main style={{ flex: 1, padding: '16px 16px 80px', overflowY: 'auto' }}>
          {bottomNav === 'dashboard' ? (
            <>
              {/* AYUSHMAN AROGYA MANDIR (HWC) BANNER CARD */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginBottom: '14px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    backgroundColor: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={26} color="#059669" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                    आयुष्मान आरोग्य मंदिर (HWC)
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: '500' }}>
                    कम्युनिटी हेल्थ ऑफिसर (CHO) कार्यक्षेत्र पोर्टल
                  </div>
                </div>
              </div>

              {/* VOICE GUIDE BANNER (CHO Dashboard announcement) */}
              <div
                onClick={playVoiceBanner}
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#166534' }}>
                  सीएचओ सेक्टर अवलोकन (CHO Dashboard)
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isSpeaking ? '#bbf7d0' : '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Volume2 size={17} color="#15803d" />
                </div>
              </div>

              {/* 3 TABS PILLS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  marginBottom: '18px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('Overview')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '12px',
                    border: activeTab === 'Overview' ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: activeTab === 'Overview' ? '#004d40' : '#ffffff',
                    color: activeTab === 'Overview' ? '#ffffff' : '#475569',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>📊</span>
                  <span>सेक्टर अवलोकन</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('Workers')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '12px',
                    border: activeTab === 'Workers' ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: activeTab === 'Workers' ? '#004d40' : '#ffffff',
                    color: activeTab === 'Workers' ? '#ffffff' : '#475569',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>👩‍💼</span>
                  <span>आशा कार्यकर्ता</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('Referrals')}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '12px',
                    border: activeTab === 'Referrals' ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: activeTab === 'Referrals' ? '#004d40' : '#ffffff',
                    color: activeTab === 'Referrals' ? '#ffffff' : '#475569',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>⚠️</span>
                  <span>गंभीर रेफरल (4)</span>
                </button>
              </div>

              {/* TAB 1: WORKERS PERFORMANCE LIST */}
              {activeTab === 'Workers' && (
                <div>
                  <div
                    style={{
                      fontSize: '14.5px',
                      fontWeight: '800',
                      color: '#475569',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>सेक्टर की आशा कार्यकर्ताओं की कार्य प्रगति</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                      {workers.length} कार्यकर्ता सक्रिय
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {workers.map((worker) => (
                      <div
                        key={worker.id}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1.5px solid #f1f5f9',
                          padding: '16px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        {/* Worker Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                backgroundColor: worker.avatarBg,
                                color: worker.avatarColor,
                                fontWeight: '800',
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {worker.avatar}
                            </div>
                            <div>
                              <div style={{ fontSize: '15.5px', fontWeight: '800', color: '#0f172a' }}>
                                {worker.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                                गाँव: {worker.village} • {worker.phone}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedWorker(worker)}
                            style={{
                              backgroundColor: '#f1f5f9',
                              color: '#004d40',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            विवरण देखें
                          </button>
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '10px 0' }} />

                        {/* 3 Metric Counts */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            textAlign: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                              {worker.families}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                              परिवार
                            </div>
                          </div>

                          <div style={{ borderLeft: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                              {worker.surveys}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                              सर्वेक्षण पूर्ण
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '17px', fontWeight: '800', color: '#dc2626' }}>
                              {worker.referrals}
                            </div>
                            <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                              लंबित रेफरल
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: SECTOR OVERVIEW */}
              {activeTab === 'Overview' && (
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#475569', marginBottom: '12px' }}>
                    एचडब्ल्यूसी सेक्टर समग्र स्वास्थ्य सांख्यिकी
                  </div>

                  {/* 6 Key Stat Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>🏠 कुल परिवार</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>84</div>
                      <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>4 गाँव आच्छादित</div>
                    </div>

                    <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '11.5px', color: '#166534', fontWeight: '600' }}>🤰 गर्भवती महिलाएँ</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d', marginTop: '4px' }}>14</div>
                      <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>100% पंजीकृत</div>
                    </div>

                    <div style={{ backgroundColor: '#fef2f2', padding: '14px', borderRadius: '14px', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '11.5px', color: '#991b1b', fontWeight: '600' }}>⚠️ उच्च जोखिम (HRP)</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>4</div>
                      <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>नियमित निगरानी</div>
                    </div>

                    <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '14px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11.5px', color: '#1e40af', fontWeight: '600' }}>🩺 गैर-संचारी (NCD)</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>18</div>
                      <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>BP व शुगर मरीज</div>
                    </div>

                    <div style={{ backgroundColor: '#faf5ff', padding: '14px', borderRadius: '14px', border: '1px solid #e9d5ff' }}>
                      <div style={{ fontSize: '11.5px', color: '#6b21a8', fontWeight: '600' }}>📋 पूर्ण सर्वेक्षण</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#7e22ce', marginTop: '4px' }}>81</div>
                      <div style={{ fontSize: '11px', color: '#7e22ce', marginTop: '2px' }}>96.4% कवरेज</div>
                    </div>

                    <div style={{ backgroundColor: '#fffbeb', padding: '14px', borderRadius: '14px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '11.5px', color: '#92400e', fontWeight: '600' }}>🚨 कुल सक्रिय रेफरल</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>11</div>
                      <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>4 गंभीर प्राथमिकता</div>
                    </div>
                  </div>

                  {/* Village Breakdown */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
                      गाँव अनुसार प्रगति
                    </div>
                    {workers.map((w) => (
                      <div key={w.id} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                          <span>{w.village} ({w.name})</span>
                          <span>{w.surveys} सर्वेक्षण</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, (w.surveys / 35) * 100)}%`,
                              backgroundColor: '#004d40',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: CRITICAL REFERRALS */}
              {activeTab === 'Referrals' && (
                <div>
                  <div
                    style={{
                      fontSize: '14.5px',
                      fontWeight: '800',
                      color: '#475569',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>गंभीर व तत्काल रेफरल (Triage)</span>
                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>
                      4 आपातकालीन
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {criticalReferrals.map((ref) => {
                      const isApproved = approvedReferralIds.has(ref.id);
                      return (
                        <div
                          key={ref.id}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: isApproved ? '1.5px solid #a7f3d0' : '1.5px solid #fecaca',
                            padding: '16px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                                  {ref.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {ref.age} वर्ष · {ref.gender}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                घर सं.: {ref.houseNo} • {ref.village} (आशा: {ref.workerName})
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: isApproved ? '#059669' : '#dc2626',
                                backgroundColor: isApproved ? '#d1fae5' : '#fee2e2',
                                padding: '3px 8px',
                                borderRadius: '12px',
                              }}
                            >
                              {isApproved ? '✓ स्वीकृत' : `⚠️ ${ref.daysLeft} दिन शेष`}
                            </span>
                          </div>

                          <div
                            style={{
                              backgroundColor: '#fff1f2',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              marginBottom: '10px',
                            }}
                          >
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#9f1239' }}>
                              {ref.reason}
                            </div>
                            <div style={{ fontSize: '11px', color: '#be123c', marginTop: '2px' }}>
                              वाइटल्स: {ref.vitals}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setTeleconsultPatient(ref);
                                setDoctorNotes(`रोगी ${ref.name} (${ref.age}/${ref.gender}): ${ref.reason}। अस्पताल ओपीडी में त्वरित जांच व उपचार की अनुशंसा की गई।`);
                              }}
                              style={{
                                flex: 1,
                                backgroundColor: '#004d40',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                              }}
                            >
                              <Stethoscope size={15} color="#ffffff" />
                              <span>टेली-परामर्श</span>
                            </button>

                            {!isApproved && (
                              <button
                                type="button"
                                onClick={() => handleApproveReferral(ref.id)}
                                style={{
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
                                  borderRadius: '10px',
                                  padding: '9px 12px',
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Check size={15} color="#15803d" />
                                <span>स्वीकृत करें</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* PROFILE SCREEN TAB */
            <div style={{ padding: '8px 0' }}>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                  textAlign: 'center',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#004d40',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  CHO
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  डॉ. अनीता वर्मा
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  कम्युनिटी हेल्थ ऑफिसर (CHO) • सेक्टर 4
                </div>
                <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700', marginTop: '4px' }}>
                  आयुष्मान आरोग्य मंदिर, चांदपुर
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>संपर्क मोबाइल</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    +91 98765 43200
                  </div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>कार्यक्षेत्र एवं सेक्टर</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    चांदपुर, रामपुर, खेड़ा, बरखेड़ा
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    marginTop: '20px',
                    padding: '13px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  लॉगआउट करें (Log Out)
                </button>
              </div>
            </div>
          )}
        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <nav
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '64px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            zIndex: 30,
          }}
        >
          <button
            type="button"
            onClick={() => setBottomNav('dashboard')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: bottomNav === 'dashboard' ? '#004d40' : '#94a3b8',
            }}
          >
            <span style={{ fontSize: '18px' }}>📊</span>
            <span style={{ fontSize: '11px', fontWeight: '700' }}>डैशबोर्ड</span>
          </button>

          <button
            type="button"
            onClick={() => setBottomNav('profile')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: bottomNav === 'profile' ? '#004d40' : '#94a3b8',
            }}
          >
            <span style={{ fontSize: '18px' }}>👤</span>
            <span style={{ fontSize: '11px', fontWeight: '700' }}>प्रोफाइल</span>
          </button>
        </nav>

        {/* MODAL: WORKER DETAILS DRILLDOWN */}
        {selectedWorker && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setSelectedWorker(null)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '520px',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                padding: '24px 20px',
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    {selectedWorker.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>
                    गाँव: {selectedWorker.village} • {selectedWorker.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWorker(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} color="#64748b" />
                </button>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>आच्छादित परिवार</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                    {selectedWorker.families}
                  </div>
                </div>
                <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#166534' }}>सर्वेक्षण पूर्ण</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>
                    {selectedWorker.surveys}
                  </div>
                </div>
                <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#991b1b' }}>लंबित रेफरल</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
                    {selectedWorker.referrals}
                  </div>
                </div>
                <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#1e40af' }}>अंतिम सक्रियता</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#2563eb', marginTop: '6px' }}>
                    {selectedWorker.lastActive}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={`tel:${selectedWorker.phone.replace(/[^0-9+]/g, '')}`}
                  style={{
                    flex: 1,
                    backgroundColor: '#004d40',
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                  }}
                >
                  <PhoneCall size={16} />
                  <span>कॉल करें</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    toast.success(`${selectedWorker.name} को फॉलो-अप कार्य असाइन किया गया।`);
                    setSelectedWorker(null);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  कार्य असाइन करें
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: TELECONSULTATION & APPROVAL */}
        {teleconsultPatient && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setTeleconsultPatient(null)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '520px',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                padding: '24px 20px',
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    टेली-परामर्श एवं रेफरल अनुमोदन
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0' }}>
                    {teleconsultPatient.name} ({teleconsultPatient.age} वर्ष · {teleconsultPatient.gender})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTeleconsultPatient(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} color="#64748b" />
                </button>
              </div>

              <div style={{ backgroundColor: '#fff1f2', padding: '12px', borderRadius: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#9f1239' }}>
                  {teleconsultPatient.reason}
                </div>
                <div style={{ fontSize: '11.5px', color: '#be123c', marginTop: '3px' }}>
                  वाइटल्स: {teleconsultPatient.vitals}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  सीएचओ डॉक्टर चिकित्सीय सलाह एवं निर्देश:
                </label>
                <textarea
                  rows={4}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="दवाओं के नाम, खुराक व तत्काल अस्पताल भेजने के निर्देश दर्ज करें..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {showNotesSuccess ? (
                <div
                  style={{
                    padding: '14px',
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    borderRadius: '12px',
                    fontWeight: '700',
                    textAlign: 'center',
                    fontSize: '14px',
                  }}
                >
                  ✓ टेली-परामर्श सलाह सुरक्षित व रेफरल स्वीकृत!
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveTeleconsultAdvice}
                  style={{
                    width: '100%',
                    backgroundColor: '#004d40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '13px',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  सलाह सहेजें एवं रेफरल स्वीकृत करें
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
