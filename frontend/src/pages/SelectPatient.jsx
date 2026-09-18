import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { familyApi } from '../api/client';
import AyushmanFooter from '../components/AyushmanFooter';

function getAvatarVisual(member, index = 0) {
  const rel = (member?.relationship || '').toLowerCase();
  if (rel === 'self' || rel === 'head') {
    return { avatarBg: '#D1FAE5', avatarColor: '#059669' };
  }
  if (rel.includes('mother') || rel.includes('wife') || rel.includes('sister') || rel.includes('daughter')) {
    return { avatarBg: '#FFE4E6', avatarColor: '#E11D48' };
  }
  if (rel.includes('father') || rel.includes('husband')) {
    return { avatarBg: '#E0F2FE', avatarColor: '#0284C7' };
  }
  if (rel.includes('brother') || rel.includes('son')) {
    return { avatarBg: '#F3E8FF', avatarColor: '#9333EA' };
  }
  const fallbackList = [
    { avatarBg: '#D1FAE5', avatarColor: '#059669' },
    { avatarBg: '#FFE4E6', avatarColor: '#E11D48' },
    { avatarBg: '#E0F2FE', avatarColor: '#0284C7' },
    { avatarBg: '#F3E8FF', avatarColor: '#9333EA' },
  ];
  return fallbackList[index % fallbackList.length];
}

export default function SelectPatient() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Forward existing hospital params if present
  const hospitalId = params.get('hospitalId') || '';
  const hospitalName = params.get('hospitalName') || '';
  const slug = params.get('slug') || '';
  const type = params.get('type') || '';
  const dist = params.get('dist') || '';
  const img = params.get('img') || '';

  // Primary phone number
  const phoneNumber = '+91 88509 34544';

  // Family members loaded from real Database
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    familyApi.listPublicMembers('8850934544')
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : res?.data || [];
        if (list.length > 0) {
          setMembers(list);
          setSelectedId(list[0].id);
        } else {
          const fallback = [
            { id: 1, name: 'Kavish Ahuja', relationship: 'Self', age: 20, gender: 'Male' },
            { id: 2, name: 'Sonia Ahuja', relationship: 'Mother', age: 48, gender: 'Female' },
            { id: 3, name: 'Subhash Ahuja', relationship: 'Father', age: 52, gender: 'Male' },
            { id: 4, name: 'Ayush Ahuja', relationship: 'Brother', age: 16, gender: 'Male' },
          ];
          setMembers(fallback);
          setSelectedId(1);
        }
      })
      .catch((err) => {
        console.warn('DB members fetch fallback:', err.message);
        if (!isMounted) return;
        const fallback = [
          { id: 1, name: 'Kavish Ahuja', relationship: 'Self', age: 20, gender: 'Male' },
          { id: 2, name: 'Sonia Ahuja', relationship: 'Mother', age: 48, gender: 'Female' },
          { id: 3, name: 'Subhash Ahuja', relationship: 'Father', age: 52, gender: 'Male' },
          { id: 4, name: 'Ayush Ahuja', relationship: 'Brother', age: 16, gender: 'Male' },
        ];
        setMembers(fallback);
        setSelectedId(1);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedMember = members.find((m) => m.id === selectedId) || members[0];

  function handleContinue() {
    if (!selectedMember) return;
    const searchParams = new URLSearchParams();
    if (hospitalId) searchParams.set('hospitalId', hospitalId);
    if (hospitalName) searchParams.set('hospitalName', hospitalName);
    if (slug) searchParams.set('slug', slug);
    if (type) searchParams.set('type', type);
    if (dist) searchParams.set('dist', dist);
    if (img) searchParams.set('img', img);

    // Attach chosen patient details
    searchParams.set('patientId', selectedMember.id);
    searchParams.set('name', selectedMember.name);
    searchParams.set('age', String(selectedMember.age));
    searchParams.set('gender', selectedMember.gender);
    searchParams.set('relationship', selectedMember.relationship);
    searchParams.set('phone', '8850934544');

    navigate(`/book?${searchParams.toString()}`);
  }

  return (
    <div className="arogyaflow-backdrop">
      <main className="arogyaflow-phone-frame">
        {/* Top Sheet Drag Indicator Bar */}
        <div className="arogyaflow-drag-handle">
          <div className="arogyaflow-drag-bar" />
        </div>

        {/* 1. Top App Bar (Header) */}
        <header
          style={{
            padding: '8px 16px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#043c2c',
                margin: 0,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              Book OPD Token
            </h1>
            <div
              style={{
                fontSize: '13px',
                color: '#64748b',
                fontWeight: '500',
                marginTop: '2px',
              }}
            >
              Select who the appointment is for
            </div>
          </div>

          <div style={{ width: '38px' }} />
        </header>

        {/* Scrollable Content Body */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#ffffff',
          }}
        >
          {/* 2. Primary Contact Card (Phone Number) */}
          <div
            style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #DCFCE7',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#047857">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: '700',
                    color: '#0f172a',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {phoneNumber}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    color: '#64748b',
                    fontWeight: '400',
                    marginTop: '1px',
                  }}
                >
                  Linked to your account
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login/patient')}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: '600',
                color: '#047857',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.15s ease',
              }}
            >
              Change
            </button>
          </div>

          {/* 3. Family Member Selection Section (Real Database) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: '15.5px',
                fontWeight: '700',
                color: '#0f172a',
                margin: '2px 0 4px',
                letterSpacing: '-0.01em',
              }}
            >
              Select a family member
            </h2>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '13px' }}>
                Loading family members from database…
              </div>
            ) : (
              members.map((member, idx) => {
                const isSelected = selectedId === member.id;
                const visual = getAvatarVisual(member, idx);
                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedId(member.id)}
                    style={{
                      backgroundColor: isSelected ? '#F0FDF4' : '#ffffff',
                      border: isSelected ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(16, 185, 129, 0.08)'
                        : '0 1px 3px rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: visual.avatarBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: visual.avatarColor,
                          flexShrink: 0,
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#0f172a',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {member.name}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#64748b',
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{member.relationship}</span>
                          <span>•</span>
                          <span>{member.age} years</span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: isSelected ? '2px solid #00A884' : '2px solid #CBD5E1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        backgroundColor: '#ffffff',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: '#00A884',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Add Family Member Button */}
            <button
              type="button"
              onClick={() => navigate('/login/patient')}
              style={{
                marginTop: '4px',
                width: '100%',
                backgroundColor: '#F0FDF4',
                border: '1.5px dashed #86EFAC',
                borderRadius: '14px',
                padding: '13px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#059669',
                fontSize: '14.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Family Member</span>
            </button>
          </div>
        </div>

        {/* 5. Sticky Bottom Action Area */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E2E8F0',
            padding: '12px 16px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedId}
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: selectedId ? '#00A884' : '#E2E8F0',
              color: selectedId ? '#ffffff' : '#94A3B8',
              fontSize: '15px',
              fontWeight: '700',
              cursor: selectedId ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: selectedId ? '0 4px 14px rgba(0, 168, 132, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Continue</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Sticky AyushmanFooter */}
        <AyushmanFooter brandFirst={true} />
      </main>
    </div>
  );
}
