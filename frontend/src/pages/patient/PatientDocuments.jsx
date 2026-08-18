import React, { useEffect, useState } from 'react';
import { fetchAsObjectUrl, hospitalApi, patientApi } from '../../api/client';
import { Button, Card, Field, Input, Select, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientDocuments() {
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
    <div className="stack-lg">
      <h1>Documents</h1>

      <Card title="Upload a prescription or report">
        <form onSubmit={submit} className="stack-md">
          <Field label="File (image)">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
              required
            />
          </Field>
          <div className="field-row">
            <Field label="Document type">
              <Select value={form.docType} onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}>
                <option value="prescription">Prescription</option>
                <option value="report">Report</option>
              </Select>
            </Field>
            <Field label="Patient name" hint="Yourself or a family member">
              <Input value={form.patientName} onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))} required />
            </Field>
            <Field label="Patient age">
              <Input type="number" min="0" max="120" value={form.patientAge} onChange={(e) => setForm((f) => ({ ...f, patientAge: e.target.value }))} />
            </Field>
          </div>
          <Field label="Hospital" hint="Optional">
            <Select value={form.hospitalId} onChange={(e) => setForm((f) => ({ ...f, hospitalId: e.target.value }))}>
              <option value="">—</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={uploading}>
            Upload
          </Button>
        </form>
      </Card>

      <Card title="Your documents">
        {docs ? (
          <Table
            columns={[
              { key: 'fileName', header: 'File' },
              { key: 'docType', header: 'Type' },
              { key: 'patientName', header: 'Patient', render: (r) => `${r.patientName || '—'}${r.patientAge ? ` (${r.patientAge})` : ''}` },
              { key: 'createdAt', header: 'Uploaded', render: (r) => fmtDateTime(r.createdAt) },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <Button size="sm" variant="secondary" onClick={() => view(r.id)}>
                    View
                  </Button>
                ),
              },
            ]}
            rows={docs}
            emptyText="No documents uploaded yet."
          />
        ) : (
          <Spinner />
        )}
      </Card>
    </div>
  );
}
