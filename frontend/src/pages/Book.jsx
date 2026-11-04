import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hospitalApi, locationApi, otpApi, queueApi, familyApi } from '../api/client';
import { useAuth, useLinkToken } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cleanPhone, formatApproxDistance } from '../utils/helpers';
import AppHeader from '../components/AppHeader';
import AyushmanFooter from '../components/AyushmanFooter';
import {
  POPULAR_DEPARTMENT_KEYS,
  getDepartmentVisual,
  DepartmentIcon,
} from '../utils/departmentVisuals';

function getFamilyAvatarVisual(member, index = 0) {
  const rel = (member?.relationship || '').toLowerCase();
  if (rel === 'self' || rel === 'head') {
    return { avatarBg: '#D1FAE5', avatarColor: '#059669' };
  }
  if (rel.includes('mother') || rel.includes('wife') || rel.includes('sister') || rel.includes('daughter')) {
    return { avatarBg: '#FFE4E6', avatarColor: '#E11D48' };
  }
  if (rel.includes('father') || rel.includes('husband')) {
    return { avatarBg: '#E0F2FE', avatarColor: '#0284C7' };
  }
  if (rel.includes('brother') || rel.includes('son')) {
    return { avatarBg: '#F3E8FF', avatarColor: '#9333EA' };
  }
  const fallbackList = [
    { avatarBg: '#D1FAE5', avatarColor: '#059669' },
    { avatarBg: '#FFE4E6', avatarColor: '#E11D48' },
    { avatarBg: '#E0F2FE', avatarColor: '#0284C7' },
    { avatarBg: '#F3E8FF', avatarColor: '#9333EA' },
  ];
  return fallbackList[index % fallbackList.length];
}


const BOOKING_STEPS = [
  { key: 'department', label: 'Doctor' },
  { key: 'family', label: 'Patient' },
  { key: 'confirm', label: 'Confirm' },
];

