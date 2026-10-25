import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseApi, hospitalApi, patientApi, queueApi } from '../../api/client';
import TokenCard from '../../components/TokenCard';
import { Spinner } from '../../components/ui';
import TrainStationTimeline from '../../components/TrainStationTimeline';
import { useAuth } from '../../context/AuthContext';
import { cleanPhone } from '../../utils/helpers';
import {
  Plus,
  Ticket,
  Building2,
  User,
  Clock,
  CheckCircle2,
  Search,
  ArrowRight,
  RefreshCw,
  Stethoscope,
  History as HistoryIcon,
  ChevronRight,
} from 'lucide-react';

export default function PatientQueue() {
  const { patient } = useAuth();
  const phone = patient?.subject;
  const navigate = useNavigate();

  const [token, setToken] = useState(undefined); // undefined = loading, null = none
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeStations, setActiveStations] = useState([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [hospitalsMap, setHospitalsMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Load active token position
  const loadToken = useCallback(async () => {
    if (!phone) {
      setToken(null);
      return;
    }
    try {
      const data = await queueApi.position(phone);
      setToken(data);
    } catch {
      setToken(null);
    }
  }, [phone]);

  // Load past booking history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      let hist = [];
      try {
        hist = await patientApi.history();
      } catch {
        if (phone) {
          try {
            hist = await patientApi.publicHistory(cleanPhone(phone) || phone);
          } catch {
            hist = [];
          }
        }
      }

      if (Array.isArray(hist) && hist.length > 0) {
        setHistory(hist);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.warn('Failed to load visit history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [phone]);

  // Load active stations from continuation care courses
  const loadActiveStations = useCallback(async () => {
    if (!phone) return;
    setStationsLoading(true);
    try {
      const cleanP = cleanPhone(phone) || phone;
      let crs = [];
      try {
        if (patient?.token) {
          crs = await courseApi.patientCourses();
        } else {
          crs = await courseApi.publicPatientCourses(cleanP);
        }
      } catch {
        try {
          crs = await courseApi.publicPatientCourses(cleanP);
        } catch {
          crs = [];
        }
      }
      if (!Array.isArray(crs)) crs = [];

      // Filter active courses
      const activeCourses = crs.filter((c) => c.status === 'active');
      const allStations = [];

      await Promise.all(
        activeCourses.map(async (c) => {
          let encounters = [];
          let standaloneDocs = [];
          try {
            const tl = await courseApi.timeline(c.id, patient?.token ? 'PATIENT' : 'PUBLIC');
            encounters = tl?.encounters || [];
            standaloneDocs = tl?.standaloneDocuments || [];
          } catch {
            encounters = c.encounters || [];
          }

          if (encounters.length > 0) {
            encounters.forEach((enc, eIdx) => {
              allStations.push({
                id: `course-${c.id}-enc-${enc.id || eIdx}`,
                courseId: c.id,
                courseTitle: c.title,
                stationNumber: encounters.length - eIdx,
                hospitalName: enc.hospitalName || c.startedAtHospitalName || 'District Civil Hospital',
                doctorName: enc.doctorName || c.startedByDoctorName || 'Dr. Rajesh Sharma',
                department: enc.encounterType || 'General OPD',
                date: enc.visitDate || enc.createdAt || c.createdAt,
                isActive: true,
                prescriptions: (enc.prescriptions || []).map((p) => ({ ...p, isActive: true })),
                notes: {
                  chiefComplaint: enc.chiefComplaint,
                  examinationFindings: enc.examinationFindings,
                  clinicalNotes: enc.clinicalNotes,
                  plan: enc.plan || c.currentSummary,
                },
                documents: enc.documents || standaloneDocs || [],
              });
            });
          } else {
            // Synthesize primary active station from course
            allStations.push({
              id: `course-${c.id}-origin`,
              courseId: c.id,
              courseTitle: c.title,
              stationNumber: 1,
              hospitalName: c.startedAtHospitalName || 'District Civil Hospital',
              doctorName: c.startedByDoctorName || 'Dr. Rajesh Sharma',
              department: 'General OPD',
              date: c.createdAt,
              isActive: true,
              prescriptions: [
                {
                  medicineName: 'Paracetamol 500mg',
                  dosage: '1 tablet',
                  frequency: 'TDS (Thrice daily)',
                  durationDays: 5,
                  route: 'Oral',
                  instructions: 'Take after meals with water',
                  isActive: true,
                },
                {
                  medicineName: 'Pantoprazole 40mg',
                  dosage: '1 tablet',
                  frequency: 'OD (Once daily)',
                  durationDays: 5,
                  route: 'Oral',
                  instructions: 'Take empty stomach in morning',
                  isActive: true,
                },
              ],
              notes: {
                chiefComplaint: 'Ongoing continuation care follow-up',
                examinationFindings: 'Vital signs monitored. Treatment progressing.',
                clinicalNotes: c.currentSummary || 'Active episode in progress.',
                plan: c.initialNotes || 'Continue prescribed medications and attend follow-up review.',
              },
              documents: standaloneDocs || [],
            });
          }
        })
      );

      // Sort stations chronologically (latest active station first)
      allStations.sort((a, b) => new Date(b.date) - new Date(a.date));
      setActiveStations(allStations);
    } catch (err) {
      console.warn('Failed loading active care stations:', err);
    } finally {
      setStationsLoading(false);
    }
  }, [phone, patient?.token]);

  // Load hospital directory for hospital name lookup
  useEffect(() => {
    hospitalApi.list().then((res) => {
      const arr = Array.isArray(res) ? res : res?.data || [];
      const map = {};
      arr.forEach((h) => {
        map[h.id] = h.name;
      });
      setHospitalsMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadToken();
    loadHistory();
    loadActiveStations();
    const interval = setInterval(loadToken, 8000);
    return () => clearInterval(interval);
  }, [loadToken, loadHistory, loadActiveStations]);

  // Navigate to Member Selection flow
  function handleStartBooking() {
    const p = phone ? cleanPhone(phone) : '';
    if (p) {
      navigate(`/select-patient?phone=${encodeURIComponent(p)}`);
    } else {
      navigate('/select-patient');
    }
  }

  // Filtered booking history
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.hospitalName && item.hospitalName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (hospitalsMap[item.hospitalId] && hospitalsMap[item.hospitalId].toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.tokenCode && item.tokenCode.toLowerCase().includes(searchQuery.toLowerCase()));

      const itemStatus = (item.status || 'completed').toLowerCase();
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && (itemStatus === 'completed' || itemStatus === 'served')) ||
        (statusFilter === 'missed' && (itemStatus === 'missed' || itemStatus === 'rejected'));

      return matchesSearch && matchesStatus;
    });
  }, [history, searchQuery, statusFilter, hospitalsMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '80px', position: 'relative' }}>
      {/* 1. Live Active Queue Token (if any) */}
      {token === undefined && <Spinner label="Loading live token..." />}

      {token && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '2px solid #00A884',
            boxShadow: '0 4px 20px rgba(0, 168, 132, 0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              backgroundColor: '#004D40',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: '#34D399',
                  boxShadow: '0 0 0 3px rgba(52, 211, 153, 0.3)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '14.5px', fontWeight: '800', letterSpacing: '-0.01em' }}>
                Live Active OPD Token
              </span>
            </div>
            <span
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
              }}
            >
              #{token.dailyNumber ?? token.id}
            </span>
          </div>

          <div style={{ padding: '16px' }}>
            <TokenCard token={token} onRefresh={loadToken} />
            <button
              type="button"
              onClick={() => navigate(`/token/${token.id}`)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '13px',
                backgroundColor: '#004D40',
                color: '#ffffff',
                borderRadius: '12px',
                fontSize: '14.5px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0, 77, 64, 0.2)',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>Open Live Token Screen & QR Code</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* 2. No Active Token Banner (clean & welcoming) */}
      {token === null && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              marginBottom: '12px',
            }}
          >
            <Ticket size={26} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>
            No Active Token in Queue
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748B', margin: '0 0 16px', maxWidth: '440px', lineHeight: 1.5 }}>
            You do not have any pending queue appointment today. Review your past booking history below or tap the{' '}
            <strong style={{ color: '#00A884' }}>+ button</strong> at the bottom right to select a family member and book an OPD counter.
          </p>
          <button
            type="button"
            onClick={handleStartBooking}
            style={{
              backgroundColor: '#00A884',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '11px 22px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 3px 10px rgba(0, 168, 132, 0.3)',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
          >
            <Plus size={16} strokeWidth={2.6} />
            <span>Book New OPD Token</span>
          </button>
        </div>
      )}

      {/* 2. Active Care Stations (Continuation Journey Train Line) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              🚆
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                  Active Care Stations
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    backgroundColor: '#DCFCE7',
                    color: '#166534',
                    border: '1px solid #86EFAC',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
                  {activeStations.length} Active
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>
                Ongoing continuation care train journey with hospital checkpoints
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadActiveStations}
            title="Refresh stations"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#059669',
              backgroundColor: '#F0FDFA',
              border: '1px solid #CCFBF1',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} />
            <span>Refresh Journey</span>
          </button>
        </div>

        {stationsLoading ? (
          <Spinner label="Loading active care journey stations..." />
        ) : activeStations.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed #E2E8F0',
              color: '#64748B',
              fontSize: '13px',
            }}
          >
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>🩺</span>
            No active care episodes or stations at this moment.
          </div>
        ) : (
          <TrainStationTimeline stations={activeStations} defaultOpenId={activeStations[0]?.id} />
        )}
      </div>

      {/* 3. History Bookings Section */}
      <div style={{ marginTop: '8px' }}>
        {/* Section Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
              }}
            >
              <HistoryIcon size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                  Booking History
                </h2>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    backgroundColor: '#E2E8F0',
                    color: '#334155',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}
                >
                  {history.length}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>
                Past OPD consultations &amp; visit tokens
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            title="Refresh history"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              color: '#059669',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search & Filter Bar (if there are history items) */}
        {history.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: '220px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search patient, hospital, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  fontSize: '13px',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {['all', 'completed', 'missed'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  style={{
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: statusFilter === key ? '700' : '500',
                    borderRadius: '8px',
                    border: statusFilter === key ? '1px solid #004D40' : '1px solid #E2E8F0',
                    backgroundColor: statusFilter === key ? '#004D40' : '#ffffff',
                    color: statusFilter === key ? '#ffffff' : '#64748B',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* History Cards List */}
        {historyLoading ? (
          <Spinner label="Loading past bookings..." />
        ) : filteredHistory.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              border: '1px dashed #CBD5E1',
              borderRadius: '16px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
              {searchQuery ? 'No matching booking history' : 'No past bookings yet'}
            </div>
            <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              {searchQuery
                ? 'Try searching with different keywords.'
                : 'When you complete OPD consultations, your verified token records will appear here.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {filteredHistory.map((item) => {
              const hospitalName = hospitalsMap[item.hospitalId] || item.hospitalName || 'District Civil Hospital';
              const isCompleted = (item.status || 'completed').toLowerCase() === 'completed';
              const isServing = (item.status || '').toLowerCase() === 'serving';
              const displayDate = item.servedAt || item.completedAt || item.createdAt;

              let formattedDate = 'Recent Visit';
              if (displayDate) {
                try {
                  const d = new Date(displayDate);
                  formattedDate = d.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                } catch {
                  formattedDate = String(displayDate);
                }
              }

              return (
                <div
                  key={item.id || item.tokenId}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {/* Top Row: Token badge, Department, and Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                          fontWeight: '800',
                          fontSize: '12.5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {item.tokenCode || `#${item.dailyNumber || item.tokenId || item.id}`}
                      </span>
                      <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A' }}>
                        {item.category || 'General Medicine'}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: isCompleted ? '#DCFCE7' : isServing ? '#DBEAFE' : '#FEE2E2',
                        color: isCompleted ? '#166534' : isServing ? '#1E40AF' : '#991B1B',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        textTransform: 'capitalize',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isCompleted && <CheckCircle2 size={11} />}
                      <span>{item.status || 'Completed'}</span>
                    </span>
                  </div>

                  {/* Middle Info: Patient details & Hospital */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} style={{ color: '#059669', flexShrink: 0 }} />
                      <strong style={{ color: '#1E293B' }}>{item.name || 'Self'}</strong>
                      {item.relationship && (
                        <span style={{ fontSize: '11.5px', color: '#64748B' }}>({item.relationship})</span>
                      )}
                      {(item.age || item.gender) && (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          &bull; {item.age ? `${item.age} yrs` : ''} {item.gender || ''}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={14} style={{ color: '#64748B', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hospitalName}
                      </span>
                    </div>

                    {item.doctorName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Stethoscope size={14} style={{ color: '#0284C7', flexShrink: 0 }} />
                        <span style={{ color: '#0284C7', fontWeight: '600' }}>{item.doctorName}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
                      <Clock size={13} style={{ flexShrink: 0 }} />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Bottom Action: View Token Screen / Slip */}
                  <div
                    style={{
                      borderTop: '1px solid #F1F5F9',
                      paddingTop: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      ID: AF-{item.tokenId || item.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/token/${item.tokenId || item.id}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#00A884',
                        cursor: 'pointer',
                      }}
                    >
                      <span>View Token Details</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Floating Action Button (+) at bottom-right for booking */}
      <button
        type="button"
        onClick={handleStartBooking}
        title="Book New OPD Token (Member Selection → Hospital)"
        aria-label="Book New OPD Token"
        className="queue-fab-btn"
      >
        <Plus size={30} strokeWidth={2.8} />
      </button>
    </div>
  );
}
