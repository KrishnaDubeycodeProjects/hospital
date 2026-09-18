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

                {/* Timeline */}
                <Card title="Consultation History & Prescriptions">
                  {!timeline?.encounters || timeline.encounters.length === 0 ? (
                    <EmptyState title="No encounters recorded yet." />
                  ) : (
                    <div className="stack-md">
                      {timeline.encounters.map((enc) => (
                        <div
                          key={enc.id}
                          style={{
                            borderLeft: '3px solid var(--primary)',
                            paddingLeft: '16px',
                            marginLeft: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '15px' }}>{enc.chiefComplaint}</strong>
                            <span className="muted-text" style={{ fontSize: '12px' }}>
                              {fmtDateTime(enc.createdAt)}
                            </span>
                          </div>

                          {enc.clinicalNotes && (
                            <p style={{ margin: '6px 0 2px', fontSize: '13px' }}>
                              <strong>Doctor's Notes:</strong> {enc.clinicalNotes}
                            </p>
                          )}
                          {enc.plan && (
                            <p style={{ margin: '2px 0 8px', fontSize: '13px', color: 'var(--primary)' }}>
                              <strong>Plan:</strong> {enc.plan}
                            </p>
                          )}

                          {enc.prescriptions && enc.prescriptions.length > 0 && (
                            <div style={{ background: 'var(--surface-sunken)', padding: '10px 14px', borderRadius: '8px', marginTop: '8px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Medications (Rx)
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                                {enc.prescriptions.map((p, idx) => (
                                  <li key={idx}>
                                    <strong>{p.drugName}</strong> ({p.dosage}) &bull; {p.frequency} for {p.durationDays} days {p.instructions ? `- ${p.instructions}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Documents */}
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
