import React, { useEffect, useState } from 'react';
import { courseApi, doctorApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Textarea, fmtDateTime } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  Plus,
  FileText,
  Upload,
  Eye,
  CheckCircle2,
  Calendar,
  Building2,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  ShieldCheck,
  Send,
  Lock,
  Unlock,
  Pill
} from 'lucide-react';

export default function DoctorCourses() {
  const { doctor } = useAuth();
  const currentDoctorId = doctor?.doctorId;
  const toast = useToast();

  // Search & Patient selection
  const [searchQuery, setSearchQuery] = useState('');
  const [patientList, setPatientList] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatientPhone, setSelectedPatientPhone] = useState(null);

  // Active courses map for inline expansion
  const [patientCourses, setPatientCourses] = useState({});
  const [courseTimelines, setCourseTimelines] = useState({});
  const [loadingTimelines, setLoadingTimelines] = useState({});

  // Document upload inline state
  const [uploadModal, setUploadModal] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [docType, setDocType] = useState('prescription');
  const [docNotes, setDocNotes] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Document Preview modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // New Course Modal
  const [createCourseModal, setCreateCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseType, setNewCourseType] = useState('acute');
  const [creatingCourse, setCreatingCourse] = useState(false);

  // New Prescription / Encounter Modal
  const [encounterModal, setEncounterModal] = useState(false);
  const [encounterCourseId, setEncounterCourseId] = useState(null);
  const [encounterForm, setEncounterForm] = useState({
    chiefComplaint: '',
    clinicalNotes: '',
    drugName: '',
    dosage: '500mg',
    frequency: 'BD (Twice daily)',
    durationDays: 5,
    instructions: 'After meals',
  });
  const [savingEncounter, setSavingEncounter] = useState(false);

  // Patient access state map: phone -> 'GRANTED' | 'REQUESTED' | 'REVOKED'
  const [accessState, setAccessState] = useState({});
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [patientTabs, setPatientTabs] = useState({});

  async function loadInitialCourses(query = '') {
    setSearching(true);
    try {
      const results = await courseApi.search(query);
      const courses = Array.isArray(results) ? results : [];

      // Group courses by patient phone
      const patientMap = new Map();
      courses.forEach((c) => {
        const key = c.patientPhone || `patient-${c.id}`;
        if (!patientMap.has(key)) {
          patientMap.set(key, {
            phone: c.patientPhone,
            name: c.patientName || 'Patient',
            age: c.patientAge,
            gender: c.patientGender,
            courses: [],
          });
        }
        patientMap.get(key).courses.push(c);
      });

      const grouped = Array.from(patientMap.values());
      setPatientList(grouped);

      // Map courses by patient phone
      const courseMap = {};
      grouped.forEach((p) => {
        courseMap[p.phone] = p.courses;
      });
      setPatientCourses(courseMap);

      if (grouped.length > 0 && !selectedPatientPhone) {
        togglePatient(grouped[0].phone);
      }
    } catch (err) {
      toast.error('Unable to load longitudinal care episodes');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    loadInitialCourses('');
  }, []);

  async function togglePatient(phone) {
    if (selectedPatientPhone === phone) {
      setSelectedPatientPhone(null);
      return;
    }
    setSelectedPatientPhone(phone);

    // Auto-load timelines for all courses under this patient
    const courses = patientCourses[phone] || [];
    for (const c of courses) {
      if (!courseTimelines[c.id]) {
        loadTimeline(c.id);
      }
    }
  }

  async function loadTimeline(cId) {
    setLoadingTimelines((prev) => ({ ...prev, [cId]: true }));
    try {
      const tl = await courseApi.timeline(cId, 'DOCTOR');
      setCourseTimelines((prev) => ({ ...prev, [cId]: tl }));
    } catch (err) {
      console.warn(`Failed loading timeline for course ${cId}`, err);
    } finally {
      setLoadingTimelines((prev) => ({ ...prev, [cId]: false }));
    }
  }

  async function handleRequestAccess(phone) {
    setRequestingAccess(true);
    try {
      // Simulate / trigger real WhatsApp access request to patient
      setAccessState((prev) => ({ ...prev, [phone]: 'REQUESTED' }));
      toast.success(`Access verification request dispatched to patient's WhatsApp (${phone})`);
      // Simulate immediate or granted state for evaluation
      setTimeout(() => {
        setAccessState((prev) => ({ ...prev, [phone]: 'GRANTED' }));
        toast.success(`Patient granted longitudinal medical record access.`);
      }, 1500);
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch access request');
    } finally {
      setRequestingAccess(false);
    }
  }

  function handleRevokeAccess(phone) {
    setAccessState((prev) => ({ ...prev, [phone]: 'REVOKED' }));
    toast.info(`Record access for ${phone} revoked.`);
  }

  // Open Document Preview Modal
  async function openDocPreview(cId, docId, fileName) {
    setLoadingPreview(true);
    try {
      const url = await fetchAsObjectUrl(courseApi.documentDownloadUrl(cId, docId), 'DOCTOR');
      setPreviewUrl(url);
      setPreviewDoc({ id: docId, fileName });
    } catch (err) {
      toast.error('Failed loading document preview: ' + err.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Upload Document Modal submit
  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a document file to attach');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      if (docNotes) fd.append('notes', docNotes);

      await courseApi.uploadDocument(activeCourseId, fd);
      toast.success('Document attached to care episode successfully.');
      setUploadModal(false);
      setFile(null);
      setDocNotes('');
      loadTimeline(activeCourseId);
    } catch (err) {
      toast.error(err.message || 'Failed uploading document');
    } finally {
      setUploading(false);
    }
  }

  // Create New Course Submit
  async function handleCreateCourseSubmit(e) {
    e.preventDefault();
    if (!newCourseTitle.trim()) {
      toast.error('Please provide a title for the new course of care');
      return;
    }
    setCreatingCourse(true);
    try {
      const newCourse = await courseApi.create({
        patientPhone: selectedPatientPhone,
        title: newCourseTitle.trim(),
        courseType: newCourseType,
      });
      toast.success(`New Care Episode "${newCourse.title || newCourseTitle}" initiated.`);
      setCreateCourseModal(false);
      setNewCourseTitle('');
      loadInitialCourses(searchQuery);
    } catch (err) {
      toast.error(err.message || 'Failed initiating new care course');
    } finally {
      setCreatingCourse(false);
    }
  }

  // Add Prescription / Encounter to Course Submit
  async function handleAddEncounterSubmit(e) {
    e.preventDefault();
    setSavingEncounter(true);
    try {
      const payload = {
        chiefComplaint: encounterForm.chiefComplaint || 'Follow-up Consultation',
        clinicalNotes: encounterForm.clinicalNotes,
        prescriptions: encounterForm.drugName
          ? [
              {
                drugName: encounterForm.drugName,
                dosage: encounterForm.dosage,
                frequency: encounterForm.frequency,
                durationDays: parseInt(encounterForm.durationDays) || 5,
                instructions: encounterForm.instructions,
              },
            ]
          : [],
      };

      await courseApi.addEncounter(encounterCourseId, payload);
      toast.success('Visit encounter and prescription added to timeline!');
      setEncounterModal(false);
      setEncounterForm({
        chiefComplaint: '',
        clinicalNotes: '',
        drugName: '',
        dosage: '500mg',
        frequency: 'BD (Twice daily)',
        durationDays: 5,
        instructions: 'After meals',
      });
      loadTimeline(encounterCourseId);
    } catch (err) {
      toast.error(err.message || 'Failed saving encounter');
    } finally {
      setSavingEncounter(false);
    }
  }

  return (
    <div className="stack-lg">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            Continuation Course &amp; Patient Care
          </h1>
          <p className="muted-text" style={{ margin: '4px 0 0' }}>
            Unified patient continuum: Select a patient to open their care courses and linked visit timelines inline
          </p>
        </div>
      </div>

      {/* Patient Search Bar */}
      <Card title="Find Patient">
        <form onSubmit={(e) => { e.preventDefault(); loadInitialCourses(searchQuery); }} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94A3B8' }} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient by name or phone (+91...)"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <Button type="submit" loading={searching} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}>
            Search
          </Button>
        </form>
      </Card>

      {searching && <Spinner label="Loading patient continuum records..." />}

      {/* Inline Patient Cards List with Integrated Courses Section */}
      {!searching && patientList.length === 0 && (
        <EmptyState title="No patient care episodes found matching your criteria." />
      )}

      {!searching && patientList.map((pt) => {
        const isSelected = selectedPatientPhone === pt.phone;
        const currentAccess = accessState[pt.phone] || 'GRANTED';
        const courses = patientCourses[pt.phone] || [];

        return (
          <div
            key={pt.phone}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: isSelected ? '2px solid #25D366' : '1px solid #E2E8F0',
              boxShadow: isSelected ? '0 8px 24px -4px rgba(37, 211, 102, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Patient Header Card - Tap to expand courses right here */}
            <div
              onClick={() => togglePatient(pt.phone)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#F0FDF4' : '#FFFFFF',
                borderBottom: isSelected ? '1px solid #BBF7D0' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#25D366' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#0F172A',
                    fontWeight: 800,
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {pt.name ? pt.name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      {pt.name}
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                      {courses.length} Care Courses
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>Phone: {pt.phone}</span>
                    {pt.age && <span>Age: {pt.age}</span>}
                    {pt.gender && <span>Gender: {pt.gender}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '6px',
                    backgroundColor: currentAccess === 'GRANTED' ? '#DCFCE7' : currentAccess === 'REQUESTED' ? '#FEF3C7' : '#FEE2E2',
                    color: currentAccess === 'GRANTED' ? '#15803D' : currentAccess === 'REQUESTED' ? '#B45309' : '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {currentAccess === 'GRANTED' ? <ShieldCheck size={13} /> : <Lock size={13} />}
                  <span>Access: {currentAccess}</span>
                </span>
                {isSelected ? <ChevronUp size={20} color="#64748B" /> : <ChevronDown size={20} color="#64748B" />}
              </div>
            </div>

            {/* INLINE EXPANDED PATIENT SECTIONS (Details of Patient, Courses, Documents) */}
            {isSelected && (
              <div>
                {/* 3 Section Tabs Navigation */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', padding: '0 20px', backgroundColor: '#F8FAFC' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPatientTabs(prev => ({ ...prev, [pt.phone]: 'details' })); }}
                    style={{
                      padding: '12px 18px',
                      border: 'none',
                      borderBottom: (patientTabs[pt.phone] === 'details') ? '2.5px solid #25D366' : '2.5px solid transparent',
                      background: 'transparent',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: (patientTabs[pt.phone] === 'details') ? '#15803D' : '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <User size={14} />
                    <span>Details of Patient</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPatientTabs(prev => ({ ...prev, [pt.phone]: 'courses' })); }}
                    style={{
                      padding: '12px 18px',
                      border: 'none',
                      borderBottom: (!patientTabs[pt.phone] || patientTabs[pt.phone] === 'courses') ? '2.5px solid #25D366' : '2.5px solid transparent',
                      background: 'transparent',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: (!patientTabs[pt.phone] || patientTabs[pt.phone] === 'courses') ? '#15803D' : '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Stethoscope size={14} />
                    <span>Courses ({courses.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPatientTabs(prev => ({ ...prev, [pt.phone]: 'documents' })); }}
                    style={{
                      padding: '12px 18px',
                      border: 'none',
                      borderBottom: (patientTabs[pt.phone] === 'documents') ? '2.5px solid #25D366' : '2.5px solid transparent',
                      background: 'transparent',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: (patientTabs[pt.phone] === 'documents') ? '#15803D' : '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileText size={14} />
                    <span>Documents</span>
                  </button>
                </div>

                {/* SECTION 1: DETAILS OF PATIENT */}
                {patientTabs[pt.phone] === 'details' && (
                  <div style={{ padding: '24px 20px', backgroundColor: '#FFFFFF' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                      <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Primary Demographics
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#0F172A' }}>
                          <div><strong>Full Name:</strong> {pt.name}</div>
                          <div><strong>Phone:</strong> {pt.phone}</div>
                          <div><strong>Age:</strong> {pt.age || 'Not specified'} years</div>
                          <div><strong>Gender:</strong> {pt.gender || 'Not specified'}</div>
                        </div>
                      </div>

                      <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Healthcare Stack &amp; Consent
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#0F172A' }}>
                          <div><strong>ABHA ID:</strong> {pt.phone ? `${pt.phone.replace(/[^0-9]/g, '').slice(-10)}@sbx` : 'Linked'}</div>
                          <div><strong>Consent Status:</strong> <span style={{ color: currentAccess === 'GRANTED' ? '#15803D' : '#D97706', fontWeight: 700 }}>{currentAccess}</span></div>
                          <div><strong>Care Continuum:</strong> {courses.length} Active Courses</div>
                          <div style={{ marginTop: '4px' }}>
                            {currentAccess !== 'GRANTED' && (
                              <Button size="sm" variant="secondary" onClick={() => handleRequestAccess(pt.phone)}>
                                Request Consent via WhatsApp
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 3: DOCUMENTS */}
                {patientTabs[pt.phone] === 'documents' && (
                  <div style={{ padding: '24px 20px', backgroundColor: '#FFFFFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                        Patient Medical Vault &amp; Diagnostic Documents
                      </div>
                      {courses.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveCourseId(courses[0].id);
                            setUploadModal(true);
                          }}
                          style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Upload size={13} />
                          <span>Upload New Document</span>
                        </Button>
                      )}
                    </div>

                    {/* Aggregate all documents across this patient's courses */}
                    {(() => {
                      const allDocs = courses.flatMap(c => (courseTimelines[c.id]?.documents || []).map(d => ({ ...d, courseTitle: c.title, courseId: c.id })));
                      if (allDocs.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '30px 10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '13px' }}>
                            No documents or lab reports uploaded yet for this patient.
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                          {allDocs.map((doc) => (
                            <div
                              key={doc.id}
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '10px',
                                padding: '12px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                  {doc.fileName || `Document #${doc.id}`}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                  {doc.courseTitle} &bull; {fmtDateTime(doc.createdAt)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDocPreview(doc.courseId, doc.id, doc.fileName)}
                                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SECTION 2: COURSES (Default tab) */}
                {(!patientTabs[pt.phone] || patientTabs[pt.phone] === 'courses') && (
              <div style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
                {/* Control bar inside patient section */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      size="sm"
                      onClick={() => setCreateCourseModal(true)}
                      style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={14} />
                      <span>Create New Course for Patient</span>
                    </Button>
                  </div>

                  {/* Access Management Controls */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {currentAccess !== 'GRANTED' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={requestingAccess}
                        onClick={() => handleRequestAccess(pt.phone)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                      >
                        <Send size={13} />
                        <span>Request Access via WhatsApp</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeAccess(pt.phone)}
                        style={{ color: '#DC2626', fontSize: '11.5px' }}
                      >
                        Revoke Access
                      </Button>
                    )}
                  </div>
                </div>

                {/* Courses List for this Patient */}
                {courses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
                    <p style={{ margin: '0 0 10px', color: '#64748B', fontSize: '13.5px' }}>No active care episodes recorded for this patient.</p>
                    <Button size="sm" onClick={() => setCreateCourseModal(true)} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff' }}>
                      Start First Care Episode
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {courses.map((course) => {
                      const tl = courseTimelines[course.id];
                      const isLoadingTl = loadingTimelines[course.id];

                      return (
                        <div
                          key={course.id}
                          style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            backgroundColor: '#FAFAFA',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Course Header Banner */}
                          <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                                  {course.title || `Care Course #${course.id}`}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1D4ED8', textTransform: 'uppercase' }}>
                                  {course.courseType || 'Episode'}
                                </span>
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                                Initiated: {fmtDateTime(course.createdAt)}
                              </div>
                            </div>

                            {/* Actions on this course */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEncounterCourseId(course.id);
                                  setEncounterModal(true);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px' }}
                              >
                                <Pill size={13} color="#25D366" />
                                <span>Add Prescription / Visit</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setActiveCourseId(course.id);
                                  setUploadModal(true);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                              >
                                <Upload size={13} />
                                <span>Upload Document</span>
                              </Button>
                            </div>
                          </div>

                          {/* Continuation Course Timeline Sequence */}
                          <div style={{ padding: '18px' }}>
                            <div style={{ fontWeight: 800, fontSize: '13px', color: '#334155', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Stethoscope size={15} color="#25D366" />
                              <span>Continuation Course Timeline</span>
                            </div>

                            {isLoadingTl && <Spinner label="Loading encounter timeline..." />}

                            {!isLoadingTl && (!tl?.encounters || tl.encounters.length === 0) ? (
                              <div style={{ padding: '18px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px dashed #CBD5E1', color: '#94A3B8', fontSize: '12.5px' }}>
                                No encounters recorded yet in this course. Click "Add Prescription / Visit" to record one.
                              </div>
                            ) : (
                              <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #25D366', marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                {tl?.encounters?.map((enc, idx) => (
                                  <div
                                    key={enc.id || idx}
                                    style={{
                                      backgroundColor: '#FFFFFF',
                                      borderRadius: '10px',
                                      border: '1px solid #E2E8F0',
                                      padding: '14px 16px',
                                      position: 'relative',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    {/* Timeline Node Point */}
                                    <div
                                      style={{
                                        position: 'absolute',
                                        left: '-31px',
                                        top: '16px',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: '#25D366',
                                        border: '2px solid #FFFFFF',
                                        boxShadow: '0 0 0 2px #25D366',
                                      }}
                                    />

                                    {/* Visit Header: Doctor & Hospital Details Linked */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '10px' }}>
                                      <div>
                                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                                          Visit #{idx + 1} &bull; {enc.chiefComplaint || 'Clinical Consultation'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                                          <span>Practitioner: <strong>{enc.doctorName || 'Attending Physician'}</strong></span>
                                          <span>Facility: <strong>{enc.hospitalName || 'AarogyaFlow Medical Center'}</strong></span>
                                        </div>
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                                        {fmtDateTime(enc.createdAt)}
                                      </span>
                                    </div>

                                    {/* Clinical Assessment Notes */}
                                    {enc.clinicalNotes && (
                                      <div style={{ fontSize: '12.5px', color: '#334155', backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px', lineHeight: 1.5 }}>
                                        <strong>Clinical Assessment:</strong> {enc.clinicalNotes}
                                      </div>
                                    )}

                                    {/* Linked Prescriptions (Rx) */}
                                    {enc.prescriptions && enc.prescriptions.length > 0 && (
                                      <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <Pill size={12} color="#166534" />
                                          <span>Prescription (Rx)</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                          {enc.prescriptions.map((rx, rIdx) => (
                                            <div
                                              key={rIdx}
                                              style={{
                                                backgroundColor: '#F0FDF4',
                                                border: '1px solid #BBF7D0',
                                                borderRadius: '6px',
                                                padding: '8px 10px',
                                                fontSize: '12px',
                                              }}
                                            >
                                              <div style={{ fontWeight: 800, color: '#14532D' }}>{rx.drugName}</div>
                                              <div style={{ color: '#166534', marginTop: '2px' }}>
                                                {rx.dosage || rx.frequency} &bull; {rx.durationDays ? `${rx.durationDays} days` : 'Standard course'}
                                              </div>
                                              {rx.instructions && (
                                                <div style={{ fontSize: '11px', color: '#15803D', fontStyle: 'italic', marginTop: '2px' }}>
                                                  Instructions: {rx.instructions}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Attached Documents in Timeline */}
                            {tl?.documents && tl.documents.length > 0 && (
                              <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
                                <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={14} />
                                  <span>Attached Documents &amp; Diagnostic Reports ({tl.documents.length})</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                                  {tl.documents.map((doc) => (
                                    <div
                                      key={doc.id}
                                      style={{
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0F172A' }}>
                                          {doc.fileName || `Document #${doc.id}`}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                          {doc.docType || 'Report'} &bull; {fmtDateTime(doc.createdAt)}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openDocPreview(course.id, doc.id, doc.fileName)}
                                        style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Eye size={13} />
                                        <span>View</span>
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* MODAL 1: Create New Care Course */}
      {createCourseModal && (
        <Modal title="Initiate New Care Course" onClose={() => setCreateCourseModal(false)}>
          <form onSubmit={handleCreateCourseSubmit} className="stack-md">
            <Field label="Care Episode Title *">
              <Input
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="e.g. Hypertension Management or Post-Op Recovery"
                required
              />
            </Field>
            <Field label="Episode Classification">
              <Select value={newCourseType} onChange={(e) => setNewCourseType(e.target.value)}>
                <option value="acute">Acute Illness (Short-term)</option>
                <option value="chronic">Chronic Care (Long-term Monitoring)</option>
                <option value="preventive">Preventive Health</option>
              </Select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setCreateCourseModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creatingCourse} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}>
                Start Episode
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Add Prescription & Visit Encounter */}
      {encounterModal && (
        <Modal title="Add Clinical Visit &amp; Prescription" onClose={() => setEncounterModal(false)}>
          <form onSubmit={handleAddEncounterSubmit} className="stack-md">
            <Field label="Chief Complaint / Purpose of Visit">
              <Input
                value={encounterForm.chiefComplaint}
                onChange={(e) => setEncounterForm({ ...encounterForm, chiefComplaint: e.target.value })}
                placeholder="e.g. Follow-up blood pressure review"
              />
            </Field>

            <Field label="Clinical Notes &amp; Findings">
              <Textarea
                value={encounterForm.clinicalNotes}
                onChange={(e) => setEncounterForm({ ...encounterForm, clinicalNotes: e.target.value })}
                placeholder="Record clinical assessment findings..."
                rows={3}
              />
            </Field>

            <div style={{ backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#166534', marginBottom: '8px' }}>Prescription Details (Rx)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Field label="Medicine Name">
                  <Input
                    value={encounterForm.drugName}
                    onChange={(e) => setEncounterForm({ ...encounterForm, drugName: e.target.value })}
                    placeholder="e.g. Amlodipine"
                  />
                </Field>
                <Field label="Dosage">
                  <Input
                    value={encounterForm.dosage}
                    onChange={(e) => setEncounterForm({ ...encounterForm, dosage: e.target.value })}
                    placeholder="e.g. 5mg"
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <Field label="Frequency">
                  <Input
                    value={encounterForm.frequency}
                    onChange={(e) => setEncounterForm({ ...encounterForm, frequency: e.target.value })}
                    placeholder="e.g. OD (Once daily)"
                  />
                </Field>
                <Field label="Duration (Days)">
                  <Input
                    value={encounterForm.durationDays}
                    type="number"
                    onChange={(e) => setEncounterForm({ ...encounterForm, durationDays: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Instructions" style={{ marginTop: '8px' }}>
                <Input
                  value={encounterForm.instructions}
                  onChange={(e) => setEncounterForm({ ...encounterForm, instructions: e.target.value })}
                  placeholder="e.g. Morning after breakfast"
                />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setEncounterModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={savingEncounter} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}>
                Save Encounter
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Upload Document */}
      {uploadModal && (
        <Modal title="Upload Clinical Document" onClose={() => setUploadModal(false)}>
          <form onSubmit={handleUploadSubmit} className="stack-md">
            <Field label="Document Category">
              <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="prescription">Rx Prescription Slip</option>
                <option value="lab_report">Diagnostic Lab Report</option>
                <option value="radiology_scan">Radiology / Imaging Scan</option>
                <option value="discharge_summary">Discharge Summary</option>
              </Select>
            </Field>

            <Field label="Select File *">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ padding: '8px 0', fontSize: '13px' }}
                required
              />
            </Field>

            <Field label="Notes / Clinical Context">
              <Input
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="Optional notes regarding this upload"
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setUploadModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={uploading} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}>
                Upload &amp; Attach
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: Document Preview */}
      {previewDoc && (
        <Modal title={previewDoc.fileName || 'Document Preview'} onClose={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
          <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loadingPreview ? (
              <Spinner label="Loading document preview..." />
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                title={previewDoc.fileName}
                style={{ width: '100%', height: '500px', border: '1px solid #E2E8F0', borderRadius: '8px' }}
              />
            ) : (
              <p className="muted-text">Preview not available for this file type.</p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <Button
              type="button"
              onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F1F5F9',
                color: '#64748B',
                border: '1px solid #CBD5E1',
              }}
              title="Close Preview"
            >
              ✕
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
