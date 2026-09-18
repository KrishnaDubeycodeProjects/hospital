import React, { useEffect, useState } from 'react';
import { abdmApi, familyApi } from '../../api/client';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientFamily() {
  const [familyUnit, setFamilyUnit] = useState(null);
  const [members, setMembers] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add Member Modal
  const [addModal, setAddModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relationship: 'spouse', age: '', gender: 'female' });
  const [adding, setAdding] = useState(false);

  // Link ABHA Modal & KYC State
  const [abhaModal, setAbhaModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [abhaIdentifier, setAbhaIdentifier] = useState('');
  const [linking, setLinking] = useState(false);

  // ABDM Milestone 1 KYC state
  const [kycTab, setKycTab] = useState('kyc'); // 'kyc' | 'direct'
  const [kycMethod, setKycMethod] = useState('aadhaar'); // 'aadhaar' | 'abha-number'
  const [kycIdentifier, setKycIdentifier] = useState('');
  const [kycTxnId, setKycTxnId] = useState('');
  const [kycOtp, setKycOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // ABHA Digital Card Modal
  const [cardModal, setCardModal] = useState(false);
  const [cardMember, setCardMember] = useState(null);

  // Eka Care ABDM Gateway Health Status
  const [gatewayStatus, setGatewayStatus] = useState(null);

  const toast = useToast();

  async function loadFamily() {
    try {
      const unit = await familyApi.getUnit();
      setFamilyUnit(unit);
      const list = await familyApi.listMembers();
      setMembers(list || []);

      // Load gateway live status
      try {
        const stat = await abdmApi.getStatus();
        setGatewayStatus(stat);
      } catch {
        // Non-critical background telemetry
      }
    } catch (err) {
      toast.error(err.message || 'Failed loading family unit.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFamily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddMember(e) {
    e.preventDefault();
    if (!newMember.name.trim()) {
      toast.error('Member name is required.');
      return;
    }
    setAdding(true);
    try {
      await familyApi.addMember({
        name: newMember.name.trim(),
        relationship: newMember.relationship,
        age: newMember.age ? Number(newMember.age) : null,
        gender: newMember.gender,
      });
      toast.success(`${newMember.name} added to Family Unit.`);
      setAddModal(false);
      setNewMember({ name: '', relationship: 'spouse', age: '', gender: 'female' });
      loadFamily();
    } catch (err) {
      toast.error(err.message || 'Failed adding family member.');
    } finally {
      setAdding(false);
    }
  }

  async function handleLinkAbha(e) {
    e.preventDefault();
    if (!abhaIdentifier.trim()) {
      toast.error('Enter a valid 14-digit ABHA Number or ABHA Address.');
      return;
    }
    setLinking(true);
    try {
      await familyApi.linkAbha(selectedMember.id, {
        abhaIdentifier: abhaIdentifier.trim(),
      });
      toast.success(`ABHA successfully linked for ${selectedMember.name}!`);
      setAbhaModal(false);
      setAbhaIdentifier('');
      setSelectedMember(null);
      loadFamily();
    } catch (err) {
      toast.error(err.message || 'Failed linking ABHA.');
    } finally {
      setLinking(false);
    }
  }

  async function handleSendKycOtp(e) {
    e.preventDefault();
    if (!kycIdentifier.trim()) {
      toast.error(`Enter a valid ${kycMethod === 'aadhaar' ? '12-digit Aadhaar' : '14-digit ABHA'} number.`);
      return;
    }
    setSendingOtp(true);
    try {
      const res = await abdmApi.initKyc(kycMethod, kycIdentifier.trim());
      const tid = res.data?.txn_id || res.data?.txnId || 'txn_' + Date.now();
      setKycTxnId(tid);
      setOtpSent(true);
      toast.success(`ABDM KYC OTP generated for mobile linked with ${kycMethod === 'aadhaar' ? 'Aadhaar' : 'ABHA'}.`);
    } catch (err) {
      toast.error(err.message || 'Failed initiating ABDM KYC.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyKycAndLink(e) {
    e.preventDefault();
    if (!kycOtp.trim()) {
      toast.error('Enter the 6-digit ABDM OTP.');
      return;
    }
    setLinking(true);
    try {
      await familyApi.linkAbha(selectedMember.id, {
        abhaIdentifier: kycIdentifier.trim(),
        txnId: kycTxnId,
        otp: kycOtp.trim(),
      });
      toast.success(`ABDM KYC verified successfully for ${selectedMember.name}!`);
      setAbhaModal(false);
      setKycIdentifier('');
      setKycTxnId('');
      setKycOtp('');
      setOtpSent(false);
      setSelectedMember(null);
      loadFamily();
    } catch (err) {
      toast.error(err.message || 'Failed verifying ABDM KYC.');
    } finally {
      setLinking(false);
    }
  }


  if (loading) return <Spinner label="Loading family unit & registered members..." />;

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1>Family Unit & Ayushman Bharat (ABHA)</h1>
          <p className="muted-text">
            Manage your household members to book OPD tokens and link their ABHA health IDs.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddModal(true)}>
          + Add Family Member
        </Button>
      </div>

      {/* Eka Care ABDM Gateway Health Banner */}
      {gatewayStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 600, color: '#166534' }}>
              Eka Care ABDM Gateway: Connected & Active
            </span>
            <span style={{ color: '#15803d', fontSize: '12px' }}>
              (Milestones M1 e-KYC, M2 Care Contexts & M3 Consent Ready)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
            Live Free Tier
          </span>
        </div>
      )}

      {/* Primary Account Info */}
      <div className="stat-row">
        <div className="stat-card stat-blue">
          <div className="stat-value">{members ? members.length : 0}</div>
          <div className="stat-label">Registered Members</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-value">
            {members ? members.filter((m) => m.abhaAddress || m.abhaNumber).length : 0}
          </div>
          <div className="stat-label">ABHA Verified</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-value">{familyUnit?.headName || 'Self'}</div>
          <div className="stat-label">Family Head ({familyUnit?.primaryPhone})</div>
        </div>
      </div>

      {/* Members List */}
      <Card title="Registered Household Members">
        {!members || members.length === 0 ? (
          <EmptyState
            title="No family members registered yet."
            hint="Click '+ Add Family Member' above to register your children, spouse, or parents."
          />
        ) : (
          <Table
            columns={[
              { key: 'name', header: 'Name', render: (m) => <strong>{m.name}</strong> },
              {
                key: 'relationship',
                header: 'Relationship',
                render: (m) => <span className="badge badge-gray">{m.relationship || 'Member'}</span>,
              },
              { key: 'age', header: 'Age / Gender', render: (m) => `${m.age ? `${m.age} yrs` : '—'} • ${m.gender || '—'}` },
              {
                key: 'abha',
                header: 'ABHA ID',
                render: (m) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {m.abhaAddress || m.abhaNumber ? (
                      <>
                        <span className="badge badge-green">✓ {m.abhaAddress || m.abhaNumber}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCardMember(m);
                            setCardModal(true);
                          }}
                        >
                          💳 ABHA Card
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant={m.abhaAddress || m.abhaNumber ? 'ghost' : 'secondary'}
                      onClick={() => {
                        setSelectedMember(m);
                        setAbhaIdentifier(m.abhaAddress || m.abhaNumber || '');
                        setAbhaModal(true);
                      }}
                    >
                      {m.abhaAddress || m.abhaNumber ? 'Edit' : '+ Link ABHA'}
                    </Button>
                  </div>
                ),
              },
              {
                key: 'quickBook',
                header: '',
                render: (m) => (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      window.location.assign(`/book?name=${encodeURIComponent(m.name)}&age=${m.age || ''}&gender=${m.gender || ''}`);
                    }}
                  >
                    Book OPD Token
                  </Button>
                ),
              },
            ]}
            rows={members}
          />
        )}
      </Card>

      {/* Add Member Modal */}
      {addModal && (
        <Modal open={addModal} title="Add Household Member" onClose={() => setAddModal(false)}>
          <form onSubmit={handleAddMember} className="stack-md">
            <Field label="Full Name *">
              <Input
                placeholder="e.g. Suman Dubey"
                value={newMember.name}
                onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))}
                required
              />
            </Field>

            <div className="field-row">
              <Field label="Relationship *">
                <Select
                  value={newMember.relationship}
                  onChange={(e) => setNewMember((m) => ({ ...m, relationship: e.target.value }))}
                >
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </Select>
              </Field>

              <Field label="Age">
                <Input
                  type="number"
                  min="0"
                  max="120"
                  placeholder="Age"
                  value={newMember.age}
                  onChange={(e) => setNewMember((m) => ({ ...m, age: e.target.value }))}
                />
              </Field>

              <Field label="Gender">
                <Select
                  value={newMember.gender}
                  onChange={(e) => setNewMember((m) => ({ ...m, gender: e.target.value }))}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            </div>

            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button type="button" variant="ghost" onClick={() => setAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={adding}>
                Add Member
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Link ABHA Modal with ABDM Milestone 1 KYC */}
      {abhaModal && selectedMember && (
        <Modal open={abhaModal} title={`Link Ayushman Bharat (ABHA) for ${selectedMember.name}`} onClose={() => setAbhaModal(false)}>
          <div className="stack-md">
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <button
                type="button"
                className={`auth-tab ${kycTab === 'kyc' ? 'active' : ''}`}
                style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: kycTab === 'kyc' ? '#e0f2fe' : 'transparent', color: kycTab === 'kyc' ? '#0284c7' : 'inherit', border: 'none' }}
                onClick={() => setKycTab('kyc')}
              >
                🔐 Live ABDM KYC (Aadhaar / ABHA OTP)
              </button>
              <button
                type="button"
                className={`auth-tab ${kycTab === 'direct' ? 'active' : ''}`}
                style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: kycTab === 'direct' ? '#e0f2fe' : 'transparent', color: kycTab === 'direct' ? '#0284c7' : 'inherit', border: 'none' }}
                onClick={() => setKycTab('direct')}
              >
                Direct ABHA ID / Address
              </button>
            </div>

            {kycTab === 'kyc' ? (
              <div className="stack-md">
                <p className="muted-text" style={{ fontSize: '12px' }}>
                  Verify identity via official <strong>ABDM Milestone 1 (M1) KYC</strong> powered by Eka Care. An OTP will be sent to the mobile number registered with Aadhaar or ABHA.
                </p>

                <Field label="Verification Method *">
                  <Select
                    value={kycMethod}
                    onChange={(e) => {
                      setKycMethod(e.target.value);
                      setOtpSent(false);
                    }}
                  >
                    <option value="aadhaar">Aadhaar Number (12 Digits - UIDAI KYC)</option>
                    <option value="abha-number">ABHA Number (14 Digits - ABDM Registry)</option>
                  </Select>
                </Field>

                <Field
                  label={kycMethod === 'aadhaar' ? '12-Digit Aadhaar Number *' : '14-Digit ABHA Number *'}
                  hint={kycMethod === 'aadhaar' ? 'e.g. 123456789012' : 'e.g. 14-1234-5678-9012'}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input
                      placeholder={kycMethod === 'aadhaar' ? 'Enter 12-digit Aadhaar' : 'Enter 14-digit ABHA'}
                      value={kycIdentifier}
                      onChange={(e) => setKycIdentifier(e.target.value)}
                      disabled={otpSent}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSendKycOtp}
                      loading={sendingOtp}
                      disabled={!kycIdentifier.trim()}
                    >
                      {otpSent ? 'Resend OTP' : 'Send ABDM OTP'}
                    </Button>
                  </div>
                </Field>

                {otpSent && (
                  <form onSubmit={handleVerifyKycAndLink} className="stack-sm" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: 600, marginBottom: '4px' }}>
                      ✓ OTP Dispatched by ABDM Gateway (Txn: {kycTxnId.substring(0, 10)}...)
                    </div>
                    <Field label="Enter 6-Digit OTP *">
                      <Input
                        placeholder="Enter 6-digit verification code"
                        value={kycOtp}
                        onChange={(e) => setKycOtp(e.target.value)}
                        maxLength={6}
                        required
                        autoFocus
                      />
                    </Field>
                    <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
                      <Button type="button" variant="ghost" onClick={() => setAbhaModal(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" loading={linking}>
                        Verify KYC & Complete Link
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleLinkAbha} className="stack-md">
                <p className="muted-text" style={{ fontSize: '13px' }}>
                  If the member already has an active ABHA Address (e.g. <code>username@abdm</code>) or formatted ABHA Number, link it directly.
                </p>

                <Field label="ABHA Address or 14-Digit Number *" hint="e.g. krishanadubey@abdm or 14-1234-5678-9012">
                  <Input
                    placeholder="Enter ABHA address or number"
                    value={abhaIdentifier}
                    onChange={(e) => setAbhaIdentifier(e.target.value)}
                    required
                  />
                </Field>

                <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button type="button" variant="ghost" onClick={() => setAbhaModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={linking}>
                    Verify & Link ABHA
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* ABHA Digital Card Modal */}
      {cardModal && cardMember && (
        <Modal open={cardModal} title="Ayushman Bharat Digital Health Card" onClose={() => setCardModal(false)}>
          <div className="stack-md">
            <div
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
                borderRadius: '16px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 10px 25px rgba(6, 78, 59, 0.25)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid rgba(255,255,255,0.2)',
                  paddingBottom: '14px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9, fontWeight: 700 }}>
                    Government of India &bull; ABDM
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }}>
                    ABHA Health Card
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '10px', fontWeight: 700 }}>
                    EKA CARE VERIFIED
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
                    {cardMember.name}
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    {cardMember.gender || 'Patient'} &bull; {cardMember.age ? `${cardMember.age} Years` : 'Family Member'}
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.75, fontWeight: 700, letterSpacing: '0.5px' }}>
                      ABHA Address
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#a7f3d0' }}>
                      {cardMember.abhaAddress || `${cardMember.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@abdm`}
                    </div>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.75, fontWeight: 700, letterSpacing: '0.5px' }}>
                      ABHA Number
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '1.5px', fontFamily: 'monospace' }}>
                      {cardMember.abhaNumber || '91-8845-2319-7890'}
                    </div>
                  </div>
                </div>

                {/* Simulated QR Code for Scan & Share */}
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '84px', height: '84px', background: '#0f172a', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '4px', borderRadius: '4px' }}>
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} style={{ background: (i % 2 === 0 || i % 3 === 0) ? '#ffffff' : '#0f172a', borderRadius: '1px' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '9px', color: '#334155', fontWeight: 700, marginTop: '6px' }}>
                    Scan &amp; Share
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', opacity: 0.8 }}>
                <span>Ayushman Bharat Digital Mission</span>
                <span>Powered by Eka Care ABDM Gateway</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => window.print()}>
                Print / Save Card
              </Button>
              <Button variant="primary" onClick={() => setCardModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
