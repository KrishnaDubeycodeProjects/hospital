import React, { useEffect, useState } from 'react';
import { doctorApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Field, Modal, Spinner, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorPatients() {
  const [groups, setGroups] = useState(null);
  const [uploadingPatient, setUploadingPatient] = useState(null);
  const [docType, setDocType] = useState('prescription');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const loadPatients = () => {
    doctorApi
      .patients()
      .then(setGroups)
      .catch((err) => toast.error(err.message));
  };

  useEffect(() => {
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function viewDoc(id) {
    try {
      const url = await fetchAsObjectUrl(doctorApi.patientDocumentFileUrl(id), 'DOCTOR');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.message);
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
      loadPatients();
    } catch (err) {
      toast.error(err.message || 'Failed to upload report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>My Patients</h1>
          <p className="muted-text">Patients who have granted active medical record access.</p>
        </div>
      </div>

      {!groups && <Spinner label="Loading patient records..." />}
      {groups && groups.length === 0 && <EmptyState title="No patients have granted you access yet." hint="Ask the patient to scan your Doctor Access QR code from their portal." />}

      {groups?.map((g) => (
        <Card
          key={`${g.patientPhone}-${g.name}-${g.age}`}
          title={`${g.name || 'Unnamed Patient'}${g.age ? `, ${g.age} yrs` : ''}`}
          extra={
            <div className="row-gap">
              <span className="badge badge-blue">📱 {g.patientPhone}</span>
              <Button size="sm" onClick={() => setUploadingPatient(g)}>
                📁 Upload Report / Prescription
              </Button>
            </div>
          }
        >
          {g.documents.length === 0 ? (
            <EmptyState title="No documents uploaded yet for this patient." hint="Use the button above to upload a new prescription or diagnostic report." />
          ) : (
            <div className="doc-grid">
              {g.documents.map((d) => (
                <div key={d.id} className="doc-tile">
                  <div className="doc-tile-type">
                    <span className={`badge ${d.docType === 'prescription' ? 'badge-blue' : 'badge-green'}`}>
                      {d.docType}
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', fontWeight: 600, fontSize: '13px' }}>{d.fileName}</div>
                  <div className="muted-text" style={{ fontSize: '12px', margin: '4px 0 10px' }}>{fmtDateTime(d.createdAt)}</div>
                  <Button size="sm" variant="secondary" className="full-width" onClick={() => viewDoc(d.id)}>
                    View File
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {uploadingPatient && (
        <Modal title={`Upload Report for ${uploadingPatient.name || uploadingPatient.patientPhone}`} onClose={() => setUploadingPatient(null)}>
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
                  Rx Prescription
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

            <Field label="Select File (Max 8MB)">
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
              <Button type="submit" loading={submitting}>
                Upload Document
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
