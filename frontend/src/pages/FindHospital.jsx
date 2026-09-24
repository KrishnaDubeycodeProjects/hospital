import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hospitalApi, setToken } from '../api/client';
import { isOpenNow, formatApproxDistance } from '../utils/helpers';
import { useToast } from '../context/ToastContext';
import AyushmanFooter from '../components/AyushmanFooter';

const PAGE_SIZE = 20;

// Default reference coordinates (Thane / Mumbai Central) if GPS is pending/denied
const DEFAULT_COORDS = { lat: 19.1895, lon: 72.964 };

function formatOperatingHours(startTime, endTime) {
  const formatSingle = (t) => {
    if (!t) return '';
    const [hh, mm] = t.split(':').map(Number);
    const period = hh >= 12 ? 'PM' : 'AM';
    const hour12 = hh % 12 || 12;
    const mins = mm ? `:${mm < 10 ? '0' + mm : mm}` : ':00';
    return `${hour12}${mins} ${period}`;
  };
  const start = formatSingle(startTime) || '9:00 AM';
  const end = formatSingle(endTime) || '5:00 PM';
  return `${start} – ${end}`;
}

function getTitleFontSize(name = '') {
  if (name.length > 34) return '12px';
  if (name.length > 25) return '12.5px';
  if (name.length > 18) return '14px';
  return '15.5px';
}

