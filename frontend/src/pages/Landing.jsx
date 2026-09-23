import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AyushmanFooter from '../components/AyushmanFooter';

export default function Landing() {
  const [selectedService, setSelectedService] = useState(null);
  const [isContinueActive, setIsContinueActive] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectorRef = useRef(null);
  const contentRef = useRef(null);
  const navigate = useNavigate();

  const services = [
    {
      id: 'book',
      title: 'Book OPD Token',
      subtitle: 'Join queue at a hospital near you',
      color: '#E0F2FE',
      iconColor: '#0284C7',
      route: '/find-hospital',
      renderIcon: () => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'track',
      title: 'Track My Turn',
      subtitle: 'Check live queue position & wait time',
      color: '#FFEDD5',
      iconColor: '#EA580C',
      route: '/track',
      renderIcon: () => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'records',
      title: 'My Health Records',
      subtitle: 'Prescriptions, lab reports, referrals',
      color: '#F3E8FF',
      iconColor: '#7C3AED',
      route: '/login/patient',
      renderIcon: () => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: 'hospitals',
      title: 'Find Hospitals',
      subtitle: 'Nearby OPDs with live queue status',
      color: '#DCFCE7',
      iconColor: '#059669',
      route: '/find-hospital',
      renderIcon: () => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0H5m14 0h2m-16 0H3m6-12h6m-3-3v6" />
        </svg>
      ),
    },
    {
      id: 'family',
      title: 'Family & ABHA',
      subtitle: 'Manage family & link Ayushman card',
      color: '#FFE4E6',
      iconColor: '#E11D48',
      route: '/login/patient',
      renderIcon: () => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  const selectedItem = services.find((s) => s.id === selectedService);

  function handleToggleSelector() {
    const nextState = !selectorOpen;
    setSelectorOpen(nextState);
    if (nextState) {
      setTimeout(() => {
        if (contentRef.current && selectorRef.current) {
          const targetOffset = selectorRef.current.offsetTop - 8;
          contentRef.current.scrollTo({
            top: targetOffset,
            behavior: 'smooth',
          });
        }
      }, 60);
    }
  }

  function handleSelectService(service) {
    setSelectedService(service.id);
    setIsContinueActive(true);
    setSelectorOpen(false);
  }

  function handleContinue() {
    setIsContinueActive(true);
    const item = selectedItem || services[0];
    if (selectedService) {
      navigate(item.route);
    } else {
      setSelectedService(item.id);
      setTimeout(() => {
        navigate(item.route);
      }, 200);
    }
  }

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
        aria-label="Aarogya Flow Platform"
      >
        {/* Top Drag Handle Bar */}
        <div className="arogyaflow-drag-handle" data-purpose="drag-handle-bar">
          <div className="arogyaflow-drag-bar" />
        </div>

        {/* 1. Top App Bar (Header): White background, 'X' on left, 'Aarogya Flow' center, kebab menu on right */}
        <header className="arogyaflow-top-bar" style={{ borderBottom: 'none', backgroundColor: '#ffffff' }} data-purpose="modal-header">
          {/* Left: Close Button (X) */}
          <button
            aria-label="Close"
            className="arogyaflow-icon-btn"
            type="button"
            onClick={() => {
              setSelectedService(null);
              setIsContinueActive(false);
              setSelectorOpen(false);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Center: Title "Aarogya Flow" in bold modern font */}
          <h1 className="arogyaflow-bar-title" style={{ color: '#043c2c', fontSize: '18px', fontWeight: '700' }}>
            Aarogya Flow
          </h1>

          {/* Right: Vertical three-dot (kebab) menu icon */}
          <div style={{ position: 'relative' }}>
            <button
              aria-label="More options"
              className="arogyaflow-icon-btn"
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#374151">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {menuOpen && (
              <div className="arogyaflow-dropdown">
                <button
                  type="button"
                  className="arogyaflow-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/find-hospital');
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Nearby OPDs</span>
                </button>
                <button
                  type="button"
                  className="arogyaflow-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/login/doctor');
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Doctor Portal</span>
                </button>
                <button
                  type="button"
                  className="arogyaflow-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/login/admin');
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span>Staff Portal</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* 2 & 3: Content Area (Standard ~16px mobile margin) */}
        <div className="arogyaflow-content" ref={contentRef}>
          {/* 2. Hero Banner: illustration card with rounded corners & subtle drop shadow */}
          <section className="arogyaflow-hero-card" data-purpose="hero-banner">
            <img
              src="/aarogya_flow_banner.png"
              alt="Aarogya Flow: Care Closer. Healthier Tomorrow."
              className="arogyaflow-hero-img"
            />
          </section>

          {/* 3. Middle Action Element: Choose your service sleek button */}
          <section
            ref={selectorRef}
            style={{ width: '100%', position: 'relative', scrollMarginTop: '12px' }}
            data-purpose="service-dropdown-selector"
          >
            <button
              className="arogyaflow-service-selector-btn"
              onClick={handleToggleSelector}
              type="button"
            >
              {/* Left-aligned text: "Choose your service" in medium gray, regular weight */}
              <span className={`arogyaflow-service-selector-text ${selectedItem ? 'selected' : ''}`}>
                {selectedItem ? selectedItem.title : 'Choose your service'}
              </span>

              {/* Right-aligned icon: small refined chevron (>) */}
              <svg
                className={`arogyaflow-chevron-icon ${selectorOpen ? 'open' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Expandable Service Selection List */}
            {selectorOpen && (
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingBottom: '16px',
                }}
              >
                {services.map((item) => {
                  const isSelected = selectedService === item.id;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectService(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleSelectService(item);
                      }}
                      className={`arogyaflow-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div
                        className="arogyaflow-card-icon"
                        style={{
                          backgroundColor: item.color,
                        }}
                      >
                        {item.renderIcon()}
                      </div>
                      <div className="arogyaflow-card-content">
                        <div className="arogyaflow-card-title">
                          {item.title}
                        </div>
                        <div className="arogyaflow-card-subtitle">
                          {item.subtitle}
                        </div>
                      </div>
                      <div className="arogyaflow-card-chevron">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Empty Space: Ample empty white space only when selector is closed */}
          {!selectorOpen && <div className="arogyaflow-spacer" />}
        </div>

        {/* 5. Bottom Sticky Footer: Pinned to bottom, full-width Continue pill + 2-line trust footer */}
        <footer className="arogyaflow-bottom-section" style={{ flexShrink: 0, marginTop: 'auto' }}>
          <button
            type="button"
            className={`arogyaflow-btn-continue ${isContinueActive ? 'active-green' : ''}`}
            onClick={handleContinue}
          >
            Continue
          </button>
          <AyushmanFooter style={{ padding: '0', marginTop: '2px' }} />
        </footer>
      </main>
    </div>
  );
}


