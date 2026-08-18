import React, { useEffect, useState } from 'react';
import { patientApi } from '../../api/client';
import QrScanner from '../../components/QrScanner';
import { Button, Card, Field, Input, Modal, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientAccess() {
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState(null);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const [a, h] = await Promise.all([patientApi.activeAccess(), patientApi.accessHistory()]);
      setActive(a);
      setHistory(h);
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accept(rawCode) {
    if (!rawCode || rawCode.trim().length < 4) {
      toast.error('Please enter a valid 8-character access code');
      return;
    }

    setClaiming(true);
    try {
      await patientApi.acceptAccess(rawCode.trim());
      toast.success('Access granted successfully! The doctor can now view your authorized medical records.');
      setCode('');
      setScanOpen(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Invalid or expired access code');
    } finally {
      setClaiming(false);
    }
  }

  async function revoke(grantId, doctorName) {
    if (!window.confirm(`Are you sure you want to revoke medical record access for ${doctorName || 'this doctor'}?`)) {
      return;
    }

    try {
      await patientApi.revokeAccess(grantId);
      toast.success(`Access for ${doctorName || 'doctor'} revoked successfully.`);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to revoke access');
    }
  }

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Doctor Access & Privacy Control</h1>
          <p className="muted-text">
            Scan your doctor's QR code or enter their access code to grant temporary permission to view your medical reports.
          </p>
        </div>
      </div>

      <div className="landing-grid-layout">
        <Card
          title="Grant Access to a Doctor"
          extra={
            <Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
              📷 Scan Doctor QR
            </Button>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              accept(code);
            }}
            className="stack-md"
          >
            <p className="muted-text">
              Enter the 8-character access code displayed on your doctor's screen, or click above to open your camera scanner.
            </p>
            <Field label="8-Character Doctor Access Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD34"
                required
                style={{ fontSize: '18px', letterSpacing: '0.1em', fontWeight: 'bold' }}
              />
            </Field>
            <Button type="submit" loading={claiming} className="full-width">
              Grant Doctor Medical Record Access
            </Button>
          </form>
        </Card>

        <Card title="Your Data Security & Controls">
          <div className="stack-md">
            <div className="callout callout-ok">
              🛡️ <strong>Instant Control:</strong> You can revoke a doctor's access anytime with one tap. Access is also notified to your WhatsApp immediately upon granting.
            </div>

            <div className="stack-sm">
              <div className="muted-text"><strong>What a doctor can see:</strong></div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '14px' }}>
                <li>Your uploaded Rx prescriptions & diagnostic lab reports</li>
                <li>Your name and age associated with medical documents</li>
                <li>Document upload dates and medical categories</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Doctors with Active Access"
        extra={
          active && (
            <span className="badge badge-blue">
              {active.length} Active Grants
            </span>
          )
        }
      >
        {active ? (
          <Table
            columns={[
              { key: 'doctorName', header: 'Doctor Name', render: (r) => <strong>Dr. {r.doctorName}</strong> },
              { key: 'hospitalName', header: 'Hospital / Clinic', render: (r) => r.hospitalName || 'General Hospital' },
              { key: 'grantedAt', header: 'Access Granted On', render: (r) => fmtDateTime(r.grantedAt) },
              {
                key: 'actions',
                header: 'Action',
                render: (r) => (
                  <Button size="sm" variant="danger" onClick={() => revoke(r.id, r.doctorName)}>
                    🚫 Revoke Access
                  </Button>
                ),
              },
            ]}
            rows={active}
            emptyText="No doctor currently has active access to your records."
          />
        ) : (
          <Spinner label="Loading active access grants..." />
        )}
      </Card>

      {history && history.length > 0 && (
        <Card title="Access Grant History">
          <Table
            columns={[
              { key: 'doctorName', header: 'Doctor Name', render: (r) => `Dr. ${r.doctorName}` },
              { key: 'hospitalName', header: 'Hospital', render: (r) => r.hospitalName || '-' },
              { key: 'grantedAt', header: 'Granted At', render: (r) => fmtDateTime(r.grantedAt) },
              {
                key: 'status',
                header: 'Status',
                render: (r) =>
                  r.revokedAt ? (
                    <span className="badge badge-amber">Revoked on {fmtDateTime(r.revokedAt)}</span>
                  ) : (
                    <span className="badge badge-green">Active</span>
                  ),
              },
            ]}
            rows={history}
          />
        </Card>
      )}

      {scanOpen && (
        <Modal title="Scan Doctor Access QR Code" onClose={() => setScanOpen(false)}>
          <div className="stack-md">
            <p className="muted-text">Position your camera over the doctor's QR code to scan automatically.</p>
            <QrScanner
              onScan={(scannedText) => {
                if (scannedText) {
                  accept(scannedText);
                }
              }}
            />
            <Button variant="ghost" onClick={() => setScanOpen(false)} className="full-width">
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