function renderHospitalTitleWithBadge(name, isOpen) {
  const words = (name || 'Hospital').trim().split(/\s+/);
  const lastWord = words.pop() || '';
  const prefix = words.join(' ');

  return (
    <div
      style={{
        fontSize: getTitleFontSize(name),
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: '-0.02em',
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}
    >
      {prefix ? `${prefix} ` : ''}
      <span
        style={{
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <span>{lastWord}</span>
        <span
          title={isOpen ? 'Online (OPD Open)' : 'Offline (OPD Closed)'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: isOpen ? '#D1FAE5' : '#FEE2E2',
            border: `1.5px solid ${isOpen ? '#34D399' : '#F87171'}`,
            flexShrink: 0,
            transform: 'translateY(-0.5px)',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: isOpen ? '#00A884' : '#EF4444',
            }}
          />
        </span>
      </span>
    </div>
  );
}

function mapHospitalData(raw, defaultDist, index) {
  const h = raw.hospital || raw;
  const dist = raw.distanceKm != null ? raw.distanceKm : defaultDist;
  const openTime = h.openTime ? h.openTime.slice(0, 5) : '09:00';
  const closeTime = h.closeTime ? h.closeTime.slice(0, 5) : '17:00';

  // 1. hospital_name
  const hospitalName = h.name || 'Hospital';

  // 2. hospital_type
  let hospitalType = 'Government Hospital';
  const nameLower = hospitalName.toLowerCase();
  if (nameLower.includes('primary health') || nameLower.includes('phc') || nameLower.includes('rural health')) {
    hospitalType = 'Primary Health Centre';
  } else if (nameLower.includes('community health') || nameLower.includes('chc')) {
    hospitalType = 'Community Health Centre';
  } else if (h.ownership === 'Trust') {
    hospitalType = 'Trust Hospital';
  } else if (h.ownership === 'Private' && (nameLower.includes('speciality') || nameLower.includes('specialty'))) {
    hospitalType = 'Multi-Speciality Hospital';
  } else if (h.ownership === 'Government' || nameLower.includes('municipal') || nameLower.includes('csmh')) {
    hospitalType = 'Government Hospital';
  } else {
    hospitalType = h.ownership ? `${h.ownership} Hospital` : 'Government Hospital';
  }

  // 6. illustration_id
  let illustrationUrl = '/hospital_illustrations/hospital_1.png';
  if (nameLower.includes('aastha')) {
    illustrationUrl = '/hospital_illustrations/hospital_1.png';
  } else if (nameLower.includes('seva') || nameLower.includes('rural')) {
    illustrationUrl = '/hospital_illustrations/hospital_2.png';
  } else if (nameLower.includes('jeevan') || nameLower.includes('care') || nameLower.includes('community')) {
    illustrationUrl = '/hospital_illustrations/hospital_3.png';
  } else if (nameLower.includes('sahyadri') || nameLower.includes('primary')) {
    illustrationUrl = '/hospital_illustrations/hospital_4.png';
  } else {
    const pick = ((h.id || index) % 4) + 1;
    illustrationUrl = `/hospital_illustrations/hospital_${pick}.png`;
  }

  return {
    id: h.id,
    slug: h.uriSlug || h.slug || '',
    hospital_name: hospitalName,
    hospital_type: hospitalType,
    distance_km: dist != null ? Number(dist) : null,
    operating_hours_start: openTime,
    operating_hours_end: closeTime,
    is_currently_open: isOpenNow(h),
    illustration_id: illustrationUrl,
    address: h.address || '',
  };
}

export default function FindHospital() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const categoryParam = searchParams.get('category') || '';
  const phoneParam = searchParams.get('phone') || '';
  const tokenParam = searchParams.get('token') || '';
  const latParam = searchParams.get('lat') ? parseFloat(searchParams.get('lat')) : null;
  const lonParam = searchParams.get('lon') ? parseFloat(searchParams.get('lon')) : null;

  useEffect(() => {
    if (tokenParam) {
      setToken('PATIENT', tokenParam);
    }
  }, [tokenParam]);

  const [coords, setCoords] = useState(() => {
    if (latParam && lonParam && !isNaN(latParam) && !isNaN(lonParam)) {
      return { lat: latParam, lon: lonParam };
    }
    return null;
  });
  const [locating, setLocating] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Request GPS geolocation
  const requestLocation = useCallback((force = false) => {
    if (coords && !force) return;
    if (!navigator.geolocation) {
      setCoords((prev) => prev || DEFAULT_COORDS);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setCoords((prev) => prev || DEFAULT_COORDS);
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [coords]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Load hospitals dynamically from database via API
  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const activeCoords = coords || DEFAULT_COORDS;
      const nearbyParams = {
        lat: activeCoords.lat,
        lon: activeCoords.lon,
        offset: 0,
        limit: PAGE_SIZE,
      };
      if (categoryParam) {
        nearbyParams.category = categoryParam;
      }

      const res = await hospitalApi.nearby(nearbyParams);

      if (res && res.results && res.results.length > 0) {
        const mapped = res.results.map((item, idx) => mapHospitalData(item, null, idx));
        setHospitals(mapped);
      } else {
        // Fallback to full list
        const all = await hospitalApi.list();
        let filtered = all || [];
        if (categoryParam && categoryParam !== 'General OPD') {
          filtered = filtered.filter(
            (h) => h.categories && h.categories.includes(categoryParam)
          );
          if (filtered.length === 0) filtered = all || [];
        }
        const mapped = filtered.map((h, idx) => {
          // calculate fallback distance relative to default coords
          const approxDist = 8.8 + idx * 2.4;
          return mapHospitalData(h, approxDist, idx);
        });
        setHospitals(mapped);
      }
    } catch (err) {
      console.error('Error fetching hospitals:', err);
      toast.error(err.message || 'Could not load hospitals');
    } finally {
      setLoading(false);
    }
  }, [coords, categoryParam, toast]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  // Filter hospitals by search query
  const displayedHospitals = searchQuery
    ? hospitals.filter(
        (h) =>
          h.hospital_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.hospital_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : hospitals;

  return (
    <div className="arogyaflow-backdrop">
      <main
        className="arogyaflow-phone-frame"
        style={{
          backgroundColor: '#ffffff',
          height: '100dvh',
          maxHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        aria-label="Find Hospital"
      >
        {/* Top Drag Handle Bar */}
        <div className="arogyaflow-drag-handle" data-purpose="drag-handle-bar">
          <div className="arogyaflow-drag-bar" />
        </div>

        {/* 1. Top App Bar (Header): Back button, Find Hospital title */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px 12px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
          }}
          data-purpose="app-header"
        >
          {/* Clean circular/rounded back button */}
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1e293b',
              transition: 'background-color 0.15s ease',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          {/* Centered bold dark green title */}
          <h1
            style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#043c2c',
              margin: 0,
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            Find Hospital
          </h1>

          {/* Spacer for symmetrical centering */}
          <div style={{ width: '40px' }} />
        </header>

        {/* 2. Search & Status Section */}
        <div style={{ padding: '14px 16px 10px', flexShrink: 0, backgroundColor: '#ffffff' }}>
          {/* Status row: Green pin + Nearest text on left, Blue Refresh on right */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#00A884">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
              <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#043c2c' }}>
                Showing hospitals nearest to you
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                requestLocation();
                fetchHospitals();
              }}
              disabled={locating || loading}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#0284c7',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: locating ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.5s ease',
                }}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>{locating ? 'Locating…' : 'Refresh'}</span>
            </button>
          </div>

          {/* Full-width rounded search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '11px 14px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search hospital or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '14.5px',
                color: '#0f172a',
                width: '100%',
                backgroundColor: 'transparent',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 4px', fontSize: '13px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 3. Dynamic Hospital Cards (The Core Layout) */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            padding: '4px 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Loading nearest hospitals…</div>
            </div>
          ) : displayedHospitals.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏥</div>
              <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '15px' }}>No hospitals found</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Try searching with a different hospital name or area</div>
            </div>
          ) : (
            displayedHospitals.map((h, idx) => (
              <div
                key={h.id || idx}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #edf2f7',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                }}
              >
                {/* Card Internal Layout: Left Column Illustration, Right Column Details */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  {/* Left Column: Hospital illustration card */}
                  <div
                    style={{
                      width: '74px',
                      height: '74px',
                      borderRadius: '14px',
                      backgroundColor: '#E0F2FE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={h.illustration_id}
                      alt={h.hospital_name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </div>

                  {/* Right Column (Stacked) */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Row 1: Hospital Name + Inline Online/Offline Marking */}
                    {renderHospitalTitleWithBadge(h.hospital_name, h.is_currently_open)}

                    {/* Row 2: Hospital Type */}
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#64748b',
                        fontWeight: '400',
                      }}
                    >
                      {h.hospital_type}
                    </div>

                    {/* Row 3 (Split): Left: Map Pin + Distance | Right: Clock + Hours */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                      }}
                    >
                      {/* Distance */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12.5px',
                          color: '#64748b',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#64748b" style={{ flexShrink: 0 }}>
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                        </svg>
                        <span>{formatApproxDistance(h.distance_km)}</span>
                      </div>

                      {/* Operating Hours */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12.5px',
                          color: '#64748b',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{formatOperatingHours(h.operating_hours_start, h.operating_hours_end)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 5: Full-width vibrant green "Book Here →" button */}
                <button
                  type="button"
                  onClick={() => {
                    const approxDist = h.distance_km != null ? Number(h.distance_km).toFixed(1) : '8.8';
                    const q = new URLSearchParams();
                    q.set('hospitalId', h.id);
                    q.set('hospitalName', h.hospital_name || '');
                    if (h.slug) q.set('slug', h.slug);
                    if (h.hospital_type) q.set('type', h.hospital_type);
                    q.set('dist', approxDist);
                    if (h.illustration_id) q.set('img', h.illustration_id);
                    if (categoryParam) q.set('category', categoryParam);
                    if (phoneParam) q.set('phone', phoneParam);
                    if (tokenParam) q.set('token', tokenParam);
                    navigate(`/book?${q.toString()}`);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    backgroundColor: '#00A884',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0, 168, 132, 0.22)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Book Here</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* 4. Footer: Pinned at bottom */}
        <AyushmanFooter
          brandFirst={true}
          style={{
            flexShrink: 0,
            marginTop: 'auto',
            padding: '8px 16px 14px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
          }}
        />
      </main>
    </div>
  );
}

