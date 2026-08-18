import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hospitalApi, queueApi } from '../api/client';
import { Button, Card, EmptyState, Field, Input, Spinner, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();
  const { admin, patient, doctor } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await hospitalApi.list();
        if (!cancelled) {
          setHospitals(list || []);
          const first = list?.[0];
          if (first) {
            setSelectedHospital(first);
            const data = await queueApi.getQueue(first.id);
            if (!cancelled) setQueue(data);
          }
        }
      } catch {
        // Public landing page renders gracefully even if backend is starting
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
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">
            ⚡ Smart Healthcare Queue & Clinic Automation
          </div>
          <div className="row-gap" style={{ justifyContent: 'center', marginBottom: '12px' }}>
            <span className="brand-mark brand-mark-lg">AF</span>
            <h1 style={{ fontSize: '42px', margin: 0 }}>ArogyaFlow</h1>
          </div>
          <p className="landing-hero-lead">
            Zero-Wait Clinic Queues, Live Token Tracking & Direct Doctor-Patient Record Exchange.
          </p>

          <div className="hero-actions">
            <Link to="/book">
              <Button size="lg" className="hero-btn-primary">
                🎟️ Book Live Token Now
              </Button>
            </Link>
            <Link to="/login/patient">
              <Button size="lg" variant="secondary" className="hero-btn-secondary">
                🩺 Patient Portal & Reports
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="landing-body">
        {/* Quick Token Tracking Section */}
        <Card className="hero-card-elevated">
          <div className="card-head">
            <div>
              <h2>🔍 Track Your Queue Token</h2>
              <p className="muted-text">Enter the phone number used at check-in for real-time live position updates.</p>
            </div>
          </div>
          <form onSubmit={trackToken} className="track-hero-form">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter Mobile Number (+91 9876543210)"
              required
              className="track-input-lg"
            />
            <Button type="submit" size="lg">
              Track Position Live
            </Button>
          </form>
        </Card>

        {/* Hospital Directory & Location Finder */}
        <div className="landing-grid-layout">
          <div className="stack-md">
            <Card
              title="🏥 Hospital Directory & Live OPD Status"
              extra={
                <span className="badge badge-blue">
                  {hospitals.length || 100}+ Hospitals Registered
                </span>
              }
            >
              <div className="stack-md">
                <Field label="Search by Location (Kandivali, Borivali, Malad, Goregaon, Andheri...)">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type area e.g. Kandivali West, Borivali, OPD..."
                  />
                </Field>

                <div className="hospital-scroll-list">
                  {filteredHospitals.slice(0, 20).map((h, idx) => (
                    <div
                      key={h.id || h.uriSlug}
                      className={`hospital-list-item ${selectedHospital?.id === h.id ? 'active' : ''}`}
                      onClick={() => handleHospitalChange(h)}
                    >
                      <div className="hospital-item-title">
                        <strong>#{idx + 1} {h.name}</strong>
                        <span className="badge badge-green">OPD {h.openTime}–{h.closeTime}</span>
                      </div>
                      <div className="muted-text" style={{ fontSize: '13px', marginTop: '4px' }}>
                        📍 {h.address || 'Mumbai, Maharashtra'}
                      </div>
                      <div className="category-pills" style={{ marginTop: '6px' }}>
                        {h.categories?.slice(0, 4).map((c) => (
                          <span key={c} className="cat-pill">{c}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredHospitals.length === 0 && (
                    <EmptyState title="No matching hospitals found" hint="Try searching Kandivali, Borivali, or Malad" />
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Selected Hospital Live Queue Snapshot */}
          <div className="stack-md">
            {selectedHospital && (
              <Card title={`🏥 ${selectedHospital.name}`}>
                <div className="stack-md">
                  <div className="hospital-profile-header">
                    <p className="muted-text" style={{ fontSize: '14px', margin: 0 }}>📍 {selectedHospital.address || 'Mumbai, Maharashtra'}</p>
                    {selectedHospital.digipin && <span className="badge badge-amber">📌 DIGIPIN: {selectedHospital.digipin}</span>}
                  </div>

                  <div className="hospital-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', margin: '8px 0' }}>
                    <span className="badge badge-blue">⏰ OPD: {selectedHospital.openTime}–{selectedHospital.closeTime}</span>
                    <span className="badge badge-green">👨‍⚕️ Counters: {selectedHospital.activeCounters || 2} Active</span>
                    <span className="badge badge-amber">⏱️ Avg Wait: {selectedHospital.avgServiceMinutes || 10} min/pt</span>
                    {selectedHospital.ownership && <span className="badge badge-purple">🏛️ {selectedHospital.ownership}</span>}
                    {selectedHospital.yearEstablished && <span className="badge badge-gray">📅 Est. {selectedHospital.yearEstablished}</span>}
                  </div>

                  {selectedHospital.categories && selectedHospital.categories.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>🩺 Medical Specializations & OPD Departments:</strong>
                      <div className="category-pills">
                        {selectedHospital.categories.map((cat) => (
                          <span key={cat} className="cat-pill">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedHospital.accreditation && selectedHospital.accreditation.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>🏆 Accreditations:</strong>
                      <div className="row-gap" style={{ gap: '6px' }}>
                        {selectedHospital.accreditation.map((acc) => (
                          <span key={acc} className="badge badge-green">{acc}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />

                  {loading && <Spinner label="Checking live counters..." />}
                  {queue && (
                    <div className="stack-md">
                      <div className="stat-row">
                        <StatCard label="Waiting" value={queue.stats?.waiting || 0} tone="amber" />
                        <StatCard label="Now Serving" value={queue.stats?.serving || 0} tone="blue" />
                        <StatCard label="Done Today" value={queue.stats?.completed || 0} tone="green" />
                      </div>

                      {queue.currentServing ? (
                        <div className="callout callout-ok">
                          🟢 <strong>Token #{queue.currentServing}</strong> is currently at the counter!
                        </div>
                      ) : (
                        <EmptyState title="No active tokens at counter right now." hint="Queue is clear and ready for immediate check-in." />
                      )}

                      <Link to="/book" style={{ display: 'block', marginTop: '8px' }}>
                        <Button className="full-width" size="lg">
                          🎟️ Book Token at {selectedHospital.name.split(',')[0]}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* User Role Portals */}
            <Card title="Portal Access">
              <div className="role-card-grid">
                <RoleCard
                  to="/login/patient"
                  icon="🩺"
                  active={!!patient}
                  label="Patient Portal"
                  hint="Check live token position, access medical documents & share records with doctors."
                />
                <RoleCard
                  to="/login/doctor"
                  icon="👨‍⚕️"
                  active={!!doctor}
                  label="Doctor Portal"
                  hint="Manage OPD time slots, scan patient QR codes, and upload medical reports."
                />
                <RoleCard
                  to="/login/admin"
                  icon="🏥"
                  active={!!admin}
                  label="Hospital Staff"
                  hint="Operate OPD counter boards, call next patient tokens, and manage hospital settings."
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ to, icon, label, hint, active }) {
  return (
    <Link to={to} className="role-card">
      <div className="row-gap" style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <div className="role-card-label">{label}</div>
      </div>
      <p className="role-card-hint">{hint}</p>
      {active && <span className="badge badge-green">Session Active</span>}
    </Link>
  );
}
