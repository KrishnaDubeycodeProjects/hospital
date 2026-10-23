import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import AyushmanFooter from '../components/AyushmanFooter';
import { WhatsAppIcon } from '../components/Icons';
import {
  Calendar,
  Clock,
  FileText,
  Building2,
  Users,
  Stethoscope,
  Activity,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const services = [
    {
      id: 'book',
      title: 'Book OPD Token',
      subtitle: 'Select department, check hospital distance & register your visit token',
      icon: Calendar,
      color: '#E0F2FE',
      border: '#BAE6FD',
      iconColor: '#0284C7',
      route: '/find-hospital',
    },
    {
      id: 'track',
      title: 'Track Live Queue',
      subtitle: 'Monitor real-time token progression and estimated waiting time',
      icon: Clock,
      color: '#FFEDD5',
      border: '#FED7AA',
      iconColor: '#EA580C',
      route: '/track',
    },
    {
      id: 'records',
      title: 'Health Records & ABHA',
      subtitle: 'Access digital prescriptions, diagnostic lab reports & medical history',
      icon: FileText,
      color: '#F3E8FF',
      border: '#E9D5FF',
      iconColor: '#9333EA',
      route: '/login/patient',
    },
    {
      id: 'hospitals',
      title: 'Hospitals & Departments',
      subtitle: 'Explore participating medical centers, OPD timings and counter status',
      icon: Building2,
      color: '#DCFCE7',
      border: '#BBF7D0',
      iconColor: '#16A34A',
      route: '/find-hospital',
    },
    {
      id: 'family',
      title: 'Family Health Profiles',
      subtitle: 'Manage dependents, children, and elderly parents under a unified profile',
      icon: Users,
      color: '#FFE4E6',
      border: '#FECDD3',
      iconColor: '#E11D48',
      route: '/login/patient',
    },
    {
      id: 'doctor',
      title: 'Clinician Consultation Suite',
      subtitle: 'Digital EHR consultation workflow, e-prescriptions & queue calling',
      icon: Stethoscope,
      color: '#E0E7FF',
      border: '#C7D2FE',
      iconColor: '#4F46E5',
      route: '/login/doctor',
    },
    {
      id: 'asha',
      title: 'Community Health Hub',
      subtitle: 'ASHA worker survey tools, maternal health tracking & village sync',
      icon: Users,
      color: '#DCFCE7',
      border: '#BBF7D0',
      iconColor: '#15803D',
      route: '/asha',
    },
  ];

  const platformPillars = [
    {
      icon: Clock,
      title: 'Live Queue Tracking',
      description: 'Transparent token call progression with travel-time buffers to reduce crowded waiting halls.',
      iconColor: '#047857',
      bgColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    {
      icon: ShieldCheck,
      title: 'Digital Health Records',
      description: 'Longitudinal medical vault linking verified ABHA accounts with prescriptions and lab results.',
      iconColor: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
    },
    {
      icon: Stethoscope,
      title: 'Clinician Workflow',
      description: 'Streamlined doctor desk with one-click patient calling, history review, and drug database.',
      iconColor: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
    },
    {
      icon: Smartphone,
      title: 'Mobile & WhatsApp Access',
      description: 'Instant token booking and live notifications delivered directly to citizens via WhatsApp.',
      iconColor: '#059669',
      bgColor: '#F0FDF4',
      borderColor: '#BBF7D0',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      {/* Website Top Navigation Header */}
      <AppHeader activeNav="home" />

      {/* Main Website Content */}
      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section
          style={{
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
            borderBottom: '1px solid #E2E8F0',
            padding: '52px 20px 44px',
          }}
        >
          <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F4C3A',
                backgroundColor: '#E8F5E9',
                border: '1px solid #C8E6C9',
                padding: '5px 14px',
                borderRadius: '20px',
                marginBottom: '18px',
              }}
            >
              <Activity size={14} style={{ color: '#0F4C3A' }} />
              <span>Hospital Outpatient Queue &amp; Care Coordination System</span>
            </span>

            <h1
              style={{
                fontSize: 'clamp(28px, 4.2vw, 46px)',
                fontWeight: '900',
                color: '#0F4C3A',
                margin: '0 0 16px',
                letterSpacing: '-0.03em',
                lineHeight: 1.18,
              }}
            >
              Modern Outpatient Care &amp; <br />
              <span style={{ color: '#059669' }}>Transparent Queue Management</span>
            </h1>

            <p
              style={{
                fontSize: '15.5px',
                color: '#475569',
                maxWidth: '680px',
                margin: '0 auto 28px',
                lineHeight: 1.6,
              }}
            >
              Connect patients, clinicians, and hospital counters through real-time queue visibility, digital health record vaults, and automated mobile updates.
            </p>

            {/* Quick Action Buttons */}
            <div className="landing-hero-actions">
              <button
                type="button"
                onClick={() => navigate('/find-hospital')}
                style={{
                  backgroundColor: '#0F4C3A',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '14.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(15, 76, 58, 0.2)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Calendar size={18} />
                <span>Book OPD Appointment</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/track')}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '12px 22px',
                  fontSize: '14.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Clock size={18} />
                <span>Track Active Token</span>
              </button>
              <button
                type="button"
                onClick={() => window.open('https://wa.me/919120123877?text=Hi', '_blank')}
                style={{
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #86EFAC',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  fontSize: '14.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <WhatsAppIcon size={17} color="#15803D" />
                <span>WhatsApp Assistant</span>
              </button>
            </div>

            {/* Platform Feature Pillars */}
            <div className="landing-pillars-grid">
              {platformPillars.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: p.bgColor,
                        border: `1px solid ${p.borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} style={{ color: p.iconColor }} />
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1E293B' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.45' }}>
                      {p.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Core Services Section */}
        <section style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(32px, 5vw, 48px) clamp(16px, 4vw, 20px)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 24px)', fontWeight: '800', color: '#0F4C3A', margin: '0 0 8px' }}>
              Comprehensive Healthcare Services
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0, maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}>
              Access everything from OPD appointment booking to electronic health records in one unified, patient-centric system.
            </p>
          </div>

          <div className="landing-services-grid">
            {services.map((svc) => {
              const IconComp = svc.icon;
              return (
                <div
                  key={svc.id}
                  onClick={() => navigate(svc.route)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = svc.border;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: svc.color,
                      border: `1px solid ${svc.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={22} style={{ color: svc.iconColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 5px', fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>
                      {svc.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: '1.45' }}>
                      {svc.subtitle}
                    </p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '10px', fontSize: '12px', fontWeight: '700', color: '#0F4C3A' }}>
                      <span>Open Service</span>
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Stakeholder Portals Section */}
        <section style={{ backgroundColor: '#F1F5F9', borderTop: '1px solid #E2E8F0', padding: 'clamp(32px, 5vw, 42px) clamp(16px, 4vw, 20px)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: 'clamp(19px, 3.2vw, 22px)', fontWeight: '800', color: '#1E293B', margin: '0 0 6px' }}>
                Dedicated Stakeholder Portals
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Tailored interfaces for patients, clinicians, hospital staff, and community health workers.
              </p>
            </div>

            <div className="landing-portals-grid">
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px', width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={22} style={{ color: '#0F4C3A' }} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0F4C3A' }}>Patient &amp; Family</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5, flex: 1 }}>
                  View live OPD tokens, digital prescription slips, lab results, and household member ABHA cards.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/patient')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#E8F5E9', color: '#0F4C3A', border: '1px solid #C8E6C9', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Enter Patient Portal &rarr;
                </button>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px', width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stethoscope size={22} style={{ color: '#1D4ED8' }} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#1D4ED8' }}>Doctor Consultation</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5, flex: 1 }}>
                  Call patients into the chair, generate e-prescriptions, order lab tests, and track care continuums.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/doctor')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Enter Doctor Desk &rarr;
                </button>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px', width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={22} style={{ color: '#0F766E' }} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0F766E' }}>Hospital Admin &amp; Reception</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5, flex: 1 }}>
                  Configure departments, manage counter queue queues, handle token calls, and view hospital analytics.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/admin')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#F0FDFA', color: '#0F766E', border: '1px solid #99F6E4', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Enter Staff Console &rarr;
                </button>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #86EFAC', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px', width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={22} style={{ color: '#15803D' }} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#15803D' }}>ASHA &amp; Community Health</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.5, flex: 1 }}>
                  Conduct village household surveys, monitor maternal health status, and sync offline field data.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/asha')}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  Launch ASHA Hub &rarr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* WhatsApp Assistance Banner */}
        <section style={{ backgroundColor: '#ffffff', borderTop: '1px solid #E2E8F0', padding: 'clamp(28px, 4vw, 36px) clamp(16px, 4vw, 20px)' }}>
          <div className="landing-wa-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#25D366',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                }}
              >
                <WhatsAppIcon size={24} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16.5px', fontWeight: '800', color: '#166534' }}>
                  Automated WhatsApp Notification Bot
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#15803D' }}>
                  Book appointment tokens and receive live queue notifications on WhatsApp: <strong>+91 91201 23877</strong>
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/919120123877?text=Hi"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#16A34A',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
              }}
            >
              <WhatsAppIcon size={16} color="#ffffff" />
              <span>Message on WhatsApp</span>
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <AyushmanFooter />
    </div>
  );
}
