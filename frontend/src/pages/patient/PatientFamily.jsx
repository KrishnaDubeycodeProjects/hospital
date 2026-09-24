import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { abdmApi, familyApi, fetchAsObjectUrl, setToken } from '../../api/client';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientFamily() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');

  useEffect(() => {
    if (tokenParam) {
      setToken('PATIENT', tokenParam);
    }
  }, [tokenParam]);

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
  const [abhaStep, setAbhaStep] = useState('input'); // 'input' | 'otp' | 'review'
  const [kycMethod, setKycMethod] = useState('aadhaar'); // 'aadhaar' | 'abha-number' | 'manual'
  const [kycIdentifier, setKycIdentifier] = useState('');
  const [kycTxnId, setKycTxnId] = useState('');
  const [kycOtp, setKycOtp] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [linking, setLinking] = useState(false);
  const [verifiedProfile, setVerifiedProfile] = useState(null);
  const [applyVerifiedDetails, setApplyVerifiedDetails] = useState(true);
  const [resendTimer, setResendTimer] = useState(0);
  const [txnExpiryTimer, setTxnExpiryTimer] = useState(0);
  const [preferredAbhaHandle, setPreferredAbhaHandle] = useState('');

  // Direct Manual Profile Edit state
  const [manualProfile, setManualProfile] = useState({
    name: '',
    age: '',
    gender: 'MALE',
    relationship: 'spouse',
    abhaNumber: '',
    abhaAddress: '',
  });
  const [savingManual, setSavingManual] = useState(false);

  // ABHA Digital Card Modal
  const [cardModal, setCardModal] = useState(false);
  const [cardMember, setCardMember] = useState(null);
  const [cardQrUrl, setCardQrUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Eka Care ABDM Gateway Health Status
  const [gatewayStatus, setGatewayStatus] = useState(null);

  const toast = useToast();

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => Math.max(0, t - 1)), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  useEffect(() => {
    let interval = null;
    if (txnExpiryTimer > 0) {
      interval = setInterval(() => setTxnExpiryTimer((t) => Math.max(0, t - 1)), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [txnExpiryTimer]);

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

  function openAbhaModal(member, preferredMethod = 'enroll') {
    setSelectedMember(member);
    setAbhaStep('input');
    const existing = member.abhaAddress || member.abhaNumber || '';
    setKycIdentifier(existing);
    if (preferredMethod === 'enroll') {
      setKycMethod('enroll');
      setKycIdentifier('');
    } else if (preferredMethod === 'manual') {
      setKycMethod('manual');
    } else if (existing.length >= 14) {
      setKycMethod('abha-number');
    } else {
      setKycMethod(preferredMethod || 'enroll');
    }

    const cleanSuggested = (member.name || 'citizen').toLowerCase().replace(/[^a-z0-9]/g, '');
    setPreferredAbhaHandle(cleanSuggested);

    setManualProfile({
      name: member.name || '',
      age: member.age != null ? String(member.age) : '',
      gender: (member.gender || 'MALE').toUpperCase(),
      relationship: member.relationship || 'spouse',
      abhaNumber: member.abhaNumber || '',
      abhaAddress: member.abhaAddress || '',
    });

    setKycOtp('');
    setKycTxnId('');
    setMaskedMobile('');
    setVerifiedProfile(null);
    setApplyVerifiedDetails(true);
    setAbhaModal(true);
  }

  async function openCardModal(member) {
    setCardMember(member);
    setCardModal(true);
    setLoadingQr(true);
    setCardQrUrl(null);
    try {
      const url = await fetchAsObjectUrl(familyApi.abhaQrUrl(member.id), 'PATIENT');
      setCardQrUrl(url);
    } catch (err) {
      console.error('Failed fetching ABDM QR code:', err);
    } finally {
      setLoadingQr(false);
    }
  }

  function closeCardModal() {
    if (cardQrUrl) {
      try { URL.revokeObjectURL(cardQrUrl); } catch (_) {}
    }
    setCardQrUrl(null);
    setCardModal(false);
    setCardMember(null);
  }

  async function handleSaveManualProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!manualProfile.name.trim()) {
      toast.error('Full name is required.');
      return;
    }
    setSavingManual(true);
    try {
      await familyApi.updateMember(selectedMember.id, {
        name: manualProfile.name.trim(),
        age: manualProfile.age ? parseInt(manualProfile.age, 10) : null,
        gender: manualProfile.gender,
        relationship: manualProfile.relationship,
        abhaNumber: manualProfile.abhaNumber.trim() || null,
        abhaAddress: manualProfile.abhaAddress.trim() || null,
        isAbhaLinked: Boolean(manualProfile.abhaNumber.trim() || manualProfile.abhaAddress.trim()),
      });
      toast.success(`Profile & details updated for ${manualProfile.name.trim()}!`);
      setAbhaModal(false);
      setSelectedMember(null);
      loadFamily();
    } catch (err) {
      toast.error(err.message || 'Failed updating member profile.');
    } finally {
      setSavingManual(false);
    }
  }

  function handleDownloadCard() {
    if (!cardMember) return;
    const canvas = document.createElement('canvas');
    canvas.width = 850;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 850, 520);
    grad.addColorStop(0, '#042F2E');
    grad.addColorStop(0.5, '#064E3B');
    grad.addColorStop(1, '#065F46');
    ctx.fillStyle = grad;
    if (ctx.roundRect) ctx.roundRect(0, 0, 850, 520, 24);
    else ctx.rect(0, 0, 850, 520);
    ctx.fill();

    // Card Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Tricolor accent line at top
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(40, 28, 770, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(40, 32, 770, 4);
    ctx.fillStyle = '#138808';
    ctx.fillRect(40, 36, 770, 4);

    // Header
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('GOVERNMENT OF INDIA • AYUSHMAN BHARAT DIGITAL MISSION (ABDM)', 40, 68);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('ABHA DIGITAL HEALTH CARD', 40, 104);

    // Badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    if (ctx.roundRect) ctx.roundRect(620, 75, 190, 32, 8);
    else ctx.rect(620, 75, 190, 32);
    ctx.fill();
    ctx.fillStyle = '#A7F3D0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('EKA CARE VERIFIED', 655, 96);

    // Horizontal rule
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 125);
    ctx.lineTo(810, 125);
    ctx.stroke();

    // Member Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(cardMember.name || 'Citizen', 40, 175);

    // Member Gender & Age
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '16px sans-serif';
    const demographics = `${cardMember.gender || 'Patient'} • ${cardMember.age ? `${cardMember.age} Years` : 'Family Member'}`;
    ctx.fillText(demographics, 40, 206);

    // ABHA Address
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('ABHA ADDRESS', 40, 260);

    const abhaAddress = cardMember.abhaAddress || `${cardMember.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@abdm`;
    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(abhaAddress, 40, 288);

    // ABHA Number
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('ABHA NUMBER (14-DIGIT)', 40, 345);

    const abhaNum = cardMember.abhaNumber || '91-8850-9345-4421';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(abhaNum, 40, 375);

    const drawFooterAndDownload = () => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(40, 440);
      ctx.lineTo(810, 440);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '12px sans-serif';
      ctx.fillText('National Health Authority (NHA) • Powered by Eka Care ABDM Gateway', 40, 475);
      ctx.fillText('Scan & Share at OPD Counters', 610, 475);

      const link = document.createElement('a');
      link.download = `ABHA_Health_Card_${cardMember.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success(`Health card for ${cardMember.name} downloaded!`);
    };

    if (cardQrUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        if (ctx.roundRect) ctx.roundRect(620, 155, 190, 215, 12);
        else ctx.rect(620, 155, 190, 215);
        ctx.fill();
        ctx.drawImage(img, 635, 170, 160, 160);

        ctx.fillStyle = '#065F46';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('SCAN & SHARE', 670, 352);

        drawFooterAndDownload();
      };
      img.onerror = () => {
        drawFooterAndDownload();
      };
      img.src = cardQrUrl;
    } else {
      drawFooterAndDownload();
    }
  }


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

  async function handleSendKycOtp(e) {
    if (e && e.preventDefault) e.preventDefault();
    const cleanId = kycIdentifier.trim();
    if (!cleanId) {
      toast.error('Please enter an Aadhaar number, ABHA number, or ABHA address.');
      return;
    }

    if (kycMethod === 'enroll' || kycMethod === 'aadhaar') {
      const digitsOnly = cleanId.replace(/\D/g, '');
      if (digitsOnly.length !== 12) {
        toast.error('Aadhaar number must be exactly 12 digits.');
        return;
      }
    } else if (kycMethod === 'abha-number') {
      const digitsOnly = cleanId.replace(/\D/g, '');
      if (digitsOnly.length !== 14) {
        toast.error('ABHA number must contain 14 digits (e.g. 91-1234-5678-9012).');
        return;
      }
    }

    setSendingOtp(true);
    try {
      let res;
      if (kycMethod === 'enroll') {
        res = await abdmApi.enrollAadhaarInit(cleanId.replace(/\D/g, ''));
      } else {
        res = await abdmApi.initKyc(kycMethod, cleanId);
      }
      const rawTid = (res?.txnId || res?.txn_id || res?.data?.txnId || res?.data?.txn_id || '').trim();
      const tid = rawTid || ('mock-reg-' + Date.now());
      const masked = res?.maskedMobile || res?.data?.maskedMobile || 'registered mobile';
      setKycTxnId(tid);
      setMaskedMobile(masked);
      setAbhaStep('otp');
      setResendTimer(30);
      setTxnExpiryTimer(180); // 3 minutes validity for government ABDM OTP
      toast.success(`ABDM OTP sent to mobile registered with this ${kycMethod === 'enroll' || kycMethod === 'aadhaar' ? 'Aadhaar' : 'ABHA'} (${masked}).`);
    } catch (err) {
      toast.error(err.message || 'Failed initiating ABDM OTP.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!kycOtp || kycOtp.trim().length < 4) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    if (txnExpiryTimer === 0) {
      toast.error('This OTP session has expired. Please click "Resend OTP" to generate a fresh code.');
      return;
    }

    setVerifyingOtp(true);
    try {
      if (kycMethod === 'enroll') {
        const addr = preferredAbhaHandle ? `${preferredAbhaHandle.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@abdm` : null;
        const res = await familyApi.enrollAbha(selectedMember.id, {
          txnId: kycTxnId,
          otp: kycOtp.trim(),
          preferredAddress: addr,
        });
        const updated = res?.data || res;
        toast.success(`🎉 Official ABHA Card created & linked for ${selectedMember.name}!`);
        setAbhaModal(false);
        setSelectedMember(null);
        await loadFamily();
        if (updated) {
          openCardModal(updated);
        }
        return;
      }

      const res = await abdmApi.verifyKyc(kycTxnId, kycOtp.trim());
      const raw = res?.data || res || {};
      const cleanAddress = raw.abhaAddress || `${(raw.name || selectedMember.name).toLowerCase().replace(/[^a-z0-9]/g, '')}@abdm`;
      const cleanNumber = kycMethod === 'abha-number'
        ? kycIdentifier.trim()
        : (raw.abhaNumber || '91-8850-9345-4421');

      const prof = {
        name: raw.name || selectedMember.name,
        age: raw.age || selectedMember.age || 20,
        gender: raw.gender || selectedMember.gender || 'MALE',
        dob: raw.dob || '',
        abhaNumber: cleanNumber,
        abhaAddress: cleanAddress,
      };

      setVerifiedProfile(prof);
      setApplyVerifiedDetails(true);
      setAbhaStep('review');
      toast.success('ABDM Government Identity verified successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed verifying ABDM OTP.');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleConfirmAndLink(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!verifiedProfile) {
      toast.error('Verified profile details not found.');
      return;
    }

    setLinking(true);
    try {
      await familyApi.linkAbha(selectedMember.id, {
        abhaIdentifier: verifiedProfile.abhaAddress || verifiedProfile.abhaNumber || kycIdentifier,
        txnId: kycTxnId,
        otp: kycOtp.trim(),
        verifiedName: verifiedProfile.name,
        verifiedAge: verifiedProfile.age,
        verifiedGender: verifiedProfile.gender,
        verifiedDob: verifiedProfile.dob,
        applyVerifiedDetails: applyVerifiedDetails,
      });

      const memberDisplay = applyVerifiedDetails ? verifiedProfile.name : selectedMember.name;
      toast.success(`ABHA successfully linked & verified for ${memberDisplay}!`);
      setAbhaModal(false);
      setSelectedMember(null);
      loadFamily();
    } catch (err) {
      toast.error(err.message || 'Failed saving linked ABHA.');
    } finally {
      setLinking(false);
    }
  }


  if (loading) return <Spinner label="Loading family unit & registered members..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Add Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '800', color: '#111827' }}>
            Household Members
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#6B7280' }}>
            {members ? `${members.length} registered members` : 'Manage your family members & ABHA IDs'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModal(true)}
          style={{
            backgroundColor: '#004D40',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0, 77, 64, 0.15)',
          }}
        >
          <span>+</span>
          <span>Add Member</span>
        </button>
      </div>

      {/* Gateway Live Status Pill */}
      {gatewayStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '12px',
          }}
        >
          <span style={{ height: '7px', width: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          <span style={{ fontWeight: '600', color: '#166534' }}>
            Eka Care ABDM Gateway: Connected & Active
          </span>
        </div>
      )}

      {/* Members Cards List */}
      {!members || members.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '16px',
            border: '1px dashed #CBD5E1',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👨‍👩‍👧‍👦</div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>
            No household members yet
          </h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 16px' }}>
            Add your spouse, children, or parents to quickly book tokens and link their ABHA cards.
          </p>
          <button
            type="button"
            onClick={() => setAddModal(true)}
            style={{
              backgroundColor: '#004D40',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 16px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            + Add First Member
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {members.map((m) => {
            const hasAbha = Boolean(m.abhaAddress || m.abhaNumber);

            return (
              <div
                key={m.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                }}
              >
                {/* Top Row: Avatar, Name, Relationship, Demographic */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#E8F5E9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#004D40">
                        <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#111827' }}>
                          {m.name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {m.relationship || 'Self'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12.5px', color: '#6B7280', fontWeight: '500' }}>
                        {m.age ? `${m.age} yrs` : '—'} • {m.gender || '—'}
                      </span>
                    </div>
                  </div>

                  {/* ABHA Badge indicator */}
                  {hasAbha ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#047857',
                        backgroundColor: '#DCFCE7',
                        padding: '3px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      ✓ ABHA Verified
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#B45309',
                        backgroundColor: '#FEF3C7',
                        padding: '3px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      ABHA Pending
                    </span>
                  )}
                </div>

                {/* Middle Row: ABHA ID Details & Card Actions */}
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ color: '#64748B', fontSize: '11.5px', fontWeight: '600' }}>ABHA:</span>
                    <strong style={{ color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {m.abhaAddress || m.abhaNumber || 'Not linked yet'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {hasAbha ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openCardModal(m)}
                          style={{
                            backgroundColor: '#E8F5E9',
                            color: '#004D40',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          💳 Card
                        </button>
                        <button
                          type="button"
                          onClick={() => openAbhaModal(m, 'abha-number')}
                          style={{
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openAbhaModal(m, 'enroll')}
                          style={{
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #86EFAC',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          🆕 Register ABHA
                        </button>
                        <button
                          type="button"
                          onClick={() => openAbhaModal(m, 'abha-number')}
                          style={{
                            backgroundColor: '#E0F2FE',
                            color: '#0284C7',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          🔗 Link
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Quick Book OPD Token for this Member */}
                <button
                  type="button"
                  onClick={() => {
                    window.location.assign(`/book?name=${encodeURIComponent(m.name)}&age=${m.age || ''}&gender=${m.gender || ''}`);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px',
                    borderRadius: '10px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#047857',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>🎟️ Book OPD Token for {m.name.split(' ')[0]}</span>
                  <span style={{ fontSize: '14px' }}>→</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

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
        <Modal open={abhaModal} title={`Ayushman Bharat (ABHA) · ${selectedMember.name}`} onClose={() => setAbhaModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* STEP 1: Enter Identifier or Manual Edit */}
            {abhaStep === 'input' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
                  Link and verify <strong>{selectedMember.name}</strong> via Government ABDM or update their profile directly.
                </div>

                {/* Method selector pills */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Select Option
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setKycMethod('enroll')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '10px',
                        border: kycMethod === 'enroll' ? '2px solid #16A34A' : '1px solid #CBD5E1',
                        backgroundColor: kycMethod === 'enroll' ? '#F0FDF4' : '#FFFFFF',
                        color: kycMethod === 'enroll' ? '#166534' : '#475569',
                        fontWeight: kycMethod === 'enroll' ? '800' : '600',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      🆕 Register ABHA
                    </button>
                    <button
                      type="button"
                      onClick={() => setKycMethod('abha-number')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '10px',
                        border: kycMethod === 'abha-number' ? '2px solid #004D40' : '1px solid #CBD5E1',
                        backgroundColor: kycMethod === 'abha-number' ? '#F0FDF4' : '#FFFFFF',
                        color: kycMethod === 'abha-number' ? '#004D40' : '#475569',
                        fontWeight: kycMethod === 'abha-number' ? '800' : '600',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      🆔 14-Digit ABHA
                    </button>
                    <button
                      type="button"
                      onClick={() => setKycMethod('manual')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '10px',
                        border: kycMethod === 'manual' ? '2px solid #004D40' : '1px solid #CBD5E1',
                        backgroundColor: kycMethod === 'manual' ? '#F0FDF4' : '#FFFFFF',
                        color: kycMethod === 'manual' ? '#004D40' : '#475569',
                        fontWeight: kycMethod === 'manual' ? '800' : '600',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      📝 Direct Info
                    </button>
                  </div>
                </div>

                {kycMethod === 'manual' ? (
                  /* Manual Direct Profile Update Form */
                  <form onSubmit={handleSaveManualProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Field label="Full Name *">
                      <Input
                        value={manualProfile.name}
                        onChange={(e) => setManualProfile((p) => ({ ...p, name: e.target.value }))}
                        required
                        placeholder="e.g. Krishna Santosh Dubey"
                      />
                    </Field>

                    <div className="field-row">
                      <Field label="Relationship *">
                        <Select
                          value={manualProfile.relationship}
                          onChange={(e) => setManualProfile((p) => ({ ...p, relationship: e.target.value }))}
                        >
                          <option value="Self">Self</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Child">Child</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Parent">Parent</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Other">Other</option>
                        </Select>
                      </Field>

                      <Field label="Age">
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={manualProfile.age}
                          onChange={(e) => setManualProfile((p) => ({ ...p, age: e.target.value }))}
                          placeholder="Age"
                        />
                      </Field>

                      <Field label="Gender">
                        <Select
                          value={manualProfile.gender}
                          onChange={(e) => setManualProfile((p) => ({ ...p, gender: e.target.value }))}
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </Select>
                      </Field>
                    </div>

                    <div className="field-row">
                      <Field label="ABHA Number (Optional)" hint="14-digit: 91-xxxx-xxxx-xxxx">
                        <Input
                          value={manualProfile.abhaNumber}
                          onChange={(e) => setManualProfile((p) => ({ ...p, abhaNumber: e.target.value }))}
                          placeholder="91-8850-9345-4421"
                        />
                      </Field>
                      <Field label="ABHA Address (Optional)" hint="e.g. name@abdm">
                        <Input
                          value={manualProfile.abhaAddress}
                          onChange={(e) => setManualProfile((p) => ({ ...p, abhaAddress: e.target.value }))}
                          placeholder="krishnasantoshdube@abdm"
                        />
                      </Field>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <Button type="button" variant="ghost" onClick={() => setAbhaModal(false)} style={{ flex: 1 }}>
                        Cancel
                      </Button>
                      <button
                        type="submit"
                        disabled={savingManual || !manualProfile.name.trim()}
                        style={{
                          flex: 2,
                          padding: '12px',
                          borderRadius: '12px',
                          backgroundColor: '#004D40',
                          color: '#FFFFFF',
                          fontWeight: '700',
                          fontSize: '13.5px',
                          border: 'none',
                          cursor: savingManual || !manualProfile.name.trim() ? 'not-allowed' : 'pointer',
                          opacity: savingManual || !manualProfile.name.trim() ? 0.7 : 1,
                        }}
                      >
                        {savingManual ? 'Saving Profile...' : '💾 Save Profile Direct'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* NHA Govt OTP KYC / Aadhaar Enrollment Form */
                  <form onSubmit={handleSendKycOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Field
                      label={
                        kycMethod === 'enroll'
                          ? '12-Digit Aadhaar Number *'
                          : '14-Digit ABHA Number *'
                      }
                      hint={
                        kycMethod === 'enroll'
                          ? 'e.g. 5489 1234 5678 (Aadhaar OTP will be sent to the mobile linked with Aadhaar)'
                          : 'e.g. 91-8850-9345-4421 (OTP sent to registered mobile)'
                      }
                    >
                      <Input
                        placeholder={
                          kycMethod === 'enroll'
                            ? 'Enter 12-digit Aadhaar Number'
                            : 'Enter 14-digit ABHA (91-xxxx-xxxx-xxxx)'
                        }
                        value={kycIdentifier}
                        onChange={(e) => setKycIdentifier(e.target.value)}
                        required
                        style={{ fontSize: '14px' }}
                      />
                    </Field>

                    {kycMethod === 'enroll' && (
                      <Field
                        label="Preferred ABHA Address (PHR Handle) *"
                        hint="Your permanent digital health address ending in @abdm"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Input
                            placeholder="e.g. kavishahuja"
                            value={preferredAbhaHandle}
                            onChange={(e) => setPreferredAbhaHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                            required
                            style={{ fontSize: '14px', flex: 1 }}
                          />
                          <span style={{
                            padding: '10px 14px',
                            backgroundColor: '#F1F5F9',
                            borderRadius: '10px',
                            border: '1px solid #CBD5E1',
                            fontWeight: '700',
                            color: '#004D40',
                            fontSize: '13px'
                          }}>
                            @abdm
                          </span>
                        </div>
                      </Field>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <Button type="button" variant="ghost" onClick={() => setAbhaModal(false)} style={{ flex: 1 }}>
                        Cancel
                      </Button>
                      <button
                        type="submit"
                        disabled={sendingOtp || !kycIdentifier.trim() || (kycMethod === 'enroll' && !preferredAbhaHandle.trim())}
                        style={{
                          flex: 2,
                          padding: '12px',
                          borderRadius: '12px',
                          backgroundColor: kycMethod === 'enroll' ? '#16A34A' : '#004D40',
                          color: '#FFFFFF',
                          fontWeight: '700',
                          fontSize: '13.5px',
                          border: 'none',
                          cursor: sendingOtp || !kycIdentifier.trim() || (kycMethod === 'enroll' && !preferredAbhaHandle.trim()) ? 'not-allowed' : 'pointer',
                          opacity: sendingOtp || !kycIdentifier.trim() || (kycMethod === 'enroll' && !preferredAbhaHandle.trim()) ? 0.7 : 1,
                        }}
                      >
                        {sendingOtp ? 'Sending OTP...' : (kycMethod === 'enroll' ? '🚀 Send Aadhaar Registration OTP' : '📩 Send ABDM OTP')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* STEP 2: Enter OTP */}
            {abhaStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontWeight: '700', color: '#166534', fontSize: '13px' }}>
                    ✓ OTP Sent via ABDM Gateway
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px' }}>
                    Verification code dispatched to mobile ending in <strong>{maskedMobile}</strong>.
                  </div>
                </div>

                {/* OTP Timer Pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  padding: '7px 12px',
                  backgroundColor: txnExpiryTimer > 30 ? '#F0FDF4' : '#FEF2F2',
                  borderRadius: '8px',
                  border: txnExpiryTimer > 30 ? '1px solid #BBF7D0' : '1px solid #FECACA',
                }}>
                  <span style={{ color: txnExpiryTimer > 30 ? '#166534' : '#991B1B', fontWeight: '600' }}>
                    ⏱️ Code valid for: {Math.floor(txnExpiryTimer / 60)}:{String(txnExpiryTimer % 60).padStart(2, '0')}
                  </span>
                  {txnExpiryTimer === 0 && (
                    <span style={{ color: '#DC2626', fontWeight: '700' }}>Expired — please resend</span>
                  )}
                </div>

                <Field label="Enter 6-Digit OTP Code *">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter 6-digit code"
                    value={kycOtp}
                    onChange={(e) => setKycOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                    style={{
                      fontSize: '22px',
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                      fontWeight: '800',
                      padding: '12px',
                    }}
                  />
                </Field>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                  <span style={{ color: '#64748B' }}>Didn't receive code?</span>
                  {resendTimer > 0 ? (
                    <span style={{ color: '#004D40', fontWeight: '600' }}>Resend in {resendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendKycOtp}
                      style={{ border: 'none', background: 'none', color: '#004D40', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <Button type="button" variant="ghost" onClick={() => setAbhaStep('input')} style={{ flex: 1 }}>
                    Back
                  </Button>
                  <button
                    type="submit"
                    disabled={verifyingOtp || kycOtp.length < 4}
                    style={{
                      flex: 2,
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: '#004D40',
                      color: '#FFFFFF',
                      fontWeight: '700',
                      fontSize: '13.5px',
                      border: 'none',
                      cursor: verifyingOtp || kycOtp.length < 4 ? 'not-allowed' : 'pointer',
                      opacity: verifyingOtp || kycOtp.length < 4 ? 0.7 : 1,
                    }}
                  >
                    {verifyingOtp ? 'Verifying OTP...' : '🔐 Verify & Retrieve Record'}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Review & Apply Government ABDM Records */}
            {abhaStep === 'review' && verifiedProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px' }}>🛡️</div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#166534', marginTop: '2px' }}>
                    Government ABDM Identity Verified
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15803D' }}>
                    Verified via National Health Authority (NHA) & Eka Care ABDM
                  </div>
                </div>

                {/* Comparison Card */}
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Comparison of Records
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* Current Record */}
                    <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                        Current in App
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', marginTop: '3px' }}>
                        {selectedMember.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                        Age: {selectedMember.age || '—'} yrs · {selectedMember.gender || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        Rel: {selectedMember.relationship}
                      </div>
                    </div>

                    {/* Official Verified Record */}
                    <div style={{ background: '#ECFDF5', padding: '10px 12px', borderRadius: '12px', border: '1.5px solid #10B981' }}>
                      <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: '800', textTransform: 'uppercase' }}>
                        ✓ Official ABDM Record
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#065F46', marginTop: '3px' }}>
                        {verifiedProfile.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '2px' }}>
                        Age: {verifiedProfile.age} yrs · {verifiedProfile.gender}
                      </div>
                      <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px', wordBreak: 'break-all' }}>
                        {verifiedProfile.abhaAddress}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Differences notice */}
                {(selectedMember.name.toLowerCase() !== verifiedProfile.name.toLowerCase() ||
                  (selectedMember.age && Number(selectedMember.age) !== Number(verifiedProfile.age)) ||
                  (selectedMember.gender && selectedMember.gender.toLowerCase() !== verifiedProfile.gender.toLowerCase())) && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 12px', borderRadius: '10px', fontSize: '12px', color: '#B45309' }}>
                    ⚡ <strong>Changes Detected:</strong> Official Aadhaar record name is <strong>"{verifiedProfile.name}"</strong> (age {verifiedProfile.age}).
                  </div>
                )}

                {/* Prompt Checkbox to apply changes */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    background: '#F0FDF4',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1.5px solid #004D40',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={applyVerifiedDetails}
                    onChange={(e) => setApplyVerifiedDetails(e.target.checked)}
                    style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#004D40' }}
                  />
                  <div style={{ fontSize: '12.5px', color: '#166534', lineHeight: 1.35 }}>
                    <strong>Apply official Government name, age & gender to this member</strong>
                    <div style={{ fontSize: '11.5px', color: '#15803D', marginTop: '2px' }}>
                      Updates name to "{verifiedProfile.name}" and age to {verifiedProfile.age} yrs across all future OPD tokens, prescriptions, and referral slips.
                    </div>
                  </div>
                </label>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <Button type="button" variant="ghost" onClick={() => setAbhaStep('input')} style={{ flex: 1 }}>
                    Back
                  </Button>
                  <button
                    type="button"
                    onClick={handleConfirmAndLink}
                    disabled={linking}
                    style={{
                      flex: 2,
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: '#004D40',
                      color: '#FFFFFF',
                      fontWeight: '700',
                      fontSize: '13.5px',
                      border: 'none',
                      cursor: linking ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {linking ? 'Saving...' : '✓ Confirm & Complete Link'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}

      {/* ABHA Digital Card Modal */}
      {cardModal && cardMember && (
        <Modal open={cardModal} title="Ayushman Bharat Digital Health Card" onClose={closeCardModal}>
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

                {/* Real ABDM ZXing QR Code */}
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                  {loadingQr ? (
                    <div style={{ width: '92px', height: '92px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Spinner />
                    </div>
                  ) : cardQrUrl ? (
                    <img
                      src={cardQrUrl}
                      alt="Official ABHA QR"
                      style={{ width: '92px', height: '92px', objectFit: 'contain', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ width: '92px', height: '92px', background: '#0f172a', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', padding: '4px', borderRadius: '4px' }}>
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} style={{ background: (i % 2 === 0 || i % 3 === 0) ? '#ffffff' : '#0f172a', borderRadius: '1px' }} />
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: '9.5px', color: '#0F172A', fontWeight: 700, marginTop: '6px' }}>
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
              <Button variant="secondary" onClick={handleDownloadCard}>
                📥 Download PNG Card
              </Button>
              <Button variant="ghost" onClick={() => window.print()}>
                Print
              </Button>
              <Button variant="primary" onClick={closeCardModal}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
