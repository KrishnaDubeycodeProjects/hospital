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

import React, { useEffect, useState } from 'react';
import { courseApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientCourses() {
  const [courses, setCourses] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [stationActiveTab, setStationActiveTab] = useState({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function loadCourses() {
    try {
      const list = await courseApi.patientCourses();
      setCourses(list || []);
      if (list && list.length > 0) {
        selectCourse(list[0]);
      }
    } catch (err) {
      toast.error(err.message || 'Failed loading care episodes.');
    } finally {
      setLoading(false);
    }
  }

  async function selectCourse(c) {
    setSelectedCourse(c);
    setLoadingTimeline(true);
    try {
      const t = await courseApi.timeline(c.id, 'PATIENT');
      setTimeline(t);
    } catch (err) {
      toast.error(err.message || 'Could not load course timeline.');
      setTimeline(null);
    } finally {
      setLoadingTimeline(false);
    }
  }

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadDoc(docId, fileName) {
    try {
      const url = await fetchAsObjectUrl(courseApi.documentDownloadUrl(selectedCourse.id, docId), 'PATIENT');
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `record-${docId}`;
      a.click();
    } catch (err) {
      toast.error(err.message || 'Failed downloading medical document.');
    }
  }

  if (loading) return <Spinner label="Loading your longitudinal care episodes..." />;

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>My Care Episodes & Consultations</h1>
          <p className="muted-text">
            Your health records across visits, including doctor notes, prescriptions, and lab reports.
          </p>
        </div>
      </div>

      {!courses || courses.length === 0 ? (
        <EmptyState
          title="No Care Episodes on Record"
          hint="When a doctor completes an OPD consultation for you or a registered family member, your care timeline will appear here."
        />
      ) : (
        <div className="clean-directory-grid" style={{ alignItems: 'flex-start' }}>
          {/* Courses List */}
          <div className="stack-sm">
            <h3 style={{ fontSize: '16px', margin: '0 0 10px' }}>Select Care Episode</h3>
            {courses.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCourse(c)}
                className={`clean-hospital-card ${selectedCourse?.id === c.id ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{c.title}</strong>
                  <span className="badge badge-blue">{c.courseType}</span>
                </div>
                <div className="muted-text" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {c.targetDepartment} &bull; {fmtDateTime(c.createdAt)}
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <strong>Diagnosis:</strong> {c.primaryDiagnosis || 'Clinical Review'}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline & Documents Pane */}
          <div>
            {loadingTimeline ? (
              <Spinner label="Loading episode timeline..." />
            ) : selectedCourse ? (
              <div className="stack-md">
                <Card title={`Care Episode #${selectedCourse.id}: ${selectedCourse.title}`}>
                  <dl className="detail-list">
                    <div className="detail-row">
                      <dt>Primary Diagnosis</dt>
                      <dd>{selectedCourse.primaryDiagnosis || 'Routine Assessment'}</dd>
                    </div>
                    <div className="detail-row">
                      <dt>Status</dt>
                      <dd>
                        <span className={`badge ${selectedCourse.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                          {selectedCourse.status}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </Card>

                {/* Railway-style Checkpoint Station Timeline */}
                <Card title="Episode Checkpoint Stations (Railway Track Timeline)">
                  {/* Doctor Details at the top like grouping a continuation */}
                  <div
                    style={{
                      backgroundColor: '#F0FDFA',
                      border: '1.5px solid #99F6E4',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F766E', textTransform: 'uppercase' }}>
                        Care Episode Continuation Grouping
                      </span>
                      <span className="badge badge-green">{selectedCourse.status || 'Active'}</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
                      {selectedCourse.title}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CCFBF1' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Consulting Doctor</span>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                          👨‍⚕️ {selectedCourse.doctorName || selectedCourse.doctor || 'Dr. Rajesh Sharma'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Hospital Facility</span>
                        <strong style={{ fontSize: '13px', color: '#004D40' }}>
                          🏥 {selectedCourse.hospitalName || selectedCourse.hospital || 'District Civil Hospital'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {!timeline?.encounters || timeline.encounters.length === 0 ? (
                    <EmptyState title="No visits recorded yet." />
                  ) : (
                    <div style={{ position: 'relative', padding: '10px 4px 10px 10px' }}>
                      {/* Continuous Vertical Grey Track Line */}
                      <div
                        style={{
                          position: 'absolute',
                          left: '74px',
                          top: '20px',
                          bottom: '30px',
                          width: '3px',
                          backgroundColor: '#CBD5E1',
                          borderRadius: '2px',
                          zIndex: 1,
                        }}
                      />

                      {(() => {
                        const sorted = [...timeline.encounters].sort((a, b) => {
                          const dateA = new Date(a.visitDate || a.createdAt || 0);
                          const dateB = new Date(b.visitDate || b.createdAt || 0);
                          return dateB - dateA;
                        });

                        return sorted.map((enc, idx) => {
                          const encId = enc.id || idx;
                          const isLatest = idx === 0;
                          const isFirstIn = idx === sorted.length - 1;
                          const stationNum = sorted.length - idx;
                          const currentTab = stationActiveTab[encId];

                          const toggleTab = (tab) => {
                            setStationActiveTab((prev) => ({
                              ...prev,
                              [encId]: prev[encId] === tab ? null : tab,
                            }));
                          };

                          return (
                            <div
                              key={encId}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '16px',
                                marginBottom: idx === sorted.length - 1 ? '0' : '24px',
                                position: 'relative',
                              }}
                            >
                              {/* Left: Station Code & Distance */}
                              <div style={{ width: '60px', textAlign: 'right', flexShrink: 0, paddingTop: '1px' }}>
                                <div style={{ fontSize: '12.5px', fontWeight: '800', color: isLatest ? '#0284C7' : '#334155' }}>
                                  {`STN-${String(stationNum).padStart(2, '0')}`}
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: '600' }}>
                                  {isFirstIn ? '0.0 km' : `${(stationNum - 1) * 35}.0 km`}
                                </div>
                              </div>

                              {/* Dot on Left directly on the line */}
                              <div
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: isLatest ? '#16A34A' : isFirstIn ? '#D97706' : '#0D9488',
                                  border: '3.5px solid #FFFFFF',
                                  boxShadow: '0 0 0 2px #CBD5E1',
                                  flexShrink: 0,
                                  marginTop: '2px',
                                  zIndex: 2,
                                }}
                              />

                              {/* Right: Date Time on right, 2 Buttons, details */}
                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  background: isLatest ? '#F0FDF4' : '#FFFFFF',
                                  border: isLatest ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
                                  borderRadius: '12px',
                                  padding: '12px 14px',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
                                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                                    {isFirstIn ? '🏁 Initial Intake & Consultation' : isLatest ? '🟢 Latest Review & Checkpoint' : `🔄 Follow-Up Checkpoint Station #${stationNum}`}
                                  </div>
                                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
                                    📅 {formatLaymanDateTime(enc.visitDate || enc.createdAt)}
                                  </div>
                                </div>

                                <div style={{ fontSize: '11px', color: isLatest ? '#15803D' : '#B45309', fontWeight: '700', marginTop: '2px' }}>
                                  {isLatest ? 'Completed • On-Time Review' : isFirstIn ? 'First In (Origin Station)' : 'Follow-up Verified'}
                                </div>

                                {/* 2 Action Buttons */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => toggleTab('details')}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '8px',
                                      border: currentTab === 'details' ? '1.5px solid #004D40' : '1px solid #CBD5E1',
                                      backgroundColor: currentTab === 'details' ? '#E8F5E9' : '#FFFFFF',
                                      color: currentTab === 'details' ? '#004D40' : '#334155',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                    }}
                                  >
                                    <span>👁️ View Details</span>
                                    <span style={{ fontSize: '9px' }}>{currentTab === 'details' ? '▲' : '▼'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleTab('rx')}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '8px',
                                      border: currentTab === 'rx' ? '1.5px solid #1E40AF' : '1px solid #CBD5E1',
                                      backgroundColor: currentTab === 'rx' ? '#EFF6FF' : '#FFFFFF',
                                      color: currentTab === 'rx' ? '#1E40AF' : '#334155',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                    }}
                                  >
                                    <span>💊 Note &amp; Prescription</span>
                                    <span style={{ fontSize: '9px' }}>{currentTab === 'rx' ? '▲' : '▼'}</span>
                                  </button>
                                </div>

                                {/* Details Panel */}
                                {currentTab === 'details' && (
                                  <div style={{ marginTop: '10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '12px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {enc.chiefComplaint && <div><strong>Complaint:</strong> {enc.chiefComplaint}</div>}
                                    {enc.examinationFindings && <div><strong>Findings:</strong> {enc.examinationFindings}</div>}
                                    {enc.plan && <div style={{ background: '#ECFDF5', padding: '8px 10px', borderRadius: '6px', color: '#065F46' }}><strong>Plan:</strong> {enc.plan}</div>}
                                  </div>
                                )}

                                {/* Rx Panel */}
                                {currentTab === 'rx' && (
                                  <div style={{ marginTop: '10px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {enc.clinicalNotes && <div><strong>Doctor's Notes:</strong> {enc.clinicalNotes}</div>}
                                    {enc.prescriptions && enc.prescriptions.length > 0 ? (
                                      <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                                        {enc.prescriptions.map((p, pIdx) => (
                                          <li key={pIdx}>
                                            <strong>{p.medicineName || p.drugName}</strong> ({p.dosage}) &bull; {p.frequency} for {p.durationDays} days {p.instructions ? `- ${p.instructions}` : ''}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div style={{ fontStyle: 'italic', color: '#64748B' }}>No extra prescriptions at this station.</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </Card>

                {/* Documents */}}}
                <Card title="Diagnostic Documents & Reports">
                  {!timeline?.documents || timeline.documents.length === 0 ? (
                    <EmptyState title="No documents attached to this episode." />
                  ) : (
                    <Table
                      columns={[
                        { key: 'fileName', header: 'File Name' },
                        { key: 'docType', header: 'Type', render: (d) => <span className="badge badge-blue">{d.docType}</span> },
                        { key: 'fileSize', header: 'Size', render: (d) => `${Math.round((d.fileSize || 0) / 1024)} KB` },
                        { key: 'createdAt', header: 'Date', render: (d) => fmtDateTime(d.createdAt) },
                        {
                          key: 'actions',
                          header: '',
                          render: (d) => (
                            <Button size="sm" variant="secondary" onClick={() => downloadDoc(d.id, d.fileName)}>
                              Download
                            </Button>
                          ),
                        },
                      ]}
                      rows={timeline.documents}
                    />
                  )}
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
