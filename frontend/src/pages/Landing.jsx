import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import AyushmanFooter from '../components/AyushmanFooter';
import { WhatsAppIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Clock,
  FileText,
  Users,
  Stethoscope,
  Building2,
  ChevronRight,
  Ticket,
  Footprints,
} from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/919120123877?text=Hi';

/**
 * Home page. Written for first-time, low-literacy patients:
 *  - three big actions first (book · check my token · WhatsApp), each with a Hindi line
 *  - a 3-step "how it works" so the token idea is clear without reading paragraphs
 *  - staff / health-worker tools kept small and separate at the bottom
 */
export default function Landing() {
  const navigate = useNavigate();
  const { patient } = useAuth();

  const primaryActions = [
    {
      id: 'book',
      title: 'Book a token',
      hindi: 'टोकन बुक करें',
      icon: Calendar,
      onClick: () => navigate('/find-hospital'),
      style: { backgroundColor: '#0F4C3A', color: '#ffffff', border: '1px solid #0F4C3A' },
      hindiColor: '#C8E6C9',
    },
    {
      id: 'track',
      title: 'Check my token',
      hindi: 'मेरा टोकन देखें',
      icon: Clock,
      onClick: () => navigate('/track'),
      style: { backgroundColor: '#ffffff', color: '#0F172A', border: '1px solid #CBD5E1' },
      hindiColor: '#64748B',
    },
    {
      id: 'whatsapp',
      title: 'Book on WhatsApp',
      hindi: 'व्हाट्सएप पर बुक करें',
      icon: null,
      onClick: () => window.open(WHATSAPP_URL, '_blank', 'noopener'),
      style: { backgroundColor: '#DCFCE7', color: '#14532D', border: '1px solid #86EFAC' },
      hindiColor: '#15803D',
    },
  ];

  const steps = [
    { icon: Building2, title: 'Choose hospital and doctor', hindi: 'अस्पताल और डॉक्टर चुनें' },
    { icon: Ticket, title: 'Get your token number', hindi: 'अपना टोकन नंबर पाएं' },
    { icon: Footprints, title: 'Come when your turn is near', hindi: 'बारी पास आने पर आएं' },
  ];

  const services = [
    {
      id: 'book',
      title: 'Book a token',
      subtitle: 'Pick a nearby hospital and the doctor you need',
      icon: Calendar,
      color: '#E0F2FE',
      border: '#BAE6FD',
      iconColor: '#0284C7',
      route: '/find-hospital',
    },
    {
      id: 'track',
      title: 'Check my token',
      subtitle: 'See how many people are before you',
      icon: Clock,
      color: '#FFEDD5',
      border: '#FED7AA',
      iconColor: '#EA580C',
      route: '/track',
    },
    {
      id: 'records',
      title: 'My reports & medicines',
      subtitle: 'Prescriptions, lab reports and past visits',
      icon: FileText,
      color: '#F3E8FF',
      border: '#E9D5FF',
      iconColor: '#9333EA',
      route: patient ? '/patient/records' : '/login/patient',
    },
    {
      id: 'family',
      title: 'My family',
      subtitle: 'Add children and parents to book for them',
      icon: Users,
      color: '#FFE4E6',
      border: '#FECDD3',
      iconColor: '#E11D48',
      route: patient ? '/patient/family' : '/login/patient',
    },
  ];

  const staffLinks = [
    { id: 'doctor', label: 'Doctor login', icon: Stethoscope, color: '#1D4ED8', onClick: () => navigate('/login/doctor') },
    { id: 'admin', label: 'Hospital staff login', icon: Building2, color: '#0F766E', onClick: () => navigate('/login/admin') },
    { id: 'asha', label: 'ASHA worker app', icon: Users, color: '#15803D', onClick: () => { window.location.href = '/asha'; } },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      <AppHeader activeNav="home" />

      <main style={{ flex: 1 }}>
        {/* Hero: one sentence, three big buttons */}
        <section
          style={{
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
            borderBottom: '1px solid #E2E8F0',
            padding: 'clamp(32px, 6vw, 52px) 20px clamp(28px, 5vw, 44px)',
          }}
        >
          <div style={{ maxWidth: '880px', margin: '0 auto', textAlign: 'center' }}>
            <h1
              style={{
                fontSize: 'clamp(28px, 5vw, 44px)',
                fontWeight: '900',
                color: '#0F4C3A',
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Get your hospital token
              <br />
              <span style={{ color: '#059669' }}>without standing in line</span>
            </h1>
            <p style={{ fontSize: 'clamp(16px, 2.6vw, 19px)', fontWeight: '700', color: '#047857', margin: '0 0 12px' }}>
              घर बैठे अस्पताल का टोकन लें
            </p>
            <p style={{ fontSize: '16px', color: '#475569', maxWidth: '560px', margin: '0 auto 28px', lineHeight: 1.6 }}>
              Book a token, watch your turn on your phone, and go to the doctor only when it is almost your turn.
            </p>

            <div className="landing-hero-actions">
              {primaryActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={a.onClick}
                    style={{
                      ...a.style,
                      minHeight: '64px',
                      minWidth: '220px',
                      borderRadius: '14px',
                      padding: '12px 22px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'left',
                      boxShadow: '0 2px 8px rgba(15, 76, 58, 0.10)',
                    }}
                  >
                    {Icon ? <Icon size={24} /> : <WhatsAppIcon size={24} color={a.style.color} />}
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                      <span style={{ fontSize: '17px', fontWeight: '800' }}>{a.title}</span>
                      <span style={{ fontSize: '13.5px', fontWeight: '600', color: a.hindiColor }}>{a.hindi}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* How it works */}
            <ol
              aria-label="How it works"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 auto',
                maxWidth: '820px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: '12px',
                textAlign: 'left',
              }}
            >
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li
                    key={s.title}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#047857',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{s.title}</span>
                      <span style={{ fontSize: '13px', color: '#64748B' }}>{s.hindi}</span>
                    </span>
                    <Icon size={22} style={{ color: '#059669', flexShrink: 0 }} />
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Patient services */}
        <section style={{ maxWidth: '1000px', margin: '0 auto', padding: 'clamp(28px, 5vw, 44px) clamp(16px, 4vw, 20px)' }}>
          <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 24px)', fontWeight: '800', color: '#0F4C3A', margin: '0 0 20px', textAlign: 'center' }}>
            What do you want to do?
          </h2>

          <div className="landing-services-grid">
            {services.map((svc) => {
              const IconComp = svc.icon;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => navigate(svc.route)}
                  className="landing-service-card"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '18px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    textAlign: 'left',
                    width: '100%',
                    font: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      backgroundColor: svc.color,
                      border: `1px solid ${svc.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={26} style={{ color: svc.iconColor }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', margin: '0 0 4px', fontSize: '17px', fontWeight: '700', color: '#1E293B' }}>
                      {svc.title}
                    </span>
                    <span style={{ display: 'block', fontSize: '14px', color: '#64748B', lineHeight: 1.45 }}>{svc.subtitle}</span>
                  </span>
                  <ChevronRight size={22} style={{ color: '#94A3B8', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </section>

        {/* WhatsApp */}
        <section style={{ padding: '0 clamp(16px, 4vw, 20px) clamp(28px, 4vw, 40px)' }}>
          <div className="landing-wa-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#25D366',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <WhatsAppIcon size={24} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: '#166534' }}>
                  No app needed — use WhatsApp
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#15803D', lineHeight: 1.5 }}>
                  Send <strong>Hi</strong> to <strong>+91 91201 23877</strong> to book a token and get updates about your turn.
                </p>
              </div>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#16A34A',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 22px',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '15px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <WhatsAppIcon size={18} color="#ffffff" />
              <span>Open WhatsApp</span>
            </a>
          </div>
        </section>

        {/* Staff & health-worker tools: present, but out of the patient's way */}
        <section style={{ backgroundColor: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: '24px clamp(16px, 4vw, 20px)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', marginBottom: '12px', textAlign: 'center' }}>
              For doctors, hospital staff and ASHA workers
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              {staffLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={l.onClick}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      minHeight: '44px',
                      padding: '8px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      color: l.color,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={16} />
                    <span>{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <AyushmanFooter />
    </div>
  );
}
