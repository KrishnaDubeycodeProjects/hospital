import React, { useState } from 'react';
import { courseApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Textarea, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorCourses() {
  const [courseIdInput, setCourseIdInput] = useState('');
  const [activeCourse, setActiveCourse] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);

  // Document upload modal
  const [uploadModal, setUploadModal] = useState(false);
  const [docType, setDocType] = useState('lab_report');
  const [docNotes, setDocNotes] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // New encounter modal
  const [encounterModal, setEncounterModal] = useState(false);
  const [encounterForm, setEncounterForm] = useState({
    chiefComplaint: '',
    clinicalNotes: '',
    examinationFindings: '',
    plan: '',
  });
  const [savingEncounter, setSavingEncounter] = useState(false);

  const toast = useToast();

  async function loadCourse(id) {
    if (!id) return;
    setLoading(true);
    try {
      const c = await courseApi.get(id, 'DOCTOR');
      setActiveCourse(c);
      const t = await courseApi.timeline(id, 'DOCTOR');
      setTimeline(t);
    } catch (err) {
      toast.error(err.message || 'Course not found or access denied.');
      setActiveCourse(null);
      setTimeline(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (courseIdInput.trim()) {
      loadCourse(courseIdInput.trim());
    }
  }

  async function downloadDoc(docId, fileName) {
    try {
      const url = await fetchAsObjectUrl(courseApi.documentDownloadUrl(activeCourse.id, docId), 'DOCTOR');
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `document-${docId}`;
      a.click();
    } catch (err) {
      toast.error(err.message || 'Failed downloading document.');
    }
  }

  async function handleUploadDoc(e) {
    e.preventDefault();
    if (!file) {
      toast.error('Select a document to upload.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      if (docNotes) fd.append('notes', docNotes);
      await courseApi.uploadDocument(activeCourse.id, fd);
      toast.success('Document uploaded with Apache Tika inspection & SHA-256 fingerprint.');
      setUploadModal(false);
      setFile(null);
      setDocNotes('');
      loadCourse(activeCourse.id);
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAddEncounter(e) {
    e.preventDefault();
    if (!encounterForm.chiefComplaint.trim()) {
      toast.error('Chief complaint is required.');
      return;
    }
    setSavingEncounter(true);
    try {
      await courseApi.addEncounter(activeCourse.id, {
        chiefComplaint: encounterForm.chiefComplaint,
        clinicalNotes: encounterForm.clinicalNotes,
        examinationFindings: encounterForm.examinationFindings,
        plan: encounterForm.plan,
        prescriptions: [],
      });
      toast.success('Clinical encounter recorded.');
      setEncounterModal(false);
      setEncounterForm({ chiefComplaint: '', clinicalNotes: '', examinationFindings: '', plan: '' });
      loadCourse(activeCourse.id);
    } catch (err) {
      toast.error(err.message || 'Failed recording encounter.');
    } finally {
      setSavingEncounter(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Care Episodes & Longitudinal Courses</h1>
          <p className="muted-text">
            Search patient care courses to review clinical encounters, prescriptions, and Apache Tika-verified documents.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <form onSubmit={handleSearch} className="row-gap">
          <Field label="Lookup Care Episode by Course ID">
            <Input
              type="number"
              placeholder="e.g. 1"
              value={courseIdInput}
              onChange={(e) => setCourseIdInput(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" style={{ alignSelf: 'flex-end', minHeight: '48px' }}>
            Fetch Course Timeline
          </Button>
        </form>
      </Card>

      {loading && <Spinner label="Loading course records and timeline..." />}

      {!loading && !activeCourse && (
        <EmptyState
          title="No Course Selected"
          hint="Enter a valid Course ID above to view the patient's care timeline, documents, and referrals."
        />
      )}

      {!loading && activeCourse && (
        <div className="stack-lg">
          {/* Header Card */}
          <Card
            title={`Course #${activeCourse.id} — ${activeCourse.title}`}
            actions={
              <div className="row-gap">
                <Button size="sm" variant="secondary" onClick={() => setEncounterModal(true)}>
                  + Add Clinical Encounter
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setUploadModal(true)}>
                  📁 Attach Document
                </Button>
              </div>
            }
          >
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Patient</dt>
                <dd>{activeCourse.patientName} ({activeCourse.patientPhone})</dd>
              </div>
              <div className="detail-row">
                <dt>Department & Type</dt>
                <dd>{activeCourse.targetDepartment} &bull; <span className="badge badge-blue">{activeCourse.courseType}</span></dd>
              </div>
              <div className="detail-row">
                <dt>Primary Diagnosis</dt>
                <dd>{activeCourse.primaryDiagnosis || 'Under Investigation'}</dd>
              </div>
              <div className="detail-row">
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${activeCourse.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                    {activeCourse.status}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>

          {/* Longitudinal Timeline */}
          <Card title="Longitudinal Care Timeline">
            {!timeline?.encounters || timeline.encounters.length === 0 ? (
              <EmptyState title="No encounters recorded yet." />
            ) : (
              <div className="stack-md">
                {timeline.encounters.map((enc, idx) => (
                  <div
                    key={enc.id || idx}
                    style={{
                      borderLeft: '3px solid var(--primary)',
                      paddingLeft: '16px',
                      marginLeft: '8px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                        Encounter #{enc.id}: {enc.chiefComplaint}
                      </h4>
                      <span className="muted-text" style={{ fontSize: '12px' }}>
                        {fmtDateTime(enc.createdAt)}
                      </span>
                    </div>

                    {enc.clinicalNotes && (
                      <p style={{ margin: '6px 0 2px', fontSize: '13px' }}>
                        <strong>Notes:</strong> {enc.clinicalNotes}
                      </p>
                    )}
                    {enc.examinationFindings && (
                      <p style={{ margin: '2px 0', fontSize: '13px' }}>
                        <strong>Exam:</strong> {enc.examinationFindings}
                      </p>
                    )}
                    {enc.plan && (
                      <p style={{ margin: '2px 0 8px', fontSize: '13px', color: 'var(--primary)' }}>
                        <strong>Plan:</strong> {enc.plan}
                      </p>
                    )}

                    {/* Prescriptions */}
                    {enc.prescriptions && enc.prescriptions.length > 0 && (
                      <div style={{ background: 'var(--surface-sunken)', padding: '10px 14px', borderRadius: '8px', marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                          PRESCRIPTIONS (Rx)
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                          {enc.prescriptions.map((rx, rIdx) => (
                            <li key={rIdx}>
                              <strong>{rx.drugName}</strong> {rx.dosage} &bull; {rx.frequency} for {rx.durationDays} days ({rx.instructions || 'as advised'})
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

          {/* Documents Vault */}
          <Card title="Diagnostic Documents & Imaging Vault">
            {!timeline?.documents || timeline.documents.length === 0 ? (
              <EmptyState title="No documents attached to this care course." />
            ) : (
              <Table
                columns={[
                  { key: 'fileName', header: 'File Name' },
                  { key: 'docType', header: 'Type', render: (d) => <span className="badge badge-blue">{d.docType}</span> },
                  { key: 'fileHash', header: 'SHA-256 Fingerprint', render: (d) => <code style={{ fontSize: '11px' }}>{d.fileHash ? d.fileHash.slice(0, 16) + '...' : '—'}</code> },
                  { key: 'fileSize', header: 'Size', render: (d) => `${Math.round((d.fileSize || 0) / 1024)} KB` },
                  { key: 'createdAt', header: 'Uploaded', render: (d) => fmtDateTime(d.createdAt) },
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
      )}

      {/* Upload Document Modal */}
      {uploadModal && (
        <Modal title="Attach Diagnostic Document" onClose={() => setUploadModal(false)}>
          <form onSubmit={handleUploadDoc} className="stack-md">
            <Field label="Document Classification">
              <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="lab_report">Lab / Blood Report</option>
                <option value="prescription">Rx Prescription Slip</option>
                <option value="discharge_summary">Discharge Summary</option>
                <option value="radiology_scan">Radiology / X-Ray / CT Scan</option>
                <option value="consent_form">Informed Consent Form</option>
              </Select>
            </Field>

            <Field label="Clinical Notes / Observation (Optional)">
              <Input
                placeholder="e.g. Pre-operative fasting blood panel"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
              />
            </Field>

            <Field label="Select File (Magic-byte inspected, max 10MB)">
              <input
                type="file"
                className="input"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </Field>

            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button type="button" variant="ghost" onClick={() => setUploadModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={uploading}>
                Upload & Verify Hash
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Encounter Modal */}
      {encounterModal && (
        <Modal title="Record Follow-up Encounter" onClose={() => setEncounterModal(false)}>
          <form onSubmit={handleAddEncounter} className="stack-md">
            <Field label="Chief Complaint *">
              <Input
                value={encounterForm.chiefComplaint}
                onChange={(e) => setEncounterForm((f) => ({ ...f, chiefComplaint: e.target.value }))}
                required
              />
            </Field>
            <Field label="Clinical Notes">
              <Textarea
                rows={2}
                value={encounterForm.clinicalNotes}
                onChange={(e) => setEncounterForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
              />
            </Field>
            <Field label="Examination Findings">
              <Textarea
                rows={2}
                value={encounterForm.examinationFindings}
                onChange={(e) => setEncounterForm((f) => ({ ...f, examinationFindings: e.target.value }))}
              />
            </Field>
            <Field label="Management Plan">
              <Input
                value={encounterForm.plan}
                onChange={(e) => setEncounterForm((f) => ({ ...f, plan: e.target.value }))}
              />
            </Field>
            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button type="button" variant="ghost" onClick={() => setEncounterModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={savingEncounter}>
                Save Encounter
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
