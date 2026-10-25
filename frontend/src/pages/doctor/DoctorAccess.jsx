import React, { useEffect, useState } from 'react';
import { abdmApi, doctorApi, fetchAsObjectUrl, patientApi } from '../../api/client';
import { Button, Card, EmptyState, Field, Input, Spinner, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorAccess() {
  const [request, setRequest] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(null);
  const [qrObjectUrl, setQrObjectUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const toast = useToast();

  // Direct patient consent verification by phone
  const [patientPhoneInput, setPatientPhoneInput] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  // QR Code fetching
  useEffect(() => {
    if (!request?.code) {
      setQrObjectUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    setQrLoading(true);

    fetchAsObjectUrl(doctorApi.accessRequestQrUrl(request.code), 'DOCTOR')
      .then((url) => {
        if (cancelled) return;
        objectUrl = url;
        setQrObjectUrl(url);
      })
      .catch((err) => {
        console.warn('QR fetch fallback to render helper:', err);
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [request?.code]);

  async function loadActiveCount() {
    try {
      const patients = await doctorApi.patients();
      setActivePatientsCount(Array.isArray(patients) ? patients.length : 0);
    } catch {
      // Ignored if doctor hasn't joined a hospital yet
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const data = await doctorApi.createAccessRequest();
      setRequest(data);
      toast.success('Access code generated successfully. Ready for patient authorization.');
    } catch (err) {
      console.warn('Doctor access generate fallback:', err);
      // Fallback offline mock request code so UI never gets stuck
      setRequest({
        code: 'DR' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      toast.info('Generated local demo access code.');
    } finally {
      setGenerating(false);
    }
  }

  function copyCode() {
    if (!request?.code) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(request.code);
      toast.success('Access code copied to clipboard');
    } else {
      toast.info(`Code: ${request.code}`);
    }
  }

  // Quick Direct Patient Claim in Clinic (e.g., patient is present with phone)
  async function handleDirectPhoneConsent(e) {
    if (e) e.preventDefault();
    if (!patientPhoneInput || patientPhoneInput.trim().length < 10) {
      toast.error('Please enter a valid 10-digit patient mobile number');
      return;
    }
    if (!request?.code) {
      toast.error('No active access code available. Click Generate Code first.');
      return;
    }

    setVerifyingPhone(true);
    try {
      const res = await fetch(`/api/doctors/access-requests/${encodeURIComponent(request.code)}/grant-by-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ phone: patientPhoneInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Access granted for ${patientPhoneInput.trim()}! Medical records unlocked & WhatsApp notification sent.`);
        setPatientPhoneInput('');
        loadActiveCount();
        generate(); // Refresh code for next patient
      } else {
        toast.error(data.message || 'Failed to grant access');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to verify consent');
    } finally {
      setVerifyingPhone(false);
    }
  }

  useEffect(() => {
    generate();
    loadActiveCount();
  }, []);

  // ABDM HIU External Consent Flow
  const [abhaId, setAbhaId] = useState('kavishahuja@abdm');
  const [requestingConsent, setRequestingConsent] = useState(false);
  const [consentRequest, setConsentRequest] = useState(null);
  const [approvingConsent, setApprovingConsent] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [externalRecords, setExternalRecords] = useState([]);

  async function handleRequestConsent(e) {
    if (e) e.preventDefault();
    if (!abhaId || !abhaId.trim()) {
      toast.error('Please enter an ABHA address or number');
      return;
    }
    setRequestingConsent(true);
    try {
      const res = await abdmApi.initConsent({
        patient: { id: abhaId.trim() },
        purpose: { text: 'Care Evaluation & Treatment Planning', code: 'CAREV' },
        hiu: { id: 'CHIS-DEMO-HIU' },
      });
      const data = res?.data || res;
      setConsentRequest(data);
      setExternalRecords([]);
      toast.success(`ABDM Consent Request created: ${data.consent_request_id || data.consentRequestId}`);
    } catch (err) {
      toast.error(err.message || 'Failed to initiate ABDM consent');
    } finally {
      setRequestingConsent(false);
    }
  }

  async function handleTestApprove() {
    const reqId = consentRequest?.consent_request_id || consentRequest?.consentRequestId;
    if (!reqId) return;
    setApprovingConsent(true);
    try {
      const res = await abdmApi.testApproveConsent(reqId);
      const data = res?.data || res;
      setConsentRequest(data);
      toast.success('Consent GRANTED via Test Mode! Fetching external medical records...');
      const artefactId = data.consentArtefactId || data.artefactId;
      if (artefactId) {
        await loadExternalRecords(artefactId);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to approve consent in test mode');
    } finally {
      setApprovingConsent(false);
    }
  }

  async function loadExternalRecords(artefactId) {
    setLoadingRecords(true);
    try {
      const res = await abdmApi.getConsentRecords(artefactId);
      const records = res?.data || (Array.isArray(res) ? res : []);
      setExternalRecords(records);
      toast.success(`Retrieved ${records.length} external ABDM medical records`);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch external health records');
    } finally {
      setLoadingRecords(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Patient Access &amp; Medical Records
          </h1>
          <p className="muted-text" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Generate a QR code or access code for patients to share their medical history, lab reports, and prescriptions.
          </p>
        </div>
        {activePatientsCount !== null && (
          <span className="badge badge-green" style={{ fontSize: '13px', padding: '6px 14px' }}>
            {activePatientsCount} Active Patients
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* QR Access Code Card */}
        <Card
          title="Patient Access QR Code"
          extra={
            <Button size="sm" onClick={generate} loading={generating}>
              Generate Fresh QR
            </Button>
          }
        >
          {generating ? (
            <Spinner label="Generating QR code..." />
          ) : !request ? (
            <EmptyState
              title="Click above to generate a new QR Access Code."
              hint="Valid for 30 minutes. Make sure you have joined a hospital first."
            />
          ) : (
            <div className="qr-block stack-md" style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: '16px',
                  display: 'inline-block',
                  borderRadius: '16px',
                  border: '2px solid var(--border)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              >
                {qrObjectUrl ? (
                  <img
                    src={qrObjectUrl}
                    alt="Doctor Patient Access QR Code"
                    width={240}
                    height={240}
                    style={{ display: 'block', margin: '0 auto' }}
                  />
                ) : qrLoading ? (
                  <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner label="Loading QR..." />
                  </div>
                ) : (
                  /* Fallback SVG representation of the access code if binary image fails */
                  <div
                    style={{
                      width: 240,
                      height: 240,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px dashed #CBD5E1',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Doctor Access Code</span>
                    <strong style={{ fontSize: '28px', color: '#0F172A', letterSpacing: '0.1em', marginTop: '6px' }}>
                      {request.code}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                      Scan via Patient Portal
                    </span>
                  </div>
                )}
              </div>

              <div className="stack-sm">
                <div className="muted-text" style={{ fontSize: '13px' }}>Patient Access Code:</div>
                <div className="row-gap" style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <code className="join-code" style={{ fontSize: '24px', letterSpacing: '0.15em', fontWeight: 800 }}>
                    {request.code}
                  </code>
                  <Button size="sm" variant="secondary" onClick={copyCode}>
                    Copy Code
                  </Button>
                </div>
                <div className="muted-text" style={{ fontSize: '12.5px', marginTop: '4px' }}>
                  Code expires: <strong>{fmtDateTime(request.expiresAt)}</strong> (Valid for 30 minutes)
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Quick Direct In-Clinic Consent & How it Works */}
        <div className="stack-md">
          <Card title="Quick In-Clinic Patient Consent">
            <form onSubmit={handleDirectPhoneConsent} className="stack-sm">
              <p className="muted-text" style={{ margin: 0, fontSize: '13px' }}>
                If the patient is present in the consultation room, you can directly verify consent using their registered mobile number.
              </p>
              <Field label="Patient Registered Mobile Number">
                <Input
                  placeholder="e.g. 9876543210"
                  value={patientPhoneInput}
                  onChange={(e) => setPatientPhoneInput(e.target.value)}
                  maxLength={10}
                />
              </Field>
              <Button type="submit" variant="primary" loading={verifyingPhone} style={{ alignSelf: 'flex-start' }}>
                Verify & Grant Access
              </Button>
            </form>
          </Card>

          <Card title="How Patient Permission Works">
            <div className="stack-sm" style={{ fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="badge badge-blue" style={{ height: 'fit-content' }}>1</span>
                <div>
                  <strong>Patient Scans QR:</strong> Patient opens their Ayushman Patient Portal and scans this QR code or types the 8-character code.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="badge badge-blue" style={{ height: 'fit-content' }}>2</span>
                <div>
                  <strong>WhatsApp Notification:</strong> Patient receives a security confirmation on WhatsApp with a one-touch revocation key.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="badge badge-blue" style={{ height: 'fit-content' }}>3</span>
                <div>
                  <strong>Instant Medical Records:</strong> Patient prescriptions, past visits, and lab reports become immediately viewable.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ABDM External Records (HIU Consent Flow) */}
      <Card
        title="Records from Other Hospitals"
        extra={<span className="badge badge-blue">Connected Hospitals</span>}
      >
        <div className="stack-md">
          <p className="muted-text" style={{ margin: 0, fontSize: '13.5px' }}>
            Request past medical history, prescriptions, and lab reports from other connected hospitals using the patient's Ayushman Health Account (ABHA).
          </p>

          <form onSubmit={handleRequestConsent} className="row-gap" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <Field label="Patient ABHA Address or 14-Digit ABHA Number">
                <Input
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  placeholder="e.g. kavishahuja@abdm or 91-8850-9345-4421"
                  required
                />
              </Field>
            </div>
            <Button type="submit" loading={requestingConsent}>
              Request ABDM Consent
            </Button>
          </form>

          {consentRequest && (
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
              }}
              className="stack-md"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                    Request ID
                  </span>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace' }}>
                    {consentRequest.consent_request_id || consentRequest.consentRequestId || 'CR-PENDING'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className={`badge ${
                      consentRequest.status === 'GRANTED' ? 'badge-green' : 'badge-amber'
                    }`}
                    style={{ fontSize: '13px', padding: '6px 12px' }}
                  >
                    {consentRequest.status === 'GRANTED' ? 'GRANTED' : 'PENDING APPROVAL'}
                  </span>

                  {consentRequest.status !== 'GRANTED' && (
                    <Button
                      size="sm"
                      onClick={handleTestApprove}
                      loading={approvingConsent}
                      style={{
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        border: 'none',
                        fontWeight: '700',
                      }}
                    >
                      One-Click Quick Approve (Demo)
                    </Button>
                  )}
                </div>
              </div>

              {consentRequest.status !== 'GRANTED' ? (
                <div className="callout callout-info" style={{ fontSize: '13px' }}>
                  <strong>How This Works:</strong> In live production, the patient receives an approval notification on their personal device (Aarogya Setu or ABHA App). In this sandbox/demo environment, click <strong>"One-Click Test Approve"</strong> above to instantly grant consent and unlock external records without external devices.
                </div>
              ) : (
                <div>
                  <div className="callout callout-ok" style={{ fontSize: '13px', marginBottom: '12px' }}>
                    <strong>Permission Granted:</strong> <code>{consentRequest.consentArtefactId || consentRequest.artefactId || 'ARTEFACT-VERIFIED'}</code>. Medical records unlocked.
                  </div>

                  {loadingRecords ? (
                    <Spinner label="Loading past medical records..." />
                  ) : externalRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <Button size="sm" onClick={() => loadExternalRecords(consentRequest.consentArtefactId || consentRequest.artefactId)}>
                        Reload External Health Records
                      </Button>
                    </div>
                  ) : (
                    <div className="stack-sm">
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
                        External Health Records Received ({externalRecords.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                        {externalRecords.map((rec, idx) => (
                          <div
                            key={rec.recordId || idx}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '10px',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="badge badge-blue" style={{ fontSize: '11px' }}>
                                {rec.type || 'Clinical Record'}
                              </span>
                              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                                {rec.date || 'Recent'}
                              </span>
                            </div>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>
                              {rec.title}
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                              Provider: <strong>{rec.providerHospital || 'ABDM Network Hospital'}</strong>
                            </div>
                            {rec.doctorName && (
                              <div style={{ fontSize: '12px', color: '#475569' }}>
                                Doctor: {rec.doctorName}
                              </div>
                            )}
                            {rec.summary && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#334155',
                                  backgroundColor: '#F8FAFC',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  marginTop: '4px',
                                  lineHeight: '1.4',
                                }}
                              >
                                {rec.summary}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
