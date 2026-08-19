import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hospitalApi, queueApi } from '../api/client';
import { EmptyState, Spinner } from '../components/ui';
import {
  HospitalIcon,
  MapPinIcon,
  SearchIcon,
  UserIcon,
  DoctorIcon,
  ArrowRightIcon,
  TicketIcon,
  PhoneIcon,
  BuildingIcon,
  LockIcon,
  ActivityIcon
} from '../components/Icons';

function isOpenNow(h) {
  if (!h || !h.openTime || !h.closeTime) return true;
  if (h.openTime === '00:00' && (h.closeTime === '23:59' || h.closeTime === '24:00')) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMins = (str) => {
    const [hh, mm] = str.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  const openMins = parseMins(h.openTime);
  const closeMins = parseMins(h.closeTime);

  if (closeMins > openMins) {
    return currentMinutes >= openMins && currentMinutes < closeMins;
  } else {
    // Overnight shift e.g. 20:00 to 06:00
    return currentMinutes >= openMins || currentMinutes < closeMins;
  }
}

export default function Landing() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await hospitalApi.list();
        if (!cancelled) {
          const validList = list || [];
          setHospitals(validList);
          const first = validList[0];
          if (first) {
            setSelectedHospital(first);
            const data = await queueApi.getQueue(first.id);
            if (!cancelled) setQueue(data);
          }
        }
      } catch {
        // Public landing page renders gracefully even if backend is initializing
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleHospitalChange = async (h) => {
    setSelectedHospital(h);
    try {
      const data = await queueApi.getQueue(h.id);
      setQueue(data);
    } catch {
      setQueue(null);
    }
    // On small screens, scroll down to the drawer element
    if (window.innerWidth < 860) {
      const drawer = document.getElementById('selected-hospital-drawer');
      if (drawer) drawer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  function trackToken(e) {
    e.preventDefault();
    if (phone.trim()) navigate(`/track/${encodeURIComponent(phone.trim())}`);
  }

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.address && h.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="clean-landing">
      {/* 1. Responsive Header */}
      <header className="clean-header">
        <div className="clean-header-inner">
          <Link to="/" className="clean-brand">
            <div className="clean-brand-icon">AF</div>
            <h1 className="clean-brand-name">ArogyaFlow</h1>
          </Link>

          <button
            className="mobile-nav-toggle"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Toggle Navigation"
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>

          <nav className={`clean-nav-links ${mobileNavOpen ? 'open' : ''}`}>
            <a href="#directory" className="clean-nav-link" onClick={() => setMobileNavOpen(false)}>Hospital Directory</a>
            <a href="#portals" className="clean-nav-link" onClick={() => setMobileNavOpen(false)}>Portals</a>
            <a href="#security" className="clean-nav-link" onClick={() => setMobileNavOpen(false)}>Security & Privacy</a>
            <div className="clean-mobile-actions">
              <Link to="/track" className="clean-btn-secondary" onClick={() => setMobileNavOpen(false)}>
                <SearchIcon size={16} /> Track Token
              </Link>
              <Link to="/book" className="clean-btn-primary" onClick={() => setMobileNavOpen(false)}>
                <TicketIcon size={16} /> Book Token
              </Link>
            </div>
          </nav>

          <div className="clean-desktop-actions">
            <Link to="/track" className="clean-btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              <SearchIcon size={16} /> Track Token
            </Link>
            <Link to="/book" className="clean-btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
              <TicketIcon size={16} /> Book Token
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="clean-hero">
        <div className="clean-hero-inner">
          <div>
            <div className="clean-hero-badge">
              <ActivityIcon size={14} /> Smart OPD Queue Orchestration
            </div>

            <h1 className="clean-hero-h1">
              OPD Token Management & Live Queue Tracking
            </h1>

            <p className="clean-hero-p">
              ArogyaFlow helps patients find OPD hospitals, book consultation tokens, and receive live SMS turn updates without standing in crowded waiting rooms.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/book" className="clean-btn-primary">
                <TicketIcon size={18} /> Book Live Token
              </Link>
              <Link to="/find-hospital" className="clean-btn-secondary">
                <HospitalIcon size={18} /> View Hospitals
              </Link>
            </div>
          </div>

          {/* Quick Track Box */}
          <div className="clean-tracker-card">
            <h3 className="clean-tracker-title">
              <SearchIcon size={18} style={{ color: '#0284c7' }} /> Track Your Queue Position
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Enter the phone number used at booking to check real-time turn status.
            </p>

            <form onSubmit={trackToken}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <PhoneIcon size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter Mobile Number (+91 9876543210)"
                  required
                  className="clean-input"
                  style={{ paddingLeft: '40px' }}
                />
              </div>

              <button type="submit" className="clean-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Track Token Position <ArrowRightIcon size={16} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 3. Real Dynamic Stats Strip */}
      <section className="clean-stats-strip">
        <div className="clean-stats-inner">
          <div className="clean-stat-card">
            <HospitalIcon size={24} style={{ color: '#0284c7' }} />
            <div>
              <div className="clean-stat-val">{hospitals.length || 25}</div>
              <div className="clean-stat-lbl">Registered Hospitals</div>
            </div>
          </div>

          <div className="clean-stat-card">
            <ActivityIcon size={24} style={{ color: '#10b981' }} />
            <div>
              <div className="clean-stat-val">Live</div>
              <div className="clean-stat-lbl">OPD Counter Synchronization</div>
            </div>
          </div>

          <div className="clean-stat-card">
            <PhoneIcon size={24} style={{ color: '#0284c7' }} />
            <div>
              <div className="clean-stat-val">SMS & Voice</div>
              <div className="clean-stat-lbl">Instant Location Token Dispatch</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Hospital Directory Section */}
      <section id="directory" className="clean-section">
        <div className="clean-section-header">
          <h2 className="clean-section-title">Hospital Directory & Live Status</h2>
          <p className="clean-section-desc">Select a hospital to view departments, OPD timings, and active counter status.</p>
        </div>

        <div className="clean-directory-grid">
          {/* Left List */}
          <div>
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hospital by name or area..."
                className="clean-input"
                style={{ paddingLeft: '38px' }}
              />
            </div>

            <div style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredHospitals.slice(0, 20).map((h, idx) => {
                const isSelected = selectedHospital?.id === h.id;
                const opdOpen = isOpenNow(h);

                return (
                  <div
                    key={h.id || h.slug || idx}
                    onClick={() => handleHospitalChange(h)}
                    className={`clean-hospital-card ${isSelected ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 className="clean-hospital-title">#{idx + 1} {h.name}</h4>
                      {opdOpen ? (
                        <span className="clean-pill" style={{ background: '#ecfdf5', color: '#047857' }}>🟢 OPD Open</span>
                      ) : (
                        <span className="clean-pill" style={{ background: '#fef2f2', color: '#b91c1c' }}>🔴 OPD Closed</span>
                      )}
                    </div>

                    <div className="clean-hospital-meta" style={{ marginTop: '4px' }}>
                      <MapPinIcon size={14} style={{ color: '#0284c7' }} />
                      {h.address || 'Mumbai / Thane Region'}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <span className="clean-pill">⏰ OPD: {h.openTime || '08:00'} - {h.closeTime || '20:00'}</span>
                      <span className="clean-pill">👨‍⚕️ {h.activeCounters || 2} Counters</span>
                    </div>
                  </div>
                );
              })}

              {filteredHospitals.length === 0 && (
                <EmptyState title="No matching hospitals found" hint="Try searching with a different location name." />
              )}
            </div>
          </div>

          {/* Right Selected Hospital Drawer */}
          <div>
            {selectedHospital ? (
              <div id="selected-hospital-drawer" className="clean-drawer">
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {selectedHospital.name}
                    </h3>
                    {isOpenNow(selectedHospital) ? (
                      <span className="clean-pill" style={{ background: '#ecfdf5', color: '#047857' }}>🟢 OPD Open</span>
                    ) : (
                      <span className="clean-pill" style={{ background: '#fef2f2', color: '#b91c1c' }}>🔴 OPD Closed</span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPinIcon size={14} style={{ color: '#0284c7' }} /> {selectedHospital.address}
                  </p>
                  {selectedHospital.digipin && (
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0284c7', display: 'block', marginTop: '6px', fontWeight: 600 }}>
                      📌 DIGIPIN: {selectedHospital.digipin}
                    </span>
                  )}
                </div>

                {/* Departments */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                    OPD Specializations
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedHospital.categories?.map((cat) => (
                      <span key={cat} className="clean-pill" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        {cat}
                      </span>
                    )) || <span style={{ fontSize: '12px', color: '#64748b' }}>General Medicine</span>}
                  </div>
                </div>

                {/* Live Status Box */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                    Live Queue Counter Overview
                  </div>

                  {loading ? (
                    <Spinner label="Loading counter status..." />
                  ) : queue ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '12px' }}>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706' }}>{queue.stats?.waiting || 0}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>WAITING</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7' }}>{queue.stats?.serving || 0}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>SERVING</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981' }}>{queue.stats?.completed || 0}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>COMPLETED</div>
                        </div>
                      </div>

                      {queue.currentServing ? (
                        <div style={{ fontSize: '13px', color: '#047857', fontWeight: 600, background: '#ecfdf5', padding: '8px 12px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                          🟢 Token #{queue.currentServing} is currently at the counter
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                          Queue is clear right now.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Operational</div>
                  )}
                </div>

                <Link
                  to={`/book?hospitalId=${selectedHospital.id}&hospitalName=${encodeURIComponent(selectedHospital.name)}`}
                  className="clean-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <TicketIcon size={16} /> Book OPD Token at {selectedHospital.name.split(',')[0]}
                </Link>
              </div>
            ) : (
              <EmptyState title="Select a hospital" hint="Choose a hospital from the list to view OPD details." />
            )}
          </div>
        </div>
      </section>

      {/* 5. Portal Access */}
      <section id="portals" className="clean-section" style={{ borderTop: '1px solid #e2e8f0' }}>
        <div className="clean-section-header">
          <h2 className="clean-section-title">Healthcare Portals</h2>
          <p className="clean-section-desc">Access dedicated interfaces for patients, doctors, and staff.</p>
        </div>

        <div className="clean-portals-grid">
          <div className="clean-portal-box">
            <div>
              <div className="clean-portal-icon">
                <UserIcon size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Patient Portal</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Track live OPD token positions, manage prescriptions, and share records with doctors via OTP consent.
              </p>
            </div>
            <Link to="/login/patient" className="clean-btn-secondary" style={{ marginTop: '20px', justifyContent: 'center' }}>
              Patient Login <ArrowRightIcon size={14} />
            </Link>
          </div>

          <div className="clean-portal-box">
            <div>
              <div className="clean-portal-icon">
                <DoctorIcon size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Doctor Portal</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Scan patient check-in QR codes, access shared medical history, and issue digital prescriptions.
              </p>
            </div>
            <Link to="/login/doctor" className="clean-btn-secondary" style={{ marginTop: '20px', justifyContent: 'center' }}>
              Doctor Login <ArrowRightIcon size={14} />
            </Link>
          </div>

          <div className="clean-portal-box">
            <div>
              <div className="clean-portal-icon">
                <BuildingIcon size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Hospital Staff</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                Manage counter token calling boards, dispatch next numbers, and oversee OPD queue operations.
              </p>
            </div>
            <Link to="/login/admin" className="clean-btn-secondary" style={{ marginTop: '20px', justifyContent: 'center' }}>
              Staff Login <ArrowRightIcon size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Privacy & Security */}
      <section id="security" style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '40px 24px' }}>
        <div style={{ maxWdith: '1140px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <LockIcon size={24} style={{ color: '#0284c7' }} />
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
              Consent-Based Data Privacy & Security
            </h4>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              All patient medical records are encrypted. Doctors can only view patient EMR records after receiving explicit OTP consent verification.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="clean-footer">
        <div className="clean-footer-inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <strong style={{ color: '#ffffff', fontSize: '16px' }}>ArogyaFlow Healthcare</strong>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                Smart OPD Queueing & Clinical Token Orchestration Platform
              </p>
            </div>

            <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
              <Link to="/book" style={{ color: '#94a3b8', textDecoration: 'none' }}>Book Token</Link>
              <Link to="/find-hospital" style={{ color: '#94a3b8', textDecoration: 'none' }}>Find Hospital</Link>
              <Link to="/track" style={{ color: '#94a3b8', textDecoration: 'none' }}>Track Position</Link>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', marginTop: '24px', paddingTop: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
            © {new Date().getFullYear()} ArogyaFlow. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
