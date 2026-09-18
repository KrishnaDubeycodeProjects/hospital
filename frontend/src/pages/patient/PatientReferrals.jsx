import React, { useEffect, useState } from 'react';
import { referralApi } from '../../api/client';
import { Button, EmptyState, Modal, Spinner, Table } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientReferrals() {
  const [referrals, setReferrals] = useState(null);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function loadReferrals() {
    try {
      const list = await referralApi.patientReferrals();
      setReferrals(list || []);
    } catch (err) {
      toast.error(err.message || 'Failed loading referral slips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPriorityBadge(tier) {
    if (tier?.includes('emergency')) {
      return <span className="badge badge-red">🚨 Emergency (24h)</span>;
    }
    if (tier?.includes('urgent')) {
      return <span className="badge badge-amber">⚡ Urgent (7-Day Quota)</span>;
    }
    return <span className="badge badge-blue">Routine (30-Day)</span>;
  }

  if (loading) return <Spinner label="Loading your referral slips..." />;

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Hospital Referral Passes & Slips</h1>
          <p className="muted-text">
            Digital referral passes with cryptographically signed QR codes and guaranteed destination hospital quota reservations.
          </p>
        </div>
      </div>

      {!referrals || referrals.length === 0 ? (
        <EmptyState
          title="No Referrals Issued"
          hint="When a consulting doctor refers you or a family member to another hospital, your admission pass and QR code will appear here."
        />
      ) : (
        <div className="stack-md">
          <Table
            columns={[
              {
                key: 'id',
                header: 'Pass ID',
                render: (r) => <strong>#{r.id}</strong>,
              },
              {
                key: 'toHospital',
                header: 'Destination Hospital',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.toHospitalName || 'Specialty Hospital'}</div>
                    <div className="muted-text" style={{ fontSize: '12px' }}>
                      {r.targetDepartment || 'General Medicine'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'tier',
                header: 'Priority Tier',
                render: (r) => getPriorityBadge(r.priorityTier),
              },
              {
                key: 'validUntil',
                header: 'Valid Until',
                render: (r) => (
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.validUntil || '—'}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <span className={`badge ${r.status === 'completed' ? 'badge-green' : r.status === 'cancelled' ? 'badge-red' : 'badge-blue'}`}>
                    {r.status}
                  </span>
                ),
              },
              {
                key: 'action',
                header: '',
                render: (r) => (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setSelectedSlip(r)}
                  >
                    View QR Slip
                  </Button>
                ),
              },
            ]}
            rows={referrals}
          />
        </div>
      )}

      {/* QR Slip Modal */}
      {selectedSlip && (
        <Modal
          title={`Digital Referral Pass #${selectedSlip.id}`}
          onClose={() => setSelectedSlip(null)}
        >
          <div className="stack-md" style={{ textAlign: 'center' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'inline-block' }}>
              <img
                src={referralApi.qrUrl(selectedSlip.id)}
                alt="Referral Admission QR"
                style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto' }}
              />
            </div>

            <div style={{ marginTop: '8px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>
                {selectedSlip.toHospitalName || 'Specialty Hospital'}
              </h3>
              <div className="muted-text" style={{ fontSize: '13px' }}>
                Department: <strong>{selectedSlip.targetDepartment}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
              {getPriorityBadge(selectedSlip.priorityTier)}
              <span className="badge badge-gray">Valid until {selectedSlip.validUntil}</span>
            </div>

            {selectedSlip.reason && (
              <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', textAlign: 'left', marginTop: '10px' }}>
                <strong>Transfer Reason:</strong> {selectedSlip.reason}
              </div>
            )}

            <p className="muted-text" style={{ fontSize: '12px', margin: '12px 0 0' }}>
              Show this QR code at the reception of the destination hospital. It grants admission and unlocks your medical history for the treating physician.
            </p>

            <Button variant="primary" className="full-width" onClick={() => setSelectedSlip(null)}>
              Close Pass
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
