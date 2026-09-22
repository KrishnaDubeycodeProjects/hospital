import React, { useEffect, useState } from 'react';
import { patientApi } from '../../api/client';
import QrScanner from '../../components/QrScanner';
import { Button, EmptyState, Field, Input, Modal, Spinner, fmtDateTime } from '../../components/ui';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
          Doctor Access & Privacy
        </h2>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
          Grant temporary permission for your consulting doctor to review your medical documents.
        </p>
      </div>

      {/* Grant Access Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #004D40',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: '#004D40' }}>
            🔑 Grant Doctor Access
          </span>
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#166534',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            📷 Scan QR
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            accept(code);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <Field label="Enter 8-Character Doctor Code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD34"
              required
              style={{
                fontSize: '18px',
                letterSpacing: '0.15em',
                fontWeight: '800',
                textAlign: 'center',
                textTransform: 'uppercase',
                borderRadius: '12px',
                padding: '12px',
              }}
            />
          </Field>

          <button
            type="submit"
            disabled={claiming}
            style={{
              backgroundColor: '#004D40',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '13px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: claiming ? 'not-allowed' : 'pointer',
              opacity: claiming ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {claiming ? 'Verifying...' : 'Grant Record Access to Doctor'}
          </button>
        </form>
      </div>

      {/* Active Grants Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
            Doctors with Active Access
          </span>
          {active && (
            <span className="badge badge-green">
              {active.length} Active
            </span>
          )}
        </div>

        {active === null ? (
          <Spinner label="Loading access permissions..." />
        ) : active.length === 0 ? (
          <EmptyState
            title="No Active Doctor Access"
            hint="When you share an access code or scan a doctor's QR, their active permission card will appear here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {active.map((r) => (
              <div
                key={r.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🩺</span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        Dr. {r.doctorName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        🏥 {r.hospitalName || 'General OPD Clinic'}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-green">Active</span>
                </div>

                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Granted on: {fmtDateTime(r.grantedAt)}
                </div>

                <button
                  type="button"
                  onClick={() => revoke(r.id, r.doctorName)}
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    borderRadius: '10px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  🚫 Revoke Doctor Access
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Privacy Banner */}
      <div
        style={{
          backgroundColor: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>
          🛡️ ABDM Privacy Guarantee
        </div>
        <p style={{ fontSize: '12px', color: '#15803D', margin: 0, lineHeight: 1.4 }}>
          Access is limited only to your uploaded prescriptions and diagnostic reports. You retain 100% control and can revoke access anytime with one tap.
        </p>
      </div>

      {/* History (if any) */}
      {history && history.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', marginBottom: '8px', textTransform: 'uppercase' }}>
            Past Access Grants ({history.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                    Dr. {h.doctorName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                    {fmtDateTime(h.grantedAt)}
                  </div>
                </div>
                {h.revokedAt ? (
                  <span className="badge badge-gray">Revoked</span>
                ) : (
                  <span className="badge badge-green">Active</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      {scanOpen && (
        <Modal title="Scan Doctor QR Code" onClose={() => setScanOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Point camera at the QR code displayed on your doctor's desk or screen.
            </p>
            <QrScanner
              onResult={(scannedText) => {
                if (scannedText) {
                  accept(scannedText);
                }
              }}
            />
            <Button variant="ghost" onClick={() => setScanOpen(false)} style={{ width: '100%' }}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
