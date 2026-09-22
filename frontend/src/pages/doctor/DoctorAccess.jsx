import React, { useState, useEffect } from 'react';
import { doctorApi, abdmApi, fetchAsObjectUrl } from '../../api/client';
import { Button, Card, EmptyState, Field, Input, Spinner, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorAccess() {
  const [request, setRequest] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(null);
  const [qrObjectUrl, setQrObjectUrl] = useState(null);
  const toast = useToast();

  // /api/doctors/access-requests/{code}/qr needs a Bearer token, which a plain
  // <img src> can never send, and (when VITE_API_URL is an ngrok tunnel) also
  // needs the ngrok-skip-browser-warning header axios attaches -- otherwise
  // ngrok serves its HTML interstitial instead of the PNG. Fetch through the
  // authed axios client and hand the browser an object URL instead.
  useEffect(() => {
    if (!request?.code) {
      setQrObjectUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    fetchAsObjectUrl(doctorApi.accessRequestQrUrl(request.code), 'DOCTOR')
      .then((url) => {
        if (cancelled) return;
        objectUrl = url;
        setQrObjectUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [request?.code]);

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

  // ABDM HIU External Consent State (Milestone 3)
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
        hiu: { id: 'CHIS-DEMO-HIU' }
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
      toast.success(`Retrieved ${records.length} external ABDM medical records!`);
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
                {qrObjectUrl ? (
                  <img
                    src={qrObjectUrl}
                    alt="Doctor Patient Access QR Code"
                    width={260}
                    height={260}
                    style={{ display: 'block' }}
                  />
                ) : (
                  <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="muted-text">Loading QR…</span>
                  </div>
                )}
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

      {/* ABDM Milestone 3: External Records (HIU Consent) */}
      <Card
        title="ABDM External Health Records (HIU Consent Flow)"
        extra={
          <span className="badge badge-blue">Milestone 3 (HIU)</span>
        }
      >
        <div className="stack-md">
          <p className="muted-text" style={{ margin: 0, fontSize: '13.5px' }}>
            Request encrypted past medical history (OPD visits, prescriptions, lab reports) generated at other ABDM network hospitals.
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
              📩 Request ABDM Consent
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
                    Consent Request ID
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
                    {consentRequest.status === 'GRANTED' ? '✅ GRANTED' : '⏳ PENDING APPROVAL'}
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
                      ⚡ One-Click Test Approve (Demo Mode)
                    </Button>
                  )}
                </div>
              </div>

              {consentRequest.status !== 'GRANTED' ? (
                <div className="callout callout-info" style={{ fontSize: '13px' }}>
                  ℹ️ <strong>How This Works:</strong> In live production, the patient receives an approval notification on their personal device (Aarogya Setu or ABHA App). In this sandbox/demo environment, click <strong>"⚡ One-Click Test Approve"</strong> above to instantly grant consent and unlock external records without external devices.
                </div>
              ) : (
                <div>
                  <div className="callout callout-ok" style={{ fontSize: '13px', marginBottom: '12px' }}>
                    🔒 <strong>Consent Artefact Issued:</strong> <code>{consentRequest.consentArtefactId || consentRequest.artefactId || 'ARTEFACT-VERIFIED'}</code>. Clinical data decrypted and available.
                  </div>

                  {loadingRecords ? (
                    <Spinner label="Decrypting and fetching external clinical records from ABDM repository..." />
                  ) : externalRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <Button size="sm" onClick={() => loadExternalRecords(consentRequest.consentArtefactId || consentRequest.artefactId)}>
                        🔄 Reload External Health Records
                      </Button>
                    </div>
                  ) : (
                    <div className="stack-sm">
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>
                        🏥 External Health Records Received ({externalRecords.length})
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
                                📅 {rec.date || 'Recent'}
                              </span>
                            </div>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>
                              {rec.title}
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                              🏥 <strong>{rec.providerHospital || 'ABDM Network Hospital'}</strong>
                            </div>
                            {rec.doctorName && (
                              <div style={{ fontSize: '12px', color: '#475569' }}>
                                👨‍⚕️ {rec.doctorName}
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
