import React, { useState } from 'react';
import { CalendarIcon } from '../pages/patient/HealthRecordsScreen';

// Helper to format dates & timings in Indian Standard Time (IST)
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
        year: 'numeric',
        hour: '2-digit',
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
  const [expandedMedicines, setExpandedMedicines] = useState({});

  if (!stations || stations.length === 0) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px dashed #CBD5E1',
          color: '#64748B',
          fontSize: '13px',
        }}
      >
        <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>🚉</span>
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

  const toggleMedicine = (medKey) => {
    setExpandedMedicines((prev) => ({
      ...prev,
      [medKey]: !prev[medKey],
    }));
  };

  return (
    <div style={{ position: 'relative', padding: '8px 0 8px 12px' }}>
      {/* Continuous Vertical Railway Transit Track Line */}
      <div
        style={{
          position: 'absolute',
          left: '23px',
          top: '24px',
          bottom: '24px',
          width: '3px',
          backgroundColor: '#CBD5E1',
          borderRadius: '2px',
          zIndex: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {stations.map((stn, idx) => {
          const stationId = stn.id || `stn-${idx}`;
          const isOpen = openStationId === stationId;
          const currentTab = stationTabs[stationId] || 'prescription';
          const isActive = stn.isActive !== false;
          const stationNum = stn.stationNumber || idx + 1;
          const prescriptions = stn.prescriptions || [];
          const documents = stn.documents || [];
          const notes = stn.notes || {};

          return (
            <div
              key={stationId}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Left Column: Train Station Marker Dot on Track */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#16A34A' : '#DC2626',
                  border: '3.5px solid #FFFFFF',
                  boxShadow: isActive
                    ? '0 0 0 2px #16A34A, 0 0 8px rgba(22, 163, 74, 0.4)'
                    : '0 0 0 2px #DC2626, 0 0 6px rgba(220, 38, 38, 0.3)',
                  flexShrink: 0,
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => toggleStation(stationId)}
                title={isActive ? 'Active Station (Green Dot)' : 'Inactive Station (Red Dot)'}
              />

              {/* Right Column: Station Card with Marking Point & Dropdown */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: '#FFFFFF',
                  border: isOpen
                    ? isActive ? '1.5px solid #004D40' : '1.5px solid #94A3B8'
                    : '1px solid #E2E8F0',
                  borderRadius: '14px',
                  boxShadow: isOpen
                    ? '0 4px 16px rgba(0, 77, 64, 0.08)'
                    : '0 1px 4px rgba(0, 0, 0, 0.03)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Station Header & Marking Point (Clickable Banner) */}
                <div
                  onClick={() => toggleStation(stationId)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    backgroundColor: isOpen ? (isActive ? '#F0FDFA' : '#F8FAFC') : '#FFFFFF',
                    borderBottom: isOpen ? '1px solid #E2E8F0' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Row 1: Station Badge & Active/Inactive Dot Indicator */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2',
                          color: isActive ? '#15803D' : '#991B1B',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        🚉 Station {stationNum}
                      </span>
                      <strong style={{ fontSize: '13.5px', color: '#0F172A' }}>
                        {stn.hospitalName || 'District Civil Hospital'}
                      </strong>
                    </div>

                    {/* Status Dot with Label */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? '#16A34A' : '#DC2626',
                          display: 'inline-block',
                          boxShadow: isActive ? '0 0 0 2px rgba(22, 163, 74, 0.25)' : 'none',
                        }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: isActive ? '#15803D' : '#991B1B' }}>
                        {isActive ? 'Active Station' : 'Inactive Station'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Doctor & Department Info */}
                  <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>👨‍⚕️ <strong>{stn.doctorName || 'Dr. Rajesh Sharma'}</strong></span>
                    {stn.department && (
                      <span style={{ color: '#64748B' }}>&bull; {stn.department}</span>
                    )}
                  </div>

                  {/* Row 3: Marking Point Button (Date & Time in India Time IST) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CCFBF1',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', color: '#0F766E' }}>
                      <CalendarIcon size={13} color="#0D9488" />
                      <span>Marking Point: {formatIndianDateTime(stn.date)}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0284C7' }}>
                      {isOpen ? '▲ Close Details' : '▼ View 3 Tabs (Prescription, Notes, Docs)'}
                    </span>
                  </div>
                </div>

                {/* Dropdown Content with the 3 Tabs */}
                {isOpen && (
                  <div style={{ padding: '12px 14px', backgroundColor: '#FFFFFF' }}>
                    {/* 3 Tabs Header */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '6px',
                        backgroundColor: '#F1F5F9',
                        padding: '4px',
                        borderRadius: '10px',
                        marginBottom: '14px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setTab(stationId, 'prescription')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: currentTab === 'prescription' ? '#004D40' : 'transparent',
                          color: currentTab === 'prescription' ? '#FFFFFF' : '#334155',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          boxShadow: currentTab === 'prescription' ? '0 1px 3px rgba(0,77,64,0.2)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>💊</span>
                        <span>Prescription</span>
                        {prescriptions.length > 0 && (
                          <span
                            style={{
                              backgroundColor: currentTab === 'prescription' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
                              padding: '1px 5px',
                              borderRadius: '8px',
                              fontSize: '10px',
                            }}
                          >
                            {prescriptions.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setTab(stationId, 'notes')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: currentTab === 'notes' ? '#1E40AF' : 'transparent',
                          color: currentTab === 'notes' ? '#FFFFFF' : '#334155',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          boxShadow: currentTab === 'notes' ? '0 1px 3px rgba(30,64,175,0.2)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>📝</span>
                        <span>Notes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTab(stationId, 'document')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: currentTab === 'document' ? '#B45309' : 'transparent',
                          color: currentTab === 'document' ? '#FFFFFF' : '#334155',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          boxShadow: currentTab === 'document' ? '0 1px 3px rgba(180,83,9,0.2)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>📄</span>
                        <span>Document</span>
                        {documents.length > 0 && (
                          <span
                            style={{
                              backgroundColor: currentTab === 'document' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
                              padding: '1px 5px',
                              borderRadius: '8px',
                              fontSize: '10px',
                            }}
                          >
                            {documents.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* TAB 1: PRESCRIPTION (Clicking each medicine reveals when & what to eat) */}
                    {currentTab === 'prescription' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Prescribed Medications (Click any to view meal schedule)
                          </span>
                        </div>

                        {prescriptions.length === 0 ? (
                          <div style={{ padding: '14px', textAlign: 'center', color: '#64748B', fontSize: '12.5px', background: '#F8FAFC', borderRadius: '8px' }}>
                            No new medicines prescribed at this station. Continue prior medications.
                          </div>
                        ) : (
                          prescriptions.map((p, pIdx) => {
                            const medKey = `${stationId}-med-${pIdx}`;
                            const isMedOpen = !!expandedMedicines[medKey];
                            const name = p.medicineName || p.drugName || 'Clinical Medication';
                            const dosage = p.dosage || p.dose || '1 tablet';
                            const frequency = p.frequency || 'BD (Twice daily)';
                            const duration = p.durationDays || p.duration || 5;
                            const route = p.route || 'Oral';
                            const instructions = p.instructions || 'Take after meals with water';
                            const isMedActive = p.isActive !== false;
                            const { m, a, n } = parseDosageSlots(frequency, dosage);

                            return (
                              <div
                                key={medKey}
                                style={{
                                  backgroundColor: isMedOpen ? '#F0FDFA' : '#F8FAFC',
                                  border: isMedOpen ? '1.5px solid #99F6E4' : '1px solid #E2E8F0',
                                  borderRadius: '10px',
                                  overflow: 'hidden',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {/* Clickable Medicine Bar */}
                                <div
                                  onClick={() => toggleMedicine(medKey)}
                                  style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '8px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {/* Green or Red Dot for Active/Inactive Medicine */}
                                    <span
                                      style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: isMedActive ? '#16A34A' : '#DC2626',
                                        display: 'inline-block',
                                        flexShrink: 0,
                                      }}
                                      title={isMedActive ? 'Active Medicine' : 'Completed / Inactive'}
                                    />
                                    <div>
                                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                                        {pIdx + 1}. {name}
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                                        {route} &bull; Dosage: {dosage} &bull; Duration: {duration} Days
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: isMedActive ? '#15803D' : '#991B1B' }}>
                                      {isMedActive ? '🟢 Active' : '🔴 Inactive'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '700' }}>
                                      {isMedOpen ? '▲' : '▼'}
                                    </span>
                                  </div>
                                </div>

                                {/* Expanded Detail Panel: When & What to Eat */}
                                {isMedOpen && (
                                  <div
                                    style={{
                                      padding: '10px 12px 12px',
                                      borderTop: '1px solid #CCFBF1',
                                      backgroundColor: '#FFFFFF',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px',
                                    }}
                                  >
                                    {/* When to take (Daily visual intake slots) */}
                                    <div>
                                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                        ⏰ When to Take (Daily Schedule)
                                      </span>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <div
                                          style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            background: m ? '#DCFCE7' : '#F1F5F9',
                                            color: m ? '#166534' : '#94A3B8',
                                            border: m ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                                          }}
                                        >
                                          <span>🌅 Morning</span> {m ? '✓' : '✗'}
                                        </div>

                                        <div
                                          style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            background: a ? '#FEF3C7' : '#F1F5F9',
                                            color: a ? '#92400E' : '#94A3B8',
                                            border: a ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                                          }}
                                        >
                                          <span>☀️ Afternoon</span> {a ? '✓' : '✗'}
                                        </div>

                                        <div
                                          style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            background: n ? '#E0E7FF' : '#F1F5F9',
                                            color: n ? '#3730A3' : '#94A3B8',
                                            border: n ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                                          }}
                                        >
                                          <span>🌙 Night</span> {n ? '✓' : '✗'}
                                        </div>
                                      </div>
                                    </div>

                                    {/* What to eat / Food instructions */}
                                    <div
                                      style={{
                                        backgroundColor: '#FFFBEB',
                                        border: '1px solid #FDE68A',
                                        borderRadius: '8px',
                                        padding: '8px 10px',
                                        fontSize: '12px',
                                        color: '#92400E',
                                      }}
                                    >
                                      <strong>🍛 What &amp; When to Eat:</strong> {instructions}
                                    </div>

                                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                                      Prescription frequency: <strong>{frequency}</strong> &bull; Total duration: <strong>{duration} days</strong>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* TAB 2: NOTES (Clinical observations, findings & doctor advice) */}
                    {currentTab === 'notes' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                        {notes.chiefComplaint && (
                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>
                              Patient Reason for Visit / Chief Complaint
                            </span>
                            <div style={{ fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>
                              {notes.chiefComplaint}
                            </div>
                          </div>
                        )}

                        {notes.examinationFindings && (
                          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>
                              Physical Examination Findings &amp; Vitals
                            </span>
                            <div style={{ color: '#334155', marginTop: '2px', lineHeight: 1.4 }}>
                              {notes.examinationFindings}
                            </div>
                          </div>
                        )}

                        {notes.plan && (
                          <div style={{ background: '#ECFDF5', padding: '10px 12px', borderRadius: '8px', border: '1px solid #A7F3D0', color: '#065F46' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                              🎯 Doctor's Advice &amp; Care Guidance
                            </span>
                            <div style={{ marginTop: '2px', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                              {notes.plan}
                            </div>
                          </div>
                        )}

                        {!notes.chiefComplaint && !notes.examinationFindings && !notes.plan && (
                          <div style={{ padding: '14px', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                            Routine consultation session. Vitals normal. Follow general health precautions.
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: DOCUMENT (Uploaded documents by doctor) */}
                    {currentTab === 'document' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {documents.length === 0 ? (
                          <div style={{ padding: '14px', textAlign: 'center', color: '#64748B', fontSize: '12.5px', background: '#F8FAFC', borderRadius: '8px' }}>
                            📄 No external documents uploaded at this station. Digital e-prescription and clinical notes are logged above.
                          </div>
                        ) : (
                          documents.map((doc, dIdx) => (
                            <div
                              key={doc.id || dIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 12px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>📄</span>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                                    {doc.fileName || `Medical_Document_${dIdx + 1}.pdf`}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                                    Uploaded: {formatIndianDateTime(doc.uploadedAt || doc.createdAt)} &bull; ABDM Verified
                                  </div>
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
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: '#004D40',
                                  color: '#FFFFFF',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>👁️</span>
                                <span>View</span>
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
