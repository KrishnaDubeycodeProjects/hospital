import React, { useState, useEffect } from 'react';
import { doctorApi } from '../../api/client';
import { Button, Card, EmptyState, RemoteImage, Spinner, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorAccess() {
  const [request, setRequest] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(null);
  const toast = useToast();

  async function loadActiveCount() {
    try {
      const patients = await doctorApi.patients();
      setActivePatientsCount(patients?.length || 0);
    } catch {
      // Ignored if doctor hasn't joined a hospital yet
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const data = await doctorApi.createAccessRequest();
      setRequest(data);
      toast.success('Fresh QR Access Code generated! Ready for patient scanning.');
    } catch (err) {
      toast.error(err.message || 'Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    generate();
    loadActiveCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyCode() {
    if (request?.code) {
      navigator.clipboard.writeText(request.code);
      toast.success('Access code copied to clipboard!');
    }
  }

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Doctor Access & Patient Record Consent</h1>
          <p className="muted-text">
            Generate a secure QR code or access key for patients to scan and share their medical history & prescriptions.
          </p>
        </div>
        {activePatientsCount !== null && (
          <span className="badge badge-green" style={{ fontSize: '14px', padding: '8px 14px' }}>
            👥 {activePatientsCount} Active Consenting Patients
          </span>
        )}
      </div>

      <div className="landing-grid-layout">
        <Card
          title="Patient Access QR Code"
          extra={
            <Button size="sm" onClick={generate} loading={generating}>
              🔄 Generate Fresh QR
            </Button>
          }
        >
          {generating ? (
            <Spinner label="Generating encrypted QR code..." />
          ) : !request ? (
            <EmptyState
              title="Click above to generate a new QR Access Code."
              hint="Valid for 30 minutes. Make sure you have joined a hospital first."
            />
          ) : (
            <div className="qr-block stack-md">
              <div style={{ background: '#ffffff', padding: '16px', display: 'inline-block', borderRadius: '16px', border: '2px solid var(--border)' }}>
                <RemoteImage
                  src={doctorApi.accessRequestQrUrl(request.code)}
                  alt="Doctor Patient Access QR Code"
                  width={260}
                  height={260}
                  style={{ display: 'block' }}
                />
              </div>

              <div className="stack-sm">
                <div className="muted-text">Direct Access Code:</div>
                <div className="row-gap" style={{ justifyContent: 'center' }}>
                  <code className="join-code" style={{ fontSize: '24px', letterSpacing: '0.15em' }}>
                    {request.code}
                  </code>
                  <Button size="sm" variant="secondary" onClick={copyCode}>
                    📋 Copy
                  </Button>
                </div>
                <div className="muted-text" style={{ fontSize: '13px', marginTop: '6px' }}>
                  ⏰ Code expires: <strong>{fmtDateTime(request.expiresAt)}</strong> (30 min TTL)
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card title="How Patient Consent Works">
          <div className="stack-md" style={{ padding: '8px 0' }}>
            <div className="callout callout-ok">
              🔒 <strong>Encrypted Consent Model:</strong> Patient records are strictly private and accessible only upon explicit patient authorization.
            </div>

            <div className="stack-sm" style={{ marginTop: '8px' }}>
              <div className="step-item row-gap">
                <span className="badge badge-blue">1</span>
                <div><strong>Patient scans QR Code</strong> or enters the 8-character access code on their phone.</div>
              </div>

              <div className="step-item row-gap">
                <span className="badge badge-blue">2</span>
                <div><strong>WhatsApp Notification:</strong> Patient receives an instant security notice on WhatsApp confirming access grant with an instant revocation key.</div>
              </div>

              <div className="step-item row-gap">
                <span className="badge badge-blue">3</span>
                <div><strong>Medical Record Sync:</strong> Patient documents (Rx prescriptions, lab reports) become immediately viewable in your Doctor Portal.</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
