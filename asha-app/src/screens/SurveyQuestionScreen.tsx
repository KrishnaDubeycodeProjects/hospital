import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, Platform } from 'react-native';
import { setBackGuard } from '../navigation/backGuard';
import {
  Volume2,
  Check,
  Mic,
  FileText,
  CalendarDays,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
} from 'lucide-react-native';
import { AppBar, Screen, Card, Button, IconButton, Field, StatusPill, color, radius, space, text, type, touch } from '../ui';
import { SpeechEngine, VoiceRecognition } from '../voice/speechEngine';
import type { VoiceKind } from '../voice/smartExtract';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { getStorageWorkerPhone } from '../storage/OfflineStorageService';
import {
  sanitizeDecimal,
  sanitizeInteger,
  validateAdultWeight,
  validateBp,
  validateChildWeight,
  validateHb,
  validateTablets,
} from '../services/formValidation';
import {
  parseClinicalDate,
  formatClinicalDate,
  calculateEdd,
  gestationalWeeks,
  trimesterFromWeeks,
} from '../services/maternalMath';

interface SurveyQuestionScreenProps {
  onBack: () => void;
  onComplete: () => void;
  familyUnitId?: string;
  familyMemberId?: string;
  memberName?: string;
  formType?: 'PREGNANCY' | 'CHILD' | 'OTHER';
}

interface QuestionDef {
  id: string;
  number: number;
  title: string;
  type: 'binary' | 'options' | 'number' | 'text' | 'dual_number' | 'custom_clinical' | 'date';
  options?: string[];
  fieldKey: string;
  helperText?: string;
}

