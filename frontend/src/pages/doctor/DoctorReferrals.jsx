import React, { useEffect, useState } from 'react';
import { doctorApi, hospitalApi, referralApi } from '../../api/client';
import { Button, Card, Field, Input, Modal, Select, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorReferrals() {
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick referral modal
  const [createModal, setCreateModal] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [toHospitalId, setToHospitalId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('General Medicine');
  const [reason, setReason] = useState('');
  const [priorityTier, setPriorityTier] = useState('urgent_7d');
  const [submitting, setSubmitting] = useState(false);

  // Prior Context Inspection modal
  const [contextModal, setContextModal] = useState(false);
  const [contextCourseId, setContextCourseId] = useState('');
  const [priorData, setPriorData] = useState(null);
  const [fetchingContext, setFetchingContext] = useState(false);

  // QR Viewer modal
  const [selectedQr, setSelectedQr] = useState(null);

  const toast = useToast();

  async function loadData() {
    try {
      const me = await doctorApi.me();
      setProfile(me);
      const list = await hospitalApi.list();
      setHospitals(list || []);
    } catch (err) {
      toast.error(err.message || 'Failed loading referral workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateReferral(e) {
    e.preventDefault();
    if (!courseId || !toHospitalId) {
      toast.error('Course ID and Destination Hospital are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await referralApi.create({
        courseId: Number(courseId),
        toHospitalId: Number(toHospitalId),
        targetDepartment,
        reason,
        priorityTier,
      });
      toast.success(`Referral #${res.id} generated with pessimistic quota lock.`);
      setCreateModal(false);
      setCourseId('');
      setReason('');
      setSelectedQr(res);
    } catch (err) {
      toast.error(err.message || 'Failed creating referral. Hospital quota may be exhausted.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInspectPriorContext(e) {
    e.preventDefault();
    if (!contextCourseId) return;

    setFetchingContext(true);
    try {
      const data = await referralApi.priorContext(Number(contextCourseId), profile.hospitalId);
      setPriorData(data);
    } catch (err) {
      toast.error(err.message || 'Unable to retrieve prior context.');
      setPriorData(null);
    } finally {
      setFetchingContext(false);
    }
  }

  async function handleCancelReferral(id) {
    if (!window.confirm(`Are you sure you want to cancel Referral #${id}? This will free up the hospital quota slot.`)) {
      return;
    }
    try {
      await referralApi.cancel(id);
      toast.success(`Referral #${id} cancelled. Quota slot released.`);
    } catch (err) {
      toast.error(err.message || 'Failed cancelling referral.');
    }
  }

  if (loading) return <Spinner label="Loading referral and triage console..." />;

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Tiered Referrals & Triage Console</h1>
          <p className="muted-text">
            Issue quota-guaranteed hospital referrals with concurrency locking, or inspect incoming patient clinical context.
          </p>
        </div>
        <div className="row-gap">
          <Button variant="primary" onClick={() => setCreateModal(true)}>
            + Issue New Referral
          </Button>
          <Button variant="secondary" onClick={() => setContextModal(true)}>
            🔍 Inspect Incoming Prior Context
          </Button>
        </div>
      </div>

      {/* Quota Overview Cards */}
      <div className="stat-row">
        <div className="stat-card stat-blue">
          <div className="stat-value">{profile?.hospitalName ? 'Enforced' : '—'}</div>
          <div className="stat-label">Pessimistic Quota Guard</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-value">7 Days</div>
          <div className="stat-label">Urgent Validity Ceiling</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-value">Real-Time</div>
          <div className="stat-label">Post-Commit WhatsApp Slip</div>
        </div>
      </div>

      {/* Instructions Card */}
      <Card title="How Quota Locking & Seamless Admission Works">
        <div className="stack-sm" style={{ fontSize: '14px', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            <strong>1. Concurrency-Safe Quota Allocation:</strong> Destination hospitals enforce daily limits (e.g., max 5 urgent slots/day). The backend locks the hospital row with <code>SELECT ... FOR UPDATE</code> before incrementing, preventing accidental overbooking.
          </p>
          <p style={{ margin: 0 }}>
            <strong>2. Encrypted QR Slip:</strong> The patient is issued a digitally verifiable QR code delivered straight to WhatsApp and the patient portal.
          </p>
          <p style={{ margin: 0 }}>
            <strong>3. Prior Context Ingestion:</strong> When the patient arrives at the receiving hospital, the doctor enters the Course ID or scans the slip to immediately unlock the full clinical summary, prescriptions, and lab history.
          </p>
        </div>
      </Card>

      {/* Create Referral Modal */}
      {createModal && (
        <Modal title="Issue Priority Tiered Referral" onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreateReferral} className="stack-md">
            <Field label="Medical Course ID *" hint="Course / Episode ID being referred">
              <Input
                type="number"
                placeholder="e.g. 1"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              />
            </Field>

            <Field label="Destination Hospital *" hint="Row locked via SELECT FOR UPDATE">
              <Select value={toHospitalId} onChange={(e) => setToHospitalId(e.target.value)} required>
                <option value="">Select target hospital…</option>
                {hospitals
                  .filter((h) => h.id !== profile?.hospitalId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} (Urgent Quota: {h.urgentReferralQuota ?? 5}/day)
                    </option>
                  ))}
              </Select>
            </Field>

            <div className="field-row">
              <Field label="Target Department">
                <Select value={targetDepartment} onChange={(e) => setTargetDepartment(e.target.value)}>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="General Surgery">General Surgery</option>
                  <option value="General Medicine">General Medicine</option>
                </Select>
              </Field>

              <Field label="Priority Tier">
                <Select value={priorityTier} onChange={(e) => setPriorityTier(e.target.value)}>
                  <option value="emergency_immediate">🚨 Emergency (Immediate 24h)</option>
                  <option value="urgent_7d">⚡ Urgent (Strict 7-Day Quota)</option>
                  <option value="routine_30d">📋 Routine (30-Day Window)</option>
                </Select>
              </Field>
            </div>

            <Field label="Clinical Reason / Transfer Note *">
              <Input
                placeholder="e.g. Acute coronary evaluation required"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </Field>

            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button type="button" variant="ghost" onClick={() => setCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Issue & Lock Quota
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Prior Context Inspection Modal */}
      {contextModal && (
        <Modal title="Inspect Incoming Referral Prior Context" wide onClose={() => setContextModal(false)}>
          <div className="stack-md">
            <form onSubmit={handleInspectPriorContext} className="row-gap">
              <Field label="Course ID from Referral Slip">
                <Input
                  type="number"
                  placeholder="Enter Course ID"
                  value={contextCourseId}
                  onChange={(e) => setContextCourseId(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" variant="primary" loading={fetchingContext} style={{ alignSelf: 'flex-end', minHeight: '48px' }}>
                Retrieve Prior Context
              </Button>
            </form>

            {priorData && (
              <div style={{ background: 'var(--surface-sunken)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px', color: 'var(--primary)' }}>
                  Incoming Transfer: Referral #{priorData.id}
                </h4>
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                  <div><strong>Originating Clinic:</strong> {priorData.fromHospitalName || 'Referring Clinic'}</div>
                  <div><strong>Referring Doctor:</strong> {priorData.referredByName || 'Attending Physician'}</div>
                  <div><strong>Priority Tier:</strong> <span className="badge badge-amber">{priorData.priorityTier}</span></div>
                  <div><strong>Valid Until:</strong> {priorData.validUntil}</div>
                  <div style={{ marginTop: '8px' }}><strong>Transfer Reason:</strong> {priorData.reason}</div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      try {
                        await referralApi.complete(priorData.id);
                        toast.success(`Referral #${priorData.id} marked as completed & admitted.`);
                        setContextModal(false);
                      } catch (e) {
                        toast.error(e.message || 'Failed admitting referral.');
                      }
                    }}
                  >
                    ✓ Admit & Complete Referral
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleCancelReferral(priorData.id)}>
                    Cancel / Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* QR Viewer Modal */}
      {selectedQr && (
        <Modal title={`Referral Pass #${selectedQr.id}`} onClose={() => setSelectedQr(null)}>
          <div className="stack-md" style={{ textAlign: 'center' }}>
            <img
              src={referralApi.qrUrl(selectedQr.id)}
              alt="Referral Pass QR"
              style={{ width: '200px', height: '200px', margin: '0 auto', border: '1px solid var(--border)', borderRadius: '8px' }}
            />
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {selectedQr.toHospitalName || 'Destination Hospital'} &bull; {selectedQr.priorityTier}
            </div>
            <p className="muted-text" style={{ fontSize: '12px' }}>
              Patient has received this QR code via WhatsApp. Show this pass upon OPD admission.
            </p>
            <Button variant="primary" onClick={() => setSelectedQr(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
