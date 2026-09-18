import React, { useEffect, useState } from 'react';
import { courseApi, fetchAsObjectUrl, hospitalApi, patientApi, referralApi } from '../../api/client';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientRecordsHub() {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'courses' | 'referrals' | 'history'

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Unified Health Records Hub</h1>
          <p className="muted-text">
            Longitudinal medical history, prescriptions, diagnostic reports, and hospital referral passes.
          </p>
        </div>
      </div>

      {/* 4 Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`pill-toggle-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          📄 Prescriptions & Reports
        </button>
        <button
          type="button"
          className={`pill-toggle-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          🩺 Care Episodes
        </button>
        <button
          type="button"
          className={`pill-toggle-btn ${activeTab === 'referrals' ? 'active' : ''}`}
          onClick={() => setActiveTab('referrals')}
        >
          🔄 Referral Slips
        </button>
        <button
          type="button"
          className={`pill-toggle-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 Visit History
        </button>
      </div>

      {activeTab === 'documents' && <DocumentsTab />}
      {activeTab === 'courses' && <CoursesTab />}
      {activeTab === 'referrals' && <ReferralsTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

// ------------------------------------------------------------- TAB 1: Documents
function DocumentsTab() {
  const [docs, setDocs] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState({ file: null, docType: 'prescription', patientName: '', patientAge: '', hospitalId: '' });
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      setDocs(await patientApi.documents());
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
    hospitalApi.list().then(setHospitals).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.file) {
      toast.error('Choose a file first.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('docType', form.docType);
      fd.append('patientName', form.patientName);
      if (form.patientAge) fd.append('patientAge', form.patientAge);
      if (form.hospitalId) fd.append('hospitalId', form.hospitalId);
      await patientApi.uploadDocument(fd);
      toast.success('Document uploaded.');
      setForm({ file: null, docType: 'prescription', patientName: '', patientAge: '', hospitalId: '' });
      e.target.reset();
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function view(id) {
    try {
      const url = await fetchAsObjectUrl(patientApi.documentFileUrl(id), 'PATIENT');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="stack-md">
      <Card title="Upload Prescription / Diagnostic Report">
        <form onSubmit={submit} className="stack-md">
          <div className="field-row">
            <Field label="Document Type">
              <Select value={form.docType} onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}>
                <option value="prescription">Prescription</option>
                <option value="lab_report">Lab Report</option>
                <option value="discharge_summary">Discharge Summary</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Issuing Hospital (optional)">
              <Select value={form.hospitalId} onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))}>
                <option value="">(None / Other)</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Patient Name (optional, defaults to profile)">
              <Input
                value={form.patientName}
                onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
                placeholder="Ram Kumar"
              />
            </Field>
            <Field label="Patient Age (optional)">
              <Input
                type="number"
                value={form.patientAge}
                onChange={(e) => setForm((f) => ({ ...f, patientAge: e.target.value }))}
                placeholder="42"
              />
            </Field>
          </div>
          <Field label="File (PDF, PNG, JPG, max 10MB)">
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={(e) => setForm((f) => ({ ...f, file: e.target.files[0] || null }))}
              required
            />
          </Field>
          <Button type="submit" loading={uploading}>
            Upload Document
          </Button>
        </form>
      </Card>

      <Card title="Uploaded Medical Documents">
        {docs === null ? (
          <Spinner />
        ) : (
          <Table
            columns={[
              { key: 'docType', header: 'Type', render: (r) => <Badge tone="blue">{r.docType}</Badge> },
              { key: 'fileName', header: 'File' },
              { key: 'createdAt', header: 'Uploaded', render: (r) => fmtDateTime(r.createdAt) },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <Button size="sm" variant="secondary" onClick={() => view(r.id)}>
                    View / Download
                  </Button>
                ),
              },
            ]}
            rows={docs}
            emptyText="No documents uploaded yet."
          />
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------- TAB 2: Courses
function CoursesTab() {
  const [courses, setCourses] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
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
      toast.error(err.message || 'Failed downloading document.');
    }
  }

  if (courses === null) return <Spinner label="Loading care episodes..." />;

  return (
    <div className="stack-md">
      {!courses || courses.length === 0 ? (
        <EmptyState
          title="No Care Episodes Yet"
          hint="Longitudinal episodes of care (like TB treatment, ANC, or chronic hypertension management) will appear here once initiated by your consulting physician."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '20px' }}>
          {/* Courses List */}
          <div className="stack-sm">
            <h3 style={{ fontSize: '15px', color: '#64748b' }}>Active Episodes</h3>
            {courses.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCourse(c)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: selectedCourse?.id === c.id ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  backgroundColor: selectedCourse?.id === c.id ? '#EFF6FF' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#0F172A' }}>{c.department}</span>
                  <Badge tone={c.status === 'active' ? 'green' : 'gray'}>{c.status}</Badge>
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                  Diagnosis: <strong>{c.diagnosis || 'Clinical evaluation'}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                  Started: {fmtDateTime(c.createdAt)}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div>
            {selectedCourse ? (
              <Card title={`Timeline: ${selectedCourse.department} (${selectedCourse.diagnosis || ''})`}>
                {loadingTimeline ? (
                  <Spinner label="Loading timeline..." />
                ) : !timeline ? (
                  <EmptyState title="No timeline records" />
                ) : (
                  <div className="stack-md">
                    {/* Encounters */}
                    {timeline.encounters && timeline.encounters.length > 0 && (
                      <div className="stack-sm">
                        <h4>Consultation Encounters ({timeline.encounters.length})</h4>
                        {timeline.encounters.map((enc) => (
                          <div key={enc.id} style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <strong>{fmtDateTime(enc.createdAt)}</strong>
                              <span style={{ color: '#0284C7' }}>Dr. ID #{enc.doctorId}</span>
                            </div>
                            {enc.chiefComplaint && (
                              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                                <strong>Chief Complaint:</strong> {enc.chiefComplaint}
                              </div>
                            )}
                            {enc.clinicalNotes && (
                              <div style={{ fontSize: '13px', marginTop: '2px', color: '#475569' }}>
                                <strong>Notes:</strong> {enc.clinicalNotes}
                              </div>
                            )}
                            {enc.carePlan && (
                              <div style={{ fontSize: '13px', marginTop: '2px', color: '#059669' }}>
                                <strong>Plan:</strong> {enc.carePlan}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prescriptions */}
                    {timeline.prescriptions && timeline.prescriptions.length > 0 && (
                      <div className="stack-sm">
                        <h4>Prescriptions ({timeline.prescriptions.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {timeline.prescriptions.map((rx) => (
                            <div key={rx.id} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '10px' }}>
                              <div style={{ fontWeight: '600', color: '#166534' }}>
                                💊 {rx.drugName} {rx.dosage && `(${rx.dosage})`}
                              </div>
                              <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px' }}>
                                Frequency: {rx.frequency || 'As advised'} · Duration: {rx.durationDays ? `${rx.durationDays} days` : 'Ongoing'}
                                {rx.instructions && ` · Instructions: ${rx.instructions}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    {timeline.documents && timeline.documents.length > 0 && (
                      <div className="stack-sm">
                        <h4>Attached Medical Records ({timeline.documents.length})</h4>
                        {timeline.documents.map((doc) => (
                          <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '10px' }}>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '13px' }}>📎 {doc.documentType || 'Clinical Record'}</div>
                              <div style={{ fontSize: '11px', color: '#94A3B8' }}>{fmtDateTime(doc.createdAt)}</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => downloadDoc(doc.id, doc.fileName)}>
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <EmptyState title="Select a care episode to view full longitudinal timeline" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- TAB 3: Referrals
function ReferralsTab() {
  const [referrals, setReferrals] = useState(null);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const toast = useToast();

  useEffect(() => {
    referralApi
      .patientReferrals()
      .then(setReferrals)
      .catch((err) => toast.error(err.message || 'Failed loading referrals'));
  }, [toast]);

  function getPriorityBadge(tier) {
    if (tier?.includes('emergency')) {
      return <span className="badge badge-red">🚨 Emergency (24h)</span>;
    }
    if (tier?.includes('urgent')) {
      return <span className="badge badge-amber">⚡ Urgent (7-Day Quota)</span>;
    }
    return <span className="badge badge-blue">Routine (30-Day)</span>;
  }

  if (referrals === null) return <Spinner label="Loading referral slips..." />;

  return (
    <div className="stack-md">
      {!referrals || referrals.length === 0 ? (
        <EmptyState
          title="No Referrals Issued"
          hint="When a consulting physician issues an inter-facility referral slip, it will appear here with an admission QR pass."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {referrals.map((r) => (
            <div
              key={r.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0284C7' }}>
                  Pass #{r.id}
                </span>
                {getPriorityBadge(r.priorityTier)}
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Referred Destination</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                  🏥 {r.toHospitalName || `Facility #${r.toHospitalId}`}
                </div>
                <div style={{ fontSize: '13px', color: '#2563EB', fontWeight: '500' }}>
                  Dept: {r.department}
                </div>
              </div>

              {r.reason && (
                <div style={{ fontSize: '13px', color: '#475569', backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '8px' }}>
                  <strong>Reason:</strong> {r.reason}
                </div>
              )}

              <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                Valid until: <strong>{r.validUntil ? new Date(r.validUntil).toLocaleDateString('en-IN') : 'Open'}</strong>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedSlip(r)}
                style={{ marginTop: 'auto' }}
              >
                🎟️ View QR Admission Pass
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* QR Pass Modal */}
      {selectedSlip && (
        <Modal title="Referral Admission QR Pass" onClose={() => setSelectedSlip(null)}>
          <div style={{ textAlign: 'center', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#0F172A' }}>
              {selectedSlip.toHospitalName}
            </div>
            {getPriorityBadge(selectedSlip.priorityTier)}
            <img
              src={referralApi.qrUrl(selectedSlip.id)}
              alt="Referral QR Pass"
              style={{ width: '220px', height: '220px', borderRadius: '16px', border: '1px solid #CBD5E1', padding: '8px', background: '#ffffff' }}
            />
            <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '280px', margin: 0 }}>
              Present this pass at the Priority Referral Desk of the receiving hospital for expedited admission.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------- TAB 4: History
function HistoryTab() {
  const [rows, setRows] = useState(null);
  const toast = useToast();

  useEffect(() => {
    patientApi
      .history()
      .then(setRows)
      .catch((err) => toast.error(err.message));
  }, [toast]);

  const columns = [
    { key: 'id', header: 'Visit ID' },
    { key: 'name', header: 'Name', render: (r) => r.name || '—' },
    { key: 'age', header: 'Age', render: (r) => r.age ?? '—' },
    { key: 'category', header: 'Department', render: (r) => r.category || '—' },
    { key: 'servedAt', header: 'Served', render: (r) => fmtDateTime(r.servedAt) },
    { key: 'completedAt', header: 'Completed', render: (r) => fmtDateTime(r.completedAt) },
  ];

  return (
    <Card>
      {rows ? <Table columns={columns} rows={rows} emptyText="No past visits found." /> : <Spinner />}
    </Card>
  );
}
