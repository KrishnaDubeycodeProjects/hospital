/**
 * NHM ASHA training (Me → प्रशिक्षण): module list with real progress, a reading view, and
 * offline read-aloud (device TTS) for the whole module or any single point.
 * Progress is stored per worker on the device; nothing is pre-marked complete.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GraduationCap, Clock, CircleCheck, Circle, Volume2, Square, ChevronRight } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SpeechEngine } from '../voice/speechEngine';
import { Card, Button, StatusPill, Sheet, IconBadge, color, radius, space, text, useTr } from '../ui';

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
  },
  {
    id: 'nhm-mod-2',
    moduleNumber: 2,
    titleHi: 'बाल प्रतिरक्षण चक्र एवं कुपोषण प्रबंधन',
    titleMr: 'बाल लसीकरण आणि कुपोषण व्यवस्थापन',
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
  },
];

export const NhmCoursesCard: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const tr = useTr();
  const isMarathi = language === 'mr';
  const locale = isMarathi ? 'mr-IN' : 'hi-IN';

  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<NhmCourseModule | null>(null);
  /** What is being read aloud: 'all' (whole module), a point index, or null. */
  const [speaking, setSpeaking] = useState<'all' | number | null>(null);
  const speakToken = useRef(0);

  const phone = user?.phone ? user.phone.replace(/[^0-9]/g, '').slice(-10) : 'general';
  const STORAGE_KEY = `@asha_${phone}_nhm_progress_v7`;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const ids = raw ? JSON.parse(raw) : [];
        setDone(new Set(Array.isArray(ids) ? ids : []));
      })
      .catch(() => {});
  }, [STORAGE_KEY]);

  // Stop reading when the card unmounts (Me tab collapsed / screen left).
  useEffect(() => () => SpeechEngine.stop(), []);

  const toggleDone = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const title = (m: NhmCourseModule) => (isMarathi ? m.titleMr : m.titleHi);
  const category = (m: NhmCourseModule) => (isMarathi ? m.categoryMr : m.categoryHi);
  const description = (m: NhmCourseModule) => (isMarathi ? m.descriptionMr : m.descriptionHi);
  const points = (m: NhmCourseModule) => (isMarathi ? m.keyPointsMr : m.keyPointsHi);

  const stopSpeaking = () => {
    speakToken.current++;
    SpeechEngine.stop();
    setSpeaking(null);
  };

  const speak = (what: 'all' | number, textToRead: string) => {
    if (speaking === what) {
      stopSpeaking();
      return;
    }
    SpeechEngine.stop();
    const token = ++speakToken.current;
    setSpeaking(what);
    SpeechEngine.speak(textToRead, locale, 0.9, undefined, () => {
      if (speakToken.current === token) setSpeaking(null);
    }).catch(() => setSpeaking(null));
  };

  const readWholeModule = (m: NhmCourseModule) =>
    [
      `${tr('मॉड्यूल', 'मॉड्यूल')} ${m.moduleNumber}. ${title(m)}.`,
      description(m),
      tr('मुख्य बातें।', 'मुख्य मुद्दे.'),
      ...points(m),
    ].join(' ');

  const closeModule = () => {
    stopSpeaking();
    setOpen(null);
  };

  const completed = DEFAULT_MODULES.filter((m) => done.has(m.id)).length;
  const percent = Math.round((completed / DEFAULT_MODULES.length) * 100);

  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.headRow}>
          <IconBadge icon={GraduationCap} tone="accent" />
          <View style={styles.flex}>
            <Text style={text.heading}>{tr('आशा प्रशिक्षण', 'आशा प्रशिक्षण')}</Text>
            <Text style={text.caption}>{tr('राष्ट्रीय स्वास्थ्य मिशन', 'राष्ट्रीय आरोग्य अभियान')}</Text>
          </View>
          <StatusPill
            tone={completed === DEFAULT_MODULES.length ? 'green' : 'accent'}
            label={`${completed}/${DEFAULT_MODULES.length}`}
          />
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          accessibilityLabel={tr('प्रशिक्षण प्रगति', 'प्रशिक्षण प्रगती')}
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </Card>

      {DEFAULT_MODULES.map((m) => {
        const isDone = done.has(m.id);
        return (
          <Card key={m.id} tone={isDone ? 'green' : undefined} onPress={() => setOpen(m)} accessibilityLabel={title(m)}>
            <View style={styles.moduleRow}>
              <View style={[styles.number, isDone && styles.numberDone]}>
                {isDone ? (
                  <CircleCheck size={22} color={color.white} strokeWidth={2.2} />
                ) : (
                  <Text style={styles.numberText}>{m.moduleNumber}</Text>
                )}
              </View>
              <View style={styles.flex}>
                <Text style={text.heading} numberOfLines={2}>
                  {title(m)}
                </Text>
                <View style={styles.metaRow}>
                  <Clock size={14} color={color.muted} strokeWidth={2} />
                  <Text style={text.caption}>
                    {m.durationMinutes} {tr('मिनट', 'मिनिटे')} · {category(m)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={color.faint} strokeWidth={2} />
            </View>
          </Card>
        );
      })}

      <Sheet
        visible={!!open}
        onClose={closeModule}
        title={open ? `${open.moduleNumber}. ${title(open)}` : undefined}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        {open ? (
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <View style={styles.metaRow}>
              <StatusPill tone="accent" label={category(open)} />
              <StatusPill tone="neutral" icon={Clock} label={`${open.durationMinutes} ${tr('मिनट', 'मिनिटे')}`} />
            </View>

            <Button
              label={speaking === 'all' ? tr('रोकें', 'थांबवा') : tr('पूरा पाठ सुनें', 'संपूर्ण पाठ ऐका')}
              icon={speaking === 'all' ? Square : Volume2}
              variant={speaking === 'all' ? 'danger' : 'primary'}
              onPress={() => speak('all', readWholeModule(open))}
            />

            <Text style={text.body}>{description(open)}</Text>

            <Text style={text.label}>{tr('मुख्य बातें — छूकर सुनें', 'मुख्य मुद्दे — स्पर्श करून ऐका')}</Text>
            {points(open).map((pt, i) => {
              const active = speaking === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => speak(i, pt)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tr('सुनें', 'ऐका')}: ${pt}`}
                  style={({ pressed }) => [styles.point, active && styles.pointActive, pressed && styles.pressed]}
                >
                  <Text style={[text.body, styles.flex]}>{pt}</Text>
                  {active ? (
                    <Square size={18} color={color.red} fill={color.red} strokeWidth={2} />
                  ) : (
                    <Volume2 size={20} color={color.accent} strokeWidth={2} />
                  )}
                </Pressable>
              );
            })}

            <Button
              label={done.has(open.id) ? tr('पूरा हुआ — वापस लें', 'पूर्ण — परत घ्या') : tr('पूरा हुआ', 'पूर्ण झाले')}
              icon={done.has(open.id) ? CircleCheck : Circle}
              variant={done.has(open.id) ? 'secondary' : 'primary'}
              onPress={() => toggleDone(open.id)}
            />
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  flex: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: color.lineSoft, overflow: 'hidden', marginTop: space.md },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: color.accent },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  number: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentSoft,
  },
  numberDone: { backgroundColor: color.green },
  numberText: { fontSize: 18, fontWeight: '800', color: color.accent },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap', marginTop: space.xs },
  sheetBody: { gap: space.md, paddingBottom: space.xl },
  point: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  pointActive: { borderColor: color.red, backgroundColor: color.redSoft },
  pressed: { transform: [{ scale: 0.98 }] },
});
