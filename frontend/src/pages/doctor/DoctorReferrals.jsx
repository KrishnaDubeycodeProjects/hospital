import React, { useEffect, useState } from 'react';
import { doctorApi, hospitalApi, referralApi } from '../../api/client';
import { Button, Card, Field, Input, Modal, Select, Spinner, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorReferrals() {
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab State: 'outgoing' | 'incoming'
  const [activeTab, setActiveTab] = useState('outgoing');
  const [outgoingList, setOutgoingList] = useState([]);
  const [incomingList, setIncomingList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal
  const [createModal, setCreateModal] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [toHospitalId, setToHospitalId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('Cardiology');
  const [reason, setReason] = useState('');
  const [priorityTier, setPriorityTier] = useState('urgent_7d');
  const [submitting, setSubmitting] = useState(false);

  // Context Modal
  const [contextModal, setContextModal] = useState(false);
  const [contextCourseId, setContextCourseId] = useState('');
  const [fetchingContext, setFetchingContext] = useState(false);
  const [priorData, setPriorData] = useState(null);

  // QR Viewer Modal
  const [selectedQr, setSelectedQr] = useState(null);
  const toast = useToast();

  async function loadData() {
    try {
      const [me, hospList] = await Promise.all([doctorApi.me(), hospitalApi.list()]);
      setProfile(me);
      setHospitals(hospList || []);

      // Fetch outgoing and incoming hospital referrals
      try {
        const res = await fetch('/api/referrals/hospital', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });
        if (res.ok) {
          const body = await res.json();
          if (body.data) {
            setOutgoingList(body.data.outgoing || []);
            setIncomingList(body.data.incoming || []);
          }
        }
      } catch (e) {
        console.warn('Could not load hospital referrals:', e);
      }
    } catch (err) {
      toast.error(err.message || 'Failed loading referral details.');
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
      loadData();
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
      const data = await referralApi.priorContext(Number(contextCourseId), profile?.hospitalId || 1);
      setPriorData(data);
    } catch (err) {
      toast.error(err.message || 'Unable to retrieve prior context.');
      setPriorData(null);
    } finally {
      setFetchingContext(false);
    }
  }

  async function handleCancelReferral(id) {
    if (!window.confirm(`Are you sure you want to cancel Referral #${id}? This will release the quota slot.`)) {
      return;
    }
    try {
      await referralApi.cancel(id);
      toast.success(`Referral #${id} cancelled. Quota slot released.`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed cancelling referral.');
    }
  }

  const q = searchQuery.toLowerCase().trim();
  const filteredOutgoing = outgoingList.filter((r) => {
    if (!q) return true;
    return (
      (r.patientName && r.patientName.toLowerCase().includes(q)) ||
      (r.patientPhone && r.patientPhone.includes(q)) ||
      (r.toHospitalName && r.toHospitalName.toLowerCase().includes(q)) ||
      (r.targetDepartment && r.targetDepartment.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  const filteredIncoming = incomingList.filter((r) => {
    if (!q) return true;
    return (
      (r.patientName && r.patientName.toLowerCase().includes(q)) ||
      (r.patientPhone && r.patientPhone.includes(q)) ||
      (r.fromHospitalName && r.fromHospitalName.toLowerCase().includes(q)) ||
      (r.referringDoctorName && r.referringDoctorName.toLowerCase().includes(q)) ||
      (r.targetDepartment && r.targetDepartment.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  if (loading) return <Spinner label="Loading referral and triage console..." />;

  return (
    <div className="stack-lg">
      {/* Header Bar */}
      <div className="card-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            Referrals & Triage Console
          </h1>
          <p className="muted-text" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
            Manage outbound specialist referrals with pessimistic quota locking and admit incoming transfer patients with prior clinical context.
          </p>
        </div>
        <div className="row-gap">
          <Button variant="primary" onClick={() => setCreateModal(true)}>
            + Issue New Referral
          </Button>
          <Button variant="secondary" onClick={() => setContextModal(true)}>
            Inspect Prior Context
          </Button>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="stat-row">
        <div className="stat-card stat-blue">
          <div className="stat-value">{outgoingList.length}</div>
          <div className="stat-label">Outbound Referrals Issued</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-value">{incomingList.length}</div>
          <div className="stat-label">Incoming Transfer Patients</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-value">
            {profile?.hospitalName ? 'Active' : 'Enforced'}
          </div>
          <div className="stat-label">Pessimistic Quota Guard</div>
        </div>
      </div>

      {/* Search and Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Dual Clean Tabs without icons */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', paddingBottom: '2px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('outgoing')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'outgoing' ? '#004D40' : '#64748B',
              borderBottom: activeTab === 'outgoing' ? '3px solid #004D40' : '3px solid transparent',
              marginBottom: '-4px',
            }}
          >
            Outgoing Referrals ({outgoingList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'incoming' ? '#004D40' : '#64748B',
              borderBottom: activeTab === 'incoming' ? '3px solid #004D40' : '3px solid transparent',
              marginBottom: '-4px',
            }}
          >
            Incoming Referrals ({incomingList.length})
          </button>
        </div>

        <div style={{ width: '280px' }}>
          <Input
            placeholder="Search patient, hospital, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table Content */}
      {activeTab === 'outgoing' ? (
        <Card title="Outgoing Referrals (Issued from this Clinic)">
          {filteredOutgoing.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
              No outgoing referrals found. Click &quot;+ Issue New Referral&quot; to transfer a patient with quota locking.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 12px' }}>Ref #</th>
                    <th style={{ padding: '10px 12px' }}>Patient</th>
                    <th style={{ padding: '10px 12px' }}>Destination Hospital</th>
                    <th style={{ padding: '10px 12px' }}>Department</th>
                    <th style={{ padding: '10px 12px' }}>Priority Tier</th>
                    <th style={{ padding: '10px 12px' }}>Valid Until</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutgoing.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#004D40' }}>
                        #{r.id}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{r.patientName || 'Patient'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{r.patientPhone}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.toHospitalName || 'Specialist Hospital'}</td>
                      <td style={{ padding: '10px 12px' }}>{r.targetDepartment}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          className={`badge ${
                            r.priorityTier?.includes('emergency')
                              ? 'badge-red'
                              : r.priorityTier?.includes('urgent')
                              ? 'badge-amber'
                              : 'badge-blue'
                          }`}
                          style={{ fontSize: '11px', textTransform: 'capitalize' }}
                        >
                          {r.priorityTier?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.validUntil || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          className={`badge ${
                            r.status === 'completed'
                              ? 'badge-green'
                              : r.status === 'cancelled'
                              ? 'badge-red'
                              : 'badge-blue'
                          }`}
                          style={{ fontSize: '11px', textTransform: 'capitalize' }}
                        >
                          {r.status || 'issued'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedQr(r)}
                            style={{ fontSize: '11px' }}
                          >
                            View Pass QR
                          </Button>
                          {r.status === 'issued' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelReferral(r.id)}
                              style={{ fontSize: '11px', color: '#DC2626' }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card title="Incoming Referrals (Transfers to this Hospital)">
          {filteredIncoming.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
              No incoming transfer referrals at this time.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 12px' }}>Ref #</th>
                    <th style={{ padding: '10px 12px' }}>Originating Facility</th>
                    <th style={{ padding: '10px 12px' }}>Referring Doctor</th>
                    <th style={{ padding: '10px 12px' }}>Patient</th>
                    <th style={{ padding: '10px 12px' }}>Department</th>
                    <th style={{ padding: '10px 12px' }}>Priority</th>
                    <th style={{ padding: '10px 12px' }}>Reason</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncoming.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#004D40' }}>
                        #{r.id}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.fromHospitalName || 'Primary Health Center'}</td>
                      <td style={{ padding: '10px 12px' }}>{r.referringDoctorName || 'Referring Physician'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{r.patientName || 'Patient'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{r.patientPhone}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.targetDepartment}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          className={`badge ${
                            r.priorityTier?.includes('emergency')
                              ? 'badge-red'
                              : r.priorityTier?.includes('urgent')
                              ? 'badge-amber'
                              : 'badge-blue'
                          }`}
                          style={{ fontSize: '11px', textTransform: 'capitalize' }}
                        >
                          {r.priorityTier?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '320px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {r.reason}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setContextCourseId(String(r.courseId));
                            setPriorData(r);
                            setContextModal(true);
                          }}
                          style={{ fontSize: '11px' }}
                        >
                          Inspect Context
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

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

            <Field label="Destination Hospital *" hint="Locked via pessimistic quota lock">
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
                  <option value="emergency_immediate">Emergency (Immediate 24h)</option>
                  <option value="urgent_7d">Urgent (Strict 7-Day Quota)</option>
                  <option value="routine_30d">Routine (30-Day Window)</option>
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
                  <div><strong>Referring Doctor:</strong> {priorData.referredByName || priorData.referringDoctorName || 'Attending Physician'}</div>
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
                        loadData();
                      } catch (e) {
                        toast.error(e.message || 'Failed admitting referral.');
                      }
                    }}
                  >
                    Admit & Complete Referral
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
              Patient has received this referral pass and notification. Show this pass upon OPD admission.
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
