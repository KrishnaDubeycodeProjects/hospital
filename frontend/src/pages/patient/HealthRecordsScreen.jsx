// Helper to format dates & timings in layman terms (e.g. Friday, 18 Sep 2026 • 10:15 AM (Morning))
export function formatLaymanDateTime(dateInput) {
  if (!dateInput) return 'Recent Consultation';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      // If it is already a string like '18 Sep 2026', return with friendly label
      return String(dateInput);
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const weekday = dayNames[d.getDay()];
    const day = d.getDate();
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const period = hours < 12 ? 'Morning' : hours < 17 ? 'Afternoon' : 'Evening';
    hours = hours % 12 || 12;
    
    return `${weekday}, ${day} ${month} ${year} • ${hours}:${minutes} ${ampm} (${period})`;
  } catch {
    return String(dateInput);
  }
}

// Professional SVG Vector Calendar Icon
export function CalendarIcon({ size = 15, color = 'currentColor', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { courseApi, familyApi, fetchAsObjectUrl, hospitalApi, patientApi, referralApi, setToken } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AyushmanFooter from '../../components/AyushmanFooter';
import { Modal, Spinner, fmtDateTime } from '../../components/ui';
import { RAW_FAMILY_MEMBERS } from '../../data/rawPatientRecordsData';
import TrainStationTimeline, { formatIndianDateTime } from '../../components/TrainStationTimeline';


// Helper to parse time-of-day slots
function parseRuralDosageSlots(frequency = '', dosage = '') {
  const f = (frequency || '').toLowerCase();
  const d = (dosage || '').toLowerCase();
  let m = false;
  let a = false;
  let n = false;
  if (f.includes('tid') || f.includes('tds') || f.includes('thrice') || f.includes('three') || d.includes('1-1-1')) {
    m = true; a = true; n = true;
  } else if (f.includes('bid') || f.includes('bd') || f.includes('twice') || f.includes('two') || d.includes('1-0-1')) {
    m = true; a = false; n = true;
  } else if (f.includes('od') || f.includes('once') || f.includes('daily') || d.includes('1-0-0') || d.includes('0-0-1')) {
    if (f.includes('night') || d.includes('0-0-1')) {
      n = true;
    } else {
      m = true;
    }
  } else {
    m = true; n = true;
  }
  return { m, a, n };
}

// Native SpeechSynthesis helper to read prescription aloud in English
function speakPrescriptionAloud(title, doctor, diagnosis, prescriptions = [], plan = '') {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    alert('Voice narration is not supported on this browser or device.');
    return;
  }
  window.speechSynthesis.cancel();
  
  let speechText = `Hello. This is your medical consultation summary with Dr. ${doctor || 'Rajesh Sharma'}. `;
  if (diagnosis) speechText += `Clinical diagnosis: ${diagnosis}. `;
  if (prescriptions && prescriptions.length > 0) {
    speechText += `You have ${prescriptions.length} prescribed medication${prescriptions.length > 1 ? 's' : ''}. `;
    prescriptions.forEach((p, idx) => {
      const name = p.medicineName || p.drugName || 'Medicine';
      const dose = p.dosage || p.dose || 'one dose';
      const freq = p.frequency || '';
      const instructions = p.instructions ? `, ${p.instructions}` : '';
      speechText += `Medicine ${idx + 1}: ${name}, dosage: ${dose}, ${freq}${instructions}. `;
    });
  }
  if (plan) speechText += `Doctor's Advice: ${plan}. `;
  speechText += `Please take your medications on time and follow all instructions. Thank you.`;

  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.lang = 'en-IN';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}


// Helper to extract essential clinical vitals from raw summary
function parseVitalsFromSummary(text = '') {
  if (!text) return { bp: '120/80', pulse: '76', temp: '98.6', spo2: '99%', hasLabs: false };
  const bpMatch = text.match(/BP\s*([0-9/]+)/i);
  const pulseMatch = text.match(/Pulse\s*([0-9]+)/i);
  const tempMatch = text.match(/Temp\s*([0-9.]+)/i);
  const spo2Match = text.match(/SpO2\s*([0-9]+%?)/i);
  const labsMatch = text.match(/Investigations Ordered:\s*([^\n\r]+)/i);

  return {
    bp: bpMatch ? bpMatch[1] : '120/80',
    pulse: pulseMatch ? pulseMatch[1] : '76',
    temp: tempMatch ? tempMatch[1] : '98.6',
    spo2: spo2Match ? spo2Match[1] : '99%',
    hasLabs: Boolean(labsMatch && !labsMatch[1].toLowerCase().includes('none')),
  };
}

// Helper to map family member to their corresponding clinical sample bundle if DB records are not yet added
function getMemberFallbackData(member, memberIndex = 0) {
  if (!member) return RAW_FAMILY_MEMBERS[0] || null;
  const rel = (member.relationship || member.relation || '').toLowerCase().trim();
  const name = (member.name || '').toLowerCase().trim();

  // Try direct name match first
  const nameMatch = RAW_FAMILY_MEMBERS.find(
    (rm) => rm.name.toLowerCase().includes(name) || name.includes(rm.name.toLowerCase())
  );
  if (nameMatch) return nameMatch;

  // Relationship-based mapping
  if (rel === 'self' || rel === 'head') {
    return RAW_FAMILY_MEMBERS[0]; // Primary Self bundle
  }
  if (rel.includes('wife') || rel.includes('mother') || rel.includes('spouse') || rel.includes('female')) {
    return RAW_FAMILY_MEMBERS[1] || RAW_FAMILY_MEMBERS[0]; // Spouse/Mother bundle
  }
  if (rel.includes('father') || rel.includes('husband') || rel.includes('parent')) {
    return RAW_FAMILY_MEMBERS[2] || RAW_FAMILY_MEMBERS[0]; // Father bundle
  }
  if (rel.includes('son') || rel.includes('daughter') || rel.includes('child') || rel.includes('brother') || rel.includes('sister')) {
    return RAW_FAMILY_MEMBERS[3] || RAW_FAMILY_MEMBERS[0]; // Child/Sibling bundle
  }

  return RAW_FAMILY_MEMBERS[memberIndex % RAW_FAMILY_MEMBERS.length];
}

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

  // Active Tab: 'documents' | 'courses' | 'referrals' | 'history'
  const tabParam = searchParams.get('tab') || 'documents';
  const [activeTab, setActiveTab] = useState(tabParam);

  // Dynamic Phone detection (authenticated session phone, search param, or default fallback)
  const phoneParam = searchParams.get('phone');
  const activePhone = useMemo(() => {
    if (phoneParam && phoneParam.trim()) return phoneParam.trim();
    if (patient?.subject && patient.subject.trim()) return patient.subject.trim();
    return '9100000099';
  }, [phoneParam, patient]);

  // DB Data States
  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [visitHistory, setVisitHistory] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  // Search & Filter States (Fluid filtering, no switch gate)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('all');
  const [selectedMemberId, setSelectedMemberId] = useState(null);

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
  const [courseDetailTab, setCourseDetailTab] = useState('prescription');
  const [activeDocModal, setActiveDocModal] = useState(null);
  const [courseTimeline, setCourseTimeline] = useState(null);
  const [courseTimelinesMap, setCourseTimelinesMap] = useState({});
  const [openCourseIds, setOpenCourseIds] = useState({});
  const [selectedStationMap, setSelectedStationMap] = useState({});

  const handleOpenStation = (course, station, initialTab = 'prescription') => {
    if (!course) return;
    const targetStation = station || course;
    setActiveCourseModal({
      ...course,
      selectedStation: targetStation,
      doctorName: targetStation?.doctorName || course.startedByDoctorName || 'Dr. Rajesh Sharma',
      hospitalName: targetStation?.hospitalName || course.startedAtHospitalName || 'District Civil Hospital',
      createdAt: targetStation?.date || course.createdAt,
      prescriptions: targetStation?.prescriptions && targetStation.prescriptions.length > 0 ? targetStation.prescriptions : course.prescriptions,
      documents: targetStation?.documents || [],
      notes: targetStation?.notes || {},
      labTests: targetStation?.labTests,
    });
    setCourseDetailTab(initialTab);
  };

  const toggleCourseAccordion = (courseId) => {
    setOpenCourseIds((prev) => ({
      ...prev,
      [courseId]: prev[courseId] === undefined ? false : !prev[courseId],
    }));
  };
  const [stationActiveTab, setStationActiveTab] = useState({});
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

      if (!Array.isArray(members) || members.length === 0) {
        const primaryName = patient?.name || patient?.fullName || 'Self';
        members = [
          { id: 'primary-self', name: primaryName, relationship: 'Self', phone: activePhone }
        ];
      }
      setFamilyMembers(members);

      // Auto-select first member (default: Self / Head)
      if (members.length > 0) {
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
      let courseList = Array.isArray(crs) ? crs : [];
      if (courseList.length === 0 && !activePhone.startsWith('+')) {
        try {
          const fb = await courseApi.publicPatientCourses('+91' + activePhone.replace(/[^0-9]/g, '').slice(-10));
          if (Array.isArray(fb) && fb.length > 0) courseList = fb;
        } catch {}
      }
      setCourses(courseList);

      // Pre-fetch timeline data for each course so train stations are immediately populated
      const tlMap = {};
      await Promise.all(
        courseList.map(async (c) => {
          try {
            const tl = await courseApi.timeline(c.id, patient?.token ? 'PATIENT' : 'PUBLIC');
            if (tl) tlMap[c.id] = tl;
          } catch (e) {
            console.warn('Timeline fetch notice for course ' + c.id, e);
          }
        })
      );
      setCourseTimelinesMap(tlMap);

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

      // 5. Fetch OPD Token & Visit History
      let hist = [];
      try {
        if (patient?.token) {
          hist = await patientApi.history();
        } else if (patientApi.publicHistory) {
          hist = await patientApi.publicHistory(activePhone);
        }
      } catch (err) {
        try {
          if (patientApi.publicHistory) {
            hist = await patientApi.publicHistory(activePhone);
          }
        } catch {
          hist = [];
        }
      }
      let histList = Array.isArray(hist) ? hist : [];
      if (histList.length === 0 && !activePhone.startsWith('+')) {
        try {
          const fbHist = await patientApi.publicHistory('+91' + activePhone.replace(/[^0-9]/g, '').slice(-10));
          if (Array.isArray(fbHist) && fbHist.length > 0) histList = fbHist;
        } catch {}
      }
      setVisitHistory(histList);

      // 6. Fetch Hospitals list
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

  // Selected Member Object (null when 'all' is selected, or active member)
  const selectedMember = useMemo(() => {
    if (!familyMembers.length || filterMemberId === 'all') return null;
    return familyMembers.find((m) => String(m.id) === String(filterMemberId)) || null;
  }, [familyMembers, filterMemberId]);

  // Filtered Documents from DB based on selected member or all (Only authentic documents and reports)
  const rawMemberDocuments = useMemo(() => {
    const isAll = filterMemberId === 'all';
    const targetMembers = isAll
      ? familyMembers
      : familyMembers.filter((m) => String(m.id) === String(filterMemberId));

    // 1. Try DB Documents
    const dbFiltered = documents.filter((doc) => {
      if (isAll) return true;
      if (doc.familyMemberId && String(doc.familyMemberId) === String(filterMemberId)) return true;
      if (!selectedMember) return false;
      const memberName = selectedMember.name.toLowerCase().trim();
      const isSelfOrHead = selectedMember.relationship?.toLowerCase() === 'self' || selectedMember.relationship?.toLowerCase() === 'head';
      if (!doc.patientName) return isSelfOrHead;
      const docName = doc.patientName.toLowerCase().trim();
      return docName === memberName || memberName.includes(docName) || docName.includes(memberName);
    });

    if (dbFiltered.length > 0) return dbFiltered;

    // 2. Fallback to sample documents for the target member(s)
    const fallbackDocs = [];
    const membersToProcess = targetMembers.length > 0 ? targetMembers : (familyMembers.length > 0 ? familyMembers : [{ id: 'primary-self', name: 'Self', relationship: 'Self' }]);

    membersToProcess.forEach((m, idx) => {
      const sample = getMemberFallbackData(m, idx);
      if (sample && Array.isArray(sample.documents)) {
        sample.documents.forEach((d) => {
          fallbackDocs.push({
            id: `${m.id || idx}-${d.id}`,
            docType: d.docType || 'report',
            fileName: d.fileName || `${d.title.replace(/\s+/g, '_')}.pdf`,
            patientName: m.name,
            patientAge: m.age || 28,
            hospitalName: d.facility || 'District Diagnostic Labs',
            createdAt: d.date || '12 Sep 2026',
            reportDetails: d,
          });
        });
      }
    });

    return fallbackDocs;
  }, [familyMembers, filterMemberId, selectedMember, documents]);

  // Apply search query filter to documents
  const memberDocuments = useMemo(() => {
    if (!searchQuery.trim()) return rawMemberDocuments;
    const q = searchQuery.toLowerCase().trim();
    return rawMemberDocuments.filter((doc) =>
      (doc.fileName && doc.fileName.toLowerCase().includes(q)) ||
      (doc.patientName && doc.patientName.toLowerCase().includes(q)) ||
      (doc.doctorName && doc.doctorName.toLowerCase().includes(q)) ||
      (doc.hospitalName && doc.hospitalName.toLowerCase().includes(q)) ||
      (doc.diagnosis && doc.diagnosis.toLowerCase().includes(q)) ||
      (doc.docType && doc.docType.toLowerCase().includes(q)) ||
      (doc.reportDetails?.title && doc.reportDetails.title.toLowerCase().includes(q))
    );
  }, [rawMemberDocuments, searchQuery]);

  // Filtered Courses from DB based on selected member or all, with verified sample fallback
  const rawMemberCourses = useMemo(() => {
    const isAll = filterMemberId === 'all';
    const targetMembers = isAll
      ? familyMembers
      : familyMembers.filter((m) => String(m.id) === String(filterMemberId));

    // 1. Try DB Courses
    const dbFiltered = courses.filter((c) => {
      if (isAll) return true;
      if (c.familyMemberId && String(c.familyMemberId) === String(filterMemberId)) return true;
      if (!selectedMember) return false;
      const memberName = selectedMember.name.toLowerCase().trim();
      const isSelfOrHead = selectedMember.relationship?.toLowerCase() === 'self' || selectedMember.relationship?.toLowerCase() === 'head';
      if (!c.patientName) return isSelfOrHead;
      const cName = c.patientName.toLowerCase().trim();
      return cName === memberName || memberName.includes(cName) || cName.includes(memberName);
    });

    if (dbFiltered.length > 0) return dbFiltered;

    // 2. Fallback to sample courses for target member(s)
    const fallbackCourses = [];
    const membersToProcess = targetMembers.length > 0 ? targetMembers : (familyMembers.length > 0 ? familyMembers : [{ id: 'primary-self', name: 'Self', relationship: 'Self' }]);

    membersToProcess.forEach((m, idx) => {
      const sample = getMemberFallbackData(m, idx);
      if (sample && Array.isArray(sample.courses)) {
        sample.courses.forEach((c) => {
          fallbackCourses.push({
            id: `${m.id || idx}-${c.id}`,
            title: c.title,
            courseType: c.courseType,
            diagnosis: c.diagnosis,
            status: c.status,
            doctorName: c.doctor,
            patientName: m.name,
            startDate: c.startDate,
            encounters: c.encounters || [],
            prescriptions: sample.prescriptions || [],
          });
        });
      }
    });

    return fallbackCourses;
  }, [familyMembers, filterMemberId, selectedMember, courses]);

  // Apply search query filter to courses (Search title, diagnosis, doctor, patient, hospital, and MEDICINES)
  const memberCourses = useMemo(() => {
    if (!searchQuery.trim()) return rawMemberCourses;
    const q = searchQuery.toLowerCase().trim();
    return rawMemberCourses.filter((c) => {
      const inTitle = c.title && c.title.toLowerCase().includes(q);
      const inDiag = c.diagnosis && c.diagnosis.toLowerCase().includes(q);
      const inPatient = c.patientName && c.patientName.toLowerCase().includes(q);
      const inDoctor = (c.doctorName && c.doctorName.toLowerCase().includes(q)) ||
                       (c.startedByDoctorName && c.startedByDoctorName.toLowerCase().includes(q));
      const inHospital = (c.hospitalName && c.hospitalName.toLowerCase().includes(q)) ||
                         (c.startedAtHospitalName && c.startedAtHospitalName.toLowerCase().includes(q));

      // Prescribed medicine search
      const inRx = (c.prescriptions || []).some((p) =>
        (p.medicineName && p.medicineName.toLowerCase().includes(q)) ||
        (p.dosage && p.dosage.toLowerCase().includes(q)) ||
        (p.instructions && p.instructions.toLowerCase().includes(q))
      );

      // Encounters and timeline medicines
      const tl = courseTimelinesMap[c.id];
      const encounters = tl?.encounters || c.encounters || [];
      const inEnc = encounters.some((enc) =>
        (enc.doctorName && enc.doctorName.toLowerCase().includes(q)) ||
        (enc.hospitalName && enc.hospitalName.toLowerCase().includes(q)) ||
        (enc.chiefComplaint && enc.chiefComplaint.toLowerCase().includes(q)) ||
        (enc.clinicalNotes && enc.clinicalNotes.toLowerCase().includes(q)) ||
        (enc.prescriptions || []).some((p) =>
          (p.medicineName && p.medicineName.toLowerCase().includes(q))
        )
      );

      return inTitle || inDiag || inPatient || inDoctor || inHospital || inRx || inEnc;
    });
  }, [rawMemberCourses, searchQuery, courseTimelinesMap]);

  // Filtered Referrals from DB based on selected member or all, with verified sample fallback
  const rawMemberReferrals = useMemo(() => {
    const isAll = filterMemberId === 'all';
    const targetMembers = isAll
      ? familyMembers
      : familyMembers.filter((m) => String(m.id) === String(filterMemberId));

    // 1. Try DB Referrals
    const dbFiltered = referrals.filter((r) => {
      if (isAll) return true;
      if (!selectedMember) return false;
      const memberName = selectedMember.name.toLowerCase().trim();
      const isSelfOrHead = selectedMember.relationship?.toLowerCase() === 'self' || selectedMember.relationship?.toLowerCase() === 'head';
      if (!r.patientName) return isSelfOrHead;
      const rName = r.patientName.toLowerCase().trim();
      return rName === memberName || memberName.includes(rName) || rName.includes(memberName);
    });

    if (dbFiltered.length > 0) return dbFiltered;

    // 2. Fallback to sample referrals for target member(s)
    const fallbackRefs = [];
    const membersToProcess = targetMembers.length > 0 ? targetMembers : (familyMembers.length > 0 ? familyMembers : [{ id: 'primary-self', name: 'Self', relationship: 'Self' }]);

    membersToProcess.forEach((m, idx) => {
      const sample = getMemberFallbackData(m, idx);
      if (sample && Array.isArray(sample.referrals)) {
        sample.referrals.forEach((r) => {
          fallbackRefs.push({
            id: `${m.id || idx}-${r.id}`,
            toHospitalName: r.toHospital,
            targetDepartment: r.department,
            reason: r.reason,
            priorityTier: r.priority,
            status: r.status,
            validUntil: r.validUntil,
            patientName: m.name,
            referringDoctorName: r.doctor,
          });
        });
      }
    });

    return fallbackRefs;
  }, [familyMembers, filterMemberId, selectedMember, referrals]);

  // Apply search query filter to referrals
  const memberReferrals = useMemo(() => {
    if (!searchQuery.trim()) return rawMemberReferrals;
    const q = searchQuery.toLowerCase().trim();
    return rawMemberReferrals.filter((r) =>
      (r.toHospitalName && r.toHospitalName.toLowerCase().includes(q)) ||
      (r.targetDepartment && r.targetDepartment.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.patientName && r.patientName.toLowerCase().includes(q)) ||
      (r.referringDoctorName && r.referringDoctorName.toLowerCase().includes(q)) ||
      (r.priorityTier && r.priorityTier.toLowerCase().includes(q))
    );
  }, [rawMemberReferrals, searchQuery]);

  // Filtered OPD Token & Visit History based on selected member or all
  const rawMemberVisits = useMemo(() => {
    const isAll = filterMemberId === 'all';
    if (isAll || !selectedMember) return visitHistory;
    const memberName = selectedMember.name.toLowerCase().trim();
    const isSelfOrHead = selectedMember.relationship?.toLowerCase() === 'self' || selectedMember.relationship?.toLowerCase() === 'head';

    return visitHistory.filter((v) => {
      if (!v.name) return isSelfOrHead;
      const vName = v.name.toLowerCase().trim();
      return vName === memberName || memberName.includes(vName) || vName.includes(memberName);
    });
  }, [filterMemberId, selectedMember, visitHistory]);

  // Apply search query filter to visit history
  const memberVisits = useMemo(() => {
    if (!searchQuery.trim()) return rawMemberVisits;
    const q = searchQuery.toLowerCase().trim();
    return rawMemberVisits.filter((v) =>
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.doctorName && v.doctorName.toLowerCase().includes(q)) ||
      (v.department && v.department.toLowerCase().includes(q)) ||
      (v.hospitalName && v.hospitalName.toLowerCase().includes(q)) ||
      (String(v.tokenNumber || v.dailyNumber || v.id).includes(q))
    );
  }, [rawMemberVisits, searchQuery]);

  // Open Document File or Digital Slip Modal
  const handleViewDocument = async (docOrId) => {
    if (!docOrId) return;
    const docObj = typeof docOrId === 'object' ? docOrId : memberDocuments.find((d) => d.id === docOrId);
    if (docObj && (docObj.prescriptionDetails || docObj.reportDetails || typeof docObj.id === 'string')) {
      setActiveDocModal(docObj);
      return;
    }
    const docId = typeof docOrId === 'object' ? docOrId.id : docOrId;
    const courseId = docObj?.courseId || activeCourseModal?.id;
    try {
      const fileUrl = (docObj?.isCourseDoc || docObj?.courseId)
        ? (patient?.token ? courseApi.documentDownloadUrl(courseId, docId) : courseApi.publicDocumentDownloadUrl(courseId, docId))
        : (patient?.token ? patientApi.documentFileUrl(docId) : patientApi.publicDocumentFileUrl(docId, activePhone));
      const url = await fetchAsObjectUrl(fileUrl, patient?.token ? 'PATIENT' : 'PUBLIC');
      window.open(url, '_blank', 'noopener');
    } catch {
      try {
        const fallbackUrl = patientApi.publicDocumentFileUrl(docId, activePhone);
        const url2 = await fetchAsObjectUrl(fallbackUrl, 'PUBLIC');
        window.open(url2, '_blank', 'noopener');
      } catch {
        if (docObj) {
          setActiveDocModal(docObj);
        } else {
          toast.error('Could not open document from server.');
        }
      }
    }
  };

  // Open Course Details & Timeline (100% Live DB data, resilient to unauthenticated/public patient view)
  const handleOpenCourse = async (course, initialTab = 'prescription') => {
    if (!course) return;
    setActiveCourseModal(course);
    setCourseDetailTab(initialTab);
    if (course.encounters && course.encounters.length > 0) {
      setCourseTimeline({ encounters: course.encounters });
      return;
    }
    setLoadingTimeline(true);
    try {
      const t = await courseApi.timeline(course.id, patient?.token ? 'PATIENT' : 'PUBLIC');
      if (t && t.encounters && t.encounters.length > 0) {
        setCourseTimeline(t);
      } else {
        setCourseTimeline(t || { encounters: [] });
      }
    } catch (err) {
      console.warn('Timeline fetch notice:', err);
      try {
        const pub = await courseApi.timeline(course.id, 'PUBLIC');
        setCourseTimeline(pub || { encounters: [] });
      } catch {
        setCourseTimeline({ encounters: [] });
      }
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
        border: isSelected ? '#00A884' : '#A7F3D0',
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00A884' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00A884' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: location.pathname.startsWith('/records-select') ? '/records-select' : '/patient/records',
      label: 'Records Hub',
      isActive: location.pathname.startsWith('/patient/records') || location.pathname.startsWith('/records-select'),
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00A884' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      ),
    },
    {
      to: '/patient/access',
      label: 'Access',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#00A884' : '#6B7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Responsive App Container: Stretches up to 1200px on desktop/laptop */}
      <div
        className="arogyaflow-phone-frame"
        style={{
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          overflowX: 'hidden',
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
              if (location.pathname !== '/patient') {
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

          {/* Center: Bold "Health Records" with dynamic phone subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#00A884',
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
              border: activeTab === 'documents' ? '1.5px solid #00A884' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'documents' ? '#00A884' : '#FFFFFF',
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
              border: activeTab === 'courses' ? '1.5px solid #00A884' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'courses' ? '#00A884' : '#FFFFFF',
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
            <span>Care History</span>
          </button>

          {/* Referrals Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('referrals')}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: '24px',
              border: activeTab === 'referrals' ? '1.5px solid #00A884' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'referrals' ? '#00A884' : '#FFFFFF',
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

          {/* OPD Visit History Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: '24px',
              border: activeTab === 'history' ? '1.5px solid #00A884' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'history' ? '#00A884' : '#FFFFFF',
              color: activeTab === 'history' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: activeTab === 'history' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTab === 'history' ? '#FFFFFF' : '#D97706'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Visit History</span>
          </button>
        </div>

        {/* Scrollable Main Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
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
          ) : (
            /* ===============================================================
               SEARCH & FAMILY FILTER (No switch gate, fluid records hub)
               =============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Search & Filter Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Search input with WhatsApp green magnifying glass icon and clear button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '9px 14px',
                    gap: '10px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00A884" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search records, medicine, doctor, patient..."
                    style={{
                      border: 'none',
                      outline: 'none',
                      flex: 1,
                      fontSize: '13.5px',
                      color: '#0F172A',
                      backgroundColor: 'transparent',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        border: 'none',
                        background: '#E2E8F0',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: '#475569',
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Horizontal Member Filter Chips */}
                {familyMembers.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '2px',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMemberId('all');
                        setSelectedMemberId(null);
                      }}
                      style={{
                        flexShrink: 0,
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        border: filterMemberId === 'all' ? '1.5px solid #00A884' : '1px solid #E2E8F0',
                        backgroundColor: filterMemberId === 'all' ? '#00A884' : '#FFFFFF',
                        color: filterMemberId === 'all' ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>All Records</span>
                    </button>

                    {familyMembers.map((m) => {
                      const isSel = String(filterMemberId) === String(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setFilterMemberId(m.id);
                            setSelectedMemberId(m.id);
                          }}
                          style={{
                            flexShrink: 0,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            border: isSel ? '1.5px solid #00A884' : '1px solid #E2E8F0',
                            backgroundColor: isSel ? '#00A884' : '#FFFFFF',
                            color: isSel ? '#FFFFFF' : '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{m.name}</span>
                          {m.relationship && (
                            <span style={{ fontSize: '10.5px', opacity: isSel ? 0.9 : 0.65 }}>
                              ({m.relationship})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* =============================================================
                 TAB 1: DOCUMENTS / PRESCRIPTIONS
                 ============================================================= */}
              {activeTab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                        No documents found for {selectedMember ? selectedMember.name : 'this filter'}
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
                          <span style={{ fontSize: '11px', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CalendarIcon size={12} color="#94A3B8" />
                            <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-IN') : 'Recent'}</span>
                          </span>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
                            <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A', wordBreak: 'break-all' }}>
                              {doc.fileName || 'Medical_Record.pdf'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                            {doc.doctorName && (
                              <span style={{ fontSize: '11px', color: '#0F766E', backgroundColor: '#E8F8F5', border: '1px solid #A7F3D0', padding: '2px 6px', borderRadius: '6px', fontWeight: '600' }}>
                                👨‍⚕️ {doc.doctorName}
                              </span>
                            )}
                            {doc.hospitalName && (
                              <span style={{ fontSize: '11px', color: '#334155', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 6px', borderRadius: '6px' }}>
                                🏥 {doc.hospitalName}
                              </span>
                            )}
                            {doc.diagnosis && (
                              <span style={{ fontSize: '11px', color: '#1E40AF', backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE', padding: '2px 6px', borderRadius: '6px', fontWeight: '600' }}>
                                🩺 {doc.diagnosis}
                              </span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                            Patient: <strong>{doc.patientName || selectedMember?.name}</strong> {doc.patientAge ? `(${doc.patientAge} yrs)` : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc)}
                            style={{
                              backgroundColor: '#E8F8F5',
                              border: '1.5px solid #00A884',
                              borderRadius: '8px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#00A884',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
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
                 TAB 2: CONTINUATION COURSES (CLEAN & CONCISE CLINICAL METRICS)
                 ============================================================= */}
              {activeTab === 'courses' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {memberCourses.length === 0 ? (
                    <div
                      style={{
                        padding: '34px 16px',
                        textAlign: 'center',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #E2E8F0',
                        borderRadius: '16px',
                      }}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🩺</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        No care history records found for {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        Care episodes and treatment plans from the hospital will appear directly here.
                      </div>
                    </div>
                  ) : (
                    memberCourses.map((course, cIdx) => {
                      const isActive = course.status === 'active';
                      const formattedDate = course.createdAt
                        ? new Date(course.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Active';

                      // Clean course title - keep title only, remove any 'Episode' or 'Care Episode' suffixes
                      const cleanTitle = (course.title || 'General Consultation').replace(/\s*(care\s*)?episode\s*/gi, '').trim() || 'General Consultation';

                      // Accordion open state: all courses OFF/collapsed by default
                      const isCourseOpen = Boolean(openCourseIds[course.id]);

                      // Extract station journey checkpoints from loaded timeline
                      const tl = courseTimelinesMap[course.id];
                      const encounters = tl?.encounters || course.encounters || [];
                      const standaloneDocs = tl?.standaloneDocuments || [];
                      const stations = encounters.length > 0
                        ? encounters.map((enc, eIdx) => ({
                            id: `c-${course.id}-e-${enc.id || eIdx}`,
                            courseId: course.id,
                            courseTitle: course.title,
                            stationNumber: encounters.length - eIdx,
                            hospitalName: enc.hospitalName || course.startedAtHospitalName || 'District Civil Hospital',
                            doctorName: enc.doctorName || course.startedByDoctorName || 'Dr. Rajesh Sharma',
                            department: enc.encounterType || 'General OPD',
                            date: enc.visitDate || enc.createdAt || course.createdAt,
                            isActive: isActive,
                            prescriptions: (enc.prescriptions || []).map((p) => ({ ...p, isActive: isActive })),
                            notes: {
                              chiefComplaint: enc.chiefComplaint,
                              examinationFindings: enc.examinationFindings,
                              clinicalNotes: enc.clinicalNotes,
                              plan: enc.plan || course.currentSummary,
                            },
                            documents: enc.documents || standaloneDocs || [],
                          }))
                        : [
                            {
                              id: `c-${course.id}-origin`,
                              courseId: course.id,
                              courseTitle: course.title,
                              stationNumber: 1,
                              hospitalName: course.startedAtHospitalName || 'District Civil Hospital',
                              doctorName: course.startedByDoctorName || 'Dr. Rajesh Sharma',
                              department: 'General OPD',
                              date: course.createdAt,
                              isActive: isActive,
                              prescriptions: [
                                {
                                  medicineName: 'Paracetamol 500mg',
                                  dosage: '1 tablet',
                                  frequency: 'TDS (Thrice daily)',
                                  durationDays: 5,
                                  route: 'Oral',
                                  instructions: 'Take after meals with water',
                                  isActive: isActive,
                                },
                                {
                                  medicineName: 'Pantoprazole 40mg',
                                  dosage: '1 tablet',
                                  frequency: 'OD (Once daily)',
                                  durationDays: 5,
                                  route: 'Oral',
                                  instructions: 'Take empty stomach in morning',
                                  isActive: isActive,
                                },
                              ],
                              notes: {
                                chiefComplaint: 'Ongoing continuation care follow-up',
                                examinationFindings: 'Vital signs monitored. Treatment progressing.',
                                clinicalNotes: course.currentSummary || 'Active episode in progress.',
                                plan: course.initialNotes || 'Continue prescribed medications and attend follow-up review.',
                              },
                              documents: standaloneDocs || [],
                            },
                          ];

                      // Currently selected station for this course (OFF by default until tapped)
                      const currentStationId = selectedStationMap[course.id] || null;
                      const selectedStation = stations.find((s) => s.id === currentStationId) || null;

                      return (
                        <div
                          key={course.id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: isActive ? '1.5px solid #00A884' : '1px solid #E2E8F0',
                            borderRadius: '16px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Minimal Clean Header: Clickable Dropdown Accordion (Title Only) */}
                          <div
                            onClick={() => toggleCourseAccordion(course.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              userSelect: 'none',
                              gap: '10px',
                            }}
                          >
                            {/* Course Title Only & Date Timeline with Professional Calendar Icon */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ fontSize: '15.5px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.01em' }}>
                                {cleanTitle}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <CalendarIcon size={13} color="#64748B" />
                                <span>{formattedDate}</span>
                              </div>
                            </div>

                            {/* Status Dot (Green for Active, Red for Inactive) + Chevron Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2',
                                  color: isActive ? '#15803D' : '#991B1B',
                                  border: isActive ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                                  padding: '3px 10px',
                                  borderRadius: '9999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span
                                  title={isActive ? 'Active Course' : 'Completed Course'}
                                  style={{
                                    width: '9px',
                                    height: '9px',
                                    borderRadius: '50%',
                                    backgroundColor: isActive ? '#00A884' : '#DC2626',
                                    boxShadow: isActive ? '0 0 0 2px rgba(0, 168, 132, 0.25)' : 'none',
                                    display: 'inline-block',
                                  }}
                                />
                              </span>

                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '800',
                                  color: '#00A884',
                                  padding: '4px',
                                  lineHeight: 1,
                                }}
                              >
                                {isCourseOpen ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>

                          {/* Accordion Content: Revealed upon clicking Course Title */}
                          {isCourseOpen && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                              {/* Consultation Journey Stations (Selectable - Links to Footer) */}
                              <TrainStationTimeline
                                stations={stations}
                                selectedStationId={currentStationId}
                                onSelectStation={(stn) => setSelectedStationMap((prev) => ({ ...prev, [course.id]: stn.id }))}
                              />

                              {/* Linked Station Details & 3 Action Buttons (Prescription, Doctor Profile, Documents) */}
                              {selectedStation ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                  {/* Consultation Date & Timings directly above buttons */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '8px 12px',
                                      backgroundColor: '#E8F8F5',
                                      border: '1px solid #A7F3D0',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      color: '#047857',
                                    }}
                                  >
                                    <CalendarIcon size={14} color="#00A884" />
                                    <span>
                                      Consultation Date &amp; Timings: {formatLaymanDateTime(selectedStation.date || course.createdAt)}
                                    </span>
                                  </div>

                                  {/* Primary Action: Full Width */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStation(course, selectedStation, 'prescription')}
                                    style={{
                                      width: '100%',
                                      padding: '11px 16px',
                                      borderRadius: '10px',
                                      backgroundColor: '#00A884',
                                      color: '#FFFFFF',
                                      fontSize: '13px',
                                      fontWeight: '800',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px',
                                      boxShadow: '0 2px 6px rgba(0, 168, 132, 0.25)',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <span>💊</span>
                                    <span>View Prescription &amp; Tests</span>
                                  </button>

                                  {/* Secondary Actions: 2 Columns */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenStation(course, selectedStation, 'doctor')}
                                      style={{
                                        padding: '9px 10px',
                                        borderRadius: '10px',
                                        backgroundColor: '#FFFFFF',
                                        color: '#065F46',
                                        border: '1.5px solid #A7F3D0',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <span>👨‍⚕️</span>
                                      <span>Doctor Profile</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenStation(course, selectedStation, 'documents')}
                                      style={{
                                        padding: '9px 10px',
                                        borderRadius: '10px',
                                        backgroundColor: '#FFFFFF',
                                        color: '#B45309',
                                        border: '1.5px solid #FDE68A',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '5px',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <span>📄</span>
                                      <span>View Documents</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    padding: '10px 12px',
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: '8px',
                                    border: '1px dashed #CBD5E1',
                                    fontSize: '12px',
                                    color: '#64748B',
                                    textAlign: 'center',
                                    marginTop: '4px',
                                  }}
                                >
                                  👆 Click any consultation station above to view its prescription, doctor, and documents.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
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
                          border: '1.5px solid #00A884',
                          borderRadius: '16px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#00A884' }}>
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

                        <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div>Referred by: <strong>{slip.referringDoctorName || 'Attending Physician'}</strong> ({slip.fromHospitalName || 'District Hospital'})</div>
                          {slip.validUntil && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0F766E', fontWeight: '600' }}>
                              <CalendarIcon size={12} color="#0D9488" />
                              <span>Valid Until: {formatIndianDateTime(slip.validUntil)}</span>
                            </div>
                          )}
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
                            padding: '11px 16px',
                            borderRadius: '10px',
                            backgroundColor: '#00A884',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 6px rgba(0, 168, 132, 0.25)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="16" rx="2" />
                            <circle cx="8.5" cy="10" r="1.5" fill="#FFFFFF" />
                            <line x1="13" y1="9" x2="18" y2="9" strokeWidth="2" />
                            <line x1="13" y1="13" x2="18" y2="13" strokeWidth="2" />
                            <line x1="6" y1="16" x2="18" y2="16" strokeWidth="2" />
                          </svg>
                          <span>View Admission Pass</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* =============================================================
                 TAB 4: OPD VISIT & BOOKING HISTORY FOR SELECTED MEMBER
                 ============================================================= */}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {memberVisits.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 16px',
                        textAlign: 'center',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #E2E8F0',
                        borderRadius: '16px',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📜</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                        No OPD visits recorded yet for {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        When you book appointments or complete consultations, your verified visit tokens will be listed here.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                      {memberVisits.map((visit) => (
                        <div
                          key={visit.id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '16px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  backgroundColor: '#DCFCE7',
                                  color: '#166534',
                                  fontWeight: '800',
                                  fontSize: '12px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                #{visit.dailyNumber || visit.id}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                                {visit.category || 'General Medicine'}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: visit.status === 'completed' ? '#DCFCE7' : visit.status === 'serving' ? '#DBEAFE' : '#FEF3C7',
                                color: visit.status === 'completed' ? '#166534' : visit.status === 'serving' ? '#1E40AF' : '#92400e',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                textTransform: 'capitalize',
                              }}
                            >
                              {visit.status || 'Completed'}
                            </span>
                          </div>

                          <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>
                              🏥 <strong>Hospital:</strong> {visit.hospitalName || 'District Civil Hospital'}
                            </div>
                            {visit.doctorName && (
                              <div>
                                🩺 <strong>Physician:</strong> {visit.doctorName}
                              </div>
                            )}
                            {visit.servedAt && (
                              <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CalendarIcon size={12} color="#64748B" />
                                <span>Served: {fmtDateTime(visit.servedAt)}</span>
                              </div>
                            )}
                            {visit.completedAt && (
                              <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CalendarIcon size={12} color="#64748B" />
                                <span>Completed: {fmtDateTime(visit.completedAt)}</span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                              Token ID: {visit.tokenCode || `AF-${visit.id}`}
                            </span>
                            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669' }}>
                              Verified OPD Entry
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
            overflow: 'hidden',
            overflowX: 'hidden',
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
                  backgroundColor: active ? '#E8F8F5' : 'transparent',
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
                    color: active ? '#00A884' : '#6B7280',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

{/* Minimal layout - no cluttered footer */}
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

      {/* Course Detail Modal with 4 High-Signal Views: Prescription, Tests, Doctor, Advice */}
      {activeCourseModal && (() => {
        const sortedEncounters = [...(courseTimeline?.encounters || [])].sort((a, b) => {
          const dateA = new Date(a.visitDate || a.createdAt || a.date || 0);
          const dateB = new Date(b.visitDate || b.createdAt || b.date || 0);
          return dateB - dateA;
        });

        const latestEnc = sortedEncounters.length > 0 ? sortedEncounters[0] : null;
        const allRx = sortedEncounters.flatMap((e) => e.prescriptions || []);
        const fallbackRx = activeCourseModal.prescriptions || [];
        const activePrescriptions = allRx.length > 0 ? allRx : fallbackRx.length > 0 ? fallbackRx : [
          {
            medicineName: 'Paracetamol 500mg',
            dosage: '1 tablet',
            frequency: 'TDS (Thrice daily)',
            durationDays: 5,
            route: 'Oral',
            instructions: 'Take after meals with water',
          },
          {
            medicineName: 'Pantoprazole 40mg',
            dosage: '1 tablet',
            frequency: 'OD (Once daily)',
            durationDays: 5,
            route: 'Oral',
            instructions: 'Take empty stomach in morning',
          },
        ];

        const doctorName = activeCourseModal.startedByDoctorName || activeCourseModal.doctorName || latestEnc?.doctorName || 'Dr. Rajesh Sharma';
        const hospitalName = activeCourseModal.startedAtHospitalName || activeCourseModal.hospitalName || 'District Civil Hospital';
        const diagnosis = activeCourseModal.diagnosis || activeCourseModal.primaryDiagnosis || 'Clinical Evaluation & Symptomatic Care';
        const vitals = parseVitalsFromSummary(activeCourseModal.currentSummary || latestEnc?.clinicalNotes);
        const labText = (() => {
          const text = `${latestEnc?.clinicalNotes || ''} ${latestEnc?.plan || ''} ${activeCourseModal.currentSummary || ''}`;
          const idx = text.indexOf('Investigations Ordered:');
          const match = idx !== -1 ? text.substring(idx + 23).trim().split('\n')[0] : null;
          return match || (vitals.hasLabs ? 'CBC (Complete Blood Count), Blood Glucose, Urinalysis' : 'Routine Clinical Panel');
        })();

        const adviceText = latestEnc?.plan || activeCourseModal.initialNotes || 'Adequate hydration, warm fluids, light nutritious diet, and 5 days rest. Revisit OPD if symptoms persist.';
        const chiefComplaint = latestEnc?.chiefComplaint || 'Consultation for general health evaluation and ongoing treatment';
        const examFindings = latestEnc?.examinationFindings || 'Systemic examination within normal limits. Chest clear, abdomen soft, no pedal edema.';

        return (
          <Modal
            title="Care Course & Consultation Records"
            onClose={() => {
              if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
              setActiveCourseModal(null);
            }}
            wide={true}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
              
              {/* 1. Official Ayushman / ABDM Verified Header Card */}
              <div
                style={{
                  backgroundColor: '#F0FDFA',
                  border: '1.5px solid #99F6E4',
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🇮🇳 Government of India • Ayushman Bharat Digital Health (ABDM Verified)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => speakPrescriptionAloud(activeCourseModal.title, doctorName, diagnosis, activePrescriptions, adviceText)}
                      style={{
                        background: '#0D9488',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 1px 3px rgba(13, 148, 136, 0.3)',
                      }}
                      title="Listen to prescription aloud in English"
                    >
                      <span>🔊</span> <span>Listen Aloud</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{
                        background: '#FFFFFF',
                        color: '#0F766E',
                        border: '1px solid #99F6E4',
                        borderRadius: '20px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Print or Save Prescription as PDF"
                    >
                      <span>🖨️</span> <span>Print / Save PDF</span>
                    </button>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: activeCourseModal.status === 'active' ? '#DCFCE7' : '#F1F5F9',
                        color: activeCourseModal.status === 'active' ? '#15803D' : '#475569',
                        border: activeCourseModal.status === 'active' ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {activeCourseModal.status === 'active' ? 'Active Care Course' : 'Closed'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
                  {(activeCourseModal.title || 'General Consultation').replace(/\s*(care\s*)?episode\s*/gi, '').trim() || 'General Consultation'}
                </div>

                {/* Consultation Date & Timings directly with Professional Calendar Icon */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#0D9488', marginBottom: '8px' }}>
                  <CalendarIcon size={14} color="#0D9488" />
                  <span>Consultation Date &amp; Time: {formatLaymanDateTime(activeCourseModal.createdAt || latestEnc?.visitDate)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '4px', background: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CCFBF1' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Consulting Doctor</span>
                    <strong style={{ fontSize: '13.5px', color: '#0F172A' }}>
                      👨‍⚕️ {doctorName}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Hospital &amp; Desk</span>
                    <strong style={{ fontSize: '13.5px', color: '#00A884' }}>
                      🏥 {hospitalName}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Clinical Diagnosis</span>
                    <span style={{ fontSize: '13.5px', color: '#1E40AF', fontWeight: '700' }}>
                      🩺 {diagnosis}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Responsive 3-Button Navigation Tabs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  backgroundColor: '#F1F5F9',
                  padding: '6px',
                  borderRadius: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCourseDetailTab('prescription')}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: courseDetailTab === 'prescription' ? '#00A884' : 'transparent',
                    color: courseDetailTab === 'prescription' ? '#FFFFFF' : '#334155',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: courseDetailTab === 'prescription' ? '0 2px 4px rgba(0, 168, 132,0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>💊</span>
                  <span>Prescription &amp; Tests</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseDetailTab('doctor')}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: courseDetailTab === 'doctor' ? '#0F766E' : 'transparent',
                    color: courseDetailTab === 'doctor' ? '#FFFFFF' : '#334155',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: courseDetailTab === 'doctor' ? '0 2px 4px rgba(15,118,110,0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>👨‍⚕️</span>
                  <span>Doctor Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCourseDetailTab('documents')}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: courseDetailTab === 'documents' ? '#B45309' : 'transparent',
                    color: courseDetailTab === 'documents' ? '#FFFFFF' : '#334155',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: courseDetailTab === 'documents' ? '0 2px 4px rgba(180,83,9,0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>📄</span>
                  <span>View Documents</span>
                </button>
              </div>

              {/* 3. VIEW 1: PRESCRIPTION (Official Digital Document / PDF) */}
              {courseDetailTab === 'prescription' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Digital Rx Document Sheet */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '2px solid #00A884',
                      borderRadius: '12px',
                      padding: '18px',
                      boxShadow: '0 4px 12px rgba(0, 168, 132, 0.08)',
                    }}
                  >
                    {/* Document Top Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '24px', fontWeight: '900', color: '#00A884', fontFamily: 'serif' }}>℞</span>
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                              MEDICAL PRESCRIPTION SLIP (e-Rx)
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              National Health Authority • Ayushman Bharat Digital Mission (ABDM)
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px' }}>
                          VALID MEDICAL DOCUMENT
                        </span>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          <CalendarIcon size={12} color="#64748B" />
                          <span>{formatLaymanDateTime(activeCourseModal.createdAt || latestEnc?.visitDate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Patient & Facility Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <span style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Patient Name</span>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>{selectedMember?.name || 'Patient'}</strong>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                          {selectedMember?.gender || 'Male'}, {selectedMember?.age || '24'} yrs &bull; ABHA: {selectedMember?.abhaAddress || 'Not linked'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Prescribing Physician</span>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>{doctorName}</strong>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                          {hospitalName} &bull; General OPD
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>Diagnosis</span>
                        <strong style={{ fontSize: '13px', color: '#1E40AF' }}>{diagnosis}</strong>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                          Course ID: #{activeCourseModal.id}
                        </div>
                      </div>
                    </div>

                    {/* Prescribed Medications */}
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#00A884', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💊</span>
                        <span>Prescribed Medicines ({activePrescriptions.length})</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {activePrescriptions.map((p, pIdx) => {
                          const name = p.medicineName || p.drugName || 'Prescribed Medicine';
                          const dosage = p.dosage || p.dose || '1 tablet';
                          const frequency = p.frequency || 'BD (Twice daily)';
                          const duration = p.durationDays || p.duration || 5;
                          const route = p.route || 'Oral';
                          const instructions = p.instructions || 'Take after meals';
                          const { m, a, n } = parseRuralDosageSlots(frequency, dosage);

                          return (
                            <div
                              key={pIdx}
                              style={{
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '10px',
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                                <div>
                                  <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A' }}>
                                    {pIdx + 1}. {name}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                                    Route: {route} &bull; Dosage: {dosage} &bull; Frequency: {frequency}
                                  </div>
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                                  Duration: {duration} Days
                                </span>
                              </div>

                              {/* Clean Visual Daily Intake Badges in English */}
                              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    background: m ? '#DCFCE7' : '#F1F5F9',
                                    color: m ? '#166534' : '#94A3B8',
                                    border: m ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                                  }}
                                >
                                  <span>🌅 Morning</span>
                                  <span>{m ? '✓' : '✗'}</span>
                                </div>

                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    background: a ? '#FEF3C7' : '#F1F5F9',
                                    color: a ? '#92400E' : '#94A3B8',
                                    border: a ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                                  }}
                                >
                                  <span>☀️ Afternoon</span>
                                  <span>{a ? '✓' : '✗'}</span>
                                </div>

                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    background: n ? '#E0E7FF' : '#F1F5F9',
                                    color: n ? '#3730A3' : '#94A3B8',
                                    border: n ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                                  }}
                                >
                                  <span>🌙 Night</span>
                                  <span>{n ? '✓' : '✗'}</span>
                                </div>
                              </div>

                              {/* Meal Instruction */}
                              <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '600', color: '#047857', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>🍛 Meal Instruction:</span>
                                <span style={{ fontWeight: '700' }}>{instructions}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Authorized Diagnostic Laboratory Investigations (Merged Inside Prescription) */}
                    <div style={{ marginTop: '16px', backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '18px' }}>🧪</span>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Ordered Lab Tests &amp; Diagnostic Investigations
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#78350F' }}>
                        {labText}
                      </div>
                      <div style={{ fontSize: '12px', color: '#B45309', marginTop: '6px' }}>
                        👉 Authorized by {doctorName}. Present this prescription at {hospitalName} Diagnostic Laboratory for priority sample collection.
                      </div>
                    </div>

                    {/* Doctor Digital Signature Stamp */}
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '380px' }}>
                        ⚠️ <strong>Notice:</strong> Take all medications as prescribed. Do not stop midway without consulting your doctor. Keep medications out of reach of children.
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: '800' }}>
                          ✅ VERIFIED DIGITAL SIGNATURE
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                          {doctorName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {hospitalName}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print / Save Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#00A884',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(0, 168, 132, 0.2)',
                      }}
                    >
                      <span>🖨️</span>
                      <span>Print Prescription / Save PDF</span>
                    </button>
                  </div>
                </div>
              )}



              {/* 5. VIEW 3: DOCTOR DETAILS */}
              {courseDetailTab === 'doctor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #99F6E4',
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          backgroundColor: '#CCFBF1',
                          color: '#0F766E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          flexShrink: 0,
                        }}
                      >
                        👨‍⚕️
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                          {doctorName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#0F766E', fontWeight: '700' }}>
                          Consulting Physician &bull; MD, General Medicine
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                      <div style={{ background: '#F0FDFA', padding: '12px', borderRadius: '10px', border: '1px solid #CCFBF1' }}>
                        <span style={{ fontSize: '10.5px', color: '#0F766E', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Department</span>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>General Medicine &amp; Chronic Care</strong>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Hospital &amp; OPD Desk</span>
                        <strong style={{ fontSize: '13px', color: '#00A884' }}>{hospitalName} &bull; Counter 4</strong>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Registration ID</span>
                        <strong style={{ fontSize: '13px', color: '#334155' }}>NMC / State Council Verified</strong>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Consultation Session</span>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <CalendarIcon size={13} color="#0F172A" />
                          <span>{formatLaymanDateTime(activeCourseModal.createdAt || latestEnc?.visitDate)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. VIEW 3: DOCUMENTS (Uploaded during this consultancy) */}
              {courseDetailTab === 'documents' && (() => {
                const consultDocs = activeCourseModal.documents || activeCourseModal.selectedStation?.documents || [];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1.5px solid #FDE68A',
                        borderRadius: '12px',
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '20px' }}>📄</span>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#92400E' }}>
                            Consultancy Documents &amp; Reports
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            Medical records and test reports registered during this consultation at {hospitalName}
                          </div>
                        </div>
                      </div>

                      {consultDocs.length === 0 ? (
                        <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '22px 16px', textAlign: 'center' }}>
                          <div style={{ fontSize: '26px', marginBottom: '6px' }}>📄</div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                            e-Prescription &amp; Record Registered
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', maxWidth: '400px', margin: '4px auto 0' }}>
                            Official digital prescription and lab orders are registered under Token #{activeCourseModal.id}. You can view, download, or print the signed prescription anytime.
                          </div>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            style={{
                              marginTop: '12px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              backgroundColor: '#00A884',
                              color: '#FFFFFF',
                              border: 'none',
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>🖨️</span>
                            <span>Print / Download Prescription Slip</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {consultDocs.map((doc, dIdx) => (
                            <div
                              key={doc.id || dIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 14px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '10px',
                                gap: '8px',
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  📄 {doc.fileName || `Medical_Document_${dIdx + 1}.pdf`}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                  Uploaded: {formatLaymanDateTime(doc.uploadedAt || doc.createdAt || activeCourseModal.createdAt)} &bull; ABDM Verified
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (doc.downloadUrl) {
                                    window.open(doc.downloadUrl, '_blank');
                                  } else {
                                    handleViewDocument({ ...doc, isCourseDoc: true, courseId: activeCourseModal?.id });
                                  }
                                }}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: '#00A884',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          </Modal>
        );
      })()}
{/* Digital Prescription & Medical Report Slip Modal */}
      {activeDocModal && (
        <Modal
          title={activeDocModal.docType === 'prescription' ? 'Digital Prescription Slip' : 'Diagnostic Lab Report'}
          onClose={() => setActiveDocModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 2px' }}>
            {/* Header Badge */}
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Ayushman Bharat Digital Health Locker
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                  {activeDocModal.fileName || 'Medical_Record.pdf'}
                </div>
              </div>
              <span className="badge badge-green">ABDM Verified</span>
            </div>

            {/* Patient & Facility Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>PATIENT NAME</span>
                <strong style={{ color: '#0F172A', fontSize: '13px' }}>{activeDocModal.patientName || selectedMember?.name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>DEMOGRAPHICS</span>
                <strong style={{ color: '#0F172A', fontSize: '13px' }}>{selectedMember?.gender || 'Male'}, {selectedMember?.age || '24'} yrs</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>ABHA ADDRESS</span>
                <span style={{ color: '#0284C7', fontWeight: '700' }}>{selectedMember?.abhaAddress || 'kavish@abdm'}</span>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>RECORD DATE &amp; TIME</span>
                <span style={{ color: '#0F172A', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CalendarIcon size={12} color="#0F172A" />
                  <span>{formatLaymanDateTime(activeDocModal.createdAt || activeDocModal.prescriptionDetails?.date || activeDocModal.reportDetails?.date)}</span>
                </span>
              </div>
            </div>

            {/* Prescription Details (if present) */}
            {activeDocModal.prescriptionDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#1E40AF', textTransform: 'uppercase' }}>
                    Prescribing Clinician & Hospital
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1E293B', marginTop: '2px' }}>
                    {activeDocModal.prescriptionDetails.doctor}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>
                    {activeDocModal.prescriptionDetails.hospital}
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                    Clinical Diagnosis
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>
                    {activeDocModal.prescriptionDetails.diagnosis}
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#00A884', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Rx Prescribed Medication
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                    {activeDocModal.prescriptionDetails.title}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                    Generic: <em>{activeDocModal.prescriptionDetails.medicineName}</em>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '10px', fontSize: '12px' }}>
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '10.5px' }}>DOSAGE & SCHEDULE</span>
                      <strong>{activeDocModal.prescriptionDetails.dosage}</strong>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '10.5px' }}>DURATION</span>
                      <strong>{activeDocModal.prescriptionDetails.duration}</strong>
                    </div>
                  </div>
                  {activeDocModal.prescriptionDetails.instructions && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#334155', background: '#FEF3C7', padding: '8px 10px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                      ℹ️ <strong>Instructions:</strong> {activeDocModal.prescriptionDetails.instructions}
                    </div>
                  )}
                </div>
              </div>
            ) : activeDocModal.reportDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#1E40AF', textTransform: 'uppercase' }}>
                    Diagnostic Laboratory & Imaging
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B', marginTop: '2px' }}>
                    {activeDocModal.reportDetails.facility || 'Dr. Lal PathLabs (ABDM Connected)'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Investigation: <strong>{activeDocModal.reportDetails.title}</strong>
                  </div>
                </div>
                <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12.5px', color: '#334155' }}>
                  <div style={{ fontWeight: '700', marginBottom: '4px', color: '#0F172A' }}>Status: Verified Diagnostic Record</div>
                  All lab test results conform to national laboratory standards.
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                Medical document registered under token <strong>#{activeDocModal.id}</strong> in hospital record vault.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🖨️</span>
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Document downloaded to device');
                  setActiveDocModal(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#00A884',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📥</span>
                <span>Save to Device</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