function BookingSteps({ step }) {
  const current = BOOKING_STEPS.findIndex((s) => s.key === step);
  return (
    <ol
      aria-label="Booking steps"
      style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}
    >
      {BOOKING_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const on = active || done;
        return (
          <li
            key={s.key}
            aria-current={active ? 'step' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: active ? 700 : 600, color: on ? '#047857' : '#94A3B8' }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 800,
                backgroundColor: on ? '#047857' : '#E2E8F0',
                color: on ? '#ffffff' : '#64748B',
              }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span>{s.label}</span>
            {i < BOOKING_STEPS.length - 1 && (
              <span aria-hidden="true" style={{ width: '14px', height: '2px', backgroundColor: done ? '#047857' : '#E2E8F0' }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function Book() {
  const [params] = useSearchParams();
  const hospitalIdParam = params.get('hospitalId') ? Number(params.get('hospitalId')) : null;
  const hospitalNameParam = params.get('hospitalName') || '';
  const slugParam = params.get('slug') || '';
  const typeParam = params.get('type') || '';
  const distParam = params.get('dist') || '';
  const imgParam = params.get('img') || '';
  const tokenParam = params.get('token') || '';
  const patientIdParam = params.get('patientId') ? Number(params.get('patientId')) : null;
  const patientNameParam = params.get('name') || '';
  const patientAgeParam = params.get('age') || '';
  const patientGenderParam = params.get('gender') || '';
  const patientRelParam = params.get('relationship') || '';

  const navigate = useNavigate();
  const toast = useToast();
  const { login, patient } = useAuth();

  useLinkToken();

  // Flow State: 1. 'department' -> 2. 'family' -> 3. 'confirm'
  const [step, setStep] = useState(() => {
    if (params.get('category') && hospitalIdParam) return 'confirm';
    if (patientIdParam || patientNameParam) return 'department';
    return params.get('category') && hospitalIdParam ? 'family' : 'department';
  });

  // Hospital state
  const [hospitalId, setHospitalId] = useState(hospitalIdParam);
  const [hospitalSlug, setHospitalSlug] = useState(slugParam);
  const [hospitalName, setHospitalName] = useState(hospitalNameParam);
  const [hospitalType, setHospitalType] = useState(typeParam || 'Government Hospital');
  const [distanceKm, setDistanceKm] = useState(() => {
    if (!distParam) return '8.8';
    const num = parseFloat(String(distParam).replace(/[^0-9.]/g, ''));
    return isNaN(num) ? '8.8' : (Math.round(num * 10) / 10).toString();
  });
  const [hospitalImg, setHospitalImg] = useState(imgParam || '/hospital_illustrations/hospital_1.png');
  const [hospitalsList, setHospitalsList] = useState([]);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Department state (dynamically fetched from database for the selected hospital)
  const [dbCategories, setDbCategories] = useState([]);
  const [deptSearch, setDeptSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState(params.get('category') || '');

  // Real Database Family Members state
  // A logged-in session always wins over a ?phone= URL param, so a shared/forwarded
  // link can never make you book (or view) under someone else's number.
  const activeUserPhone = patient?.subject || params.get('phone') || '';
  const cleanPhoneStr = activeUserPhone ? activeUserPhone.replace(/\D/g, '') : '';
  const primaryPhone = cleanPhoneStr ? `+91 ${cleanPhoneStr.slice(-10)}` : 'Not signed in';
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState(patientIdParam);

  // Form / Patient details
  const [phone, setPhone] = useState(cleanPhoneStr || '');

  // OTP state
  const [otpStage, setOtpStage] = useState('verified'); // Auto-verified for primary linked account
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRef = useRef(null);

  // Location state
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [digipin, setDigipin] = useState('');
  const [decodingDigipin, setDecodingDigipin] = useState(false);
  const [showDigipinFallback, setShowDigipinFallback] = useState(false);

  // Pre-submission wait preview state
  const [queueEstimate, setQueueEstimate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Load hospitals list from database
  useEffect(() => {
    hospitalApi.list().then((list) => {
      const arr = Array.isArray(list) ? list : list?.data || [];
      setHospitalsList(arr);

      if (!hospitalId && !hospitalSlug && arr.length > 0) {
        setHospitalId(arr[0].id);
        setHospitalSlug(arr[0].uriSlug || arr[0].slug || '');
        setHospitalName(arr[0].name);
        if (arr[0].ownership) setHospitalType(`${arr[0].ownership} Hospital`);
      } else if (hospitalId && arr.length > 0) {
        const found = arr.find((h) => h.id === hospitalId);
        if (found) {
          if (!hospitalName) setHospitalName(found.name);
          if (!hospitalSlug) setHospitalSlug(found.uriSlug || found.slug || '');
          if (!typeParam && found.ownership) setHospitalType(`${found.ownership} Hospital`);
        }
      } else if (hospitalSlug && arr.length > 0) {
        const found = arr.find((h) => (h.uriSlug || h.slug) === hospitalSlug);
        if (found) {
          if (!hospitalName) setHospitalName(found.name);
          if (!hospitalId) setHospitalId(found.id);
          if (!typeParam && found.ownership) setHospitalType(`${found.ownership} Hospital`);
        }
      }
    }).catch((err) => {
      console.warn('Failed to load hospitals list:', err);
    });
  }, [hospitalId, hospitalSlug, hospitalName, typeParam]);

  // 1. Fetch live categories dynamically for the selected hospital from database
  useEffect(() => {
    let isMounted = true;

    async function loadHospitalCategories() {
      // hospitalSlug is already seeded from ?slug=; falling back to slugParam here would
      // snap a hospital switched in the modal back to the one in the URL.
      let activeSlug = hospitalSlug;
      let matchedHospital = null;

      if (!activeSlug && hospitalId && hospitalsList.length > 0) {
        matchedHospital = hospitalsList.find((h) => h.id === hospitalId);
        if (matchedHospital) {
          activeSlug = matchedHospital.uriSlug || matchedHospital.slug;
        }
      } else if (activeSlug && hospitalsList.length > 0) {
        matchedHospital = hospitalsList.find(
          (h) => (h.uriSlug && h.uriSlug === activeSlug) || (h.slug && h.slug === activeSlug) || h.id === hospitalId
        );
      }

      setLoadingCategories(true);

      try {
        let liveCats = [];

        // A. Fetch fresh hospital profile by slug if available
        if (activeSlug) {
          try {
            const hRes = await hospitalApi.getBySlug(activeSlug);
            const hData = hRes?.data || hRes;
            if (hData && Array.isArray(hData.categories) && hData.categories.length > 0) {
              liveCats = [...hData.categories];
            }
            if (hData) {
              if (isMounted && hData.name) setHospitalName(hData.name);
              if (isMounted && hData.ownership) setHospitalType(`${hData.ownership} Hospital`);
              if (isMounted && hData.id) setHospitalId(hData.id);
            }
          } catch (e) {
            console.warn('Could not fetch hospital by slug:', e.message);
          }
        }

        // B. Check matchedHospital from cached list if liveCats is still empty
        if (liveCats.length === 0 && matchedHospital && Array.isArray(matchedHospital.categories)) {
          liveCats = [...matchedHospital.categories];
        }

        // C. Also check if hospital has configured department counters
        if (activeSlug) {
          try {
            const deptList = await hospitalApi.departments(activeSlug);
            const arr = Array.isArray(deptList) ? deptList : deptList?.data || [];
            if (arr.length > 0) {
              const deptNames = arr.map((d) => d.category || d.name || d).filter(Boolean);
              const merged = new Set([...liveCats, ...deptNames]);
              liveCats = Array.from(merged);
            }
          } catch {}
        }

        // D. Fallback only if no categories are configured for this hospital in DB
        if (liveCats.length === 0) {
          const globalCats = await hospitalApi.categories();
          if (Array.isArray(globalCats) && globalCats.length > 0) {
            liveCats = globalCats.slice(0, 8);
          } else {
            liveCats = POPULAR_DEPARTMENT_KEYS;
          }
        }

        if (isMounted) {
          setDbCategories(liveCats);

          // If previously selected department is not offered by this hospital, reset it!
          setSelectedDept((prev) => {
            if (!prev) return '';
            const exists = liveCats.some((c) => {
              const cLow = c.toLowerCase();
              const prevLow = prev.toLowerCase();
              return cLow === prevLow || (prevLow.includes('general medicine') && cLow.includes('general medicine'));
            });
            return exists ? prev : '';
          });
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    }

    loadHospitalCategories();
    return () => {
      isMounted = false;
    };
  }, [hospitalId, hospitalSlug, slugParam, hospitalsList]);

  // The patient chosen on SelectPatient (passed in the URL), as a one-item list.
  function paramMember() {
    if (!patientNameParam) return [];
    return [{
      id: patientIdParam || 'from-link',
      name: patientNameParam,
      relationship: patientRelParam || 'Member',
      age: patientAgeParam ? Number(patientAgeParam) : undefined,
      gender: patientGenderParam || undefined,
    }];
  }

  // 2. Fetch Real Family Members from Database
  useEffect(() => {
    let isMounted = true;
    setLoadingMembers(true);

    const targetQueryPhone = cleanPhone(phone) || cleanPhoneStr;
    (targetQueryPhone ? familyApi.listPublicMembers(targetQueryPhone) : Promise.resolve([]))
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          setFamilyMembers(list);
          if (patientIdParam && list.some((m) => m.id === patientIdParam)) {
            setSelectedMemberId(patientIdParam);
          } else if (patientNameParam) {
            const found = list.find((m) => m.name.toLowerCase() === patientNameParam.toLowerCase());
            if (found) setSelectedMemberId(found.id);
            else setSelectedMemberId(list[0].id);
          } else {
            setSelectedMemberId((prev) => prev || list[0].id);
          }
        } else {
          // No members on record yet: only offer the patient picked on the previous
          // screen (never demo people), otherwise ask them to add one.
          const fromParams = paramMember();
          setFamilyMembers(fromParams);
          setSelectedMemberId(fromParams.length ? fromParams[0].id : null);
        }
      })
      .catch((err) => {
        console.warn('Real DB family members fallback:', err.message);
        if (!isMounted) return;
        const fromParams = paramMember();
        setFamilyMembers(fromParams);
        setSelectedMemberId(fromParams.length ? fromParams[0].id : null);
      })
      .finally(() => {
        if (isMounted) setLoadingMembers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-fetch queue wait estimate when hospital or department changes
  useEffect(() => {
    if (!hospitalId || !selectedDept) return;
    queueApi.getQueue(hospitalId, selectedDept || undefined).then((q) => {
      if (q && q.stats) {
        const waitCount = q.stats.waitingCount ?? 0;
        const avgMins = q.stats.avgServiceMinutes ?? 10;
        setQueueEstimate({
          nextNumber: (q.stats.totalCount ?? 0) + 1,
          estWaitMins: waitCount * avgMins,
        });
      }
    }).catch(() => {});
  }, [hospitalId, selectedDept]);

  // Auto-request location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 15),
          });
        },
        () => {
          setLocation({ latitude: 19.1895, longitude: 72.964, accuracy: 25 });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocation({ latitude: 19.1895, longitude: 72.964, accuracy: 25 });
    }
  }, []);

  function requestGeoLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported. Please use DIGIPIN code below.');
      setShowDigipinFallback(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 10),
        });
        toast.success('Location updated successfully.');
      },
      (err) => {
        setLocating(false);
        setShowDigipinFallback(true);
        toast.error(err.message || 'Could not access GPS. Enter DIGIPIN below.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleDecodeDigipin() {
    if (!digipin.trim()) {
      toast.error('Enter a valid 10-character DIGIPIN');
      return;
    }
    setDecodingDigipin(true);
    try {
      const res = await locationApi.decode(digipin.trim());
      if (res && res.latitude && res.longitude) {
        setLocation({
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: 50,
        });
        toast.success('DIGIPIN decoded to coordinates.');
      } else {
        toast.error('Could not decode DIGIPIN');
      }
    } catch (err) {
      toast.error(err.message || 'Invalid DIGIPIN');
    } finally {
      setDecodingDigipin(false);
    }
  }

  const selectedMember = familyMembers.find((m) => m.id === selectedMemberId) || familyMembers[0];

  // Final Token Submission
  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedMember) {
      toast.error('Please select a family member for the appointment');
      setStep('family');
      return;
    }
    if (!selectedDept) {
      toast.error('Please select an OPD department');
      setStep('department');
      return;
    }

    const bookingPhone = cleanPhone(phone) || cleanPhoneStr;
    if (!bookingPhone) {
      toast.error('Please log in with your phone number to book a token');
      navigate('/login/patient');
      return;
    }
    if (!hospitalId) {
      toast.error('Please select a hospital');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        hospitalId: hospitalId,
        name: selectedMember.name.trim(),
        patientName: selectedMember.name.trim(),
        age: parseInt(selectedMember.age, 10) || 20,
        gender: selectedMember.gender || 'Male',
        category: selectedDept,
        phone: bookingPhone,
        latitude: location?.latitude || 19.1895,
        longitude: location?.longitude || 72.9640,
      };

      const res = await queueApi.create(payload);
      const token = res.data;
      if (res.alreadyExists) {
        toast.info('You already have an active token today.');
      } else {
        toast.success(`Token #${token.dailyNumber || token.id} generated!`);
      }
      navigate(`/token/${token.id}`);
    } catch (err) {
      toast.error(err.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Department lists - derived exclusively from this hospital's live categories
  const { popularList, remainingList } = useMemo(() => {
    const rawList = dbCategories.length > 0 ? dbCategories : [];

    const populars = [];
    const usedLabels = new Set();

    // 1. Match priority popular categories that THIS hospital actually offers
    for (const key of POPULAR_DEPARTMENT_KEYS) {
      const match = rawList.find((c) => {
        const lower = c.toLowerCase();
        const keyLower = key.toLowerCase();
        if (keyLower === 'general medicine') {
          return lower.includes('general medicine') || lower.includes('internal medicine');
        }
        if (keyLower === 'obstetrics & gynaecology') {
          return lower.includes('obstetric') || lower.includes('gynaec');
        }
        return lower === keyLower || lower.startsWith(keyLower);
      });

      if (match && !usedLabels.has(match)) {
        usedLabels.add(match);
        const visual = getDepartmentVisual(match);
        populars.push({
          ...visual,
          displayName: visual.displayName || key,
          fullLabel: match,
        });
      }

      if (populars.length === 8) break;
    }

    // 2. If hospital has other offered categories and fewer than 8 in populars,
    // fill the top grid up to 8 so the user has immediate access to all available specialties
    if (populars.length < 8) {
      for (const c of rawList) {
        if (!usedLabels.has(c)) {
          usedLabels.add(c);
          const visual = getDepartmentVisual(c);
          populars.push({
            ...visual,
            displayName: visual.displayName || c,
            fullLabel: c,
          });
          if (populars.length === 8) break;
        }
      }
    }

    // 3. Remaining departments offered by this hospital beyond the top 8
    const others = [];
    for (const c of rawList) {
      if (!usedLabels.has(c)) {
        const visual = getDepartmentVisual(c);
        others.push({
          ...visual,
          displayName: visual.displayName || c,
          fullLabel: c,
        });
      }
    }

    return { popularList: populars, remainingList: others };
  }, [dbCategories]);

  const filteredPopular = useMemo(() => {
    if (!deptSearch.trim()) return popularList;
    const q = deptSearch.toLowerCase().trim();
    return popularList.filter(
      (d) =>
        d.displayName.toLowerCase().includes(q) ||
        d.fullLabel.toLowerCase().includes(q) ||
        (d.hint || '').toLowerCase().includes(q)
    );
  }, [popularList, deptSearch]);

  const filteredAll = useMemo(() => {
    if (!deptSearch.trim()) return remainingList;
    const q = deptSearch.toLowerCase().trim();
    return remainingList.filter(
      (d) =>
        d.displayName.toLowerCase().includes(q) ||
        d.fullLabel.toLowerCase().includes(q) ||
        (d.hint || '').toLowerCase().includes(q)
    );
  }, [remainingList, deptSearch]);

  const isSelectedDept = (item) => {
    if (!selectedDept || !item) return false;
    const s = selectedDept.toLowerCase();
    const f = (item.fullLabel || '').toLowerCase();
    const d = (item.displayName || '').toLowerCase();
    return s === f || s === d || (s.includes('general medicine') && (f.includes('general medicine') || d.includes('general medicine')));
  };

  const selectedVisual = getDepartmentVisual(selectedDept);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      <AppHeader activeNav="book" />
      <main
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >

        {/* Top App Bar (Header) */}
        <header
          style={{
            padding: '8px 16px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (step === 'confirm') {
                setStep('family');
              } else if (step === 'family') {
                setStep('department');
              } else {
                navigate(-1);
              }
            }}
            aria-label="Back"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#043c2c',
                margin: 0,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              {step === 'department' ? 'Which doctor do you need?' : step === 'family' ? 'Who is the patient?' : 'Check and confirm'}
            </h1>
            <BookingSteps step={step} />
          </div>

          <div style={{ width: '38px' }} />
        </header>

        {/* ========================================================================= */}
        {/* STEP 1: SELECT DEPARTMENT                                                 */}
        {/* ========================================================================= */}
        {step === 'department' && (
          <>
            <div
              style={{
                flex: '1 1 0%',
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backgroundColor: '#ffffff',
              }}
            >
              {/* Selected Hospital Card */}
              <div
                style={{
                  backgroundColor: '#F0F7FF',
                  border: '1px solid #D6E8FC',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.04)',
                }}
              >
                <div
                  style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: '12px',
                    backgroundColor: '#E0F2FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={hospitalImg}
                    alt={hospitalName || 'Hospital'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Selected Hospital
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: '700',
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {hospitalName || 'Aastha Hospital Teen Hath Naka'}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                    {hospitalType}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#64748b">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                    </svg>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                      {formatApproxDistance(distanceKm)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHospitalModal(true)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #93C5FD',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#0284C7',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  Change
                </button>
              </div>

              {/* Search Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '11px 14px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search: fever, eye, child, teeth…"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '14px',
                    color: '#0f172a',
                    backgroundColor: 'transparent',
                  }}
                />
                {deptSearch && (
                  <button
                    type="button"
                    onClick={() => setDeptSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Empty state when searching */}
              {(loadingCategories || dbCategories.length === 0) && !deptSearch && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: '14px' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px' }} />
                  Loading departments…
                </div>
              )}

              {!loadingCategories && dbCategories.length > 0 && !deptSearch && (
                <div
                  style={{
                    backgroundColor: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '13.5px',
                    color: '#92400E',
                    lineHeight: 1.45,
                  }}
                >
                  Not sure which one? Choose <strong>General Medicine</strong> — the doctor will guide you.
                </div>
              )}

              {(deptSearch || (!loadingCategories && dbCategories.length > 0)) && filteredPopular.length === 0 && filteredAll.length === 0 && (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                  }}
                >
                  <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                    No departments found for "{deptSearch}"
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                    Try a simple word like "fever", "child", "eye" or "teeth".
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeptSearch('')}
                    style={{
                      marginTop: '12px',
                      backgroundColor: '#F1F5F9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#0f172a',
                      cursor: 'pointer',
                    }}
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* Popular Departments (Top 8 - 2 Column Grid) */}
              {filteredPopular.length > 0 && (
                <div>
                  <h2
                    style={{
                      fontSize: '15.5px',
                      fontWeight: '700',
                      color: '#0f172a',
                      margin: '6px 0 12px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Common departments
                  </h2>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {filteredPopular.map((dept, idx) => {
                      const active = isSelectedDept(dept);
                      const title = dept.displayName || dept.fullLabel;
                      return (
                        <button
                          key={dept.fullLabel || idx}
                          type="button"
                          onClick={() => setSelectedDept(dept.fullLabel)}
                          style={{
                            backgroundColor: active ? '#F0FDF4' : '#ffffff',
                            border: active ? '2px solid #00A884' : '1px solid #E2E8F0',
                            borderRadius: '14px',
                            padding: '10px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            boxShadow: active
                              ? '0 4px 12px rgba(0, 168, 132, 0.12)'
                              : '0 1px 3px rgba(0, 0, 0, 0.03)',
                            transition: 'all 0.15s ease',
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '56px',
                          }}
                        >
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              backgroundColor: dept.pastelBg,
                              border: `1px solid ${dept.borderColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <DepartmentIcon type={dept.type} color={dept.iconColor} size={15} />
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: '12px',
                              fontWeight: '600',
                              color: active ? '#043c2c' : '#0f172a',
                              lineHeight: 1.25,
                              letterSpacing: '-0.01em',
                              whiteSpace: 'normal',
                              wordBreak: 'normal',
                              overflowWrap: 'normal',
                              overflow: 'hidden',
                            }}
                          >
                            <div>{title}</div>
                            {dept.hint && (
                              <div style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', marginTop: '2px' }}>
                                {dept.hint}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              flexShrink: 0,
                              color: active ? '#00A884' : '#94A3B8',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Departments (Scrollable List) */}
              {filteredAll.length > 0 && (
                <div>
                  <h2
                    style={{
                      fontSize: '15.5px',
                      fontWeight: '700',
                      color: '#0f172a',
                      margin: '12px 0 10px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    More departments
                  </h2>

                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    {filteredAll.map((dept, idx) => {
                      const active = isSelectedDept(dept);
                      const isLast = idx === filteredAll.length - 1;
                      return (
                        <button
                          key={dept.fullLabel || idx}
                          type="button"
                          onClick={() => setSelectedDept(dept.fullLabel)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            border: 'none',
                            borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                            backgroundColor: active ? '#F0FDF4' : '#ffffff',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: dept.pastelBg,
                              border: `1px solid ${dept.borderColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <DepartmentIcon type={dept.type} color={dept.iconColor} size={18} />
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: '13.5px',
                              fontWeight: active ? '700' : '600',
                              color: active ? '#043c2c' : '#1e293b',
                              lineHeight: 1.3,
                            }}
                          >
                            <div>{dept.displayName}</div>
                            {dept.hint && (
                              <div style={{ fontSize: '12.5px', fontWeight: '500', color: '#64748b', marginTop: '2px' }}>
                                {dept.hint}
                              </div>
                            )}
                          </div>

                          <div style={{ flexShrink: 0, color: active ? '#00A884' : '#94A3B8' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Button for Step 1: Continue */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: '#ffffff',
                borderTop: '1px solid #E2E8F0',
                padding: '12px 16px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <button
                type="button"
                disabled={!selectedDept}
                onClick={() => {
                  if (!selectedDept) {
                    toast.error('Please select a department');
                    return;
                  }
                  setStep('family');
                }}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: selectedDept ? '#00A884' : '#E2E8F0',
                  color: selectedDept ? '#ffffff' : '#94A3B8',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: selectedDept ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: selectedDept ? '0 4px 14px rgba(0, 168, 132, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>Continue</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={selectedDept ? '#ffffff' : '#94A3B8'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: FAMILY MEMBER SELECTION (REAL DATABASE POPULATED)                 */}
        {/* ========================================================================= */}
        {step === 'family' && (
          <>
            <div
              style={{
                flex: '1 1 0%',
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backgroundColor: '#ffffff',
              }}
            >
              {/* Primary Contact Card */}
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #DCFCE7',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#047857">
                      <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                    </svg>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#0f172a',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {primaryPhone}
                    </div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: '#64748b',
                        fontWeight: '400',
                        marginTop: '1px',
                      }}
                    >
                      {cleanPhoneStr ? 'Your mobile number' : 'Sign in with your mobile number to continue'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/login/patient')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #86EFAC',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#047857',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  }}
                >
                  Change
                </button>
              </div>

              {/* Chosen Department Pill Banner */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: selectedVisual.pastelBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DepartmentIcon type={selectedVisual.type} color={selectedVisual.iconColor} size={14} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                    {selectedVisual.displayName} · {hospitalName}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('department')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Change
                </button>
              </div>

              {/* Family Members Selection List (Real Database) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h2
                  style={{
                    fontSize: '15.5px',
                    fontWeight: '700',
                    color: '#0f172a',
                    margin: '2px 0 4px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Who is going to the doctor?
                </h2>

                {!loadingMembers && familyMembers.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '20px 16px',
                      backgroundColor: '#F8FAFC',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '14px',
                      fontSize: '14px',
                      color: '#475569',
                      lineHeight: 1.5,
                    }}
                  >
                    No patient added yet.
                    <br />
                    {patient ? 'Add yourself or a family member below.' : 'Sign in with your mobile number, then add the patient.'}
                  </div>
                )}

                {loadingMembers ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '13px' }}>
                    Loading your family…
                  </div>
                ) : (
                  familyMembers.map((member, idx) => {
                    const isSelected = selectedMemberId === member.id;
                    const visual = getFamilyAvatarVisual(member, idx);
                    return (
                      <div
                        key={member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        style={{
                          backgroundColor: isSelected ? '#F0FDF4' : '#ffffff',
                          border: isSelected ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                          borderRadius: '16px',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected
                            ? '0 2px 8px rgba(16, 185, 129, 0.08)'
                            : '0 1px 3px rgba(0, 0, 0, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              backgroundColor: visual.avatarBg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: visual.avatarColor,
                              flexShrink: 0,
                            }}
                          >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: '15px',
                                fontWeight: '700',
                                color: '#0f172a',
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {member.name}
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                color: '#64748b',
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span>{member.relationship}</span>
                              <span>•</span>
                              {member.age != null && <span>{member.age} years</span>}
                            </div>
                          </div>
                        </div>

                        {/* Radio button */}
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: isSelected ? '2px solid #00A884' : '2px solid #CBD5E1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            backgroundColor: '#ffffff',
                            transition: 'border-color 0.15s ease',
                          }}
                        >
                          {isSelected && (
                            <div
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#00A884',
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Family Member Button */}
                <button
                  type="button"
                  onClick={() => navigate(patient ? '/patient/family' : '/login/patient')}
                  style={{
                    marginTop: '4px',
                    width: '100%',
                    backgroundColor: '#F0FDF4',
                    border: '1.5px dashed #86EFAC',
                    borderRadius: '14px',
                    padding: '13px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#059669',
                    fontSize: '14.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{patient ? 'Add a family member' : 'Sign in to add patient'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Button for Step 2: Continue */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: '#ffffff',
                borderTop: '1px solid #E2E8F0',
                padding: '12px 16px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <button
                type="button"
                disabled={!selectedMemberId}
                onClick={() => {
                  if (!selectedMemberId) {
                    toast.error('Please select a family member');
                    return;
                  }
                  setStep('confirm');
                }}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#00A884',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 168, 132, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Continue</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: CONFIRM & TOKEN GENERATION                                        */}
        {/* ========================================================================= */}
        {step === 'confirm' && (
          <>
            <div
              style={{
                flex: '1 1 0%',
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: '#f8fafc',
              }}
            >
              {/* Booking Summary Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Your booking
                </div>

                {/* Patient Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#D1FAE5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#059669',
                      }}
                    >
                      👤
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                        {selectedMember?.name}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {[selectedMember?.relationship, selectedMember?.age != null ? `${selectedMember.age} years` : null, selectedMember?.gender]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('family')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284C7',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                </div>

                <div style={{ height: '1px', backgroundColor: '#F1F5F9' }} />

                {/* Hospital & Department Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: selectedVisual.pastelBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DepartmentIcon type={selectedVisual.type} color={selectedVisual.iconColor} size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                        {selectedVisual.displayName}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {hospitalName} · 📍 {formatApproxDistance(distanceKm)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('department')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284C7',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {queueEstimate && (
                <div
                  style={{
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    gap: '16px',
                    justifyContent: 'space-around',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#065F46' }}>
                      {Math.max(0, queueEstimate.nextNumber - 1)}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#047857', fontWeight: '600' }}>tokens given today</div>
                  </div>
                  <div style={{ width: '1px', backgroundColor: '#A7F3D0' }} />
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#065F46' }}>
                      {queueEstimate.estWaitMins > 0 ? `~${queueEstimate.estWaitMins} min` : 'Short'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#047857', fontWeight: '600' }}>expected wait</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, textAlign: 'center', padding: '0 8px' }}>
                After booking you get a token number. Watch your turn live on this phone — no need to stand in line.
              </div>
            </div>

            {/* Bottom Button for Step 3: Generate Token */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: '#ffffff',
                borderTop: '1px solid #E2E8F0',
                padding: '12px 16px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#00A884',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 168, 132, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{submitting ? 'Booking your token…' : 'Confirm & get my token'}</span>
              </button>
            </div>
          </>
        )}

        {/* Hospital Switcher Modal */}
        {showHospitalModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 80,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
            onClick={() => setShowHospitalModal(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px 20px 0 0',
                maxHeight: '82%',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.18)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Drag bar */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '9999px', backgroundColor: '#CBD5E1' }} />
              </div>

              {/* Modal Header */}
              <div
                style={{
                  padding: '8px 16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Select Hospital
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Choose a facility to load its live departments
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHospitalModal(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#F1F5F9',
                    border: 'none',
                    fontSize: '14px',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Search */}
              <div style={{ padding: '12px 16px 8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '8px 12px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search hospital name or area..."
                    value={hospitalSearch}
                    onChange={(e) => setHospitalSearch(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      width: '100%',
                      fontSize: '13.5px',
                      color: '#0f172a',
                    }}
                  />
                  {hospitalSearch && (
                    <button
                      type="button"
                      onClick={() => setHospitalSearch('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Hospital List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {hospitalsList
                  .filter((h) => {
                    if (!hospitalSearch.trim()) return true;
                    const q = hospitalSearch.toLowerCase();
                    return (
                      (h.name || '').toLowerCase().includes(q) ||
                      (h.address || '').toLowerCase().includes(q) ||
                      (h.ownership || '').toLowerCase().includes(q)
                    );
                  })
                  .map((h) => {
                    const isSelected = h.id === hospitalId || (h.uriSlug && h.uriSlug === hospitalSlug);
                    const catsCount = Array.isArray(h.categories) ? h.categories.length : 0;
                    return (
                      <div
                        key={h.id || h.uriSlug}
                        onClick={() => {
                          const slug = h.uriSlug || h.slug || '';
                          setHospitalId(h.id);
                          setHospitalSlug(slug);
                          setHospitalName(h.name);
                          setHospitalType(h.ownership ? `${h.ownership} Hospital` : 'Government Hospital');
                          if (h.distanceKm != null) setDistanceKm(h.distanceKm.toFixed(1));
                          setShowHospitalModal(false);
                          toast.success(`Switched to ${h.name}`);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #00A884' : '1px solid #E2E8F0',
                          backgroundColor: isSelected ? '#F0FDF4' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: isSelected ? '#043c2c' : '#0f172a' }}>
                            {h.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {h.ownership ? `${h.ownership} Hospital` : 'Government Hospital'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: isSelected ? '#DCFCE7' : '#EFF6FF',
                                color: isSelected ? '#047857' : '#1D4ED8',
                                padding: '2px 8px',
                                borderRadius: '8px',
                              }}
                            >
                              {catsCount > 0 ? `${catsCount} live depts` : 'OPD available'}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: '#00A884',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              border: '2px solid #CBD5E1',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '10px 16px 14px',
                  borderTop: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '0 0 20px 20px',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowHospitalModal(false);
                    navigate('/find-hospital');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Browse all on Find Hospital map</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AyushmanFooter />
    </div>
  );
}