export const SurveyQuestionScreen: React.FC<SurveyQuestionScreenProps> = ({
  onBack,
  onComplete,
  familyUnitId = '',
  familyMemberId = '',
  memberName = '',
  formType = 'PREGNANCY',
}) => {
  const { ttsEnabled, localeCode, language } = useLanguage();
  const tr = (hi: string, mr: string, en?: string) => (language === 'mr' ? mr : language === 'en' ? en || hi : hi);
  const { submitSurvey } = useOfflineData();

  const pregnancyQuestions: QuestionDef[] = [
    {
      id: 'p1',
      number: 1,
      title: tr('क्या महिला गर्भवती है? (ANC)', 'स्त्री गरोदर आहे का? (ANC)', 'Is the woman pregnant? (ANC)'),
      type: 'binary',
      fieldKey: 'isPregnant',
      options: [tr('हाँ', 'होय', 'Yes'), tr('नहीं', 'नाही', 'No')],
    },
    {
      id: 'p_lmp',
      number: 2,
      title: tr('अंतिम मासिक धर्म तिथि (LMP)', 'शेवटची मासिक पाळीची तारीख (LMP)', 'Last menstrual period date (LMP)'),
      type: 'date',
      fieldKey: 'lmpDate',
      helperText: tr('EDD = LMP + 9 माह + 7 दिन', 'EDD = LMP + 9 महिने + 7 दिवस', 'EDD = LMP + 9 months + 7 days'),
    },
    {
      id: 'p2',
      number: 2,
      title: tr('प्रसव पूर्व जाँच (ANC विजिट)', 'प्रसूतीपूर्व तपासणी (ANC भेट)', 'Antenatal check-up (ANC visit)'),
      type: 'options',
      fieldKey: 'ancVisit',
      options: ['ANC 1', 'ANC 2', 'ANC 3', 'ANC 4', tr('सभी पूर्ण', 'सर्व पूर्ण', 'All done')],
    },
    {
      id: 'p3',
      number: 3,
      title: tr('Td टीका लगाया गया?', 'Td लस दिली का?', 'Td vaccine given?'),
      type: 'binary',
      fieldKey: 'ttGiven',
      options: [tr('✓ लगाया गया', '✓ दिली', '✓ Given'), tr('✕ नहीं लगाया', '✕ दिली नाही', '✕ Not given')],
    },
    {
      id: 'p4',
      number: 4,
      title: tr('बी.पी. एवं वजन', 'बी.पी. व वजन', 'BP & weight'),
      type: 'custom_clinical',
      fieldKey: 'bpAndWeight',
      helperText: tr('सामान्य बी.पी.: 120/80', 'सामान्य बी.पी.: 120/80', 'Normal BP: 120/80'),
    },
    {
      id: 'p5',
      number: 5,
      title: tr('हीमोग्लोबिन (g/dL)', 'हिमोग्लोबिन (g/dL)', 'Haemoglobin (g/dL)'),
      type: 'number',
      fieldKey: 'hemoglobin',
      helperText: tr('11 से कम → एनीमिया (उच्च जोखिम)', '11 पेक्षा कमी → रक्तक्षय (उच्च जोखीम)', 'Below 11 → anaemia (high risk)'),
    },
    {
      id: 'p6',
      number: 6,
      title: tr('मूत्र जाँच', 'लघवी तपासणी', 'Urine test'),
      type: 'options',
      fieldKey: 'urine',
      options: [tr('सामान्य', 'सामान्य', 'Normal'), tr('असामान्य (प्रोटीन+)', 'असामान्य (प्रथिने+)', 'Abnormal (protein+)'), tr('जाँच नहीं हुई', 'तपासणी झाली नाही', 'Not tested')],
    },
    {
      id: 'p7',
      number: 7,
      title: tr('पेट की जाँच हुई?', 'पोटाची तपासणी झाली का?', 'Abdominal exam done?'),
      type: 'binary',
      fieldKey: 'abdominalExam',
      options: [tr('✓ की गई', '✓ केली', '✓ Done'), tr('✕ नहीं की गई', '✕ केली नाही', '✕ Not done')],
    },
    {
      id: 'p8',
      number: 8,
      title: tr('IFA एवं कैल्शियम गोलियाँ', 'IFA व कॅल्शियम गोळ्या', 'IFA & calcium tablets'),
      type: 'dual_number',
      fieldKey: 'tablets',
      helperText: tr('लक्ष्य: 180 गोलियाँ प्रत्येक', 'लक्ष्य: प्रत्येकी 180 गोळ्या', 'Target: 180 tablets each'),
    },
    {
      id: 'p9',
      number: 9,
      title: tr('सेवा की स्थिति', 'सेवेची स्थिती', 'Service status'),
      type: 'options',
      fieldKey: 'serviceStatus',
      options: [
        tr('✓ सेवा पूर्ण', '✓ सेवा पूर्ण', '✓ Service complete'),
        tr('लाभार्थी अनुपस्थित', 'लाभार्थी अनुपस्थित', 'Beneficiary absent'),
        tr('लाभार्थी का इनकार', 'लाभार्थीचा नकार', 'Beneficiary refused'),
        tr('अस्पताल रेफरल', 'रुग्णालय संदर्भ', 'Hospital referral'),
      ],
    },
  ];

  const childQuestions: QuestionDef[] = [
    {
      id: 'c1',
      number: 1,
      title: tr('आज टीका लगाया गया?', 'आज लस दिली का?', 'Vaccine given today?'),
      type: 'binary',
      fieldKey: 'vaccineGiven',
      options: [tr('✓ हाँ, टीका लगाया', '✓ होय, लस दिली', '✓ Yes, vaccinated'), tr('✕ नहीं लगाया', '✕ दिली नाही', '✕ Not given')],
    },
    {
      id: 'c2',
      number: 2,
      title: tr('शिशु का वजन (kg)', 'बाळाचे वजन (kg)', 'Infant weight (kg)'),
      type: 'number',
      fieldKey: 'childWeight',
      helperText: tr('वृद्धि निगरानी', 'वाढ निरीक्षण', 'Growth monitoring'),
    },
    {
      id: 'c3',
      number: 3,
      title: tr('बीमारी / खतरे के लक्षण', 'आजार / धोक्याची लक्षणे', 'Illness / danger signs'),
      type: 'options',
      fieldKey: 'childCondition',
      options: [
        tr('पूर्णतः स्वस्थ', 'पूर्णपणे निरोगी', 'Fully healthy'),
        tr('खाँसी / सर्दी / बुखार', 'खोकला / सर्दी / ताप', 'Cough / cold / fever'),
        tr('दस्त (ORS देय)', 'जुलाब (ORS देय)', 'Diarrhoea (ORS due)'),
        tr('गंभीर — रेफरल आवश्यक', 'गंभीर — संदर्भ आवश्यक', 'Serious — referral needed'),
      ],
    },
    {
      id: 'c4',
      number: 4,
      title: tr('सत्र की स्थिति (रजिस्टर 18 अ)', 'सत्राची स्थिती (रजिस्टर 18 अ)', 'Session status (Register 18A)'),
      type: 'options',
      fieldKey: 'childStatus',
      options: [
        tr('✓ टीकाकरण पूर्ण', '✓ लसीकरण पूर्ण', '✓ Immunisation complete'),
        tr('माता-पिता अनुपस्थित', 'पालक अनुपस्थित', 'Parents absent'),
        tr('टीके से इनकार', 'लसीला नकार', 'Vaccine refused'),
      ],
    },
  ];

  const otherQuestions: QuestionDef[] = [
    {
      id: 'o1',
      number: 1,
      title: tr('सेवा का प्रकार', 'सेवेचा प्रकार', 'Service type'),
      type: 'options',
      fieldKey: 'otherCategory',
      options: [
        tr('परिवार नियोजन', 'कुटुंब नियोजन', 'Family planning'),
        tr('धात्री माता (PNC)', 'स्तनदा माता (PNC)', 'Lactating mother (PNC)'),
        tr('किशोरी आयरन (WIFS)', 'किशोरी लोह (WIFS)', 'Adolescent iron (WIFS)'),
        tr('NCD जाँच', 'NCD तपासणी', 'NCD screening'),
      ],
    },
    {
      id: 'o2',
      number: 2,
      title: tr('सामग्री / दवा वितरण', 'साहित्य / औषध वाटप', 'Supplies / medicine distribution'),
      type: 'options',
      fieldKey: 'suppliesGiven',
      options: [
        tr('छाया / अंतरा / कंडोम', 'छाया / अंतरा / निरोध', 'Chhaya / Antara / condom'),
        tr('आयरन (WIFS) गोली दी', 'लोह (WIFS) गोळी दिली', 'Iron (WIFS) tablets given'),
        tr('केवल परामर्श दिया', 'फक्त समुपदेशन केले', 'Counselling only'),
        tr('दवा अनुपलब्ध', 'औषध उपलब्ध नाही', 'Medicine unavailable'),
      ],
    },
    {
      id: 'o3',
      number: 3,
      title: tr('सत्यापन (रजिस्टर 18 स)', 'पडताळणी (रजिस्टर 18 स)', 'Verification (Register 18C)'),
      type: 'options',
      fieldKey: 'otherStatus',
      options: [
        tr('✓ सेवा सफल', '✓ सेवा यशस्वी', '✓ Service successful'),
        tr('अगले सप्ताह फॉलो-अप', 'पुढील आठवड्यात पाठपुरावा', 'Follow-up next week'),
        tr('स्वास्थ्य केंद्र रेफरल', 'आरोग्य केंद्र संदर्भ', 'Health centre referral'),
      ],
    },
  ];

  const questions = (
    formType === 'CHILD'
      ? childQuestions
      : formType === 'OTHER'
      ? otherQuestions
      : pregnancyQuestions
  ).map((q, i) => ({ ...q, number: i + 1 }));

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;

  // Start empty: unanswered questions must stay unrecorded, never pre-filled with sample clinical values.
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // LMP entry as three large numeric boxes (DD / MM / YYYY); EDD auto-derived by Naegele's rule.
  const [lmpParts, setLmpParts] = useState({ d: '', m: '', y: '' });
  const lmpComplete = lmpParts.d.length > 0 && lmpParts.m.length > 0 && lmpParts.y.length === 4;
  const lmpDate = lmpComplete ? parseClinicalDate(`${lmpParts.d}/${lmpParts.m}/${lmpParts.y}`) : null;
  const lmpWeeks = lmpDate ? gestationalWeeks(lmpDate) : null;
  const lmpIsFuture = lmpDate ? lmpDate.getTime() > Date.now() : false;
  const lmpError: string | null = !lmpComplete
    ? null
    : !lmpDate
    ? tr('अमान्य तिथि', 'अवैध तारीख', 'Invalid date')
    : lmpIsFuture
    ? tr('भविष्य की तिथि नहीं', 'भविष्यातील तारीख नाही', 'Date cannot be in the future')
    : lmpWeeks === null
    ? tr('45 सप्ताह से पुरानी', '45 आठवड्यांपेक्षा जुनी', 'Older than 45 weeks')
    : null;
  const lmpEdd = lmpDate && !lmpError ? calculateEdd(lmpDate) : null;

  const updateLmpPart = (part: 'd' | 'm' | 'y', raw: string) => {
    const next = { ...lmpParts, [part]: raw.replace(/[^0-9]/g, '') };
    setLmpParts(next);
    const complete = next.d.length > 0 && next.m.length > 0 && next.y.length === 4;
    const parsed = complete ? parseClinicalDate(`${next.d}/${next.m}/${next.y}`) : null;
    const valid = parsed !== null && parsed.getTime() <= Date.now() && gestationalWeeks(parsed) !== null;
    setAnswers((prev) => {
      const { lmpDate: _l, eddDate: _e, ...rest } = prev;
      return valid && parsed
        ? { ...rest, lmpDate: formatClinicalDate(parsed), eddDate: formatClinicalDate(calculateEdd(parsed)) }
        : rest;
    });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [clinicalNote, setClinicalNote] = useState('');

  const toggleVoiceRecognition = () => {
    if (isListening) {
      VoiceRecognition.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      const speechLang = language === 'mr' ? 'mr-IN' : language === 'en' ? 'en-IN' : 'hi-IN';
      VoiceRecognition.start(
        speechLang,
        (transcript) => {
          setIsListening(false);
          setClinicalNote((prev) => {
            const updated = prev ? `${prev} ${transcript}` : transcript;
            setAnswers((a) => ({ ...a, clinicalNote: updated, remarks: updated }));
            return updated;
          });
        },
        (err) => {
          setIsListening(false);
          console.warn('Voice recognition error:', err);
        }
      );
    }
  };

  const speak = (text: string) => {
    if (!ttsEnabled) return;
    SpeechEngine.speak(text, localeCode);
  };

  const handleSpeakQuestion = () => {
    speak(`${tr('प्रश्न', 'प्रश्न', 'Question')} ${currentQ.number}: ${currentQ.title}`);
  };

  const handleSpeakOption = (option: string) => {
    speak(option);
  };

  // Range checks per question; blocks Next/Save so impossible values never reach the outbox.
  const [fieldError, setFieldError] = useState<string | null>(null);
  const errorFor = (q: QuestionDef): string | null => {
    switch (q.type) {
      case 'date':
        if (lmpError) return lmpError;
        // Partly typed date (e.g. day only) must be completed or cleared.
        if ((lmpParts.d || lmpParts.m || lmpParts.y) && !lmpComplete) return tr('पूरी तिथि लिखें', 'पूर्ण तारीख लिहा', 'Enter the full date');
        return null;
      case 'custom_clinical':
        return validateBp(answers.bp, tr) || validateAdultWeight(answers.weight, tr);
      case 'number':
        return q.fieldKey === 'hemoglobin'
          ? validateHb(answers.hemoglobin, tr)
          : q.fieldKey === 'childWeight'
          ? validateChildWeight(answers.childWeight, tr)
          : null;
      case 'dual_number':
        return validateTablets(answers.ironTablets, tr) || validateTablets(answers.calciumTablets, tr);
      default:
        return null;
    }
  };

  const handleNext = () => {
    const err = errorFor(currentQ);
    setFieldError(err);
    if (err) return;
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    setFieldError(null);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Leaving a half-filled form by one stray tap loses everything — ask first.
  const isDirty = Object.keys(answers).length > 0 || clinicalNote.trim().length > 0;
  const confirmExit = () => {
    if (!isDirty) {
      onBack();
      return;
    }
    const title = tr('फ़ॉर्म छोड़ें?', 'फॉर्म सोडायचा?', 'Leave form?');
    const message = tr('भरे जवाब मिट जाएंगे', 'भरलेली उत्तरे जातील', 'Answers will be lost');
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n${message}`)) onBack();
      return;
    }
    Alert.alert(title, message, [
      { text: tr('रुकें', 'थांबा', 'Stay'), style: 'cancel' },
      { text: tr('छोड़ें', 'सोडा', 'Leave'), style: 'destructive', onPress: onBack },
    ]);
  };

  // Android back: step to the previous question first; on question 1, confirm before leaving.
  const hardwareBackRef = useRef<() => boolean>(() => false);
  hardwareBackRef.current = () => {
    if (isSaving) return true;
    if (currentIndex > 0) handlePrev();
    else confirmExit();
    return true;
  };
  useEffect(() => {
    setBackGuard(() => hardwareBackRef.current());
    return () => setBackGuard(null);
  }, []);

  const handleSave = async () => {
    // Never attach a survey to a placeholder patient.
    if (!familyUnitId || !familyMemberId) {
      onBack();
      return;
    }
    const badIndex = questions.findIndex((q) => errorFor(q) !== null);
    if (badIndex >= 0) {
      setCurrentIndex(badIndex);
      setFieldError(errorFor(questions[badIndex]));
      return;
    }
    setIsSaving(true);
    try {
      await submitSurvey({
        familyUnitId,
        familyMemberId,
        categoryCode: formType === 'OTHER' ? 'GENERAL' : formType,
        ashaWorkerPhone: getStorageWorkerPhone(),
        answers: {
          ...answers,
          clinicalNote,
          remarks: clinicalNote || answers.remarks || '',
          recordedAt: new Date().toISOString(),
          memberName,
        },
      });
      onComplete();
    } catch (e) {
      console.error('Error submitting survey:', e);
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progress = (currentIndex + 1) / totalQuestions;

  const headerTitle =
    formType === 'PREGNANCY'
      ? tr('प्रसवपूर्व (18 ब)', 'प्रसूतीपूर्व (18 ब)', 'Antenatal (18B)')
      : formType === 'CHILD'
      ? tr('बाल स्वास्थ्य (18 अ)', 'बाल आरोग्य (18 अ)', 'Child health (18A)')
      : tr('अन्य सेवाएँ (18 स)', 'इतर सेवा (18 स)', 'Other services (18C)');

  /** Big tappable option card (≥56dp) with radio check. Stored value = shown label. */
  const renderOption = (opt: string) => {
    const selected = answers[currentQ.fieldKey] === opt;
    return (
      <Pressable
        key={opt}
        onPress={() => setAnswers({ ...answers, [currentQ.fieldKey]: opt })}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={opt}
        style={({ pressed }) => [styles.option, selected && styles.optionActive, pressed && styles.pressed]}
      >
        <View style={[styles.radio, selected && styles.radioActive]}>
          {selected ? <Check size={16} color={color.white} strokeWidth={2.4} /> : null}
        </View>
        <Text style={[styles.optionText, selected && styles.optionTextActive]}>{opt}</Text>
        <IconButton icon={Volume2} label={tr('सुनें', 'ऐका', 'Listen')} onPress={() => handleSpeakOption(opt)} />
      </Pressable>
    );
  };

  const renderNumberInput = (
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    keyboard: 'numeric' | 'decimal-pad' | 'default',
    spoken: string,
    placeholder?: string,
    voiceKind: VoiceKind = keyboard === 'numeric' ? 'number' : 'decimal'
  ) => (
    <Field
      label={label}
      value={value ? String(value) : ''}
      onChangeText={onChange}
      keyboardType={keyboard}
      placeholder={placeholder}
      voice={voiceKind}
      right={<IconButton icon={Volume2} label={tr('सुनें', 'ऐका', 'Listen')} onPress={() => speak(spoken)} />}
    />
  );

  const footer = (
    <View style={styles.footerRow}>
      <View style={styles.footerBtn}>
        <Button
          label={tr('पिछला', 'मागे', 'Previous')}
          icon={ChevronLeft}
          variant="secondary"
          disabled={currentIndex === 0}
          onPress={handlePrev}
        />
      </View>
      <View style={styles.footerBtn}>
        {isLastQuestion ? (
          <Button label={tr('सहेजें', 'जतन करा', 'Save')} icon={CircleCheck} loading={isSaving} onPress={handleSave} />
        ) : (
          <Button label={tr('अगला', 'पुढे', 'Next')} icon={ChevronRight} onPress={handleNext} />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppBar
        title={headerTitle}
        subtitle={memberName || undefined}
        onBack={confirmExit}
        backLabel={tr('वापस', 'मागे', 'Back')}
        right={<IconButton icon={Volume2} label={tr('प्रश्न सुनें', 'प्रश्न ऐका', 'Listen to question')} tone="accent" onPress={handleSpeakQuestion} />}
      />

      {/* Progress */}
      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={text.label}>
            {tr('प्रश्न', 'प्रश्न', 'Question')} {currentIndex + 1} / {totalQuestions}
          </Text>
          <Text style={text.caption}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      <Screen footer={footer}>
        <Text style={styles.question}>{currentQ.title}</Text>

        {/* Binary / options */}
        {(currentQ.type === 'binary' || currentQ.type === 'options') && currentQ.options ? (
          <View style={styles.options}>{currentQ.options.map(renderOption)}</View>
        ) : null}

        {/* LMP date → Naegele EDD, weeks, trimester */}
        {currentQ.type === 'date' ? (
          <View style={styles.block}>
            <View style={styles.lmpRow}>
              {([
                ['d', tr('दिन', 'दिवस', 'Day'), 2, '--'],
                ['m', tr('माह', 'महिना', 'Month'), 2, '--'],
                ['y', tr('वर्ष', 'वर्ष', 'Year'), 4, '----'],
              ] as const).map(([part, label, max, hint]) => (
                <View key={part} style={[styles.lmpCell, part === 'y' && styles.lmpCellWide]}>
                  <Text style={text.label}>{label}</Text>
                  <TextInput
                    style={[styles.lmpInput, lmpError ? styles.lmpInputError : null]}
                    value={lmpParts[part]}
                    onChangeText={(v) => updateLmpPart(part, v)}
                    keyboardType="number-pad"
                    maxLength={max}
                    placeholder={hint}
                    placeholderTextColor={color.faint}
                    accessibilityLabel={label}
                  />
                </View>
              ))}
            </View>

            {lmpError ? (
              <View style={styles.inlineRow}>
                <AlertTriangle size={16} color={color.red} strokeWidth={2} />
                <Text style={styles.errorText}>{lmpError}</Text>
              </View>
            ) : null}

            {lmpEdd && lmpWeeks !== null ? (
              <Card tone="green">
                <View style={styles.inlineRow}>
                  <CalendarDays size={18} color={color.green} strokeWidth={2} />
                  <Text style={[text.label, { color: color.greenText }]}>{tr('संभावित प्रसव (EDD)', 'संभाव्य प्रसूती (EDD)', 'Expected delivery (EDD)')}</Text>
                </View>
                <Text style={[text.display, { color: color.green, marginTop: space.sm }]}>{formatClinicalDate(lmpEdd)}</Text>
                <View style={[styles.inlineRow, { marginTop: space.md }]}>
                  <StatusPill tone="green" label={`${lmpWeeks} ${tr('सप्ताह', 'आठवडे', 'weeks')}`} />
                  <StatusPill tone="green" label={`${tr('तिमाही', 'तिमाही', 'Trimester')} ${trimesterFromWeeks(lmpWeeks)}`} />
                </View>
              </Card>
            ) : null}
          </View>
        ) : null}

        {/* BP & weight */}
        {currentQ.type === 'custom_clinical' ? (
          <View style={styles.block}>
            {renderNumberInput(tr('बी.पी. (mmHg)', 'बी.पी. (mmHg)', 'BP (mmHg)'), answers.bp, (v) => { setFieldError(null); setAnswers({ ...answers, bp: v.replace(/[^0-9/]/g, '') }); }, 'default', tr('रक्तचाप', 'रक्तदाब', 'Blood pressure'), '120/80', 'bp')}
            {renderNumberInput(tr('वजन (kg)', 'वजन (kg)', 'Weight (kg)'), answers.weight, (v) => { setFieldError(null); setAnswers({ ...answers, weight: sanitizeDecimal(v) }); }, 'numeric', tr('वजन किलोग्राम', 'वजन किलोग्रॅम', 'Weight in kilograms'))}
          </View>
        ) : null}

        {/* Single number */}
        {currentQ.type === 'number' ? (
          <View style={styles.block}>
            <TextInput
              style={styles.bigNumber}
              value={String(answers[currentQ.fieldKey] || '')}
              onChangeText={(v) => { setFieldError(null); setAnswers({ ...answers, [currentQ.fieldKey]: sanitizeDecimal(v) }); }}
              maxLength={5}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={color.faint}
              accessibilityLabel={currentQ.title}
            />
          </View>
        ) : null}

        {/* IFA & calcium */}
        {currentQ.type === 'dual_number' ? (
          <View style={styles.block}>
            {renderNumberInput(tr('IFA गोलियाँ (संख्या)', 'IFA गोळ्या (संख्या)', 'IFA tablets (count)'), answers.ironTablets, (v) => { setFieldError(null); setAnswers({ ...answers, ironTablets: sanitizeInteger(v) }); }, 'numeric', tr('आयरन गोलियों की संख्या', 'लोह गोळ्यांची संख्या', 'Number of iron tablets'))}
            {renderNumberInput(tr('कैल्शियम गोलियाँ (संख्या)', 'कॅल्शियम गोळ्या (संख्या)', 'Calcium tablets (count)'), answers.calciumTablets, (v) => { setFieldError(null); setAnswers({ ...answers, calciumTablets: sanitizeInteger(v) }); }, 'numeric', tr('कैल्शियम गोलियों की संख्या', 'कॅल्शियम गोळ्यांची संख्या', 'Number of calcium tablets'))}
          </View>
        ) : null}

        {/* LMP errors already render beside the date boxes; avoid showing them twice. */}
        {fieldError && fieldError !== lmpError ? (
          <View style={styles.inlineRow}>
            <AlertTriangle size={16} color={color.red} strokeWidth={2} />
            <Text style={[styles.errorText, styles.flex]}>{fieldError}</Text>
          </View>
        ) : null}

        {currentQ.helperText ? (
          <View style={styles.inlineRow}>
            <Info size={16} color={color.muted} strokeWidth={2} />
            <Text style={[text.caption, styles.flex]}>{currentQ.helperText}</Text>
          </View>
        ) : null}

        {/* Optional voice / typed note on the last question */}
        {isLastQuestion ? (
          <Card>
            <View style={styles.noteHeader}>
              <View style={styles.inlineRow}>
                <FileText size={18} color={color.accent} strokeWidth={2} />
                <Text style={text.label}>{tr('टिप्पणी (वैकल्पिक)', 'टीप (ऐच्छिक)', 'Note (optional)')}</Text>
              </View>
              <Pressable
                onPress={toggleVoiceRecognition}
                accessibilityRole="button"
                accessibilityLabel={isListening ? tr('रोकें', 'थांबवा', 'Stop') : tr('बोलकर लिखें', 'बोलून लिहा', 'Dictate')}
                style={[styles.micBtn, isListening && styles.micBtnActive]}
              >
                <Mic size={18} color={isListening ? color.white : color.accent} strokeWidth={2} />
                <Text style={[styles.micText, isListening && styles.micTextActive]}>
                  {isListening ? tr('रोकें', 'थांबवा', 'Stop') : tr('बोलकर लिखें', 'बोलून लिहा', 'Dictate')}
                </Text>
              </Pressable>
            </View>
            {isListening ? (
              <Text style={[text.caption, { marginTop: space.sm }]}>{tr('बोलिए…', 'बोला…', 'Speak…')}</Text>
            ) : null}
            <TextInput
              style={styles.noteInput}
              value={clinicalNote}
              onChangeText={(txt) => {
                setClinicalNote(txt);
                setAnswers((prev) => ({ ...prev, clinicalNote: txt, remarks: txt }));
              }}
              placeholder={tr('यहाँ बोलें या लिखें', 'येथे बोला किंवा लिहा', 'Speak or type here')}
              placeholderTextColor={color.faint}
              multiline
              numberOfLines={3}
              accessibilityLabel={tr('टिप्पणी', 'टीप', 'Note')}
            />
          </Card>
        ) : null}
      </Screen>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.canvas },
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  progressWrap: {
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: color.lineSoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: color.accent },
  question: { ...type(22, '800'), marginTop: space.xs },
  options: { gap: space.md },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  optionActive: { borderColor: color.accent, backgroundColor: color.accentSoft },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: color.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: color.accent, borderColor: color.accent },
  optionText: { ...type(17, '700'), flex: 1 },
  optionTextActive: { color: color.accentPressed },
  block: { gap: space.lg },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  errorText: { ...text.label, color: color.redText },
  lmpRow: { flexDirection: 'row', gap: space.md },
  lmpCell: { flex: 1, gap: space.sm },
  lmpCellWide: { flex: 1.6 },
  lmpInput: {
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.control,
    backgroundColor: color.surface,
    fontSize: 24,
    fontWeight: '800',
    color: color.ink,
    textAlign: 'center',
  },
  lmpInputError: { borderColor: color.red, backgroundColor: color.redSoft },
  bigNumber: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.card,
    backgroundColor: color.surface,
    fontSize: 36,
    fontWeight: '800',
    color: color.ink,
    textAlign: 'center',
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touch,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.accentLine,
    backgroundColor: color.accentSoft,
  },
  micBtnActive: { backgroundColor: color.red, borderColor: color.red },
  micText: { ...type(14, '700', color.accent) },
  micTextActive: { color: color.white },
  noteInput: {
    marginTop: space.md,
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.control,
    padding: space.md,
    fontSize: 16,
    color: color.ink,
    textAlignVertical: 'top',
  },
  footerRow: { flexDirection: 'row', gap: space.md },
  footerBtn: { flex: 1 },
});
