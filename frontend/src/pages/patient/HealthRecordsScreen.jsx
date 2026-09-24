import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { courseApi, familyApi, fetchAsObjectUrl, hospitalApi, patientApi, referralApi, setToken } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AyushmanFooter from '../../components/AyushmanFooter';
import { Modal, Spinner } from '../../components/ui';

export default function HealthRecordsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patient, logout } = useAuth();
  const toast = useToast();

  const tokenParam = searchParams.get('token');
  useEffect(() => {
    if (tokenParam) {
      setToken('PATIENT', tokenParam);
    }
  }, [tokenParam]);

  // Active Tab: 'documents' | 'courses' | 'referrals'
  const tabParam = searchParams.get('tab') || 'documents';
  const [activeTab, setActiveTab] = useState(tabParam);

  // Dynamic Phone detection (authenticated session phone, search param, or default fallback)
  const phoneParam = searchParams.get('phone');
  const activePhone = useMemo(() => {
    if (phoneParam && phoneParam.trim()) return phoneParam.trim();
    if (patient?.subject && patient.subject.trim()) return patient.subject.trim();
    return '8850934544';
  }, [phoneParam, patient]);

  // DB Data States
  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  // Patient Selection States
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [hasConfirmedPatient, setHasConfirmedPatient] = useState(false);

  // Upload Document Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    docType: 'prescription',
    memberId: '',
    patientName: '',
    patientAge: '',
    hospitalId: '',
  });
  const [uploading, setUploading] = useState(false);

  // Modals for QR / Document / Timeline preview
  const [activeSlipModal, setActiveSlipModal] = useState(null);
  const [activeCourseModal, setActiveCourseModal] = useState(null);
  const [courseTimeline, setCourseTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Tab switcher
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      return p;
    });
  };

  // Fetch all live data from Database
  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Family Members from DB
      let members = [];
      try {
        if (patient?.token) {
          members = await familyApi.listMembers();
        } else {
          members = await familyApi.listPublicMembers(activePhone);
        }
      } catch (err) {
        console.warn('Fallback public family query:', err);
        try {
          members = await familyApi.listPublicMembers(activePhone);
        } catch {
          members = [];
        }
      }
      setFamilyMembers(Array.isArray(members) ? members : []);

      // Auto-select first member (default: Self / Head)
      if (Array.isArray(members) && members.length > 0) {
        const selfMember = members.find(
          (m) =>
            m.relationship?.toLowerCase() === 'self' ||
            m.relationship?.toLowerCase() === 'head'
        );
        const initialId = selfMember ? selfMember.id : members[0].id;
        setSelectedMemberId((prev) => (prev ? prev : initialId));
      }

      // 2. Fetch Documents from DB
      let docs = [];
      try {
        if (patient?.token) {
          docs = await patientApi.documents();
        } else {
          docs = await patientApi.publicDocuments(activePhone);
        }
      } catch (err) {
        try {
          docs = await patientApi.publicDocuments(activePhone);
        } catch {
          docs = [];
        }
      }
      setDocuments(Array.isArray(docs) ? docs : []);

      // 3. Fetch Courses from DB
      let crs = [];
      try {
        if (patient?.token) {
          crs = await courseApi.patientCourses();
        } else {
          crs = await courseApi.publicPatientCourses(activePhone);
        }
      } catch (err) {
        try {
          crs = await courseApi.publicPatientCourses(activePhone);
        } catch {
          crs = [];
        }
      }
      setCourses(Array.isArray(crs) ? crs : []);

      // 4. Fetch Referrals from DB
      let refs = [];
      try {
        if (patient?.token) {
          refs = await referralApi.patientReferrals();
        } else {
          refs = await referralApi.publicPatientReferrals(activePhone);
        }
      } catch (err) {
        try {
          refs = await referralApi.publicPatientReferrals(activePhone);
        } catch {
          refs = [];
        }
      }
      setReferrals(Array.isArray(refs) ? refs : []);

      // 5. Fetch Hospitals list
      try {
        const hList = await hospitalApi.list();
        setHospitals(Array.isArray(hList) ? hList : []);
      } catch {
        // non-critical
      }
    } catch (err) {
      toast.error('Could not load records from database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhone]);

  // Selected Member Object
  const selectedMember = useMemo(() => {
    if (!familyMembers.length) return null;
    return familyMembers.find((m) => m.id === selectedMemberId) || familyMembers[0];
  }, [familyMembers, selectedMemberId]);

  // Filtered Documents from DB based on selected member
  const memberDocuments = useMemo(() => {
    if (!selectedMember || !documents.length) return [];
    const memberName = selectedMember.name.toLowerCase().trim();
    const isSelfOrHead =
      selectedMember.relationship?.toLowerCase() === 'self' ||
      selectedMember.relationship?.toLowerCase() === 'head';

    return documents.filter((doc) => {
      if (!doc.patientName) return isSelfOrHead;
      const docName = doc.patientName.toLowerCase().trim();
      return docName === memberName || memberName.includes(docName) || docName.includes(memberName);
    });
  }, [selectedMember, documents]);

  // Filtered Courses from DB based on selected member
  const memberCourses = useMemo(() => {
    if (!selectedMember || !courses.length) return [];
    const memberName = selectedMember.name.toLowerCase().trim();
    const isSelfOrHead =
      selectedMember.relationship?.toLowerCase() === 'self' ||
      selectedMember.relationship?.toLowerCase() === 'head';

    return courses.filter((c) => {
      if (c.familyMemberId && c.familyMemberId === selectedMember.id) return true;
      if (!c.patientName) return isSelfOrHead;
      const cName = c.patientName.toLowerCase().trim();
      return cName === memberName || memberName.includes(cName) || cName.includes(memberName);
    });
  }, [selectedMember, courses]);

  // Filtered Referrals from DB based on selected member
  const memberReferrals = useMemo(() => {
    if (!selectedMember || !referrals.length) return [];
    const memberName = selectedMember.name.toLowerCase().trim();
    const isSelfOrHead =
      selectedMember.relationship?.toLowerCase() === 'self' ||
      selectedMember.relationship?.toLowerCase() === 'head';

    return referrals.filter((r) => {
      if (!r.patientName) return isSelfOrHead;
      const rName = r.patientName.toLowerCase().trim();
      return rName === memberName || memberName.includes(rName) || rName.includes(memberName);
    });
  }, [selectedMember, referrals]);

  // Handle uploading document for a chosen family member
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      toast.error('Please choose a file to upload.');
      return;
    }

    const targetMember = familyMembers.find((m) => String(m.id) === String(uploadForm.memberId)) || selectedMember;
    const targetName = targetMember ? targetMember.name : (uploadForm.patientName || 'Family Member');
    const targetAge = targetMember && targetMember.age ? targetMember.age : (uploadForm.patientAge ? Number(uploadForm.patientAge) : 24);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('docType', uploadForm.docType);
      fd.append('patientName', targetName);
      if (targetAge) fd.append('patientAge', targetAge);
      if (uploadForm.hospitalId) fd.append('hospitalId', uploadForm.hospitalId);

      await patientApi.uploadDocument(fd);
      toast.success(`Document uploaded for ${targetName} to database.`);
      setShowUpload(false);
      setUploadForm({
        file: null,
        docType: 'prescription',
        memberId: '',
        patientName: '',
        patientAge: '',
        hospitalId: '',
      });
      // Refresh DB data
      loadDatabaseData();
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Open Document File
  const handleViewDocument = async (id) => {
    try {
      const url = await fetchAsObjectUrl(patientApi.documentFileUrl(id), 'PATIENT');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error('Could not open document: ' + err.message);
    }
  };

  // Open Course Timeline
  const handleOpenCourse = async (course) => {
    setActiveCourseModal(course);
    setLoadingTimeline(true);
    try {
      const t = await courseApi.timeline(course.id, patient?.token ? 'PATIENT' : 'DOCTOR');
      setCourseTimeline(t);
    } catch (err) {
      toast.error('Could not load care timeline: ' + err.message);
      setCourseTimeline(null);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Helper for member avatar color styling
  const getAvatarTheme = (member, isSelected) => {
    const rel = (member.relationship || '').toLowerCase();
    const gender = (member.gender || '').toLowerCase();

    if (rel === 'self' || rel === 'head') {
      return {
        bg: '#ECFDF5',
        color: '#059669',
        border: isSelected ? '#004D40' : '#A7F3D0',
        tagBg: '#DCFCE7',
        tagColor: '#166534',
      };
    }
    if (rel === 'mother' || gender === 'female') {
      return {
        bg: '#FFE4E6',
        color: '#E11D48',
        border: '#FECDD3',
        tagBg: '#F1F5F9',
        tagColor: '#475569',
      };
    }
    if (rel === 'father') {
      return {
        bg: '#DBEAFE',
        color: '#2563EB',
        border: '#BFDBFE',
        tagBg: '#F1F5F9',
        tagColor: '#475569',
      };
    }
    if (rel === 'brother') {
      return {
        bg: '#EDE9FE',
        color: '#7C3AED',
        border: '#DDD6FE',
        tagBg: '#F1F5F9',
        tagColor: '#475569',
      };
    }
    return {
      bg: '#F3F4F6',
      color: '#4B5563',
      border: '#E5E7EB',
      tagBg: '#F1F5F9',
      tagColor: '#475569',
    };
  };

  const handleLogout = () => {
    logout('PATIENT');
    navigate('/login/patient');
  };

  // Bottom Navigation Bar items
  const bottomTabs = [
    {
      to: '/patient',
      label: 'My Queue',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      ),
    },
    {
      to: '/patient/family',
      label: 'Family & ABHA',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: '/records-select',
      label: 'Records',
      isActive: true,
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      to: '/patient/access',
      label: 'Access',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#004D40' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F1F5F9',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Mobile App Viewport Frame */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '100vh',
          maxHeight: '920px',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
          borderRadius: '0px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 1. Header & Navigation (Top App Bar) */}
        <header
          style={{
            padding: '14px 18px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* Left: Circular back arrow */}
          <button
            type="button"
            onClick={() => {
              if (hasConfirmedPatient) {
                setHasConfirmedPatient(false);
              } else if (location.pathname !== '/patient') {
                navigate('/patient');
              } else {
                navigate(-1);
              }
            }}
            aria-label="Back"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#F3F4F6',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1F2937',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Center: Bold "Health Records" with smaller gray subtitle "+918850934544" */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#004D40',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              Health Records
            </h1>
            <span style={{ fontSize: '11.5px', color: '#6B7280', fontWeight: '500', marginTop: '2px' }}>
              {activePhone.startsWith('+') ? activePhone : `+91${activePhone}`}
            </span>
          </div>

          {/* Right: Circular light red button with logout icon */}
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#DC2626',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </header>

        {/* Tab Bar: Horizontal row of pill-shaped tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 16px 8px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          {/* Documents Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('documents')}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: '24px',
              border: activeTab === 'documents' ? '1.5px solid #004D40' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'documents' ? '#004D40' : '#FFFFFF',
              color: activeTab === 'documents' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: activeTab === 'documents' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'documents' ? '#FFFFFF' : '#64748B'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Documents</span>
          </button>

          {/* Course Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('courses')}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: '24px',
              border: activeTab === 'courses' ? '1.5px solid #004D40' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'courses' ? '#004D40' : '#FFFFFF',
              color: activeTab === 'courses' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: activeTab === 'courses' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'courses' ? '#FFFFFF' : '#7C3AED'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>Course</span>
          </button>

          {/* Referrals Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('referrals')}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: '24px',
              border: activeTab === 'referrals' ? '1.5px solid #004D40' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'referrals' ? '#004D40' : '#FFFFFF',
              color: activeTab === 'referrals' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: activeTab === 'referrals' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'referrals' ? '#FFFFFF' : '#2563EB'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>Referrals</span>
          </button>
        </div>

        {/* Scrollable Main Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {loading ? (
            <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
              <Spinner label="Loading health records from database..." />
            </div>
          ) : !hasConfirmedPatient ? (
            /* ===============================================================
               STEP 1: PATIENT SELECTION SCREEN (Exact Prompt & Screenshot Spec)
               =============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title & Subtitle */}
              <div>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    color: '#0F172A',
                    margin: '0 0 6px 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {activeTab === 'courses' ? 'View Care Episodes' : activeTab === 'referrals' ? 'View Referral Passes' : 'View Prescriptions'}
                </h2>
                <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
                  Select a family member to view their {activeTab === 'courses' ? 'care episodes and progress.' : activeTab === 'referrals' ? 'hospital referral passes.' : 'prescriptions and records.'}
                </p>
              </div>

              {/* Info Card: Full-width card with very light green background and subtle border */}
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                {/* Left: Green document icon */}
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#15803D',
                    flexShrink: 0,
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>

                {/* Right: Bold Prescriptions and gray description */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#166534', letterSpacing: '-0.01em' }}>
                    Prescriptions
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px', lineHeight: 1.35 }}>
                    View, download and manage prescriptions for your family members.
                  </div>
                </div>
              </div>

              {/* 3. Family Member Selection List (Live from DB) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {familyMembers.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: '16px',
                      border: '1px dashed #CBD5E1',
                      textAlign: 'center',
                      color: '#64748B',
                      fontSize: '13px',
                    }}
                  >
                    No family members found in DB for this phone. You can add one via Family & ABHA tab.
                  </div>
                ) : (
                  familyMembers.map((member) => {
                    const isSelected = selectedMemberId === member.id;
                    const theme = getAvatarTheme(member, isSelected);

                    return (
                      <div
                        key={member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '16px',
                          backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                          border: isSelected ? '2px solid #004D40' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 12px rgba(0, 77, 64, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        {/* Left: Avatar + Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Circular Avatar */}
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              backgroundColor: theme.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: theme.color,
                              flexShrink: 0,
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>

                          {/* Center: Bold Name & Pill Tag */}
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.01em' }}>
                              {member.name}
                            </div>
                            <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  backgroundColor: theme.tagBg,
                                  color: theme.tagColor,
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  display: 'inline-block',
                                }}
                              >
                                {member.relationship || 'Self'}
                              </span>
                              {member.age && (
                                <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                  • {member.age} yrs
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Radio Button */}
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border: isSelected ? '2px solid #004D40' : '2px solid #CBD5E1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#FFFFFF',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected && (
                            <div
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: '#004D40',
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 4. Action: Full-width solid dark green Continue button */}
              <button
                type="button"
                onClick={() => setHasConfirmedPatient(true)}
                disabled={!selectedMember}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: '#004D40',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: selectedMember ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  boxShadow: '0 4px 12px rgba(0, 77, 64, 0.2)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Continue</span>
                <span style={{ fontSize: '18px' }}>→</span>
              </button>
            </div>
          ) : (
            /* ===============================================================
               STEP 2: PATIENT'S DEDICATED DB RECORDS VIEW
               =============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Selected Patient Banner with Switch Button */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '14px',
                    }}
                  >
                    {selectedMember?.name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                      {selectedMember?.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                      {selectedMember?.relationship || 'Member'} • {selectedMember?.age ? `${selectedMember.age} yrs` : 'All ages'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHasConfirmedPatient(false)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '20px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#004D40',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Switch</span>
                  <span>↺</span>
                </button>
              </div>

              {/* =============================================================
                 TAB 1: DOCUMENTS / PRESCRIPTIONS FOR SELECTED MEMBER
                 ============================================================= */}
              {activeTab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Upload Action Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '14px',
                      padding: '12px 14px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>
                        Add Record for {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803D' }}>
                        Upload prescriptions or lab reports to database
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadForm((f) => ({
                          ...f,
                          memberId: selectedMember?.id || '',
                          patientName: selectedMember?.name || '',
                          patientAge: selectedMember?.age || '',
                        }));
                        setShowUpload(!showUpload);
                      }}
                      style={{
                        backgroundColor: '#004D40',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {showUpload ? 'Cancel' : '+ Upload'}
                    </button>
                  </div>

                  {/* Upload Form Accordion */}
                  {showUpload && (
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1.5px solid #004D40',
                        borderRadius: '16px',
                        padding: '14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      }}
                    >
                      <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Member Selector Dropdown */}
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                            PATIENT / FAMILY MEMBER
                          </label>
                          <select
                            value={uploadForm.memberId}
                            onChange={(e) => {
                              const m = familyMembers.find((item) => String(item.id) === e.target.value);
                              setUploadForm((f) => ({
                                ...f,
                                memberId: e.target.value,
                                patientName: m ? m.name : f.patientName,
                                patientAge: m && m.age ? m.age : f.patientAge,
                              }));
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              fontSize: '13px',
                              backgroundColor: '#FFFFFF',
                            }}
                          >
                            {familyMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.relationship || 'Self'}) {m.age ? `— ${m.age} yrs` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Document Type */}
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                            DOCUMENT TYPE
                          </label>
                          <select
                            value={uploadForm.docType}
                            onChange={(e) => setUploadForm((f) => ({ ...f, docType: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              fontSize: '13px',
                              backgroundColor: '#FFFFFF',
                            }}
                          >
                            <option value="prescription">💊 Prescription</option>
                            <option value="report">🔬 Diagnostic / Lab Report</option>
                          </select>
                        </div>

                        {/* Hospital */}
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                            ISSUING HOSPITAL (OPTIONAL)
                          </label>
                          <select
                            value={uploadForm.hospitalId}
                            onChange={(e) => setUploadForm((f) => ({ ...f, hospitalId: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              fontSize: '13px',
                              backgroundColor: '#FFFFFF',
                            }}
                          >
                            <option value="">(None / External Clinic)</option>
                            {hospitals.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* File Attachment */}
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                            ATTACH DOCUMENT FILE (PDF / IMAGE)
                          </label>
                          <input
                            type="file"
                            accept=".pdf,image/png,image/jpeg"
                            onChange={(e) => setUploadForm((f) => ({ ...f, file: e.target.files[0] || null }))}
                            required
                            style={{
                              width: '100%',
                              padding: '6px',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={uploading}
                          style={{
                            backgroundColor: '#004D40',
                            color: '#FFFFFF',
                            padding: '10px',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: '700',
                            fontSize: '13px',
                            cursor: uploading ? 'wait' : 'pointer',
                            marginTop: '4px',
                          }}
                        >
                          {uploading ? 'Uploading to Database...' : 'Save to ABDM Health Locker'}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Documents List from DB */}
                  {memberDocuments.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 16px',
                        textAlign: 'center',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #E2E8F0',
                        borderRadius: '16px',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                        No prescriptions or documents found for {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        Uploaded medical records for this patient will appear directly from the database here.
                      </div>
                    </div>
                  ) : (
                    memberDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '14px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: doc.docType === 'prescription' ? '#DCFCE7' : '#DBEAFE',
                              color: doc.docType === 'prescription' ? '#166534' : '#1E40AF',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {doc.docType ? doc.docType.toUpperCase() : 'DOCUMENT'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                          </span>
                        </div>

                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>
                            {doc.fileName || 'Medical_Record.pdf'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            Patient: <strong>{doc.patientName || selectedMember?.name}</strong> {doc.patientAge ? `(${doc.patientAge} yrs)` : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid #F1F5F9' }}>
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc.id)}
                            style={{
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#004D40',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>📥</span>
                            <span>Download / View</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* =============================================================
                 TAB 2: CARE EPISODES (COURSES) FOR SELECTED MEMBER
                 ============================================================= */}
              {activeTab === 'courses' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {memberCourses.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 16px',
                        textAlign: 'center',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #E2E8F0',
                        borderRadius: '16px',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🩺</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                        No care episodes found for {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        Longitudinal care episodes initiated by consulting doctors will appear here from the database.
                      </div>
                    </div>
                  ) : (
                    memberCourses.map((course) => (
                      <div
                        key={course.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1.5px solid #004D40',
                          borderRadius: '16px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#004D40' }}>
                            🏥 {course.title || course.courseType}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: course.status === 'active' ? '#DCFCE7' : '#F1F5F9',
                              color: course.status === 'active' ? '#166534' : '#475569',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {course.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#334155' }}>
                          Diagnosis: <strong>{course.diagnosis || 'Clinical follow-up'}</strong>
                        </div>

                        {course.currentSummary && (
                          <div style={{ fontSize: '12px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '8px' }}>
                            {course.currentSummary}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenCourse(course)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '10px',
                            backgroundColor: '#004D40',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: '4px',
                          }}
                        >
                          View Clinical Timeline & Prescriptions
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* =============================================================
                 TAB 3: REFERRALS FOR SELECTED MEMBER
                 ============================================================= */}
              {activeTab === 'referrals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {memberReferrals.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 16px',
                        textAlign: 'center',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #E2E8F0',
                        borderRadius: '16px',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔄</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                        No referral slips found for {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        Hospital-to-hospital priority referral passes issued by physicians will appear here from the database.
                      </div>
                    </div>
                  ) : (
                    memberReferrals.map((slip) => (
                      <div
                        key={slip.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1.5px solid #004D40',
                          borderRadius: '16px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#004D40' }}>
                            Pass #{slip.id}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: '#DBEAFE',
                              color: '#1E40AF',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {slip.priorityTier || 'Routine'}
                          </span>
                        </div>

                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                            🏥 {slip.toHospitalName || `Facility #${slip.toHospitalId}`}
                          </div>
                          <div style={{ fontSize: '12px', color: '#0284C7', fontWeight: '600', marginTop: '2px' }}>
                            Specialty: {slip.targetDepartment || 'Specialist Consultation'}
                          </div>
                        </div>

                        {slip.reason && (
                          <div style={{ fontSize: '12px', color: '#334155', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '8px' }}>
                            <strong>Reason:</strong> {slip.reason}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveSlipModal(slip)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '10px',
                            backgroundColor: '#004D40',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>🎟️</span>
                          <span>View QR Admission Pass</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar: Four items (My Queue, Family & ABHA, Records, Access) */}
        <nav
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #F1F5F9',
            padding: '8px 10px 6px',
          }}
        >
          {bottomTabs.map((tab) => {
            const active = tab.isActive;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => navigate(tab.to)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: active ? '#E8F5E9' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon(active)}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: active ? '700' : '500',
                    color: active ? '#004D40' : '#6B7280',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Aarogya Flow Footer branding */}
        <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '6px 16px 12px', flexShrink: 0 }} />
      </div>

      {/* QR Referral Modal */}
      {activeSlipModal && (
        <Modal title="Referral Admission QR Pass" onClose={() => setActiveSlipModal(null)}>
          <div style={{ textAlign: 'center', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#0F172A' }}>
              {activeSlipModal.toHospitalName}
            </div>
            <img
              src={referralApi.qrUrl(activeSlipModal.id)}
              alt="Referral Pass QR"
              style={{ width: '200px', height: '200px', borderRadius: '14px', border: '1px solid #CBD5E1', padding: '8px' }}
            />
            <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
              Present this pass at the Priority Referral Desk of {activeSlipModal.toHospitalName} for expedited OPD counter entry.
            </div>
          </div>
        </Modal>
      )}

      {/* Course Timeline Modal */}
      {activeCourseModal && (
        <Modal title={`${activeCourseModal.title || 'Care Episode'} Timeline`} onClose={() => setActiveCourseModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
            <div style={{ fontSize: '13px', color: '#64748B' }}>
              Condition: <strong>{activeCourseModal.diagnosis}</strong>
            </div>

            {loadingTimeline ? (
              <Spinner label="Loading timeline encounters..." />
            ) : !courseTimeline ? (
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>No clinical encounters logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {courseTimeline.encounters?.map((enc) => (
                  <div key={enc.id} style={{ background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                      <strong>{enc.visitDate || 'Consultation'}</strong>
                      <span>Dr. ID #{enc.doctorId}</span>
                    </div>
                    {enc.chiefComplaint && (
                      <div style={{ fontSize: '12px', color: '#0F172A', marginTop: '4px' }}>
                        <strong>Complaint:</strong> {enc.chiefComplaint}
                      </div>
                    )}
                    {enc.clinicalNotes && (
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                        <strong>Notes:</strong> {enc.clinicalNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
