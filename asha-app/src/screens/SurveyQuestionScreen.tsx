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
} from 'lucide-react-native';
import { SpeechEngine } from '../voice/speechEngine';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';

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
  type: 'binary' | 'options' | 'number' | 'text' | 'dual_number' | 'custom_clinical';
  options?: string[];
  fieldKey: string;
  helperText?: string;
}

export const SurveyQuestionScreen: React.FC<SurveyQuestionScreenProps> = ({
  onBack,
  onComplete,
  familyUnitId = 'f012-0000-0000-0012',
  familyMemberId = 'm001-0000-0000-0001',
  memberName = 'सुमन वर्मा',
  formType = 'PREGNANCY',
}) => {
  const { ttsEnabled, localeCode } = useLanguage();
  const { submitSurvey } = useOfflineData();

  const pregnancyQuestions: QuestionDef[] = [
    {
      id: 'p1',
      number: 1,
      title: 'क्या महिला गर्भवती है? (ANC)',
      type: 'binary',
      fieldKey: 'isPregnant',
      options: ['हाँ', 'नहीं'],
    },
    {
      id: 'p2',
      number: 2,
      title: 'प्रसव पूर्व जाँच (ANC विजिट)',
      type: 'options',
      fieldKey: 'ancVisit',
      options: ['ANC 1', 'ANC 2', 'ANC 3', 'ANC 4', 'सभी पूर्ण'],
    },
    {
      id: 'p3',
      number: 3,
      title: 'TT / Td टीका लगाया गया?',
      type: 'binary',
      fieldKey: 'ttGiven',
      options: ['✓ लगाया गया', '✕ नहीं लगाया'],
    },
    {
      id: 'p4',
      number: 4,
      title: 'BP एवं वजन',
      type: 'custom_clinical',
      fieldKey: 'bpAndWeight',
      helperText: 'सामान्य BP: 120/80',
    },
    {
      id: 'p5',
      number: 5,
      title: 'हीमोग्लोबिन (g/dL)',
      type: 'number',
      fieldKey: 'hemoglobin',
      helperText: '11 से कम → एनीमिया (HRP)',
    },
    {
      id: 'p6',
      number: 6,
      title: 'मूत्र जाँच (Urine)',
      type: 'options',
      fieldKey: 'urine',
      options: ['सामान्य', 'असामान्य (Protein+)', 'जाँच नहीं हुई'],
    },
    {
      id: 'p7',
      number: 7,
      title: 'पेट की जाँच हुई?',
      type: 'binary',
      fieldKey: 'abdominalExam',
      options: ['✓ की गई', '✕ नहीं की गई'],
    },
    {
      id: 'p8',
      number: 8,
      title: 'IFA एवं कैल्शियम गोलियाँ',
      type: 'dual_number',
      fieldKey: 'tablets',
      helperText: 'लक्ष्य: 180 गोलियाँ प्रत्येक',
    },
    {
      id: 'p9',
      number: 9,
      title: 'सेवा की स्थिति',
      type: 'options',
      fieldKey: 'serviceStatus',
      options: [
        '✓ सेवा पूर्ण',
        'लाभार्थी अनुपस्थित',
        'लाभार्थी का इनकार',
        'अस्पताल रेफरल',
      ],
    },
  ];

  const childQuestions: QuestionDef[] = [
    {
      id: 'c1',
      number: 1,
      title: 'आज टीका लगाया गया?',
      type: 'binary',
      fieldKey: 'vaccineGiven',
      options: ['✓ हाँ, टीका लगाया', '✕ नहीं लगाया'],
    },
    {
      id: 'c2',
      number: 2,
      title: 'शिशु का वजन (kg)',
      type: 'number',
      fieldKey: 'childWeight',
      helperText: 'वृद्धि मॉनिटरिंग',
    },
    {
      id: 'c3',
      number: 3,
      title: 'बीमारी / खतरे के लक्षण',
      type: 'options',
      fieldKey: 'childCondition',
      options: [
        'पूर्णतः स्वस्थ',
        'खाँसी / सर्दी / बुखार',
        'दस्त (ORS देय)',
        'गंभीर — रेफरल आवश्यक',
      ],
    },
    {
      id: 'c4',
      number: 4,
      title: 'सत्र की स्थिति (रजिस्टर 18 अ)',
      type: 'options',
      fieldKey: 'childStatus',
      options: [
        '✓ टीकाकरण पूर्ण',
        'माता-पिता अनुपस्थित',
        'टीके से इनकार',
      ],
    },
  ];

  const otherQuestions: QuestionDef[] = [
    {
      id: 'o1',
      number: 1,
      title: 'सेवा का प्रकार',
      type: 'options',
      fieldKey: 'otherCategory',
      options: [
        'परिवार नियोजन',
        'धात्री माता (PNC)',
        'किशोरी आयरन (WIFS)',
        'NCD जाँच',
      ],
    },
    {
      id: 'o2',
      number: 2,
      title: 'सामग्री / दवा वितरण',
      type: 'options',
      fieldKey: 'suppliesGiven',
      options: [
        'छाया / अंतरा / कंडोम',
        'आयरन (WIFS) गोली दी',
        'केवल परामर्श दिया',
        'दवा अनुपलब्ध',
      ],
    },
    {
      id: 'o3',
      number: 3,
      title: 'सत्यापन (रजिस्टर 18 स)',
      type: 'options',
      fieldKey: 'otherStatus',
      options: [
        '✓ सेवा सफल',
        'अगले सप्ताह फॉलो-अप',
        'स्वास्थ्य केंद्र रेफरल',
      ],
    },
  ];

  const questions =
    formType === 'CHILD'
      ? childQuestions
      : formType === 'OTHER'
      ? otherQuestions
      : pregnancyQuestions;

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;

  const [answers, setAnswers] = useState<Record<string, any>>({
    isPregnant: 'हाँ',
    ancVisit: 'ANC 2',
    ttGiven: '✓ लगाया गया',
    bp: '120/80',
    weight: '58',
    hemoglobin: '10.4',
    urine: 'सामान्य',
    abdominalExam: '✓ की गई',
    ironTablets: '100',
    calciumTablets: '100',
    serviceStatus: '✓ सेवा पूर्ण',
    vaccineGiven: '✓ हाँ, टीका लगाया',
    childWeight: '5.4',
    childCondition: 'पूर्णतः स्वस्थ',
    childStatus: '✓ टीकाकरण पूर्ण',
    otherCategory: 'परिवार नियोजन',
    suppliesGiven: 'छाया / अंतरा / कंडोम',
    otherStatus: '✓ सेवा सफल',
  });

  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);
    try {
      await submitSurvey({
        familyUnitId,
        familyMemberId,
        categoryCode: formType === 'OTHER' ? 'GENERAL' : formType,
        ashaWorkerPhone: '9876543210',
        answers: {
          ...answers,
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
              ? 'प्रसवपूर्व (18 ब)'
              : formType === 'CHILD'
              ? 'बाल स्वास्थ्य (18 अ)'
              : 'अन्य सेवाएँ (18 स)'}
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

            {/* 3. CUSTOM CLINICAL: BP & Weight */}
            {currentQ.type === 'custom_clinical' && (
              <View style={styles.clinicalBox}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>BP (mmHg)</Text>
                    <TouchableOpacity onPress={() => speak('रक्तचाप')} style={styles.inlineLabelVoice}>
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
                    <TouchableOpacity onPress={() => speak('वजन किलोग्राम')} style={styles.inlineLabelVoice}>
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
                    <Text style={styles.inputLabel}>IFA गोलियाँ (संख्या)</Text>
                    <TouchableOpacity onPress={() => speak('आयरन गोलियों की संख्या')} style={styles.inlineLabelVoice}>
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
                    <Text style={styles.inputLabel}>कैल्शियम गोलियाँ (संख्या)</Text>
                    <TouchableOpacity onPress={() => speak('कैल्शियम गोलियों की संख्या')} style={styles.inlineLabelVoice}>
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
          </View>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM NAV: PREV / NEXT / SAVE */}
      <View style={styles.bottomNavFixed}>
        {currentIndex > 0 ? (
          <TouchableOpacity style={styles.prevBtn} onPress={handlePrev} activeOpacity={0.8}>
            <ArrowLeft size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.prevBtnText}>पिछला</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {!isLastQuestion ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>अगला</Text>
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
              {isSaving ? 'सहेजा जा रहा है...' : 'सहेजें'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
});
