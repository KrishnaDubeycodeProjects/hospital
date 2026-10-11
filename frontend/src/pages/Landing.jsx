import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  FileText,
  Building2,
  Users,
  Stethoscope,
  MessageCircle,
  CheckCircle2,
  MapPin,
  Activity,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  HeartPulse,
  Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { otpApi, warmUpBackend } from '../api/client';
import AyushmanFooter from '../components/AyushmanFooter';

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const [demoLoading, setDemoLoading] = useState(false);

  // Trigger Lambda warming on user interaction
  const triggerWarmup = () => {
    warmUpBackend();
  };

  const services = [
    {
      id: 'whatsapp-opd',
      title: 'व्हाट्सएप ओपीडी पर्ची (WhatsApp Token)',
      subtitle: 'बिना कतार मोबाइल पर सीधे व्हाट्सएप संदेश भेजकर 30 सेकंड में पर्ची बनाएं',
      badge: 'सबसे तेज़ (Recommended)',
      badgeColor: '#008069',
      badgeBg: '#DCFCE7',
      icon: MessageCircle,
      iconBg: '#DCFCE7',
      iconColor: '#008069',
      route: 'https://wa.me/919120123877?text=Hi%2C%20I%20want%20to%20book%20an%20OPD%20appointment',
      isExternal: true,
    },
    {
      id: 'book',
      title: 'अस्पताल व विभाग चयन (Book OPD)',
      subtitle: 'सरकारी व प्राथमिक स्वास्थ्य केंद्रों में विभाग चुनें व दूरी अनुसार टोकन पाएं',
      badge: 'नागरिक सेवा',
      badgeColor: '#0369A1',
      badgeBg: '#E0F2FE',
      icon: CalendarCheck,
      iconBg: '#E0F2FE',
      iconColor: '#0284C7',
      route: '/find-hospital',
    },
    {
      id: 'track',
      title: 'लाइव कतार ट्रैकर (Live Queue Tracker)',
      subtitle: 'घर बैठे अपनी पर्ची संख्या, प्रतीक्षारत मरीज एवं सटीक आगमन समय देखें',
      badge: 'रियल-टाइम',
      badgeColor: '#B45309',
      badgeBg: '#FEF3C7',
      icon: Clock,
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
      route: '/track',
    },
    {
      id: 'asha',
      title: 'आशा कार्यकर्ता पोर्टल (ASHA Worker Portal)',
      subtitle: 'ग्रामीण परिवारों का स्वास्थ्य सर्वेक्षण, उच्च जोखिम गर्भावस्‍था (HRP) व टेलीकंसल्टेशन',
      badge: 'ग्रामीण स्वास्थ्य',
      badgeColor: '#15803D',
      badgeBg: '#DCFCE7',
      icon: HeartPulse,
      iconBg: '#DCFCE7',
      iconColor: '#16A34A',
      route: '/asha',
    },
    {
      id: 'records',
      title: 'आयुष्मान हेल्थ वॉल्ट (ABHA Health Vault)',
      subtitle: 'ई-पर्चा, रक्त जांच रिपोर्ट (CBC) एवं डिजिटल स्वास्थ्य इतिहास 14-अंक ABHA से सुरक्षित',
      badge: 'ABDM प्रमाणित',
      badgeColor: '#7E22CE',
      badgeBg: '#F3E8FF',
      icon: FileText,
      iconBg: '#F3E8FF',
      iconColor: '#9333EA',
      route: '/login/patient',
    },
    {
      id: 'doctor',
      title: 'चिकित्सक परामर्श कक्ष (Doctor OPD Cabin)',
      subtitle: 'डॉक्टरों के लिए कतार कॉल, ई-प्रिस्क्रिप्शन एवं त्वरित रेफरल प्रबंधन प्रणाली',
      badge: 'चिकित्सा कर्मी',
      badgeColor: '#1D4ED8',
      badgeBg: '#EFF6FF',
      icon: Stethoscope,
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      route: '/login/doctor',
    },
  ];

  async function handleLaunchDemoPatient() {
    triggerWarmup();
    setDemoLoading(true);
    try {
      await fetch('/api/test/patient/seed?phone=%2B919100000099', { method: 'POST' });
      const res = await otpApi.verify('+919100000099', '123456');
      login('PATIENT', res.token);
      toast.success('डेमो मरीज सत्र सक्रिय (Ramesh Kumar - Demo)');
      navigate('/patient');
    } catch (e) {
      toast.error(e.message || 'Demo activation error');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAF9' }}>
      {/* Official Government & ABDM Tricolor Accent Strip */}
      <div style={{ display: 'flex', height: '4px', width: '100%' }}>
        <div style={{ flex: 1, backgroundColor: '#FF9933' }} />
        <div style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
        <div style={{ flex: 1, backgroundColor: '#138808' }} />
      </div>

      {/* Top Formal National Health Mission Bar */}
      <div
        style={{
          backgroundColor: '#043C2C',
          color: '#E2E8F0',
          padding: '6px 20px',
          fontSize: '11.5px',
          fontWeight: '600',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid #064E3B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={14} color="#86EFAC" strokeWidth={2.2} />
          <span>राष्ट्रीय स्वास्थ्य मिशन | National Health Mission &bull; Ayushman Bharat Digital Mission (ABDM)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px' }}>
          <span>हेल्पलाइन: <strong>1075</strong> (निःशुल्क)</span>
          <span style={{ color: '#6EE7B7' }}>&bull;</span>
          <span>व्हाट्सएप सेवा: <strong>+91 91201 23877</strong></span>
        </div>
      </div>

      {/* Main Official Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '2px solid #E2E8F0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Brand & Seal */}
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}
            onMouseEnter={triggerWarmup}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#043C2C',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(4, 60, 44, 0.25)',
                border: '1.5px solid #065F46',
                flexShrink: 0,
              }}
            >
              <HeartPulse size={24} color="#86EFAC" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#043C2C', fontWeight: '800', fontSize: '20px', letterSpacing: '-0.02em' }}>
                  AarogyaFlow
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    backgroundColor: '#ECFDF5',
                    color: '#065F46',
                    border: '1px solid #A7F3D0',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.04em',
                  }}
                >
                  सार्वजनिक स्वास्थ्य प्रणाली
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: '500' }}>
                Rural & Urban Zero-Wait OPD Queue & Community Health Portal
              </div>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/find-hospital"
              onMouseEnter={triggerWarmup}
              style={{ color: '#1E293B', textDecoration: 'none', fontSize: '13.5px', fontWeight: '600' }}
            >
              अस्पताल खोजें
            </Link>
            <Link
              to="/track"
              onMouseEnter={triggerWarmup}
              style={{ color: '#1E293B', textDecoration: 'none', fontSize: '13.5px', fontWeight: '600' }}
            >
              कतार स्थिति
            </Link>
            <Link
              to="/asha"
              onMouseEnter={triggerWarmup}
              style={{
                color: '#065F46',
                textDecoration: 'none',
                fontSize: '13.5px',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#ECFDF5',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #A7F3D0',
              }}
            >
              <Users size={14} color="#059669" />
              आशा कार्यकर्ता (ASHA)
            </Link>
            <Link
              to="/login/patient"
              onMouseEnter={triggerWarmup}
              style={{ color: '#1E293B', textDecoration: 'none', fontSize: '13.5px', fontWeight: '600' }}
            >
              मरीज पोर्टल
            </Link>
            <Link
              to="/login/doctor"
              onMouseEnter={triggerWarmup}
              style={{ color: '#1E293B', textDecoration: 'none', fontSize: '13.5px', fontWeight: '600' }}
            >
              डॉक्टर लॉगिन
            </Link>
          </nav>

          {/* Top Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleLaunchDemoPatient}
              disabled={demoLoading}
              onMouseEnter={triggerWarmup}
              style={{
                backgroundColor: '#F1F5F9',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={14} color="#0284C7" />
              {demoLoading ? 'प्रक्रिया जारी...' : 'डेमो टेस्ट (Demo)'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login/patient')}
              onMouseEnter={triggerWarmup}
              style={{
                backgroundColor: '#043C2C',
                color: '#FFFFFF',
                border: '1px solid #064E3B',
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              साइन इन (Sign In)
            </button>
          </div>
        </div>
      </header>

      {/* Main Website Content */}
      <main style={{ flex: 1 }}>
        {/* Formal Public Health Banner / Hero */}
        <section
          style={{
            backgroundColor: '#043C2C',
            backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 50%)',
            color: '#FFFFFF',
            borderBottom: '3px solid #059669',
            padding: '44px 20px 48px',
          }}
        >
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                color: '#A7F3D0',
                backgroundColor: 'rgba(6, 78, 59, 0.8)',
                border: '1px solid #059669',
                padding: '4px 12px',
                borderRadius: '4px',
                marginBottom: '16px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Award size={14} color="#6EE7B7" />
              डिजिटल भारत &bull; राष्ट्रीय स्वास्थ्य प्राधिकरण (NHA) दिशा-निर्देशानुसार
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'center' }}>
              <div>
                <h1
                  style={{
                    fontSize: 'clamp(28px, 3.8vw, 42px)',
                    fontWeight: '800',
                    color: '#FFFFFF',
                    margin: '0 0 14px',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25,
                  }}
                >
                  ग्रामीण एवं शहरी अस्पतालों में <br />
                  <span style={{ color: '#34D399' }}>बिना कतार सीधी ओपीडी पर्ची</span>
                </h1>
                <p
                  style={{
                    fontSize: '15px',
                    color: '#D1FAE5',
                    maxWidth: '560px',
                    margin: '0 0 26px',
                    lineHeight: 1.6,
                  }}
                >
                  कतारों में घंटों खड़े रहने की आवश्यकता नहीं। अपने फोन पर लाइव डिजिटल टोकन लें, घर से आगमन समय देखें, और आशा कार्यकर्ताओं के सहयोग से तत्काल उपचार प्राप्त करें।
                </p>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {/* WhatsApp Force Booking CTA */}
                  <a
                    href="https://wa.me/919120123877?text=Hi%2C%20I%20want%20to%20book%20an%20OPD%20appointment"
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={triggerWarmup}
                    onClick={triggerWarmup}
                    style={{
                      backgroundColor: '#25D366',
                      color: '#043C2C',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '12px 22px',
                      fontSize: '14px',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
                      border: '1.5px solid #16A34A',
                    }}
                  >
                    <MessageCircle size={18} color="#043C2C" strokeWidth={2.4} />
                    <span>WhatsApp पर 30s में पर्ची बुक करें</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => navigate('/find-hospital')}
                    onMouseEnter={triggerWarmup}
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: '#043C2C',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Building2 size={16} color="#043C2C" />
                    <span>अस्पताल खोजें व बुक करें</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/track')}
                    onMouseEnter={triggerWarmup}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '8px',
                      padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Clock size={16} color="#A7F3D0" />
                    <span>पर्ची ट्रैक करें</span>
                  </button>
                </div>
              </div>

              {/* Citizen Information Card (Formal Government Design) */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '24px',
                  border: '1.5px solid #CBD5E1',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                  color: '#0F172A',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="#059669" />
                    <span style={{ fontWeight: '800', fontSize: '15px', color: '#043C2C' }}>नागरिक सुविधा डैशबोर्ड</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803D', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '4px' }}>
                    सक्रिय सेवा
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: '#F8FAF9', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ fontSize: '12.5px', color: '#334155' }}>
                      <strong>शून्य कतार:</strong> जब आपकी बारी नज़दीक होगी, आपको स्वचालित ध्वनि कॉल व संदेश प्राप्त होगा।
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: '#F8FAF9', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ fontSize: '12.5px', color: '#334155' }}>
                      <strong>आशा दीदी सहयोग:</strong> दूरदराज गांवों के मरीजों को आशा कार्यकर्ता सीधे रेफरल टोकन जारी करती हैं।
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: '#F8FAF9', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ fontSize: '12.5px', color: '#334155' }}>
                      <strong>14-अंक ABHA कार्ड:</strong> सभी उपचार पर्चे व खून रिपोर्ट सीधे आपके मोबाइल पर सुरक्षित रहते हैं।
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>संबद्ध स्वास्थ्य केंद्र: <strong>14+ PHC / CHC</strong></span>
                  <Link
                    to="/asha"
                    style={{ fontSize: '12px', fontWeight: '700', color: '#043C2C', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    आशा डैशबोर्ड &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WhatsApp Forced Booking Callout (Rural Citizen Friendly) */}
        <section
          style={{
            maxWidth: '1240px',
            margin: '28px auto 0',
            padding: '0 20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #008069',
              borderRadius: '10px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '18px',
              boxShadow: '0 2px 8px rgba(0, 128, 105, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '8px',
                  backgroundColor: '#DCFCE7',
                  border: '1.5px solid #86EFAC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#008069',
                  flexShrink: 0,
                }}
              >
                <MessageCircle size={26} strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: '#043C2C' }}>
                    व्हाट्सएप त्वरित पर्ची सेवा (+91 91201 23877)
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>
                    बिना इंटरनेट फॉर्म भरे
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
                  सीधे व्हाट्सएप पर <strong>'Hi'</strong> भेजें, अस्पताल चुनें और 30 सेकंड में डिजिटल पर्ची अपनी भाषा में पाएं।
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a
                href="https://wa.me/919120123877?text=Hi%2C%20I%20want%20to%20book%20an%20OPD%20appointment"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={triggerWarmup}
                onClick={triggerWarmup}
                style={{
                  backgroundColor: '#008069',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(0, 128, 105, 0.25)',
                }}
              >
                <MessageCircle size={16} />
                <span>व्हाट्सएप शुरू करें (Open WhatsApp)</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </section>

        {/* Core Services Grid */}
        <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '36px 20px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
              <Activity size={14} />
              <span>सार्वजनिक स्वास्थ्य सुविधाएं</span>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#043C2C', margin: '4px 0 6px' }}>
              मुख्य स्वास्थ्य एवं अस्पताल सेवाएं
            </h2>
            <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
              नागरिकों, ग्रामीण स्वास्थ्य कार्यकर्ताओं एवं चिकित्सकों के लिए एकीकृत डिजिटल स्वास्थ्य मंच।
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
            {services.map((svc) => {
              const IconComp = svc.icon;
              return (
                <div
                  key={svc.id}
                  onClick={() => {
                    triggerWarmup();
                    if (svc.isExternal) {
                      window.open(svc.route, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(svc.route);
                    }
                  }}
                  onMouseEnter={triggerWarmup}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '10px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#059669';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)';
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: svc.iconBg,
                      border: `1.5px solid ${svc.badgeColor}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: svc.iconColor,
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={22} strokeWidth={2.2} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          backgroundColor: svc.badgeBg,
                          color: svc.badgeColor,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {svc.badge}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: '15.5px', fontWeight: '700', color: '#0F172A', lineHeight: 1.35 }}>
                      {svc.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                      {svc.subtitle}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', fontSize: '12.5px', fontWeight: '700', color: '#043C2C' }}>
                      <span>प्रवेश करें</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Dedicated Stakeholder Portals (Formal Government Sections) */}
        <section style={{ backgroundColor: '#F1F5F9', borderTop: '1.5px solid #CBD5E1', borderBottom: '1.5px solid #CBD5E1', padding: '40px 20px' }}>
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>
                समर्पित उपयोगकर्ता पोर्टल (Dedicated User Portals)
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                मरीजों, आशा कार्यकर्ताओं, चिकित्सकों एवं अस्पताल प्रशासकों के लिए अलग-अलग सुरक्षित कार्यक्षेत्र।
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {/* Patient Portal Card */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '20px', border: '1.5px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Users size={20} color="#059669" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#043C2C' }}>मरीज पोर्टल</h3>
                </div>
                <p style={{ fontSize: '12.5px', color: '#475569', flex: 1, margin: '0 0 16px', lineHeight: 1.5 }}>
                  सक्रिय ओपीडी पर्ची देखें, परिवार के सदस्यों का ABHA खाता जोड़ें और लैब रिपोर्ट डाउनलोड करें।
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/patient')}
                  onMouseEnter={triggerWarmup}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#ECFDF5', color: '#065F46', border: '1.5px solid #A7F3D0', borderRadius: '6px', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>मरीज लॉगिन</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* ASHA Worker Portal Card */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '20px', border: '1.5px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <HeartPulse size={20} color="#15803D" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#15803D' }}>आशा कार्यकर्ता पोर्टल</h3>
                </div>
                <p style={{ fontSize: '12.5px', color: '#475569', flex: 1, margin: '0 0 16px', lineHeight: 1.5 }}>
                  गाँव के परिवारों का स्वास्थ्य रिकॉर्ड, गर्भवती महिलाओं की देखभाल एवं अस्पताल टेली-रेफरल स्वीकृत करें।
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/asha')}
                  onMouseEnter={triggerWarmup}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#F0FDF4', color: '#15803D', border: '1.5px solid #86EFAC', borderRadius: '6px', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>आशा पोर्टल खोलें</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Doctor Portal Card */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '20px', border: '1.5px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Stethoscope size={20} color="#1D4ED8" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1D4ED8' }}>चिकित्सक पोर्टल</h3>
                </div>
                <p style={{ fontSize: '12.5px', color: '#475569', flex: 1, margin: '0 0 16px', lineHeight: 1.5 }}>
                  कतार में बैठे मरीज को परामर्श हेतु बुलाएं, डिजिटल प्रिस्क्रिप्शन लिखें एवं Eka Care दवाएं जोड़ें।
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/doctor')}
                  onMouseEnter={triggerWarmup}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1.5px solid #BFDBFE', borderRadius: '6px', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>डॉक्टर लॉगिन</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Hospital Staff & Admin Card */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '20px', border: '1.5px solid #CBD5E1', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Building2 size={20} color="#0F766E" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F766E' }}>अस्पताल प्रशासन</h3>
                </div>
                <p style={{ fontSize: '12.5px', color: '#475569', flex: 1, margin: '0 0 16px', lineHeight: 1.5 }}>
                  ओपीडी काउंटर स्थिति, कतार विलंब जुर्माना एवं व्हाट्सएप बॉट स्वचालित संदेश नियंत्रण।
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login/admin')}
                  onMouseEnter={triggerWarmup}
                  style={{ width: '100%', padding: '9px', backgroundColor: '#F0FDFA', color: '#0F766E', border: '1.5px solid #99F6E4', borderRadius: '6px', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>स्टाफ कंसोल</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Official Ayushman Footer */}
      <AyushmanFooter brandFirst={true} variant="stacked" style={{ padding: '20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }} />
    </div>
  );
}
