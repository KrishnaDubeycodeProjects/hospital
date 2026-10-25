import React from 'react';
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
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch {
    return String(dateInput);
  }
}

export default function TrainStationTimeline({
  stations = [],
  selectedStationId = null,
  onSelectStation = null,
}) {
  if (!stations || stations.length === 0) {
    return (
      <div
        style={{
          padding: '16px 14px',
          textAlign: 'center',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px dashed #CBD5E1',
          color: '#64748B',
          fontSize: '12.5px',
        }}
      >
        <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>🏥</span>
        No consultation stations recorded for this care journey yet.
      </div>
    );
  }

  const activeSelectedId = selectedStationId || stations[0]?.id;

  return (
    <div style={{ position: 'relative', padding: '4px 0 4px 2px' }}>
      {/* Continuous Vertical Railway Transit Line */}
      <div
        style={{
          position: 'absolute',
          left: '11px',
          top: '14px',
          bottom: '14px',
          width: '2.5px',
          backgroundColor: '#10B981',
          borderRadius: '2px',
          zIndex: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {stations.map((stn, idx) => {
          const stationId = stn.id || `stn-${idx}`;
          const isSelected = activeSelectedId === stationId;
          const isActive = stn.isActive !== false;
          const medCount = stn.prescriptions?.length || 0;
          const docCount = stn.documents?.length || 0;

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
              {/* Left Column: Metro Transit Station Node */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? '#004D40' : (isActive ? '#10B981' : '#DC2626'),
                  border: isSelected ? '3.5px solid #FFFFFF' : '3px solid #FFFFFF',
                  boxShadow: isSelected
                    ? '0 0 0 2px #004D40, 0 0 10px rgba(0, 77, 64, 0.4)'
                    : (isActive ? '0 0 0 1.5px #10B981' : '0 0 0 1.5px #DC2626'),
                  flexShrink: 0,
                  marginTop: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => onSelectStation && onSelectStation(stn)}
                title={isSelected ? 'Selected Consultation' : 'Click to select consultation'}
              >
                {isSelected && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34D399' }} />
                )}
              </div>

              {/* Right Column: Station Consultation Card (No STN 1 / STN 2 text) */}
              <div
                onClick={() => onSelectStation && onSelectStation(stn)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: isSelected ? '#F0FDFA' : '#FFFFFF',
                  border: isSelected ? '1.5px solid #004D40' : '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: isSelected
                    ? '0 3px 10px rgba(0, 77, 64, 0.08)'
                    : '0 1px 3px rgba(0, 0, 0, 0.02)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {/* Row 1: Hospital Name + Time & Selection Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '15px' }}>🏥</span>
                    <strong style={{ fontSize: '13.5px', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stn.hospitalName || 'District Civil Hospital'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '700',
                        backgroundColor: isSelected ? '#004D40' : '#E2E8F0',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        padding: '2px 7px',
                        borderRadius: '9999px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected ? 'Active ✓' : 'Select'}
                    </span>
                  </div>
                </div>

                {/* Row 2: Doctor Name & Department */}
                <div style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span>👨‍⚕️ <strong>{stn.doctorName || 'Dr. Rajesh Sharma'}</strong></span>
                  {stn.department && <span style={{ color: '#94A3B8' }}>&bull; {stn.department}</span>}
                </div>

                {/* Row 3: Consultation Date/Time & Quick Summary Pill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '2px', paddingTop: '4px', borderTop: isSelected ? '1px solid #CCFBF1' : '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                    <CalendarIcon size={12} color="#64748B" />
                    <span>{formatIndianDateTime(stn.date)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    {medCount > 0 && (
                      <span style={{ fontWeight: '700', color: '#0F766E', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
                        💊 {medCount} Med{medCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {docCount > 0 && (
                      <span style={{ fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '4px' }}>
                        📄 {docCount} Doc{docCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
