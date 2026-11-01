import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  X,
  Award,
  Sparkles,
  Volume2,
  ShieldCheck,
} from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export interface NhmCourseModule {
  id: string;
  moduleNumber: number;
  titleHi: string;
  titleMr: string;
  categoryHi: string;
  categoryMr: string;
  durationMinutes: number;
  descriptionHi: string;
  descriptionMr: string;
  keyPointsHi: string[];
  keyPointsMr: string[];
  completed: boolean;
}

const DEFAULT_MODULES: NhmCourseModule[] = [
  {
    id: 'nhm-mod-1',
    moduleNumber: 1,
    titleHi: 'मातृ स्वास्थ्य एवं प्रसव पूर्व देखभाल (ANC)',
    titleMr: 'माता आरोग्य आणि प्रसूतीपूर्व काळजी (ANC)',
    categoryHi: 'मातृ एवं शिशु स्वास्थ्य',
    categoryMr: 'माता व बाल आरोग्य',
    durationMinutes: 25,
    descriptionHi: 'गर्भवती महिलाओं की समय पर पहचान, 4 अनिवार्य एएनसी जांचें, आईएफए गोलियों का वितरण एवं उच्च जोखिम गर्भावस्था (HRP) के खतरे के लक्षणों की पहचान।',
    descriptionMr: 'गरोदर महिलांची वेळेवर नोंदणी, ४ अनिवार्य एएनसी तपासण्या, आयएफए गोळ्यांचे वाटप आणि उच्च जोखीम गरोदरपणाची (HRP) लक्षणे ओळखणे.',
    keyPointsHi: [
      'पहली तिमाही (12 सप्ताह के भीतर) में अनिवार्य पंजीकरण।',
      'कम से कम 4 एएनसी जांचें: पहली तिमाही, 14-26 सप्ताह, 28-34 सप्ताह, 36 सप्ताह।',
      '180 दिन आईएफए (लाल गोली) एवं 360 कैल्शियम गोलियों का नियमित सेवन।',
      'गंभीर लक्षण: अत्यधिक सूजन, सिरदर्द, धुंधला दिखना, रक्तस्राव - तत्काल सीएचसी रेफरल।',
    ],
    keyPointsMr: [
      'पहिल्या त्रैमासिकात (१२ आठवड्यांच्या आत) अनिवार्य नोंदणी.',
      'किमान ४ एएनसी तपासण्या: पहिले त्रैमासिक, १४-२६ आठवडे, २८-३४ आठवडे, ३६ आठवडे.',
      '१८० दिवस आयएफए व ३६० कॅल्शियम गोळ्यांचे नियमित सेवन.',
      'धोक्याची लक्षणे: सूज, डोकेदुखी, अंधुक दिसणे, रक्तस्राव - तात्काळ रेफरल.',
    ],
    completed: true,
  },
  {
    id: 'nhm-mod-2',
    moduleNumber: 2,
    titleHi: 'बाल प्रतिरक्षण चक्र एवं कुपोषण प्रबंधन (Child Care & Vax)',
    titleMr: 'बाल लसीकरण आणि कुपोषण व्यवस्थापन (Child Care & Vax)',
    categoryHi: 'बाल स्वास्थ्य एवं पोषण',
    categoryMr: 'बाल आरोग्य व पोषण',
    durationMinutes: 30,
    descriptionHi: 'जन्म से 5 वर्ष तक का पूर्ण टीकाकरण कार्यक्रम, शून्य खुराक (Zero Dose BCG, OPV, HepB), पेंटावेलेंट, एमआर और गंभीर तीव्र कुपोषण (SAM) की पहचान।',
    descriptionMr: 'जन्मापासून ५ वर्षांपर्यंतचे संपूर्ण लसीकरण, झिरो डोस, पेंटाव्हॅलेंट, एमआर आणि तीव्र कुपोषण (SAM) ओळखणे.',
    keyPointsHi: [
      'जन्म के 24 घंटे में: बीसीजी, ओपीवी-0, हेपेटाइटिस-बी 0 खुराक।',
      '6, 10, 14 सप्ताह: पेंटावेलेंट (1, 2, 3), रोटावायरस, एफआईपीवी, पीसीवी।',
      '9-12 माह: एमआर-1, जेई-1, विटामिन-ए की पहली खुराक।',
      'एमयूएसी (MUAC) टेप द्वारा 6 माह से 5 वर्ष के बच्चों में लाल निशान (>11.5cm) पर पोषण पुनर्वास केंद्र (NRC) भेजें।',
    ],
    keyPointsMr: [
      'जन्मानंतर २४ तासांत: बीसीजी, ओपीव्ही-०, हिपॅटायटीस-बी ० डोस.',
      '६, १०, १४ आठवडे: पेंटाव्हॅलेंट, रोटाव्हायरस, एफआयपीव्ही, पीसीव्ही.',
      '९-१२ महिने: एमआर-१, जेई-१, जीवनसत्त्व-ए चा पहिला डोस.',
      'एमयूएसी टेपद्वारे कुपोषण ओळखणे आणि पोषण पुनर्वसन केंद्रात (NRC) पाठवणे.',
    ],
    completed: true,
  },
  {
    id: 'nhm-mod-3',
    moduleNumber: 3,
    titleHi: 'गैर-संचारी रोग (NCD) एवं सीबैक (CBAC) फॉर्म स्क्रीनिंग',
    titleMr: 'अंसंसर्गजन्य रोग (NCD) आणि सीबॅक फॉर्म स्क्रिनिंग',
    categoryHi: 'सार्वजनिक स्वास्थ्य जांच',
    categoryMr: 'सार्वजनिक आरोग्य तपासणी',
    durationMinutes: 20,
    descriptionHi: '30 वर्ष से अधिक आयु के प्रत्येक नागरिक का सीबैक (CBAC) फॉर्म भरना, उच्च रक्तचाप (बीपी), मधुमेह (शुगर) तथा मुख, स्तन एवं गर्भाशय ग्रीवा कैंसर की प्रारंभिक पहचान।',
    descriptionMr: '३० वर्षांवरील नागरिकांचा सीबॅक (CBAC) फॉर्म भरणे, रक्तदाब, मधुमेह व कर्करोग प्राथमिक तपासणी.',
    keyPointsHi: [
      '30 वर्ष से ऊपर के सभी ग्रामीणों की वार्षिक स्वास्थ्य सूची।',
      'सीबैक फॉर्म में 4 या अधिक अंक होने पर उपकेंद्र पर सीएचओ को प्राथमिक जांच हेतु भेजें।',
      'उच्च रक्तचाप (>140/90 mmHg) या शुगर (>200 mg/dl) वाले मरीजों की दवा निरंतरता सुनिश्चित करना।',
    ],
    keyPointsMr: [
      '३० वर्षांवरील सर्व ग्रामस्थांची वार्षिक आरोग्य यादी.',
      'सीबॅक फॉर्ममध्ये ४ किंवा अधिक गुण असल्यास सीएचओ कडे पाठवणे.',
      'रक्तदाब व मधुमेहाच्या रुग्णांची औषध नियमितता तपासणे.',
    ],
    completed: true,
  },
  {
    id: 'nhm-mod-4',
    moduleNumber: 4,
    titleHi: 'संक्रामक रोग नियंत्रण - क्षयरोग (TB) एवं मलेरिया',
    titleMr: 'संसर्गजन्य रोग नियंत्रण - क्षयरोग (TB) आणि मलेरिया',
    categoryHi: 'राष्ट्रीय स्वास्थ्य कार्यक्रम',
    categoryMr: 'राष्ट्रीय आरोग्य कार्यक्रम',
    durationMinutes: 20,
    descriptionHi: '2 सप्ताह से अधिक खांसी, बुखार, वजन घटना पर बलगम जांच, निक्षय पोर्टल पर पंजीकरण, डॉट्स (DOTS) उपचार अनुपालन एवं निक्षय पोषण योजना सहायता।',
    descriptionMr: '२ आठवड्यांपेक्षा जास्त खोकला असल्यास थुंकी तपासणी, निक्षय नोंदणी व डॉट्स औषधोपचार.',
    keyPointsHi: [
      'लक्षण युक्त व्यक्ति का तत्काल स्प्यूटम टेस्ट करवाना।',
      'टीबी मरीज को प्रतिमाह ₹500 निक्षय पोषण सहायता हेतु बैंक विवरण दर्ज करना।',
      'वेक्टर जनित रोग: बुखार होने पर मलेरिया आरडीटी (RDT) किट से जांच।',
    ],
    keyPointsMr: [
      'लक्षणे असणाऱ्या व्यक्तीची तातडीने थुंकी तपासणी.',
      'टीबी रुग्णाला दरमहा ₹५०० निक्षय पोषण योजनेसाठी बँक खाते जोडणे.',
      'ताप असल्यास मलेरिया आरडीटी किटने तात्काळ तपासणी.',
    ],
    completed: false,
  },
  {
    id: 'nhm-mod-5',
    moduleNumber: 5,
    titleHi: 'ग्राम स्वास्थ्य स्वच्छता एवं पोषण दिवस (VHND) समन्वय',
    titleMr: 'ग्राम आरोग्य स्वच्छता व पोषण दिवस (VHND) समन्वय',
    categoryHi: 'सामुदायिक समन्वय',
    categoryMr: 'समुदाय समन्वय',
    durationMinutes: 15,
    descriptionHi: 'आंगनवाड़ी केंद्र पर माह में एक बार एएनएम दीदी एवं आंगनवाड़ी कार्यकर्ता के साथ वीएचएनडी सत्र का सफल आयोजन, ड्यू लिस्ट निर्माण और ग्राम स्वास्थ्य स्वच्छता समिति (VHSNC) बैठक।',
    descriptionMr: 'अंगणवाडी केंद्रात दरमहा एएनएम व अंगणवाडी सेविकेसोबत व्हीएचएनडी सत्राचे आयोजन व ड्यु-लिस्ट तयारी.',
    keyPointsHi: [
      'सत्र से 3 दिन पूर्व टीकाकरण एवं गर्भवती ड्यू लिस्ट तैयार करना।',
      'सत्र स्थल पर साफ-सफाई, पेयजल, वजन मापने की मशीन एवं लॉजिस्टिक्स सुनिश्चित करना।',
      'किशोरी बालिकाओं एवं धात्री माताओं को स्वच्छता, सेनेटरी पैड और पोषण परामर्श देना।',
    ],
    keyPointsMr: [
      'सत्राच्या ३ दिवस आधी ड्यु-लिस्ट तयार करणे.',
      'सत्र ठिकाणी स्वच्छता, पिण्याचे पाणी व वजन काटा खात्री करणे.',
      'किशोरी व स्तनदा मातांना पोषण आणि स्वच्छतेबाबत मार्गदर्शन करणे.',
    ],
    completed: false,
  },
];

