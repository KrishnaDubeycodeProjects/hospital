import React, { useState } from 'react';
import { CalendarIcon } from '../pages/patient/HealthRecordsScreen';

// Helper to format dates & timings in clean Indian Standard Time (IST)
export function formatIndianDateTime(dateInput) {
  if (!dateInput) return 'Recent Consultation';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return (
      d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch {
    return String(dateInput);
  }
}

// Helper to parse daily dosage slots (Morning, Afternoon, Night)
export function parseDosageSlots(frequency = '', dosage = '') {
  const f = (frequency || '').toLowerCase();
  const d = (dosage || '').toLowerCase();
  let m = false;
  let a = false;
  let n = false;
  if (f.includes('tid') || f.includes('tds') || f.includes('thrice') || f.includes('three') || d.includes('1-1-1')) {
    m = true; a = true; n = true;
  } else if (f.includes('bid') || f.includes('bd') || f.includes('twice') || f.includes('two') || d.includes('1-0-1')) {
    m = true; a = false; n = true;
  } else if (f.includes('od') || f.includes('once') || f.includes('daily') || d.includes('1-0-0') || d.includes('0-0-1')) {
    if (f.includes('night') || d.includes('0-0-1')) {
      n = true;
    } else {
      m = true;
    }
  } else {
    m = true; n = true;
  }
  return { m, a, n };
}

export default function TrainStationTimeline({
  stations = [],
  defaultOpenId = null,
  onViewDocument = null,
}) {
  const [openStationId, setOpenStationId] = useState(defaultOpenId);
  const [stationTabs, setStationTabs] = useState({});

  if (!stations || stations.length === 0) {
    return (
      <div
        style={{
          padding: '20px 14px',
          textAlign: 'center',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px dashed #CBD5E1',
          color: '#64748B',
          fontSize: '12.5px',
        }}
      >
        <span style={{ fontSize: '22px', display: 'block', marginBottom: '4px' }}>🚉</span>
        No consultation stations recorded for this journey yet.
      </div>
    );
  }

  const toggleStation = (stationId) => {
    setOpenStationId((prev) => (prev === stationId ? null : stationId));
  };

  const setTab = (stationId, tab) => {
    setStationTabs((prev) => ({
      ...prev,
      [stationId]: tab,
    }));
  };

  return (
    <div style={{ position: 'relative', padding: '2px 0 2px 4px' }}>
      {/* Continuous Vertical Railway Transit Line */}
      <div
        style={{
          position: 'absolute',
          left: '13px',
          top: '16px',
          bottom: '16px',
          width: '2px',
          backgroundColor: '#10B981',
          borderRadius: '2px',
          zIndex: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {stations.map((stn, idx) => {
          const stationId = stn.id || `stn-${idx}`;
          const isOpen = openStationId === stationId;
          const currentTab = stationTabs[stationId] || 'prescription';
          const isActive = stn.isActive !== false;
          const stationNum = stn.stationNumber || idx + 1;
          const prescriptions = stn.prescriptions || [];
          const documents = stn.documents || [];
          const notes = stn.notes || {};
          const labText = stn.labTests || (notes.clinicalNotes && notes.clinicalNotes.includes('Investigations Ordered:') ? notes.clinicalNotes.split('Investigations Ordered:')[1]?.trim().split('\n')[0] : null);

          return (
            <div
              key={stationId}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Left Column: Metro Station Node */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#10B981' : '#DC2626',
                  border: '3px solid #FFFFFF',
                  boxShadow: isActive
                    ? '0 0 0 2px #10B981, 0 0 8px rgba(16, 185, 129, 0.4)'
                    : '0 0 0 2px #DC2626',
                  flexShrink: 0,
                  marginTop: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => toggleStation(stationId)}
                title={isActive ? 'Active Station' : 'Completed'}
              />

              {/* Right Column: Station Card */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: '#FFFFFF',
                  border: isOpen
                    ? (isActive ? '1.5px solid #004D40' : '1.5px solid #CBD5E1')
                    : '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: isOpen
                    ? '0 3px 12px rgba(0, 77, 64, 0.08)'
                    : '0 1px 3px rgba(0, 0, 0, 0.02)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Station Header & Marking Point (Clickable Banner) */}
                <div
                  onClick={() => toggleStation(stationId)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    backgroundColor: isOpen ? '#F0FDFA' : '#FFFFFF',
                    borderBottom: isOpen ? '1px solid #E2E8F0' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    userSelect: 'none',
                  }}
                >
                  {/* Row 1: Hospital Name + Time & Chevron */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2',
                          color: isActive ? '#15803D' : '#991B1B',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        Stn {stationNum}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stn.hospitalName || 'District Civil Hospital'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                        {formatIndianDateTime(stn.date)}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#004D40' }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Doctor Name & Department */}
                  <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span>👨‍⚕️ {stn.doctorName || 'Dr. Rajesh Sharma'}</span>
                    {stn.department && <span style={{ color: '#94A3B8' }}>&bull; {stn.department}</span>}
                  </div>
                </div>

                {/* Dropdown Content with the 3 Tabs */}
                {isOpen && (
                  <div style={{ padding: '10px 12px 12px', backgroundColor: '#FFFFFF' }}>
                    {/* 3 Mobile Segmented Tabs (Never truncated) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '4px',
                        backgroundColor: '#F1F5F9',
                        padding: '3px',
                        borderRadius: '8px',
                        marginBottom: '10px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setTab(stationId, 'prescription')}
                        style={{
                          padding: '6px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: currentTab === 'prescription' ? '#004D40' : 'transparent',
                          color: currentTab === 'prescription' ? '#FFFFFF' : '#475569',
                          fontWeight: '700',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                          boxShadow: currentTab === 'prescription' ? '0 1px 3px rgba(0,77,64,0.2)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>💊 Rx ({prescriptions.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTab(stationId, 'notes')}
                        style={{
                          padding: '6px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: currentTab === 'notes' ? '#1E40AF' : 'transparent',
                          color: currentTab === 'notes' ? '#FFFFFF' : '#475569',
                          fontWeight: '700',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                          boxShadow: currentTab === 'notes' ? '0 1px 3px rgba(30,64,175,0.2)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>📝 Notes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTab(stationId, 'document')}
                        style={{
                          padding: '6px 2px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: currentTab === 'document' ? '#B45309' : 'transparent',
                          color: currentTab === 'document' ? '#FFFFFF' : '#475569',
                          fontWeight: '700',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                          boxShadow: currentTab === 'document' ? '0 1px 3px rgba(180,83,9,0.2)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>📄 Docs ({documents.length})</span>
                      </button>
                    </div>

                    {/* TAB 1: PRESCRIPTION (High-Signal Mobile Cards with Morning/Afternoon/Night) */}
                    {currentTab === 'prescription' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {prescriptions.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: '#64748B', fontSize: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
                            No new medicines prescribed at this station.
                          </div>
                        ) : (
                          prescriptions.map((p, pIdx) => {
                            const name = p.medicineName || p.drugName || 'Clinical Medication';
                            const dosage = p.dosage || p.dose || '1 tablet';
                            const frequency = p.frequency || 'BD (Twice daily)';
                            const duration = p.durationDays || p.duration || 5;
                            const instructions = p.instructions || 'Take after meals';
                            const { m, a, n } = parseDosageSlots(frequency, dosage);

                            return (
                              <div
                                key={pIdx}
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                }}
                              >
                                {/* Top: Medicine Name & Duration */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block', flexShrink: 0 }} />
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', lineHeight: 1.25 }}>
                                      {pIdx + 1}. {name}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '10.5px', fontWeight: '700', backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                    {duration} Days
                                  </span>
                                </div>

                                {/* Middle: Dose & Meal Advice */}
                                <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  <strong style={{ color: '#0F172A' }}>{dosage}</strong>
                                  <span style={{ color: '#CBD5E1' }}>&bull;</span>
                                  <span style={{ color: '#059669', fontWeight: '600' }}>🍛 {instructions}</span>
                                </div>

                                {/* Bottom: When to Take Badges (Morning, Afternoon, Night) */}
                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: m ? '#DCFCE7' : '#F1F5F9',
                                      color: m ? '#166534' : '#94A3B8',
                                      border: m ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                                    }}
                                  >
                                    🌅 Morning {m ? '✓' : '—'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: a ? '#FEF3C7' : '#F1F5F9',
                                      color: a ? '#92400E' : '#94A3B8',
                                      border: a ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                                    }}
                                  >
                                    ☀️ Afternoon {a ? '✓' : '—'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: n ? '#E0E7FF' : '#F1F5F9',
                                      color: n ? '#3730A3' : '#94A3B8',
                                      border: n ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                                    }}
                                  >
                                    🌙 Night {n ? '✓' : '—'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Ordered Diagnostic Lab Tests (Merged Directly into Rx) */}
                        {labText && (
                          <div
                            style={{
                              marginTop: '4px',
                              backgroundColor: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              borderRadius: '8px',
                              padding: '8px 10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '14px' }}>🧪</span>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#92400E', textTransform: 'uppercase' }}>
                                Ordered Lab Tests
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#78350F', marginTop: '2px' }}>
                              {labText}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: NOTES (Clinical advice & Doctor plan) */}
                    {currentTab === 'notes' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                        {notes.chiefComplaint && (
                          <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>
                              Reason for Visit
                            </span>
                            <div style={{ fontWeight: '700', color: '#0F172A', marginTop: '1px' }}>
                              {notes.chiefComplaint}
                            </div>
                          </div>
                        )}

                        {notes.plan && (
                          <div style={{ background: '#ECFDF5', padding: '8px 10px', borderRadius: '8px', border: '1px solid #A7F3D0', color: '#065F46' }}>
                            <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                              🎯 Doctor Advice &amp; Plan
                            </span>
                            <div style={{ marginTop: '2px', lineHeight: 1.35, whiteSpace: 'pre-line' }}>
                              {notes.plan}
                            </div>
                          </div>
                        )}

                        {!notes.chiefComplaint && !notes.plan && (
                          <div style={{ padding: '12px', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                            Routine consultation session. Vitals normal. Follow general health precautions.
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: DOCUMENT (Uploaded slips & records) */}
                    {currentTab === 'document' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {documents.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: '#64748B', fontSize: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
                            📄 No external documents uploaded. Digital prescription is logged under Rx.
                          </div>
                        ) : (
                          documents.map((doc, dIdx) => (
                            <div
                              key={doc.id || dIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  📄 {doc.fileName || `Medical_Document_${dIdx + 1}.pdf`}
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                                  {formatIndianDateTime(doc.uploadedAt || doc.createdAt)}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (onViewDocument) {
                                    onViewDocument(doc);
                                  } else if (doc.downloadUrl) {
                                    window.open(doc.downloadUrl, '_blank');
                                  }
                                }}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: '#004D40',
                                  color: '#FFFFFF',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  border: 'none',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                View
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
