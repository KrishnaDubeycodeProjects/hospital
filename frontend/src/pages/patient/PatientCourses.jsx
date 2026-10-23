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
            Longitudinal health records across your visits, including doctor encounter notes, prescriptions, and lab documents.
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

                {/* Checkpoint Station Stack */}
                <Card title="Checkpoint Station Stack & Follow-ups">
                  {!timeline?.encounters || timeline.encounters.length === 0 ? (
                    <EmptyState title="No encounters recorded yet." />
                  ) : (
                    <div className="stack-md">
                      <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                        <strong style={{ color: '#0F766E' }}>📍 Checkpoint Stations ({timeline.encounters.length})</strong>
                        <span>First In at Last Place &bull; Latest on Top</span>
                      </div>
                      {(() => {
                        const sorted = [...timeline.encounters].sort((a, b) => {
                          const dateA = new Date(a.visitDate || a.createdAt || 0);
                          const dateB = new Date(b.visitDate || b.createdAt || 0);
                          return dateB - dateA;
                        });

                        return sorted.map((enc, idx) => {
                          const isLatest = idx === 0;
                          const isFirstIn = idx === sorted.length - 1;
                          const stationNum = sorted.length - idx;

                          return (
                            <div
                              key={enc.id || idx}
                              style={{
                                background: isLatest ? '#F0FDF4' : '#F8FAFC',
                                border: isLatest ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ backgroundColor: isLatest ? '#15803D' : '#0F766E', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '3px 9px', borderRadius: '10px' }}>
                                    Station #{stationNum}
                                  </span>
                                  <strong style={{ fontSize: '14px', color: isLatest ? '#15803D' : '#0F172A' }}>
                                    {isFirstIn ? 'Initial Consultation (First In)' : isLatest ? 'Latest Follow-up Station' : 'Care Review Checkpoint'}
                                  </strong>
                                </div>
                                <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '600' }}>
                                  📅 {formatLaymanDateTime(enc.visitDate || enc.createdAt)}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px', background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <div>
                                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Doctor</span>
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                                    👨‍⚕️ {enc.doctorName || enc.doctor || 'Dr. Rajesh Sharma'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Hospital Facility</span>
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#004D40' }}>
                                    🏥 {enc.hospitalName || enc.hospital || 'District Civil Hospital'}
                                  </span>
                                </div>
                              </div>

                              {enc.chiefComplaint && (
                                <div style={{ fontSize: '13px', color: '#0F172A' }}>
                                  <strong>Reason for Encounter:</strong> {enc.chiefComplaint}
                                </div>
                              )}

                              {enc.clinicalNotes && (
                                <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.4 }}>
                                  <strong>Doctor's Notes:</strong> {enc.clinicalNotes}
                                </div>
                              )}

                              {enc.plan && (
                                <div style={{ fontSize: '12px', color: '#065F46', background: '#ECFDF5', padding: '8px 12px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                                  🎯 <strong>Plan:</strong> {enc.plan}
                                </div>
                              )}

                              {enc.prescriptions && enc.prescriptions.length > 0 && (
                                <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#1E40AF', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Rx Prescribed at Station #{stationNum}
                                  </div>
                                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px' }}>
                                    {enc.prescriptions.map((p, pIdx) => (
                                      <li key={pIdx}>
                                        <strong>{p.medicineName || p.drugName}</strong> ({p.dosage}) &bull; {p.frequency} for {p.durationDays} days {p.instructions ? `- ${p.instructions}` : ''}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </Card>

                {/* Documents */}}
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
