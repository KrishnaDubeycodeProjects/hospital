import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  ArrowLeft,
  Volume2,
  CheckCircle,
  ArrowRight,
  Check,
  Mic,
  FileText,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react-native';
import { SpeechEngine, VoiceRecognition } from '../voice/speechEngine';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { getStorageWorkerPhone } from '../storage/OfflineStorageService';
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
  const tr = (hi: string, mr: string) => (language === 'mr' ? mr : hi);
  const { submitSurvey } = useOfflineData();

  const pregnancyQuestions: QuestionDef[] = [
    {
      id: 'p1',
      number: 1,
      title: tr('क्या महिला गर्भवती है? (ANC)', 'स्त्री गरोदर आहे का? (ANC)'),
      type: 'binary',
      fieldKey: 'isPregnant',
      options: [tr('हाँ', 'होय'), tr('नहीं', 'नाही')],
    },
    {
      id: 'p_lmp',
      number: 2,
      title: tr('अंतिम मासिक धर्म तिथि (LMP)', 'शेवटची मासिक पाळीची तारीख (LMP)'),
      type: 'date',
      fieldKey: 'lmpDate',
      helperText: tr('EDD = LMP + 9 माह + 7 दिन', 'EDD = LMP + 9 महिने + 7 दिवस'),
    },
    {
      id: 'p2',
      number: 2,
      title: tr('प्रसव पूर्व जाँच (ANC विजिट)', 'प्रसूतीपूर्व तपासणी (ANC भेट)'),
      type: 'options',
      fieldKey: 'ancVisit',
      options: ['ANC 1', 'ANC 2', 'ANC 3', 'ANC 4', tr('सभी पूर्ण', 'सर्व पूर्ण')],
    },
    {
      id: 'p3',
      number: 3,
      title: tr('Td टीका लगाया गया?', 'Td लस दिली का?'),
      type: 'binary',
      fieldKey: 'ttGiven',
      options: [tr('✓ लगाया गया', '✓ दिली'), tr('✕ नहीं लगाया', '✕ दिली नाही')],
    },
    {
      id: 'p4',
      number: 4,
      title: tr('बी.पी. एवं वजन', 'बी.पी. व वजन'),
      type: 'custom_clinical',
      fieldKey: 'bpAndWeight',
      helperText: tr('सामान्य बी.पी.: 120/80', 'सामान्य बी.पी.: 120/80'),
    },
    {
      id: 'p5',
      number: 5,
      title: tr('हीमोग्लोबिन (g/dL)', 'हिमोग्लोबिन (g/dL)'),
      type: 'number',
      fieldKey: 'hemoglobin',
      helperText: tr('11 से कम → एनीमिया (उच्च जोखिम)', '11 पेक्षा कमी → रक्तक्षय (उच्च जोखीम)'),
    },
    {
      id: 'p6',
      number: 6,
      title: tr('मूत्र जाँच', 'लघवी तपासणी'),
      type: 'options',
      fieldKey: 'urine',
      options: [tr('सामान्य', 'सामान्य'), tr('असामान्य (प्रोटीन+)', 'असामान्य (प्रथिने+)'), tr('जाँच नहीं हुई', 'तपासणी झाली नाही')],
    },
    {
      id: 'p7',
      number: 7,
      title: tr('पेट की जाँच हुई?', 'पोटाची तपासणी झाली का?'),
      type: 'binary',
      fieldKey: 'abdominalExam',
      options: [tr('✓ की गई', '✓ केली'), tr('✕ नहीं की गई', '✕ केली नाही')],
    },
    {
      id: 'p8',
      number: 8,
      title: tr('IFA एवं कैल्शियम गोलियाँ', 'IFA व कॅल्शियम गोळ्या'),
      type: 'dual_number',
      fieldKey: 'tablets',
      helperText: tr('लक्ष्य: 180 गोलियाँ प्रत्येक', 'लक्ष्य: प्रत्येकी 180 गोळ्या'),
    },
    {
      id: 'p9',
      number: 9,
      title: tr('सेवा की स्थिति', 'सेवेची स्थिती'),
      type: 'options',
      fieldKey: 'serviceStatus',
      options: [
        tr('✓ सेवा पूर्ण', '✓ सेवा पूर्ण'),
        tr('लाभार्थी अनुपस्थित', 'लाभार्थी अनुपस्थित'),
        tr('लाभार्थी का इनकार', 'लाभार्थीचा नकार'),
        tr('अस्पताल रेफरल', 'रुग्णालय संदर्भ'),
      ],
    },
  ];

  const childQuestions: QuestionDef[] = [
    {
      id: 'c1',
      number: 1,
      title: tr('आज टीका लगाया गया?', 'आज लस दिली का?'),
      type: 'binary',
      fieldKey: 'vaccineGiven',
      options: [tr('✓ हाँ, टीका लगाया', '✓ होय, लस दिली'), tr('✕ नहीं लगाया', '✕ दिली नाही')],
    },
    {
      id: 'c2',
      number: 2,
      title: tr('शिशु का वजन (kg)', 'बाळाचे वजन (kg)'),
      type: 'number',
      fieldKey: 'childWeight',
      helperText: tr('वृद्धि निगरानी', 'वाढ निरीक्षण'),
    },
    {
      id: 'c3',
      number: 3,
      title: tr('बीमारी / खतरे के लक्षण', 'आजार / धोक्याची लक्षणे'),
      type: 'options',
      fieldKey: 'childCondition',
      options: [
        tr('पूर्णतः स्वस्थ', 'पूर्णपणे निरोगी'),
        tr('खाँसी / सर्दी / बुखार', 'खोकला / सर्दी / ताप'),
        tr('दस्त (ORS देय)', 'जुलाब (ORS देय)'),
        tr('गंभीर — रेफरल आवश्यक', 'गंभीर — संदर्भ आवश्यक'),
      ],
    },
    {
      id: 'c4',
      number: 4,
      title: tr('सत्र की स्थिति (रजिस्टर 18 अ)', 'सत्राची स्थिती (रजिस्टर 18 अ)'),
      type: 'options',
      fieldKey: 'childStatus',
      options: [
        tr('✓ टीकाकरण पूर्ण', '✓ लसीकरण पूर्ण'),
        tr('माता-पिता अनुपस्थित', 'पालक अनुपस्थित'),
        tr('टीके से इनकार', 'लसीला नकार'),
      ],
    },
  ];

  const otherQuestions: QuestionDef[] = [
    {
      id: 'o1',
      number: 1,
      title: tr('सेवा का प्रकार', 'सेवेचा प्रकार'),
      type: 'options',
      fieldKey: 'otherCategory',
      options: [
        tr('परिवार नियोजन', 'कुटुंब नियोजन'),
        tr('धात्री माता (PNC)', 'स्तनदा माता (PNC)'),
        tr('किशोरी आयरन (WIFS)', 'किशोरी लोह (WIFS)'),
        tr('NCD जाँच', 'NCD तपासणी'),
      ],
    },
    {
      id: 'o2',
      number: 2,
      title: tr('सामग्री / दवा वितरण', 'साहित्य / औषध वाटप'),
      type: 'options',
      fieldKey: 'suppliesGiven',
      options: [
        tr('छाया / अंतरा / कंडोम', 'छाया / अंतरा / निरोध'),
        tr('आयरन (WIFS) गोली दी', 'लोह (WIFS) गोळी दिली'),
        tr('केवल परामर्श दिया', 'फक्त समुपदेशन केले'),
        tr('दवा अनुपलब्ध', 'औषध उपलब्ध नाही'),
      ],
    },
    {
      id: 'o3',
      number: 3,
      title: tr('सत्यापन (रजिस्टर 18 स)', 'पडताळणी (रजिस्टर 18 स)'),
      type: 'options',
      fieldKey: 'otherStatus',
      options: [
        tr('✓ सेवा सफल', '✓ सेवा यशस्वी'),
        tr('अगले सप्ताह फॉलो-अप', 'पुढील आठवड्यात पाठपुरावा'),
        tr('स्वास्थ्य केंद्र रेफरल', 'आरोग्य केंद्र संदर्भ'),
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
    ? tr('अमान्य तिथि', 'अवैध तारीख')
    : lmpIsFuture
    ? tr('भविष्य की तिथि नहीं', 'भविष्यातील तारीख नाही')
    : lmpWeeks === null
    ? tr('45 सप्ताह से पुरानी', '45 आठवड्यांपेक्षा जुनी')
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
      const speechLang = language === 'mr' ? 'mr-IN' : 'hi-IN';
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
    speak(`प्रश्न ${currentQ.number}: ${currentQ.title}`);
  };

  const handleSpeakOption = (option: string) => {
    speak(option);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSave = async () => {
    // Never attach a survey to a placeholder patient.
    if (!familyUnitId || !familyMemberId) {
      onBack();
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* TOP HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {formType === 'PREGNANCY'
              ? tr('प्रसवपूर्व (18 ब)', 'प्रसूतीपूर्व (18 ब)')
              : formType === 'CHILD'
              ? tr('बाल स्वास्थ्य (18 अ)', 'बाल आरोग्य (18 अ)')
              : tr('अन्य सेवाएँ (18 स)', 'इतर सेवा (18 स)')}
          </Text>
          <Text style={styles.headerMember}>{memberName}</Text>
        </View>

        <TouchableOpacity onPress={handleSpeakQuestion} style={styles.voiceBtn} activeOpacity={0.7}>
          <Volume2 size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* PROGRESS BAR */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeaderRow}>
          <Text style={styles.progressCounterText}>
            प्रश्न {currentIndex + 1} / {totalQuestions}
          </Text>
          <Text style={styles.progressPercentText}>
            {Math.round(((currentIndex + 1) / totalQuestions) * 100)}% पूर्ण
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentIndex + 1) / totalQuestions) * 100}%` as any },
            ]}
          />
        </View>
      </View>

      {/* QUESTION CARD */}
      <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={styles.questionCard}>
          {/* Question number badge + voice */}
          <View style={styles.badgeRow}>
            <View style={styles.questionBadge}>
              <Text style={styles.questionBadgeText}>प्रश्न #{currentQ.number}</Text>
            </View>
            <TouchableOpacity onPress={handleSpeakQuestion} style={styles.qVoiceBtn} activeOpacity={0.7}>
              <Volume2 size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Question Title only (no subtitle) */}
          <Text style={styles.questionTitle}>{currentQ.title}</Text>

          {/* ANSWER INPUT AREA */}
          <View style={styles.answerArea}>

            {/* 1. BINARY */}
            {currentQ.type === 'binary' && currentQ.options && (
              <View style={styles.binaryCol}>
                {currentQ.options.map((opt) => {
                  const isSelected = answers[currentQ.fieldKey] === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.bigOptionBtn, isSelected && styles.bigOptionBtnActive]}
                      onPress={() => setAnswers({ ...answers, [currentQ.fieldKey]: opt })}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <Check size={16} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.bigOptionText, isSelected && styles.bigOptionTextActive]}>
                        {opt}
                      </Text>
                      {/* Voice icon per option */}
                      <TouchableOpacity
                        onPress={() => handleSpeakOption(opt)}
                        style={styles.optionVoiceBtn}
                        activeOpacity={0.7}
                      >
                        <Volume2 size={14} color={isSelected ? Colors.primary : '#94A3B8'} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 2. MULTI-OPTION */}
            {currentQ.type === 'options' && currentQ.options && (
              <View style={styles.optionsCol}>
                {currentQ.options.map((opt) => {
                  const isSelected = answers[currentQ.fieldKey] === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.optionCard, isSelected && styles.optionCardActive]}
                      onPress={() => setAnswers({ ...answers, [currentQ.fieldKey]: opt })}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <Check size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.optionCardText, isSelected && styles.optionCardTextActive]}>
                        {opt}
                      </Text>
                      {/* Voice icon per option */}
                      <TouchableOpacity
                        onPress={() => handleSpeakOption(opt)}
                        style={styles.optionVoiceBtn}
                        activeOpacity={0.7}
                      >
                        <Volume2 size={14} color={isSelected ? Colors.primary : '#94A3B8'} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* LMP DATE (Naegele's rule EDD, gestational weeks, trimester) */}
            {currentQ.type === 'date' && (
              <View style={styles.clinicalBox}>
                <View style={styles.lmpRow}>
                  {([
                    ['d', tr('दिन', 'दिवस'), 2, '--'],
                    ['m', tr('माह', 'महिना'), 2, '--'],
                    ['y', tr('वर्ष', 'वर्ष'), 4, '----'],
                  ] as const).map(([part, label, max, hint]) => (
                    <View key={part} style={[styles.lmpCell, part === 'y' && styles.lmpCellWide]}>
                      <Text style={styles.inputLabel}>{label}</Text>
                      <TextInput
                        style={[styles.lmpInput, lmpError ? styles.lmpInputError : null]}
                        value={lmpParts[part]}
                        onChangeText={(v) => updateLmpPart(part, v)}
                        keyboardType="number-pad"
                        maxLength={max}
                        placeholder={hint}
                        placeholderTextColor="#9CA3AF"
                        accessibilityLabel={label}
                      />
                    </View>
                  ))}
                </View>

                {lmpError && (
                  <View style={styles.lmpErrorRow}>
                    <AlertTriangle size={14} color="#DC2626" />
                    <Text style={styles.lmpErrorText}>{lmpError}</Text>
                  </View>
                )}

                {lmpEdd && lmpWeeks !== null && (
                  <View style={styles.eddCard}>
                    <View style={styles.eddHeaderRow}>
                      <CalendarDays size={18} color="#047857" />
                      <Text style={styles.eddLabel}>{tr('संभावित प्रसव (EDD)', 'संभाव्य प्रसूती (EDD)')}</Text>
                    </View>
                    <Text style={styles.eddValue}>{formatClinicalDate(lmpEdd)}</Text>
                    <View style={styles.eddChipsRow}>
                      <View style={styles.eddChip}>
                        <Text style={styles.eddChipText}>
                          {lmpWeeks} {tr('सप्ताह', 'आठवडे')}
                        </Text>
                      </View>
                      <View style={styles.eddChip}>
                        <Text style={styles.eddChipText}>
                          {tr('तिमाही', 'तिमाही')} {trimesterFromWeeks(lmpWeeks)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {currentQ.helperText && (
                  <Text style={styles.helperNotice}>ℹ️ {currentQ.helperText}</Text>
                )}
              </View>
            )}

            {/* 3. CUSTOM CLINICAL: BP & Weight */}
            {currentQ.type === 'custom_clinical' && (
              <View style={styles.clinicalBox}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>{tr('बी.पी.', 'बी.पी.')} (mmHg)</Text>
                    <TouchableOpacity onPress={() => speak(tr('रक्तचाप', 'रक्तदाब'))} style={styles.inlineLabelVoice}>
                      <Volume2 size={13} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={answers.bp}
                    onChangeText={(v) => setAnswers({ ...answers, bp: v })}
                    placeholder="120/80"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 14 }]}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>वजन (kg)</Text>
                    <TouchableOpacity onPress={() => speak(tr('वजन किलोग्राम', 'वजन किलोग्रॅम'))} style={styles.inlineLabelVoice}>
                      <Volume2 size={13} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={answers.weight}
                    onChangeText={(v) => setAnswers({ ...answers, weight: v })}
                    keyboardType="numeric"
                    placeholder="58"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                {currentQ.helperText && (
                  <Text style={styles.helperNotice}>ℹ️ {currentQ.helperText}</Text>
                )}
              </View>
            )}

            {/* 4. NUMBER INPUT */}
            {currentQ.type === 'number' && (
              <View style={styles.singleInputWrap}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{currentQ.title}</Text>
                  <TouchableOpacity onPress={() => speak(currentQ.title)} style={styles.inlineLabelVoice}>
                    <Volume2 size={13} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.bigNumberInput}
                  value={String(answers[currentQ.fieldKey] || '')}
                  onChangeText={(v) => setAnswers({ ...answers, [currentQ.fieldKey]: v })}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#9CA3AF"
                />
                {currentQ.helperText && (
                  <Text style={styles.helperNotice}>ℹ️ {currentQ.helperText}</Text>
                )}
              </View>
            )}

            {/* 5. DUAL NUMBER (IFA & Calcium) */}
            {currentQ.type === 'dual_number' && (
              <View style={styles.clinicalBox}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>{tr('IFA गोलियाँ (संख्या)', 'IFA गोळ्या (संख्या)')}</Text>
                    <TouchableOpacity onPress={() => speak(tr('आयरन गोलियों की संख्या', 'लोह गोळ्यांची संख्या'))} style={styles.inlineLabelVoice}>
                      <Volume2 size={13} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={answers.ironTablets}
                    onChangeText={(v) => setAnswers({ ...answers, ironTablets: v })}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 14 }]}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>{tr('कैल्शियम गोलियाँ (संख्या)', 'कॅल्शियम गोळ्या (संख्या)')}</Text>
                    <TouchableOpacity onPress={() => speak(tr('कैल्शियम गोलियों की संख्या', 'कॅल्शियम गोळ्यांची संख्या'))} style={styles.inlineLabelVoice}>
                      <Volume2 size={13} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={answers.calciumTablets}
                    onChangeText={(v) => setAnswers({ ...answers, calciumTablets: v })}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                {currentQ.helperText && (
                  <Text style={styles.helperNotice}>ℹ️ {currentQ.helperText}</Text>
                )}
              </View>
            )}

            {/* OPTIONAL CLINICAL NOTE WITH LIVE VOICE-TO-TEXT ON LAST QUESTION */}
            {isLastQuestion && (
              <View style={styles.voiceNoteCard}>
                <View style={styles.voiceNoteHeader}>
                  <View style={styles.voiceNoteTitleRow}>
                    <FileText size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.voiceNoteTitle}>
                      {tr('टिप्पणी जोड़ें (वैकल्पिक)', 'टीप जोडा (ऐच्छिक)')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.voiceMicBtn, isListening && styles.voiceMicBtnActive]}
                    onPress={toggleVoiceRecognition}
                    activeOpacity={0.8}
                  >
                    <Mic size={15} color={isListening ? '#FFFFFF' : Colors.primary} />
                    <Text style={[styles.voiceMicBtnText, isListening && styles.voiceMicBtnTextActive]}>
                      {isListening ? tr('सुन रहे हैं... रोकें', 'ऐकत आहे... थांबवा') : tr('बोलकर लिखें', 'बोलून लिहा')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.voiceNoteSub}>
                  {isListening
                    ? tr('🎙️ बोलिए... आपकी आवाज़ को टेक्स्ट में बदला जा रहा है।', '🎙️ बोला... तुमचा आवाज मजकुरात बदलला जात आहे.')
                    : tr('माइक दबाकर बोलें या यहाँ लिखें (वैकल्पिक टिप्पणी)', 'माइक दाबून बोला किंवा येथे लिहा (ऐच्छिक टीप)')}
                </Text>

                <TextInput
                  style={styles.voiceNoteInput}
                  value={clinicalNote}
                  onChangeText={(txt) => {
                    setClinicalNote(txt);
                    setAnswers((prev) => ({ ...prev, clinicalNote: txt, remarks: txt }));
                  }}
                  placeholder={tr('यहाँ अपनी टिप्पणी बोलें या टाइप करें (वैकल्पिक)...', 'येथे तुमची टीप बोला किंवा टाइप करा (ऐच्छिक)...')}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM NAV: PREV / NEXT / SAVE */}
      <View style={styles.bottomNavFixed}>
        {currentIndex > 0 ? (
          <TouchableOpacity style={styles.prevBtn} onPress={handlePrev} activeOpacity={0.8}>
            <ArrowLeft size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.prevBtnText}>{tr('पिछला', 'मागे')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {!isLastQuestion ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>{tr('अगला', 'पुढे')}</Text>
            <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <CheckCircle size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.saveBtnText}>
              {isSaving ? tr('सहेजा जा रहा है...', 'जतन होत आहे...') : tr('सहेजें', 'जतन करा')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // LMP date entry (48dp+ tactile targets, Devanagari-safe line heights)
  lmpRow: { flexDirection: 'row', gap: 10 },
  lmpCell: { flex: 1 },
  lmpCellWide: { flex: 1.6 },
  lmpInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 6,
  },
  lmpInputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  lmpErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  lmpErrorText: { color: '#991B1B', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  eddCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  eddHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eddLabel: { fontSize: 13, fontWeight: '600', color: '#065F46', lineHeight: 18 },
  eddValue: { fontSize: 26, fontWeight: '800', color: '#047857', marginTop: 6 },
  eddChipsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  eddChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  eddChipText: { fontSize: 13, fontWeight: '700', color: '#065F46', lineHeight: 18 },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerMember: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 1,
  },
  voiceBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressCounterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  scrollBody: {
    padding: 14,
    paddingBottom: 100,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  questionBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  questionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  qVoiceBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
  },
  questionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 18,
  },
  answerArea: {
    marginTop: 0,
  },
  binaryCol: {
    gap: 10,
  },
  bigOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  bigOptionBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.primary,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  bigOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  bigOptionTextActive: {
    color: Colors.primary,
  },
  optionVoiceBtn: {
    padding: 6,
    marginLeft: 4,
    borderRadius: 6,
  },
  optionsCol: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.primary,
  },
  optionCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  optionCardTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  clinicalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputGroup: {},
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  inlineLabelVoice: {
    padding: 3,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  singleInputWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  bigNumberInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    width: '70%',
    textAlign: 'center',
    paddingVertical: 14,
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 10,
  },
  helperNotice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomNavFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  prevBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 13,
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  nextBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    elevation: 2,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 13,
    elevation: 2,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voiceNoteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  voiceNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  voiceNoteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  voiceNoteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  voiceMicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 16,
    gap: 4,
  },
  voiceMicBtnActive: {
    backgroundColor: '#EF4444',
  },
  voiceMicBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  voiceMicBtnTextActive: {
    color: '#FFFFFF',
  },
  voiceNoteSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  voiceNoteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 13,
    color: Colors.textPrimary,
    minHeight: 64,
    textAlignVertical: 'top',
  },
});
