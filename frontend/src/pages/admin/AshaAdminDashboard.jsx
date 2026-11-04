import React, { useState, useEffect } from 'react';
import { choApi } from '../../api/client';
import {
  Users,
  Stethoscope,
  PhoneCall,
  Check,
  X,
  Building2,
  Volume2,
  RefreshCw,
  Wifi
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AshaFieldWorkerApp from './AshaFieldWorkerApp';

export default function AshaAdminDashboard() {
  const { admin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active Role: 'CHO' | 'ASHA' (can switch with 1-click or via ?role=asha)
  const initialRole = searchParams.get('role')?.toUpperCase() === 'ASHA' ? 'ASHA' : 'CHO';
  const [currentRole, setCurrentRole] = useState(initialRole);

  // Active Tab: 'Overview' | 'Workers' | 'Referrals'
  const [activeTab, setActiveTab] = useState('Workers');

  // Selected ASHA Worker for drilldown modal
  const [selectedWorker, setSelectedWorker] = useState(null);

  // Referral validation (triage / transport sign-off) modal state
  const [validationTarget, setValidationTarget] = useState(null);
  const [approvedReferralIds, setApprovedReferralIds] = useState(new Set());
  const [validationNote, setValidationNote] = useState('');
  const [showNotesSuccess, setShowNotesSuccess] = useState(false);
  const [bottomNav, setBottomNav] = useState('dashboard');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ASHA Workers Data
  const [workers, setWorkers] = useState([]);

  // Live CHO sector data (workers + referrals). No sample patients or invented vitals.
  const [sectorStatus, setSectorStatus] = useState(choApi.hasSession() ? 'loading' : 'no-session');

  const GENDER_HI = { Female: 'महिला', Male: 'पुरुष', Other: 'अन्य' };
  const AVATAR_TONES = [['#dcfce7', '#15803d'], ['#e0f2fe', '#0369a1'], ['#fef3c7', '#b45309'], ['#f3e8ff', '#7c3aed']];

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('hi-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const daysUntil = (iso) => {
    if (!iso) return null;
    const due = new Date(iso);
    if (isNaN(due.getTime())) return null;
    return Math.ceil((due.getTime() - Date.now()) / 86400000);
  };

  const loadSector = React.useCallback(async () => {
    if (!choApi.hasSession()) {
      setSectorStatus('no-session');
      return;
    }
    setSectorStatus('loading');
    const [workersRes, referralsRes] = await Promise.allSettled([choApi.getSectorWorkers(), choApi.getReferrals()]);
    const denied = [workersRes, referralsRes].some(
      (r) => r.status === 'rejected' && [401, 403].includes(r.reason?.response?.status)
    );
    if (denied) {
      setSectorStatus('denied');
      return;
    }
    if (workersRes.status === 'fulfilled' && Array.isArray(workersRes.value)) {
      setWorkers(
        workersRes.value.map((w, i) => ({
          id: `w-${w.phone}`,
          avatar: String(w.name || '?').split(' ').map((x) => x[0] || '').join('').slice(0, 2).toUpperCase(),
          avatarBg: AVATAR_TONES[i % AVATAR_TONES.length][0],
          avatarColor: AVATAR_TONES[i % AVATAR_TONES.length][1],
          name: w.name || '—',
          village: w.villageName || '—',
          phone: w.phone || '',
          role: w.role || 'ASHA',
          families: Number(w.familyCount) || 0,
          surveys: Number(w.surveyCount) || 0,
          referrals: Number(w.referralCount) || 0,
          hrpCount: Number(w.pregnantCount) || 0,
          ncdCount: Number(w.ncdCount) || 0,
          lastActive: w.lastActive ? formatDate(w.lastActive) : '—',
        }))
      );
    }
    if (referralsRes.status === 'fulfilled' && Array.isArray(referralsRes.value)) {
      const rows = referralsRes.value;
      setCriticalReferrals(
        rows.map((r) => {
          const left = daysUntil(r.dueDate);
          return {
            id: `ref-${r.id}`,
            serverId: r.id,
            name: r.patientName || r.familyHeadName || '—',
            age: r.age != null ? r.age : '—',
            gender: GENDER_HI[r.gender] || '—',
            houseNo: r.houseNumber || '—',
            village: r.villageName || '—',
            phone: r.patientPhone || '',
            abhaId: '',
            workerName: r.ashaWorkerName || r.ashaWorkerPhone || '—',
            doctorName: '',
            prescriptions: '',
            prescriptionDeadline: '',
            reason: r.title || r.taskType || '—',
            tier: left != null && left <= 7 ? 'urgent_7d' : 'semi_urgent_14d',
            daysLeft: left != null ? Math.max(left, 0) : '—',
            condition: r.description || '',
            vitals: r.description || '—',
            referralSource: r.taskType === 'REFERRAL_MISSED' ? 'अस्पताल रेफरल' : 'आशा फील्ड रेफरल',
            choNote: r.choNote || '',
            approved: r.status === 'APPROVED_CHO',
          };
        })
      );
      setApprovedReferralIds(new Set(rows.filter((r) => r.status === 'APPROVED_CHO').map((r) => `ref-${r.id}`)));
    }
    setSectorStatus('ready');
  }, []);

  useEffect(() => {
    loadSector();
  }, [loadSector]);

  // Critical Referrals List
  const [criticalReferrals, setCriticalReferrals] = useState([]);

  const handleApproveReferral = async (id, note) => {
    const target = criticalReferrals.find((r) => r.id === id);
    if (!target || target.serverId == null) return false;
    try {
      await choApi.approveReferral(target.serverId, note);
    } catch (e) {
      const status = e?.response?.status;
      toast.error(
        status === 404
          ? 'यह रेफरल आपके सेक्टर में नहीं है।'
          : status === 401 || status === 403
          ? 'सीएचओ लॉगिन आवश्यक।'
          : 'सत्यापन सहेजा नहीं गया। पुनः प्रयास करें।'
      );
      return false;
    }
    setApprovedReferralIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.success('रेफरल सत्यापित।');
    return true;
  };

  const handleSaveValidation = async () => {
    if (!validationTarget) return;
    const ok = await handleApproveReferral(validationTarget.id, validationNote.trim());
    if (!ok) return;
    setShowNotesSuccess(true);
    setTimeout(() => {
      setShowNotesSuccess(false);
      setValidationTarget(null);
      setValidationNote('');
    }, 1200);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                border: '1px solid #E2E8F0',
                flexShrink: 0,
              }}
            >
              <img
                src="/aarogya_flow_icon_transparent_hd.png"
                alt="Aarogya Flow"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/aarogya_flow_icon_transparent.png';
                }}
              />
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

          {/* Right Actions & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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

            <a
              href="/asha/index.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#F3E8FF',
                color: '#7E22CE',
                border: '1.5px solid #D8B4FE',
                padding: '5px 11px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '800',
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
              title="Launch standalone React Native mobile app in a new window"
            >
              <span>📱</span>
              <span>Expo Mobile</span>
            </a>

            <button
              type="button"
              onClick={() => {
                const next = currentRole === 'CHO' ? 'ASHA' : 'CHO';
                setCurrentRole(next);
                toast.success(`Role switched to ${next === 'CHO' ? 'Community Health Officer (CHO Supervisor)' : 'ASHA Worker (Field Staff)'}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: currentRole === 'CHO' ? '#EFF6FF' : '#DCFCE7',
                color: currentRole === 'CHO' ? '#1D4ED8' : '#15803D',
                border: currentRole === 'CHO' ? '1.5px solid #93C5FD' : '1.5px solid #86EFAC',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
              }}
              title="Click to switch between CHO Supervisor and ASHA Worker roles"
            >
              <Users size={13} />
              <span>Role: {currentRole}</span>
              <RefreshCw size={11} style={{ marginLeft: '2px' }} />
            </button>

            <button
              type="button"
              onClick={() => navigate(admin ? '/admin' : '/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '5px 10px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
              title="Exit to Hospital Portal"
            >
              <span>←</span>
              <span>{admin ? 'Admin' : 'Exit'}</span>
            </button>
          </div>
        </header>

        {/* CHO SECTOR SESSION STATUS (live data only) */}
        {sectorStatus !== 'ready' && (
          <div
            role="status"
            style={{
              margin: '12px 16px 0',
              padding: '12px 14px',
              borderRadius: '12px',
              border: sectorStatus === 'loading' ? '1px solid #bae6fd' : '1px solid #fecaca',
              backgroundColor: sectorStatus === 'loading' ? '#f0f9ff' : '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '700', color: sectorStatus === 'loading' ? '#075985' : '#991b1b', lineHeight: 1.4 }}>
              {sectorStatus === 'loading' && 'सेक्टर डेटा लोड हो रहा है…'}
              {sectorStatus === 'no-session' && 'सीएचओ लॉगिन आवश्यक'}
              {sectorStatus === 'denied' && 'सीएचओ सत्यापन विफल — पुनः लॉगिन करें'}
            </span>
            {sectorStatus !== 'loading' && (
              <button
                type="button"
                onClick={() => {
                  choApi.logout();
                  navigate('/login/cho?redirect=' + encodeURIComponent('/asha-dashboard'));
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                सीएचओ लॉगिन
              </button>
            )}
          </div>
        )}

        {/* SCROLLABLE MAIN BODY */}
        <main style={{ flex: 1, padding: '16px 16px 80px', overflowY: 'auto' }}>
          {bottomNav === 'profile' ? (
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
          ) : currentRole === 'ASHA' ? (
            <AshaFieldWorkerApp onSwitchRole={() => setCurrentRole('CHO')} />
          ) : (
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
                    backgroundColor: currentRole === 'CHO' ? '#eff6ff' : '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={26} color={currentRole === 'CHO' ? '#1d4ed8' : '#059669'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                      आयुष्मान आरोग्य मंदिर (HWC)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = currentRole === 'CHO' ? 'ASHA' : 'CHO';
                        setCurrentRole(next);
                        toast.success(`Role switched to ${next === 'CHO' ? 'CHO Supervisor' : 'ASHA Field Worker'}`);
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: currentRole === 'CHO' ? '#dbeafe' : '#dcfce7',
                        color: currentRole === 'CHO' ? '#1e40af' : '#15803d',
                        border: 'none',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <RefreshCw size={10} /> Switch Role: {currentRole === 'CHO' ? 'ASHA' : 'CHO'}
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontWeight: '500' }}>
                    {currentRole === 'CHO'
                      ? 'कम्युनिटी हेल्थ ऑफिसर (CHO Supervisor) कार्यक्षेत्र पोर्टल'
                      : 'आशा कार्यकर्ता (ASHA Field Worker) ग्राम सर्वेक्षण एवं रेफरल पोर्टल'}
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
                    {sectorStatus === 'ready' && criticalReferrals.length === 0 && (
                      <div style={{ padding: '18px', textAlign: 'center', color: '#047857', fontWeight: '700', fontSize: '13px', border: '1px solid #a7f3d0', borderRadius: '12px', backgroundColor: '#ecfdf5' }}>
                        ✓ कोई लंबित रेफरल नहीं
                      </div>
                    )}
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
                                घर सं.: {ref.houseNo} • {ref.village} • आशा: {ref.workerName}
                              </div>

                              {/* Attached Phone Number & ABHA ID Number */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {ref.phone && (
                                  <a
                                    href={`tel:${ref.phone}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: '#eff6ff',
                                      color: '#1d4ed8',
                                      border: '1px solid #bfdbfe',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      textDecoration: 'none',
                                    }}
                                  >
                                    <PhoneCall size={11} color="#1d4ed8" />
                                    <span>{ref.phone}</span>
                                    <span style={{ fontSize: '9px', backgroundColor: '#dbeafe', padding: '1px 4px', borderRadius: '3px' }}>कॉल करें</span>
                                  </a>
                                )}
                                {ref.abhaId && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      backgroundColor: '#ecfdf5',
                                      color: '#047857',
                                      border: '1px solid #a7f3d0',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '10.5px',
                                      fontWeight: '700',
                                    }}
                                  >
                                    <span>ABHA:</span>
                                    <span>{ref.abhaId}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: isApproved ? '#059669' : '#dc2626',
                                backgroundColor: isApproved ? '#d1fae5' : '#fee2e2',
                                padding: '4px 9px',
                                borderRadius: '12px',
                                border: isApproved ? '1px solid #a7f3d0' : '1px solid #fecaca',
                              }}
                            >
                              {isApproved ? '✓ सत्यापित' : `⚠️ ${ref.daysLeft} दिन शेष`}
                            </span>
                          </div>

                          <div
                            style={{
                              backgroundColor: '#fff1f2',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              marginBottom: '8px',
                            }}
                          >
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#9f1239' }}>
                              {ref.reason}
                            </div>
                            <div style={{ fontSize: '11px', color: '#be123c', marginTop: '2px' }}>
                              वाइटल्स: {ref.vitals}
                            </div>
                          </div>

                          {/* Prescriptions & Prescription Deadline */}
                          {ref.prescriptions && (
                            <div
                              style={{
                                backgroundColor: '#fffbeb',
                                border: '1px solid #fde68a',
                                borderRadius: '10px',
                                padding: '8px 10px',
                                marginBottom: '10px',
                              }}
                            >
                              <div style={{ fontSize: '11px', fontWeight: '800', color: '#92400e' }}>
                                💊 दवा सलाह (Doctor Prescriptions):
                              </div>
                              <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#78350f', marginTop: '2px' }}>
                                {ref.prescriptions}
                              </div>
                              {ref.prescriptionDeadline && (
                                <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#dc2626', marginTop: '3px' }}>
                                  ⏰ प्रिस्क्रिप्शन समयसीमा: {ref.prescriptionDeadline}
                                </div>
                              )}
                              {ref.doctorName && (
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  सलाहकार: {ref.doctorName}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <a
                              href={`tel:${ref.phone}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: '#f0f9ff',
                                color: '#0369a1',
                                border: '1px solid #bae6fd',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                fontSize: '12px',
                                fontWeight: '700',
                                textDecoration: 'none',
                              }}
                            >
                              <PhoneCall size={14} color="#0369a1" />
                              <span>मरीज को कॉल करें</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setValidationTarget(ref);
                                setValidationNote('');
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
                              <span>सत्यापन करें</span>
                            </button>

                            {!isApproved && (
                              <button
                                type="button"
                                onClick={() => handleApproveReferral(ref.id, '')}
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

        {/* MODAL: REFERRAL VALIDATION (TRIAGE / TRANSPORT SIGN-OFF) */}
        {validationTarget && (
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
            onClick={() => setValidationTarget(null)}
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
                    रेफरल सत्यापन एवं परिवहन
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0' }}>
                    {validationTarget.name} ({validationTarget.age} वर्ष · {validationTarget.gender})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationTarget(null)}
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
                  {validationTarget.reason}
                </div>
                <div style={{ fontSize: '11.5px', color: '#be123c', marginTop: '3px' }}>
                  वाइटल्स: {validationTarget.vitals}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  ट्राइएज / परिवहन टिप्पणी:
                </label>
                <textarea
                  rows={4}
                  value={validationNote}
                  onChange={(e) => setValidationNote(e.target.value)}
                  placeholder="जैसे: 108 एम्बुलेंस से FRU भेजें"
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
                  ✓ रेफरल सत्यापित
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveValidation}
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
                  सत्यापित करें
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
