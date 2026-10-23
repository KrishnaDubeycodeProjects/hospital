import React, { useEffect, useState } from 'react';
import { doctorApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function DoctorPatients() {
  const { doctor } = useAuth();
  const currentDoctorId = doctor?.doctorId;
  const toast = useToast();

  // Active tab: 'active' or 'history' (NO icons in tab labels per requirement 1)
  const [activeTab, setActiveTab] = useState('active');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Active granted patients & Historical patients
  const [activeGroups, setActiveGroups] = useState(null);
  const [historyGroups, setHistoryGroups] = useState(null);
  const [grantsHistory, setGrantsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected patient for detail inspection
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Upload modal state
  const [uploadingPatient, setUploadingPatient] = useState(null);
  const [docType, setDocType] = useState('prescription');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Seen document tracking in localStorage
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

  async function loadData() {
    setLoading(true);
    try {
      const [activeData, histData, grants] = await Promise.all([
        doctorApi.patients().catch(() => []),
        doctorApi.patientHistory().catch(() => []),
        doctorApi.patientGrants().catch(() => []),
      ]);

      const activeList = Array.isArray(activeData) ? activeData : [];
      const histList = Array.isArray(histData) ? histData : [];
      const grantsList = Array.isArray(grants) ? grants : [];

      setActiveGroups(activeList);
      setHistoryGroups(histList);
      setGrantsHistory(grantsList);

      // Auto-select first active patient if available
      if (activeList.length > 0 && !selectedPatient) {
        setSelectedPatient(activeList[0]);
      }
    } catch (err) {
      toast.error(err.message || 'Failed loading patient records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openDocPreview(doc) {
    markDocAsSeen(doc.id);
    setPreviewDoc(doc);
    setLoadingPreview(true);
    try {
      const url = await fetchAsObjectUrl(doctorApi.patientDocumentFileUrl(doc.id), 'DOCTOR');
      setPreviewUrl(url);
    } catch (err) {
      toast.error('Failed loading document preview: ' + err.message);
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function downloadDoc(doc) {
    markDocAsSeen(doc.id);
    try {
      const url = await fetchAsObjectUrl(doctorApi.patientDocumentFileUrl(doc.id), 'DOCTOR');
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || `patient-document-${doc.id}`;
      a.click();
      toast.success('Document downloaded');
    } catch (err) {
      toast.error('Download failed: ' + err.message);
    }
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('patientPhone', uploadingPatient.patientPhone);
      formData.append('patientName', uploadingPatient.name || 'Patient');
      if (uploadingPatient.age) formData.append('patientAge', uploadingPatient.age);
      formData.append('docType', docType);
      formData.append('file', file);

      await doctorApi.uploadPatientDocument(formData);
      toast.success('Medical report uploaded successfully!');
      setUploadingPatient(null);
      setFile(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to upload report');
    } finally {
      setSubmitting(false);
    }
  }

  // Filter groups according to activeTab and searchQuery
  const currentDataset = activeTab === 'active' ? (activeGroups || []) : (historyGroups || []);
  const filteredPatients = currentDataset.filter((pt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = pt.name && pt.name.toLowerCase().includes(q);
    const matchPhone = pt.patientPhone && pt.patientPhone.includes(q);
    const matchAge = pt.age && String(pt.age).includes(q);
    const matchDocs = pt.documents && pt.documents.some((d) =>
      (d.fileName && d.fileName.toLowerCase().includes(q)) ||
      (d.docType && d.docType.toLowerCase().includes(q))
    );
    return matchName || matchPhone || matchAge || matchDocs;
  });

  // Find grant details for a patient
  function getGrantInfo(phone) {
    const found = grantsHistory.find((g) => g.patientPhone === phone);
    return found || null;
  }

  return (
    <div className="stack-lg">
      {/* Header */}
      <div className="card-head">
        <div>
          <h1>My Patients & Medical Records</h1>
          <p className="muted-text">
            View your patients, their medical reports, prescriptions, and past consultations.
          </p>
        </div>
      </div>

      {/* Tabs (NO ICONS per requirement 1) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('active');
            if (activeGroups && activeGroups.length > 0) setSelectedPatient(activeGroups[0]);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'active' ? '3px solid #2563EB' : '3px solid transparent',
            backgroundColor: activeTab === 'active' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'active' ? '#1D4ED8' : '#64748B',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Active Patients ({activeGroups?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            if (historyGroups && historyGroups.length > 0) setSelectedPatient(historyGroups[0]);
          }}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid #2563EB' : '3px solid transparent',
            backgroundColor: activeTab === 'history' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'history' ? '#1D4ED8' : '#64748B',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Past Patients ({historyGroups?.length || 0})
        </button>
      </div>

      {/* Search Bar */}
      <Card>
        <div className="row-gap" style={{ alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <Input
              placeholder={`Search ${activeTab === 'active' ? 'currently granted' : 'all historical'} patients by name, phone, age, or document...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <Button size="sm" variant="secondary" onClick={() => setSearchQuery('')}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {loading && <Spinner label="Loading patient records..." />}

      {!loading && filteredPatients.length === 0 && (
        <Card>
          <EmptyState
            title={activeTab === 'active' ? 'No active consenting patients found' : 'No patient history found'}
            hint={
              searchQuery
                ? 'Try a different search term.'
                : activeTab === 'active'
                ? 'Patients can grant temporary access by scanning your QR code from their portal.'
                : 'Historical patients will appear here once consultations occur.'
            }
          />
        </Card>
      )}

      {/* Main Split Layout: Patient List on Left, Detail & Documents on Right */}
      {!loading && filteredPatients.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '20px', alignItems: 'start' }} className="responsive-split">
          {/* Left Column: Patient Cards List */}
          <div className="stack-sm" style={{ maxHeight: '720px', overflowY: 'auto' }}>
            {filteredPatients.map((pt) => {
              const isSelected = selectedPatient?.patientPhone === pt.patientPhone && selectedPatient?.name === pt.name;
              const grant = getGrantInfo(pt.patientPhone);
              const isRevoked = grant?.revokedAt != null;
              const docCount = pt.documents?.length || 0;

              return (
                <div
                  key={`${pt.patientPhone}-${pt.name}-${pt.age}`}
                  onClick={() => setSelectedPatient(pt)}
                  style={{
                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                    border: `1.5px solid ${isSelected ? '#3B82F6' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '15px', color: '#0F172A' }}>
                      {pt.name || 'Unnamed Patient'}
                    </strong>
                    <span
                      className={`badge ${
                        activeTab === 'active' && !isRevoked ? 'badge-green' : isRevoked ? 'badge-amber' : 'badge-blue'
                      }`}
                      style={{ fontSize: '10.5px' }}
                    >
                      {activeTab === 'active' && !isRevoked ? 'Granted' : isRevoked ? 'Revoked' : 'Consented'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px' }}>
                    {pt.patientPhone} {pt.age ? `• ${pt.age} yrs` : ''}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#475569' }}>
                      Documents: <strong>{docCount}</strong>
                    </span>
                    {grant?.grantedAt && (
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        Granted {fmtDateTime(grant.grantedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Patient View & Document Vault */}
          <div>
            {!selectedPatient ? (
              <Card>
                <EmptyState title="Select a patient" hint="Choose a patient on the left to see full details and granted documents." />
              </Card>
            ) : (
              <div className="stack-lg">
                {/* Patient Summary Header Card */}
                <Card
                  title={`${selectedPatient.name || 'Patient Detail'}${selectedPatient.age ? `, ${selectedPatient.age} yrs` : ''}`}
                  actions={
                    <div className="row-gap">
                      <Button size="sm" variant="primary" onClick={() => setUploadingPatient(selectedPatient)}>
                        Upload Report / Rx
                      </Button>
                    </div>
                  }
                >
                  <dl className="detail-list">
                    <div className="detail-row">
                      <dt>Mobile Number</dt>
                      <dd>{selectedPatient.patientPhone}</dd>
                    </div>
                    <div className="detail-row">
                      <dt>Access Consent Status</dt>
                      <dd>
                        {(() => {
                          const grant = getGrantInfo(selectedPatient.patientPhone);
                          if (grant?.revokedAt) {
                            return <span className="badge badge-amber">Revoked on {fmtDateTime(grant.revokedAt)}</span>;
                          }
                          return <span className="badge badge-green">Active Medical Record Consent</span>;
                        })()}
                      </dd>
                    </div>
                    <div className="detail-row">
                      <dt>Documents Granted</dt>
                      <dd>{selectedPatient.documents?.length || 0} Medical Documents & Prescriptions</dd>
                    </div>
                    {(() => {
                      const grant = getGrantInfo(selectedPatient.patientPhone);
                      if (grant?.grantedAt) {
                        return (
                          <div className="detail-row">
                            <dt>Consent Granted At</dt>
                            <dd>{fmtDateTime(grant.grantedAt)}</dd>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </dl>
                </Card>

                {/* Patient Granted Documents List */}
                <Card
                  title="Granted Medical Documents & Prescriptions"
                  extra={
                    <span className="badge badge-blue">
                      {selectedPatient.documents?.length || 0} Files
                    </span>
                  }
                >
                  {!selectedPatient.documents || selectedPatient.documents.length === 0 ? (
                    <EmptyState
                      title="No documents uploaded yet for this patient."
                      hint="Click 'Upload Report / Rx' above to attach a prescription or diagnostic report."
                    />
                  ) : (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <Table
                      columns={[
                        { 
                          key: 'fileName', 
                          header: 'Document Title',
                          render: (d) => (
                            <span style={{ fontWeight: 600, color: '#0f172a', minWidth: '220px', display: 'inline-block' }}>
                              {d.fileName}
                            </span>
                          )
                        },
                        {
                          key: 'docType',
                          header: 'Type',
                          render: (d) => (
                            <span className={`badge ${d.docType === 'prescription' ? 'badge-blue' : 'badge-green'}`} style={{ whiteSpace: 'nowrap' }}>
                              {d.docType === 'prescription' ? 'Rx Prescription' : 'Diagnostic Report'}
                            </span>
                          ),
                        },
                        {
                          key: 'uploader',
                          header: 'Attribution',
                          render: (d) => {
                            const isUploadedByMe = currentDoctorId && d.uploadedByDoctorId === currentDoctorId;
                            if (isUploadedByMe) {
                              return <span className="badge badge-green" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>Uploaded by You</span>;
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
                        { 
                          key: 'createdAt', 
                          header: 'Date', 
                          render: (d) => <span style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#475569' }}>{fmtDateTime(d.createdAt)}</span> 
                        },
                        {
                          key: 'actions',
                          header: 'Actions',
                          render: (d) => (
                            <div className="row-gap" style={{ whiteSpace: 'nowrap' }}>
                              <Button size="sm" variant="secondary" onClick={() => openDocPreview(d)}>
                                View File
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => downloadDoc(d)}>
                                Download
                              </Button>
                            </div>
                          ),
                        },
                      ]}
                      rows={selectedPatient.documents}
                    />
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <Modal title={`Viewing: ${previewDoc.fileName || 'Patient Document'}`} onClose={() => setPreviewDoc(null)}>
          <div className="stack-md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={`badge ${previewDoc.docType === 'prescription' ? 'badge-blue' : 'badge-green'}`}>
                {previewDoc.docType}
              </span>
              <span className="muted-text" style={{ fontSize: '12px' }}>
                Uploaded: {fmtDateTime(previewDoc.createdAt)}
              </span>
            </div>

            {loadingPreview ? (
              <Spinner label="Loading document preview..." />
            ) : previewUrl ? (
              <div style={{ textAlign: 'center', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px' }}>
                {previewDoc.contentType?.includes('pdf') ? (
                  <iframe
                    src={previewUrl}
                    title="Document Preview"
                    style={{ width: '100%', height: '480px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Patient Medical Document"
                    style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '6px' }}
                  />
                )}
              </div>
            ) : (
              <EmptyState title="Could not load document preview" />
            )}

            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
              <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(null)}>
                Close
              </Button>
              <Button size="sm" variant="secondary" onClick={() => downloadDoc(previewDoc)}>
                Download File
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Document Modal */}
      {uploadingPatient && (
        <Modal
          title={`Upload Medical Record for ${uploadingPatient.name || uploadingPatient.patientPhone}`}
          onClose={() => setUploadingPatient(null)}
        >
          <form onSubmit={handleUploadSubmit} className="stack-md">
            <Field label="Document Type">
              <div className="row-gap">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="docType"
                    value="prescription"
                    checked={docType === 'prescription'}
                    onChange={(e) => setDocType(e.target.value)}
                  />
                  Rx Prescription Slip
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="docType"
                    value="report"
                    checked={docType === 'report'}
                    onChange={(e) => setDocType(e.target.value)}
                  />
                  Lab / Diagnostic Report
                </label>
              </div>
            </Field>

            <Field label="Select File (PDF, PNG, JPG, WebP - Max 10MB)">
              <input
                type="file"
                className="input"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </Field>

            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button type="button" variant="ghost" onClick={() => setUploadingPatient(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Upload Document
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