export const NhmCoursesCard: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [modules, setModules] = useState<NhmCourseModule[]>(DEFAULT_MODULES);
  const [showModal, setShowModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<NhmCourseModule | null>(null);

  const cleanPhone = user?.phone ? user.phone.replace(/[^0-9]/g, '').slice(-10) : 'general';
  const STORAGE_KEY = `@asha_${cleanPhone}_nhm_courses_v6`;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setModules(JSON.parse(raw));
        }
      } catch {}
    })();
  }, [STORAGE_KEY]);

  const toggleModuleCompletion = async (moduleId: string) => {
    const updated = modules.map((m) =>
      m.id === moduleId ? { ...m, completed: !m.completed } : m
    );
    setModules(updated);
    if (selectedModule && selectedModule.id === moduleId) {
      setSelectedModule({ ...selectedModule, completed: !selectedModule.completed });
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const completedCount = modules.filter((m) => m.completed).length;
  const progressPercent = Math.round((completedCount / modules.length) * 100);

  const isMarathi = language === 'mr';

  return (
    <>
      {/* Home Screen Interactive Card */}
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <View style={styles.nhmBadge}>
              <GraduationCap size={13} color="#047857" style={{ marginRight: 4 }} />
              <Text style={styles.nhmBadgeText}>
                {isMarathi ? 'राष्ट्रीय आरोग्य अभियान (NHM)' : 'राष्ट्रीय स्वास्थ्य मिशन (NHM)'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {completedCount}/{modules.length} {isMarathi ? 'पूर्ण' : 'पूर्ण (Completed)'}
              </Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>
            {isMarathi ? 'आशा प्रशिक्षण आणि कौशल्य अभ्यासक्रम' : 'आशा प्रशिक्षण एवं क्षमता संवर्धन पाठ्यक्रम'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {isMarathi
              ? 'अधिकृत राष्ट्रीय मार्गदर्शक तत्त्वे • माता, बाल व संसर्गजन्य रोग प्रोटोकॉल'
              : 'आधिकारिक राष्ट्रीय दिशानिर्देश • मातृ, शिशु स्वास्थ्य एवं एनसीडी प्रोटोकॉल'}
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressPercent}% {isMarathi ? 'प्रगती' : 'प्रगति'}</Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.openCoursesBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <BookOpen size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.openCoursesBtnText}>
            {isMarathi ? 'सर्व ५ अभ्यासक्रम मॉड्यूल पहा' : 'सभी ५ प्रशिक्षण मॉड्यूल देखें'}
          </Text>
          <ChevronRight size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Full Courses Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Award size={18} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.modalHeaderTitle}>
                    {isMarathi ? 'NHM आशा अधिकृत अभ्यासक्रम' : 'NHM आशा आधिकारिक पाठ्यक्रम'}
                  </Text>
                </View>
                <Text style={styles.modalHeaderSub}>
                  {completedCount} / {modules.length} {isMarathi ? 'मॉड्यूल यशस्वीरित्या पूर्ण केले' : 'मॉड्यूल सफलतापूर्वक पूर्ण'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setShowModal(false);
                  setSelectedModule(null);
                }}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* If Detail View Active */}
            {selectedModule ? (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.backToModulesBtn}
                  onPress={() => setSelectedModule(null)}
                >
                  <Text style={styles.backToModulesText}>
                    ← {isMarathi ? 'सर्व मॉड्यूल यादीकडे परत जा' : 'सभी मॉड्यूल सूची पर वापस जाएँ'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.detailHeaderBox}>
                  <View style={styles.detailBadgeRow}>
                    <Text style={styles.detailCategory}>
                      {isMarathi ? selectedModule.categoryMr : selectedModule.categoryHi}
                    </Text>
                    <View style={styles.detailDuration}>
                      <Clock size={12} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.detailDurationText}>{selectedModule.durationMinutes} मिनट</Text>
                    </View>
                  </View>

                  <Text style={styles.detailTitle}>
                    {selectedModule.moduleNumber}. {isMarathi ? selectedModule.titleMr : selectedModule.titleHi}
                  </Text>
                  <Text style={styles.detailDesc}>
                    {isMarathi ? selectedModule.descriptionMr : selectedModule.descriptionHi}
                  </Text>
                </View>

                {/* Key Protocols */}
                <Text style={styles.sectionHeader}>
                  {isMarathi ? '📌 मुख्य मार्गदर्शक तत्त्वे व कृती:' : '📌 मुख्य दिशानिर्देश एवं फील्ड प्रोटोकॉल:'}
                </Text>
                <View style={styles.keyPointsBox}>
                  {(isMarathi ? selectedModule.keyPointsMr : selectedModule.keyPointsHi).map((pt, idx) => (
                    <View key={idx} style={styles.pointRow}>
                      <ShieldCheck size={16} color="#059669" style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={styles.pointText}>{pt}</Text>
                    </View>
                  ))}
                </View>

                {/* Audio Guide Callout */}
                <View style={styles.audioGuideBox}>
                  <Volume2 size={18} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.audioGuideText}>
                    {isMarathi
                      ? 'ध्वनी मार्गदर्शन: हे मार्गदर्शक तत्त्व तुमच्या स्थानिक भाषेत उपलब्ध आहे.'
                      : 'ऑडियो मार्गदर्शन: यह दिशानिर्देश आपकी स्थानीय भाषा में फील्ड में उपयोग हेतु तैयार है।'}
                  </Text>
                </View>

                {/* Complete Button */}
                <TouchableOpacity
                  style={[
                    styles.toggleCompleteBtn,
                    selectedModule.completed && styles.toggleCompleteBtnDone,
                  ]}
                  onPress={() => toggleModuleCompletion(selectedModule.id)}
                  activeOpacity={0.8}
                >
                  <CheckCircle2
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.toggleCompleteBtnText}>
                    {selectedModule.completed
                      ? isMarathi ? '✓ पूर्ण झाले (Completed)' : '✓ मॉड्यूल पूर्ण (Completed)'
                      : isMarathi ? 'मॉड्यूल पूर्ण म्हणून चिन्हांकित करा' : 'मॉड्यूल पूर्ण रूप से चिह्नित करें'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* Module List View */
              <ScrollView style={styles.moduleListScroll} showsVerticalScrollIndicator={false}>
                {modules.map((mod) => (
                  <TouchableOpacity
                    key={mod.id}
                    style={[styles.moduleCard, mod.completed && styles.moduleCardCompleted]}
                    onPress={() => setSelectedModule(mod)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.moduleCardTop}>
                      <View style={styles.moduleNumberBadge}>
                        <Text style={styles.moduleNumberText}>0{mod.moduleNumber}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.moduleCategory}>
                          {isMarathi ? mod.categoryMr : mod.categoryHi}
                        </Text>
                        <Text style={styles.moduleTitle}>
                          {isMarathi ? mod.titleMr : mod.titleHi}
                        </Text>
                      </View>
                      {mod.completed ? (
                        <CheckCircle2 size={22} color="#059669" />
                      ) : (
                        <ChevronRight size={20} color={Colors.textMuted} />
                      )}
                    </View>
                    <Text style={styles.moduleDescSnippet} numberOfLines={2}>
                      {isMarathi ? mod.descriptionMr : mod.descriptionHi}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Certification Note */}
                <View style={styles.certBox}>
                  <Sparkles size={18} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.certText}>
                    {isMarathi
                      ? 'सर्व ५ मॉड्यूल पूर्ण केल्यावर तुमचे वार्षिक कार्यप्रदर्शन राष्ट्रीय आरोग्य पोर्टलवर आपोआप नोंदवले जाईल.'
                      : 'सभी ५ मॉड्यूल पूर्ण करने पर आपका वार्षिक कार्य निष्पादन राष्ट्रीय स्वास्थ्य पोर्टल पर सीधे दर्ज होगा।'}
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nhmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  nhmBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  statusPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  openCoursesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  openCoursesBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  moduleListScroll: {
    padding: 16,
  },
  moduleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  moduleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  moduleCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  moduleDescSnippet: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  certBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 8,
    marginBottom: 20,
  },
  certText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 17,
    fontWeight: '600',
  },
  detailScroll: {
    padding: 16,
  },
  backToModulesBtn: {
    marginBottom: 14,
  },
  backToModulesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  detailHeaderBox: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
  },
  detailDuration: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  keyPointsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    fontWeight: '500',
  },
  audioGuideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  audioGuideText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  toggleCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 30,
  },
  toggleCompleteBtnDone: {
    backgroundColor: '#047857',
  },
  toggleCompleteBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
