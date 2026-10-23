import React, { useState } from 'react';
import {
  Users,
  Baby,
  Syringe,
  HeartPulse,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Clock,
  Sparkles,
  LayoutGrid,
  ListFilter,
  Send,
  Volume2,
  X,
  FileText,
  Search,
  Check,
  RefreshCw,
  Wifi,
  Phone,
  Building2,
  Calendar
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

// 24 village households data for Chandpur Village
const INITIAL_HOUSEHOLDS = [
  { id: 1, houseNo: 1, familyName: 'रामेश्वर दयाल', membersCount: 5, status: 'visited', lastVisited: 'कल', nextVisit: '25 दिन शेष', pregnancy: false, child: false, ncd: true, members: [{ name: 'रामेश्वर दयाल', age: 62, gender: 'पुरुष', condition: 'उच्च रक्तचाप (Hypertension)' }, { name: 'कमला देवी', age: 58, gender: 'महिला', condition: 'सामान्य' }] },
  { id: 2, houseNo: 2, familyName: 'सुनील कुमार', membersCount: 4, status: '7days', lastVisited: '5 दिन पूर्व', nextVisit: '2 दिन शेष', pregnancy: true, child: false, ncd: false, members: [{ name: 'सुनील कुमार', age: 30, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'सुमन देवी', age: 26, gender: 'महिला', isPregnant: true, anc: 'ANC 2 Due', hb: '9.2 g/dL (Mild Anaemia)' }] },
  { id: 3, houseNo: 3, familyName: 'भगवान दास', membersCount: 6, status: '15days', lastVisited: '12 दिन पूर्व', nextVisit: '3 दिन शेष', pregnancy: false, child: true, ncd: false, members: [{ name: 'भगवान दास', age: 35, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'आरव', age: 2, gender: 'बालक', childVaccine: 'DPT Booster Due' }] },
  { id: 4, houseNo: 4, familyName: 'मोहन लाल', membersCount: 4, status: 'visited', lastVisited: '3 दिन पूर्व', nextVisit: '27 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'मोहन लाल', age: 45, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'शान्ति बाई', age: 42, gender: 'महिला', condition: 'सामान्य' }] },
  { id: 5, houseNo: 5, familyName: 'राजेन्द्र सिंह', membersCount: 5, status: '7days', lastVisited: '7 दिन पूर्व', nextVisit: 'कल शेष', pregnancy: true, child: false, ncd: false, members: [{ name: 'राजेन्द्र सिंह', age: 28, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'सीता बाई', age: 24, gender: 'महिला', isPregnant: true, isHrp: true, anc: 'ANC 3 High Risk', hb: '6.8 g/dL (Severe Anaemia HRP)' }] },
  { id: 6, houseNo: 6, familyName: 'दिलीप प्रजापति', membersCount: 3, status: '30days', lastVisited: '20 दिन पूर्व', nextVisit: '10 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'दिलीप', age: 38, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 7, houseNo: 7, familyName: 'कल्याण वर्मा', membersCount: 4, status: '15days', lastVisited: '10 दिन पूर्व', nextVisit: '5 दिन शेष', pregnancy: false, child: true, ncd: false, members: [{ name: 'कल्याण वर्मा', age: 32, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'परी', age: 1, gender: 'बालिका', childVaccine: 'MR-1 Vaccine Due' }] },
  { id: 8, houseNo: 8, familyName: 'महेन्द्र पाल', membersCount: 5, status: 'noData', lastVisited: 'अज्ञात', nextVisit: 'तुरंत जांच करें', pregnancy: false, child: false, ncd: false, members: [{ name: 'महेन्द्र पाल', age: 50, gender: 'पुरुष', condition: 'सर्वेक्षण शेष' }] },
  { id: 9, houseNo: 9, familyName: 'गोपाल कृष्ण', membersCount: 6, status: '7days', lastVisited: '6 दिन पूर्व', nextVisit: '1 दिन शेष', pregnancy: true, child: false, ncd: true, members: [{ name: 'गोपाल कृष्ण', age: 55, gender: 'पुरुष', condition: 'मधुमेह (Diabetes)' }, { name: 'राधा बाई', age: 29, gender: 'महिला', isPregnant: true, isHrp: true, anc: 'Gestational Diabetes' }] },
  { id: 10, houseNo: 10, familyName: 'सुरेश चन्द्र', membersCount: 4, status: 'visited', lastVisited: '4 दिन पूर्व', nextVisit: '26 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'सुरेश चन्द्र', age: 40, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 11, houseNo: 11, familyName: 'देवेंद्र नाथ', membersCount: 5, status: '30days', lastVisited: '22 दिन पूर्व', nextVisit: '8 दिन शेष', pregnancy: false, child: false, ncd: true, members: [{ name: 'देवेंद्र नाथ', age: 64, gender: 'पुरुष', condition: 'हृदय रोग एवं बीपी' }] },
  { id: 12, houseNo: 12, familyName: 'सत्यनारायण', membersCount: 3, status: '15days', lastVisited: '11 दिन पूर्व', nextVisit: '4 दिन शेष', pregnancy: false, child: true, ncd: false, members: [{ name: 'सत्यनारायण', age: 29, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'रोहन', age: 3, gender: 'बालक', childVaccine: 'Polio & Vitamin A Due' }] },
  { id: 13, houseNo: 13, familyName: 'राम सिंह', membersCount: 4, status: 'visited', lastVisited: '2 दिन पूर्व', nextVisit: '28 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'राम सिंह', age: 48, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 14, houseNo: 14, familyName: 'जगदीश प्रसाद', membersCount: 5, status: '7days', lastVisited: '8 दिन पूर्व', nextVisit: 'आज ही संपर्क करें', pregnancy: true, child: false, ncd: false, members: [{ name: 'जगदीश', age: 33, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'मंजू देवी', age: 27, gender: 'महिला', isPregnant: true, anc: 'ANC 4 Delivery Prep' }] },
  { id: 15, houseNo: 15, familyName: 'विनोद कुमार', membersCount: 6, status: '30days', lastVisited: '25 दिन पूर्व', nextVisit: '5 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'विनोद', age: 41, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 16, houseNo: 16, familyName: 'हरि ओम', membersCount: 4, status: 'visited', lastVisited: 'आज', nextVisit: '30 दिन शेष', pregnancy: false, child: true, ncd: false, members: [{ name: 'हरि ओम', age: 34, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'आयुष', age: 1, gender: 'बालक', childVaccine: 'पूर्ण टीकाकरण' }] },
  { id: 17, houseNo: 17, familyName: 'ब्रजमोहन', membersCount: 5, status: '7days', lastVisited: '5 दिन पूर्व', nextVisit: '2 दिन शेष', pregnancy: false, child: true, ncd: false, members: [{ name: 'ब्रजमोहन', age: 36, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'अनिता शर्मा', age: 3, gender: 'बालिका', condition: 'गंभीर तीव्र कुपोषण (SAM MUAC 11.2cm)' }] },
  { id: 18, houseNo: 18, familyName: 'मुकेश कुमार', membersCount: 3, status: '15days', lastVisited: '14 दिन पूर्व', nextVisit: '1 दिन शेष', pregnancy: false, child: false, ncd: true, members: [{ name: 'मुकेश', age: 52, gender: 'पुरुष', condition: 'अस्थमा एवं सांस की बीमारी' }] },
  { id: 19, houseNo: 19, familyName: 'प्रेम शंकर', membersCount: 4, status: 'visited', lastVisited: 'कल', nextVisit: '29 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'प्रेम शंकर', age: 44, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 20, houseNo: 20, familyName: 'ओम प्रकाश', membersCount: 5, status: '30days', lastVisited: '18 दिन पूर्व', nextVisit: '12 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'ओम प्रकाश', age: 47, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 21, houseNo: 21, familyName: 'बनवारी लाल', membersCount: 4, status: 'noData', lastVisited: 'अज्ञात', nextVisit: 'जांच शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'बनवारी लाल', age: 53, gender: 'पुरुष', condition: 'डेटा शेष' }] },
  { id: 22, houseNo: 22, familyName: 'राम प्रसाद', membersCount: 5, status: '7days', lastVisited: '6 दिन पूर्व', nextVisit: 'कल शेष', pregnancy: false, child: false, ncd: true, members: [{ name: 'राम प्रसाद', age: 58, gender: 'पुरुष', condition: 'अनियंत्रित उच्च रक्तचाप (BP 185/110 mmHg)' }] },
  { id: 23, houseNo: 23, familyName: 'किशन लाल', membersCount: 4, status: 'visited', lastVisited: '4 दिन पूर्व', nextVisit: '26 दिन शेष', pregnancy: false, child: false, ncd: false, members: [{ name: 'किशन लाल', age: 39, gender: 'पुरुष', condition: 'सामान्य' }] },
  { id: 24, houseNo: 24, familyName: 'शंकर दयाल', membersCount: 5, status: '15days', lastVisited: '13 दिन पूर्व', nextVisit: '2 दिन शेष', pregnancy: true, child: false, ncd: false, members: [{ name: 'शंकर दयाल', age: 31, gender: 'पुरुष', condition: 'सामान्य' }, { name: 'माया देवी', age: 25, gender: 'महिला', isPregnant: true, anc: 'ANC 1 Registration' }] },
];

export default function AshaFieldWorkerApp({ onSwitchRole }) {
  const toast = useToast();

  const [households, setHouseholds] = useState(INITIAL_HOUSEHOLDS);
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'pregnancy' | 'child' | 'ncd'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'duelist'
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outboxCount, setOutboxCount] = useState(3);

  // CBAC & Village Survey State
  const [surveyTargetMember, setSurveyTargetMember] = useState(null);
  const [surveyForm, setSurveyForm] = useState({
    ageGroup: '30-49',
    tobacco: 'कभी नहीं',
    alcohol: 'नहीं',
    waistCircumference: 'सामान्य',
    physicalActivity: 'हाँ (सक्रिय)',
    familyHistory: 'नहीं',
    cough2Weeks: 'नहीं',
    bloodSputum: 'नहीं',
    feverNightSweats: 'नहीं',
    skinPatches: 'नहीं',
    bpSystolic: '120',
    bpDiastolic: '80',
    hemoglobin: '11.5',
  });

  // Calculate CBAC Risk Score dynamically
  const calculateScore = () => {
    let score = 0;
    if (surveyForm.ageGroup === '30-49') score += 1;
    if (surveyForm.ageGroup === '>=50') score += 2;
    if (surveyForm.tobacco !== 'कभी नहीं') score += 2;
    if (surveyForm.alcohol === 'हाँ') score += 1;
    if (surveyForm.waistCircumference === 'अधिक (Obese)') score += 2;
    if (surveyForm.physicalActivity === 'नहीं (<150 min/wk)') score += 1;
    if (surveyForm.familyHistory === 'हाँ') score += 2;
    if (surveyForm.cough2Weeks === 'हाँ') score += 2;
    if (surveyForm.bloodSputum === 'हाँ') score += 3;
    if (surveyForm.skinPatches === 'हाँ') score += 2;
    return score;
  };

  const riskScore = calculateScore();

  // Voice narration in Hindi
  const playHindiAudio = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      const text = activeSection === 'pregnancy'
        ? 'गर्भावस्था एवं उच्च जोखिम प्रसव पूर्व जांच सूची। कृपया लाल एवं नारंगी मकानों का पहले दौरा करें।'
        : activeSection === 'child'
        ? 'शिशु टीकाकरण एवं पोषण जांच सूची। समय पर टीके लगवाना सुनिश्चित करें।'
        : activeSection === 'ncd'
        ? 'दीर्घकालिक रोग एवं बीपी शुगर स्क्रीनिंग सूची।'
        : 'आशा कार्यकर्ता ग्राम सूची ग्रिड। 24 परिवारों की निगरानी सक्रिय है।';

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      utter.rate = 0.95;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    } else {
      toast.info('ऑडियो मार्गदर्शन: कृपया उच्च प्राथमिकता वाले मकानों का प्राथमिकता से दौरा करें।');
    }
  };

  // Sync Outbox
  const handleSyncOutbox = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setOutboxCount(0);
      toast.success('सफलतापूर्वक सभी ऑफलाइन सर्वेक्षण एवं संदर्भ ABDM नेटवर्क से सिंक हो गए!');
    }, 1200);
  };

  // Filter households by section
  const filteredHouses = households.filter((h) => {
    if (activeSection === 'pregnancy') return h.pregnancy;
    if (activeSection === 'child') return h.child;
    if (activeSection === 'ncd') return h.ncd;
    return true;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case '7days': return { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', dot: '#e11d48', label: '7 दिन' };
      case '15days': return { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', dot: '#db2777', label: '15 दिन' };
      case '30days': return { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#d97706', label: '30 दिन' };
      case 'visited': return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#059669', label: 'भेंट पूर्ण' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8', label: 'जानकारी बाकी' };
    }
  };

  const handleStartSurvey = (house, member = null) => {
    setSelectedHouse(house);
    setSurveyTargetMember(member || house.members[0]);
    setSurveyModalOpen(true);
  };

  const handleSubmitSurvey = (e) => {
    e.preventDefault();
    if (selectedHouse) {
      setHouseholds((prev) =>
        prev.map((h) => (h.id === selectedHouse.id ? { ...h, status: 'visited', lastVisited: 'अभी', nextVisit: '30 दिन शेष' } : h))
      );
      setOutboxCount((c) => c + 1);
      toast.success(`मकान #${selectedHouse.houseNo} (${surveyTargetMember?.name || selectedHouse.familyName}) का सर्वेक्षण आउटबॉक्स में सुरक्षित किया गया!`);
      setSurveyModalOpen(false);
      setSelectedHouse(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. TOP ASHA WORKER BANNER */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #86efac',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
              }}
            >
              👩‍🌾
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                सुनीता देवी • आशा कार्यकर्ता (ASHA)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                ग्राम: चांदपुर • उप-केंद्र: रामपुर • सेक्टर 4
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Sync Button */}
            <button
              type="button"
              onClick={handleSyncOutbox}
              disabled={syncing || outboxCount === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                backgroundColor: outboxCount > 0 ? '#eff6ff' : '#f8fafc',
                color: outboxCount > 0 ? '#1d4ed8' : '#64748b',
                border: outboxCount > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: outboxCount > 0 ? 'pointer' : 'default',
              }}
              title="Sync pending surveys to ABDM"
            >
              <Send size={13} />
              <span>{syncing ? 'सिंक हो रहा है...' : `आउटबॉक्स (${outboxCount})`}</span>
            </button>

            {/* Role switch button */}
            <button
              type="button"
              onClick={onSwitchRole}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
              title="Switch to CHO Supervisor view"
            >
              <RefreshCw size={12} />
              <span>सीएचओ कंसोल</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>24</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>कुल मकान</div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#e11d48' }}>5</div>
            <div style={{ fontSize: '11px', color: '#e11d48', fontWeight: 600 }}>7 दिन (गंभीर)</div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#d97706' }}>6</div>
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>15 दिन (मध्यम)</div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>9</div>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>भेंट पूर्ण</div>
          </div>
        </div>
      </div>

      {/* 2. HINDI VOICE GUIDE BANNER */}
      <div
        onClick={playHindiAudio}
        style={{
          backgroundColor: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={18} color="#15803d" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
            {isSpeaking ? 'ऑडियो चल रहा है (रोकने के लिए क्लिक करें)...' : 'बोलकर सुनें / ऑडियो मार्गदर्शन (Hindi Voice)'}
          </span>
        </div>
        <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
          {isSpeaking ? 'सक्रिय' : 'सुनें ▶'}
        </span>
      </div>

      {/* 3. ACTIVITY SWITCHER (All | Pregnancy | Child | NCD) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
        }}
      >
        {[
          { key: 'all', label: 'सभी परिवार', icon: LayoutGrid, count: households.length },
          { key: 'pregnancy', label: 'गर्भावस्था', icon: Baby, count: households.filter(h => h.pregnancy).length },
          { key: 'child', label: 'शिशु टीका', icon: Syringe, count: households.filter(h => h.child).length },
          { key: 'ncd', label: 'दीर्घकालिक', icon: HeartPulse, count: households.filter(h => h.ncd).length },
        ].map((tab) => {
          const IconC = tab.icon;
          const active = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 4px',
                borderRadius: '10px',
                border: active ? '1.5px solid #004d40' : '1px solid #e2e8f0',
                backgroundColor: active ? '#004d40' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <IconC size={16} color={active ? '#ffffff' : '#004d40'} />
              <span style={{ fontSize: '11.5px', fontWeight: '700' }}>{tab.label}</span>
              <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: '600' }}>({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* 4. VIEW MODE TOGGLE (Grid vs Due List) & LEGEND */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent',
              color: viewMode === 'grid' ? '#0f172a' : '#64748b',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            सूचि ग्रिड
          </button>
          <button
            type="button"
            onClick={() => setViewMode('duelist')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'duelist' ? '#ffffff' : 'transparent',
              color: viewMode === 'duelist' ? '#0f172a' : '#64748b',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            ड्यू लिस्ट ({filteredHouses.filter(h => h.status !== 'visited').length})
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }} /> 7d</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ea580c' }} /> 15d</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ca8a04' }} /> 30d</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} /> पूर्ण</span>
        </div>
      </div>

      {/* 5. MAIN CONTENT: SUCHI GRID OR DUE LIST */}
      {viewMode === 'grid' ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
            मकान सूची (Household Dot Matrix) • किसी भी मकान पर क्लिक कर विवरण देखें:
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
              gap: '10px',
            }}
          >
            {filteredHouses.map((h) => {
              const sc = getStatusColor(h.status);
              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHouse(h)}
                  style={{
                    backgroundColor: sc.bg,
                    border: `1.5px solid ${sc.border}`,
                    borderRadius: '12px',
                    padding: '8px 4px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sc.dot }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: sc.text }}>
                    #{h.houseNo}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
                    {h.familyName.split(' ')[0]}
                  </div>
                  {h.pregnancy && <span style={{ fontSize: '10px' }} title="गर्भवती">🤰</span>}
                  {h.child && <span style={{ fontSize: '10px' }} title="शिशु">👶</span>}
                  {h.ncd && <span style={{ fontSize: '10px' }} title="बीपी / शुगर">🩺</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DUE LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredHouses.map((h) => {
            const sc = getStatusColor(h.status);
            return (
              <div
                key={h.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: sc.bg,
                      color: sc.text,
                      border: `1px solid ${sc.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '13px',
                    }}
                  >
                    #{h.houseNo}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                      {h.familyName} ({h.membersCount} सदस्य)
                    </div>
                    <div style={{ fontSize: '12px', color: sc.text, fontWeight: '600', marginTop: '2px' }}>
                      {sc.label} • अंतिम भेंट: {h.lastVisited}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartSurvey(h)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#004d40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>जांच</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. FAMILY DETAIL BOTTOM SHEET / MODAL */}
      {selectedHouse && !surveyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedHouse(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Head */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                  मकान #{selectedHouse.houseNo} विवरण
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {selectedHouse.familyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHouse(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Visit status */}
            <div
              style={{
                backgroundColor: getStatusColor(selectedHouse.status).bg,
                border: `1px solid ${getStatusColor(selectedHouse.status).border}`,
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '12.5px',
                color: getStatusColor(selectedHouse.status).text,
                fontWeight: '600',
                marginBottom: '14px',
              }}
            >
              स्थिति: {getStatusColor(selectedHouse.status).label} • अगली भेंट: {selectedHouse.nextVisit}
            </div>

            {/* Family Members Table */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                परिवार के सदस्य ({selectedHouse.members.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedHouse.members.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{m.name}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{m.gender}, {m.age} वर्ष</span>
                    </div>
                    {m.condition && (
                      <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '600', marginTop: '4px' }}>
                        ⚠️ {m.condition}
                      </div>
                    )}
                    {m.anc && (
                      <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: '600', marginTop: '4px' }}>
                        🤰 {m.anc} • Hb: {m.hb || '9.5'}
                      </div>
                    )}
                    {m.childVaccine && (
                      <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', marginTop: '4px' }}>
                        💉 {m.childVaccine}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartSurvey(selectedHouse, m)}
                      style={{
                        marginTop: '8px',
                        padding: '5px 10px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#004d40',
                        cursor: 'pointer',
                      }}
                    >
                      📋 इस सदस्य की CBAC जांच करें &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Start Full Survey Button */}
            <button
              type="button"
              onClick={() => handleStartSurvey(selectedHouse)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#004d40',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0, 77, 64, 0.25)',
              }}
            >
              <FileText size={16} />
              <span>नया ग्राम सर्वेक्षण एवं CBAC फॉर्म भरें</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE CBAC & MATERNAL SCREENING SURVEY MODAL */}
      {surveyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSurveyModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                  CBAC &amp; NCD फील्ड सर्वेक्षण
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  {surveyTargetMember?.name || selectedHouse?.familyName} (मकान #{selectedHouse?.houseNo})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSurveyModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Real-time Risk Score Box */}
            <div
              style={{
                backgroundColor: riskScore >= 4 ? '#fef2f2' : '#f0fdf4',
                border: riskScore >= 4 ? '1.5px solid #f87171' : '1.5px solid #86efac',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: riskScore >= 4 ? '#b91c1c' : '#166534', fontWeight: '700' }}>
                  {riskScore >= 4 ? '⚠️ उच्च जोखिम स्कोर (सीएचओ / पीएचसी रेफरल आवश्यक)' : '✓ सामान्य जोखिम स्कोर'}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  4 या अधिक अंक होने पर मरीज को उच्च केंद्र भेजा जाना चाहिए।
                </div>
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: riskScore >= 4 ? '#dc2626' : '#15803d',
                  backgroundColor: riskScore >= 4 ? '#fee2e2' : '#dcfce7',
                  padding: '4px 12px',
                  borderRadius: '10px',
                }}
              >
                {riskScore} / 15
              </div>
            </div>

            {/* Questions Form */}
            <form onSubmit={handleSubmitSurvey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Q1: Age */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  1. लाभार्थी की आयु (Age Group)
                </label>
                <select
                  value={surveyForm.ageGroup}
                  onChange={(e) => setSurveyForm({ ...surveyForm, ageGroup: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="<30">30 वर्ष से कम (0 अंक)</option>
                  <option value="30-49">30 से 49 वर्ष (1 अंक)</option>
                  <option value=">=50">50 वर्ष या अधिक (2 अंक)</option>
                </select>
              </div>

              {/* Q2: Tobacco */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  2. क्या तंबाकू या बीड़ी/गुटखा का सेवन करते हैं?
                </label>
                <select
                  value={surveyForm.tobacco}
                  onChange={(e) => setSurveyForm({ ...surveyForm, tobacco: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="कभी नहीं">कभी नहीं (0 अंक)</option>
                  <option value="पहले करते थे">पहले करते थे पर अब छोड़ दिया (1 अंक)</option>
                  <option value="प्रतिदिन">हाँ, नियमित रूप से करते हैं (2 अंक)</option>
                </select>
              </div>

              {/* Q3: Cough > 2 weeks (TB Screening) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  3. क्या 2 सप्ताह से अधिक समय से खांसी है? (टीबी जांच)
                </label>
                <select
                  value={surveyForm.cough2Weeks}
                  onChange={(e) => setSurveyForm({ ...surveyForm, cough2Weeks: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="नहीं">नहीं (0 अंक)</option>
                  <option value="हाँ">हाँ, 2 हफ्ते से खांसी है (2 अंक)</option>
                </select>
              </div>

              {/* Q4: BP & Vitals */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  4. रक्तचाप (Blood Pressure mmHg)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="सिस्टोलिक (120)"
                    value={surveyForm.bpSystolic}
                    onChange={(e) => setSurveyForm({ ...surveyForm, bpSystolic: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <input
                    type="number"
                    placeholder="डायस्टोलिक (80)"
                    value={surveyForm.bpDiastolic}
                    onChange={(e) => setSurveyForm({ ...surveyForm, bpDiastolic: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Q5: Hemoglobin (for pregnant women) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  5. हीमोग्लोबिन (Hb g/dL) • 11 से कम होने पर एनीमिया HRP
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={surveyForm.hemoglobin}
                  onChange={(e) => setSurveyForm({ ...surveyForm, hemoglobin: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Check size={16} />
                  <span>सबमिट करें एवं आउटबॉक्स में जोड़ें</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSurveyModalOpen(false)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  रद्द करें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
