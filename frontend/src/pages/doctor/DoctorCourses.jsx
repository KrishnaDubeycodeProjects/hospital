import React, { useEffect, useState } from 'react';
import { abdmApi, courseApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Textarea, fmtDateTime } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function DoctorCourses() {
  const { doctor } = useAuth();
  const currentDoctorId = doctor?.doctorId;
  const toast = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [patientList, setPatientList] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientCourses, setPatientCourses] = useState([]);

  // Active selected course
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [activeCourse, setActiveCourse] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(false);

  // View Data Modal
  const [fhirModal, setFhirModal] = useState(false);
  const [fhirBundle, setFhirBundle] = useState(null);
  const [loadingFhir, setLoadingFhir] = useState(false);
  const [fhirTitle, setFhirTitle] = useState('');

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

  // Document Seen tracking (persisted in localStorage per doctor)
  const seenStorageKey = `doctor_seen_docs_${currentDoctorId || 'default'}`;
  const [seenDocs, setSeenDocs] = useState(() => {
    try {
      const saved = localStorage.getItem(seenStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  function markDocAsSeen(docId) {
    const updated = { ...seenDocs, [docId]: new Date().toISOString() };
    setSeenDocs(updated);
    try {
      localStorage.setItem(seenStorageKey, JSON.stringify(updated));
    } catch {
      // storage unavailable
    }
  }

  // Load all recent courses on initial mount to group by patient
  async function loadInitialCourses(query = '') {
    setSearching(true);
    try {
      const results = await courseApi.search(query);
      const courses = Array.isArray(results) ? results : [];

      // Group courses by patient (phone + name)
      const patientMap = new Map();
      courses.forEach((c) => {
        const key = c.patientPhone || `patient-${c.id}`;
        if (!patientMap.has(key)) {
          patientMap.set(key, {
            phone: c.patientPhone,
            name: c.patientName || 'Anonymous Patient',
            courses: [],
          });
        }
        patientMap.get(key).courses.push(c);
      });

      const grouped = Array.from(patientMap.values());
      setPatientList(grouped);

      // If user searched and we found exact matches, select first patient
      if (query.trim() && grouped.length === 1) {
        selectPatient(grouped[0]);
      }
    } catch (err) {
      console.warn('Course search fallback:', err);
      toast.error('Unable to load care episodes');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    loadInitialCourses('');
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadInitialCourses(searchQuery);
  }

  function selectPatient(pt) {
    setSelectedPatient(pt);
    setPatientCourses(pt.courses || []);
    if (pt.courses && pt.courses.length > 0) {
      loadCourse(pt.courses[0].id);
    } else {
      setActiveCourse(null);
      setTimeline(null);
    }
  }

  async function loadCourse(id) {
    if (!id) return;
    setActiveCourseId(id);
    setLoadingCourse(true);
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
      setLoadingCourse(false);
    }
  }

  async function downloadDoc(docId, fileName) {
    markDocAsSeen(docId);
    try {
      const url = await fetchAsObjectUrl(courseApi.documentDownloadUrl(activeCourse.id, docId), 'DOCTOR');
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `document-${docId}`;
      a.click();
      toast.success('Document downloaded successfully');
    } catch (err) {
      toast.error(err.message || 'Failed downloading document.');
    }
  }

  async function viewDocInTab(docId) {
    markDocAsSeen(docId);
    try {
      const url = await fetchAsObjectUrl(courseApi.documentDownloadUrl(activeCourse.id, docId), 'DOCTOR');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.message || 'Failed opening document');
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
      toast.success('Document uploaded with SHA-256 fingerprint.');
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

  // View Data Direct Access
  async function openFhirBundle(courseId, encounterId = null, title = 'Course View Data') {
    setLoadingFhir(true);
    setFhirTitle(title);
    setFhirModal(true);
    try {
      let bundle;
      if (encounterId) {
        bundle = await abdmApi.getEncounterFhir(courseId, encounterId);
      } else {
        bundle = await abdmApi.getCourseFhir(courseId);
      }
      setFhirBundle(bundle);
    } catch (err) {
      console.warn('FHIR bundle load error:', err);
      toast.error('Could not load live FHIR bundle, showing structured export');
      // Structured fallback NRCES bundle
      setFhirBundle({
        resourceType: 'Bundle',
        id: `bundle-course-${courseId}`,
        type: 'document',
        meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle'] },
        timestamp: new Date().toISOString(),
        courseId: courseId,
        patientName: activeCourse?.patientName,
        encountersCount: timeline?.encounters?.length || 0,
        documentsCount: timeline?.documents?.length || 0,
      });
    } finally {
      setLoadingFhir(false);
    }
  }

  function copyFhirJson() {
    if (!fhirBundle) return;
    navigator.clipboard?.writeText(JSON.stringify(fhirBundle, null, 2));
    toast.success('FHIR R4 JSON copied to clipboard');
  }

  function downloadFhirJson() {
    if (!fhirBundle) return;
    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-r4-bundle-course-${activeCourse?.id || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('FHIR Bundle JSON downloaded');
  }

  return (
    <div className="stack-lg">
      {/* Header */}
      <div className="card-head">
        <div>
          <h1>Patient Treatments & Visit History</h1>
          <p className="muted-text">
            Search for a patient to view their past visits, medical notes, prescriptions, and test reports.
          </p>
        </div>
      </div>

      {/* Patient Search Bar */}
      <Card>
        <form onSubmit={handleSearchSubmit} className="row-gap" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <Field label="Search Patient (Name, Phone Number, Course Title, or Diagnosis)">
              <Input
                placeholder="e.g. Ramesh, 9876543210, Hypertension, or Orthopedics"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" loading={searching} style={{ minHeight: '44px' }}>
            Search Patient
          </Button>
          {searchQuery && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                loadInitialCourses('');
              }}
              style={{ minHeight: '44px' }}
            >
              Clear
            </Button>
          )}
        </form>
      </Card>

      {/* Patient Results Grid / Course Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '20px', alignItems: 'start' }} className="responsive-split">
        {/* Left Column: Matched Patients & Courses List */}
        <div className="stack-md">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              Patients ({patientList.length})
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Select patient to open courses
            </span>
          </div>

          {searching ? (
            <Spinner label="Searching patient courses..." />
          ) : patientList.length === 0 ? (
            <Card>
              <EmptyState title="No patients found" hint="Try searching by a different name, phone, or diagnosis." />
            </Card>
          ) : (
            <div className="stack-sm" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {patientList.map((pt) => {
                const isSelected = selectedPatient?.phone === pt.phone;
                return (
                  <div
                    key={pt.phone}
                    onClick={() => selectPatient(pt)}
                    style={{
                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                      border: `1.5px solid ${isSelected ? '#3B82F6' : '#E2E8F0'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{pt.name}</strong>
                      <span className="badge badge-blue" style={{ fontSize: '11px' }}>
                        {pt.courses.length} {pt.courses.length === 1 ? 'Course' : 'Courses'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px' }}>
                      {pt.phone}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                      Latest: <em>{pt.courses[0]?.title || 'Care Episode'}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* If patient selected, show their full list of courses */}
          {selectedPatient && (
            <div className="stack-sm" style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                Courses for {selectedPatient.name}
              </span>
              <div className="stack-xs">
                {patientCourses.map((c) => {
                  const isCourseActive = activeCourseId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => loadCourse(c.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${isCourseActive ? '#2563EB' : '#CBD5E1'}`,
                        backgroundColor: isCourseActive ? '#DBEAFE' : '#F8FAFC',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: '#1E293B' }}>
                          Course #{c.id}: {c.title}
                        </strong>
                        <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '10px' }}>
                          {c.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                        {c.targetDepartment} &bull; {c.primaryDiagnosis || 'Clinical Episode'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Longitudinal Timeline & Detail of Selected Course */}
        <div>
          {loadingCourse && <Spinner label="Loading visit history and records..." />}

          {!loadingCourse && !activeCourse && (
            <Card>
              <EmptyState
                title="No Course Selected"
                hint="Select a patient from the left panel to see their visits, doctor notes, prescriptions, and test reports."
              />
            </Card>
          )}

          {!loadingCourse && activeCourse && (
            <div className="stack-lg">
              {/* Course Detail Card */}
              <Card
                title={`Course #${activeCourse.id} — ${activeCourse.title}`}
                actions={
                  <div className="row-gap">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => openFhirBundle(activeCourse.id, null, `Course #${activeCourse.id} View Data`)}
                    >
                      View Record Data
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEncounterModal(true)}>
                      Add Visit Note
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setUploadModal(true)}>
                      Upload Document
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
                    <dt>Department & Course Type</dt>
                    <dd>{activeCourse.targetDepartment} &bull; <span className="badge badge-blue">{activeCourse.courseType}</span></dd>
                  </div>
                  <div className="detail-row">
                    <dt>Primary Diagnosis</dt>
                    <dd>{activeCourse.primaryDiagnosis || 'Under Active Clinical Evaluation'}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Course Status</dt>
                    <dd>
                      <span className={`badge ${activeCourse.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {activeCourse.status}
                      </span>
                    </dd>
                  </div>
                  {activeCourse.startedByDoctorName && (
                    <div className="detail-row">
                      <dt>Initiating Doctor</dt>
                      <dd>{activeCourse.startedByDoctorName}</dd>
                    </div>
                  )}
                  {activeCourse.startedAtHospitalName && (
                    <div className="detail-row">
                      <dt>Hospital Facility</dt>
                      <dd>{activeCourse.startedAtHospitalName}</dd>
                    </div>
                  )}
                </dl>
              </Card>

              {/* Visit & Treatment Timeline */}
              <Card
                title="Visit & Treatment Timeline"
                extra={
                  <span className="badge badge-green">
                    {timeline?.encounters?.length || 0} Visits Recorded
                  </span>
                }
              >
                {!timeline?.encounters || timeline.encounters.length === 0 ? (
                  <EmptyState title="No encounters recorded yet." hint="Use 'Add Visit Note' above to log a clinical follow-up or OPD note." />
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                            Visit #{enc.id}: {enc.chiefComplaint}
                          </h4>
                          <div className="row-gap" style={{ alignItems: 'center' }}>
                            <span className="muted-text" style={{ fontSize: '12px' }}>
                              {fmtDateTime(enc.createdAt || enc.visitDate)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openFhirBundle(activeCourse.id, enc.id, `Visit #${enc.id} View Data`)}
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                            >
                              View Data
                            </Button>
                          </div>
                        </div>

                        {enc.doctorName && (
                          <div style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 6px' }}>
                            Attending Doctor: <strong>{enc.doctorName}</strong> {enc.hospitalName ? `(${enc.hospitalName})` : ''}
                          </div>
                        )}

                        {enc.clinicalNotes && (
                          <p style={{ margin: '6px 0 2px', fontSize: '13px', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                            <strong>Clinical Notes:</strong> {enc.clinicalNotes}
                          </p>
                        )}
                        {enc.examinationFindings && (
                          <p style={{ margin: '2px 0', fontSize: '13px', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                            <strong>Exam Findings:</strong> {enc.examinationFindings}
                          </p>
                        )}
                        {enc.plan && (
                          <p style={{ margin: '2px 0 8px', fontSize: '13px', color: 'var(--primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                            <strong>Management Plan:</strong> {enc.plan}
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
                                  <strong>{rx.drugName || rx.medicineName}</strong> {rx.dosage} &bull; {rx.frequency} for {rx.durationDays} days ({rx.instructions || 'as advised'})
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

              {/* Diagnostic Documents & Imaging Vault */}
              <Card
                title="Diagnostic Documents & Case Records"
                extra={
                  <span className="badge badge-blue">
                    {timeline?.documents?.length || 0} Documents Attached
                  </span>
                }
              >
                {!timeline?.documents || timeline.documents.length === 0 ? (
                  <EmptyState title="No documents attached to this care course." hint="Use 'Upload Document' above to upload lab reports, discharge summaries, or imaging files." />
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <Table
                    columns={[
                      { 
                        key: 'fileName', 
                        header: 'File Name',
                        render: (d) => (
                          <span style={{ fontWeight: 600, color: '#0f172a', minWidth: '200px', display: 'inline-block' }}>
                            {d.fileName}
                          </span>
                        )
                      },
                      { key: 'docType', header: 'Classification', render: (d) => <span className="badge badge-blue" style={{ whiteSpace: 'nowrap' }}>{d.docType}</span> },
                      {
                        key: 'uploader',
                        header: 'Uploaded By',
                        render: (d) => {
                          const isUploadedByMe = currentDoctorId && d.uploadedByDoctorId === currentDoctorId;
                          if (isUploadedByMe) {
                            return <span className="badge badge-green" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>Uploaded by You</span>;
                          }
                          if (d.uploadedByDoctorName) {
                            return <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>Dr. {d.uploadedByDoctorName}</span>;
                          }
                          if (d.uploadedByDoctorId) {
                            return <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>Doctor #{d.uploadedByDoctorId}</span>;
                          }
                          return <span className="badge badge-gray" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>Uploaded by Patient</span>;
                        },
                      },
                      {
                        key: 'seenStatus',
                        header: 'Seen Status',
                        render: (d) => {
                          const seenTimestamp = seenDocs[d.id];
                          if (seenTimestamp) {
                            return (
                              <span className="badge badge-green" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                Seen by You ({fmtDateTime(seenTimestamp)})
                              </span>
                            );
                          }
                          return (
                            <span className="badge badge-amber" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                              Unseen / New
                            </span>
                          );
                        },
                      },
                      { key: 'fileSize', header: 'Size', render: (d) => <span style={{ whiteSpace: 'nowrap' }}>{`${Math.round((d.fileSize || 0) / 1024)} KB`}</span> },
                      { key: 'createdAt', header: 'Uploaded Date', render: (d) => <span style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#475569' }}>{fmtDateTime(d.createdAt)}</span> },
                      {
                        key: 'actions',
                        header: 'Actions',
                        render: (d) => (
                          <div className="row-gap" style={{ whiteSpace: 'nowrap' }}>
                            <Button size="sm" variant="secondary" onClick={() => viewDocInTab(d.id)}>
                              View File
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => downloadDoc(d.id, d.fileName)}>
                              Download
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                    rows={timeline.documents}
                  />
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* View Record Data Modal */}
      {fhirModal && (
        <Modal title={fhirTitle || 'Official ABDM FHIR R4 Document Bundle'} onClose={() => setFhirModal(false)}>
          <div className="stack-md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                NRCES Profile: <code>DocumentBundle (OPConsultRecord)</code>
              </span>
              <div className="row-gap">
                <Button size="sm" variant="secondary" onClick={copyFhirJson}>
                  Copy JSON
                </Button>
                <Button size="sm" variant="primary" onClick={downloadFhirJson}>
                  Download Bundle (.json)
                </Button>
              </div>
            </div>

            {loadingFhir ? (
              <Spinner label="Generating official FHIR R4 JSON bundle..." />
            ) : (
              <pre
                style={{
                  backgroundColor: '#0F172A',
                  color: '#F8FAFC',
                  padding: '16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  maxHeight: '450px',
                  overflowY: 'auto',
                  fontFamily: 'Consolas, monospace',
                }}
              >
                {JSON.stringify(fhirBundle, null, 2)}
              </pre>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setFhirModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
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

            <Field label="Select File (PDF or Image, max 10MB)">
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
                Upload Document
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Visit Note Modal */}
      {encounterModal && (
        <Modal title="Record Follow-up Visit" onClose={() => setEncounterModal(false)}>
          <form onSubmit={handleAddEncounter} className="stack-md">
            <Field label="Main Health Concern / Symptoms *">
              <Input
                value={encounterForm.chiefComplaint}
                onChange={(e) => setEncounterForm((f) => ({ ...f, chiefComplaint: e.target.value }))}
                required
              />
            </Field>
            <Field label="Doctor's Notes">
              <Textarea
                rows={2}
                value={encounterForm.clinicalNotes}
                onChange={(e) => setEncounterForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
              />
            </Field>
            <Field label="Physical Checkup Findings">
              <Textarea
                rows={2}
                value={encounterForm.examinationFindings}
                onChange={(e) => setEncounterForm((f) => ({ ...f, examinationFindings: e.target.value }))}
              />
            </Field>
            <Field label="Treatment Plan">
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
                Save Visit Note
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
