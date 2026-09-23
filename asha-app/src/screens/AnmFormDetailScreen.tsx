import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { ArrowLeft, Volume2, VolumeX, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { StatusBadge } from '../components/StatusBadge';
import { SpeechEngine } from '../voice/speechEngine';
import { useLanguage } from '../context/LanguageContext';

interface AnmFormDetailScreenProps {
  patientName?: string;
  onBack: () => void;
}

export const AnmFormDetailScreen: React.FC<AnmFormDetailScreenProps> = ({
  patientName = 'Suman Verma',
  onBack,
}) => {
  const { localeCode, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'Filled Form' | 'History'>('Filled Form');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const spokenSummary =
    language === 'hi'
      ? `${patientName} का नैदानिक संक्षेप: पहली गर्भावस्था: हाँ। अंतिम मासिक धर्म: 12 जून। रक्तचाप: सामान्य 118 बटे 76। हीमोग्लोबिन: 11.2, हल्का एनीमिया। नियमित प्रसवपूर्व जांच जारी रखें।`
      : language === 'mr'
      ? `${patientName} वैद्यकीय सारांश: पहिली गर्भधारणा: होय. शेवटची मासिक पाळी: 12 जून. रक्तदाब: 118 बाय 76, सामान्य. हिमोग्लोबिन: 11.2, सौम्य ॲनिमिया. नियमित तपासणी सुरू ठेवा.`
      : `${patientName} Clinical Summary: First pregnancy: Yes. LMP: 12 June. Blood pressure: Normal (118/76). Hemoglobin: 11.2 (mild anemia). Regular ANC follow-up advised.`;

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      SpeechEngine.stop();
      setIsSpeaking(false);
      return;
    }
    SpeechEngine.speak(
      spokenSummary,
      localeCode,
      0.9,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  const formEntries = [
    { label: '1. First Pregnancy', value: 'Yes', isNormal: true },
    { label: '2. LMP', value: '12/06/2025', isNormal: true },
    { label: '3. Complications', value: 'None', isNormal: true },
    { label: '4. BP', value: 'Normal (118/76)', isNormal: true },
    { label: '5. Hemoglobin', value: '11.2 g/dL', isNormal: false, note: 'Mild Anemia' },
    { label: '6. Remarks', value: 'Regular checkup advised.', isNormal: true },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pregnancy Care</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Patient Profile Card */}
        <View style={styles.patientCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>SV</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.patientName}>{patientName}</Text>
              <View style={{ marginLeft: 8 }}>
                <StatusBadge type="pregnant" />
              </View>
            </View>
            <Text style={styles.patientMeta}>Female • 28 yrs</Text>
          </View>
        </View>

        {/* Smart Clinical Summary Card (Tap to Speak Offline) */}
        <TouchableOpacity
          style={[
            styles.summaryCard,
            isSpeaking && styles.summaryCardSpeaking,
          ]}
          onPress={handleToggleSpeak}
          activeOpacity={0.85}
        >
          <View style={styles.summaryTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.speakerCircle, isSpeaking && styles.speakerCircleActive]}>
                {isSpeaking ? (
                  <VolumeX size={16} color="#FFFFFF" />
                ) : (
                  <Volume2 size={16} color={Colors.primary} />
                )}
              </View>
              <Text style={styles.summaryCardTitle}>Smart Clinical Summary</Text>
            </View>

            <View style={[styles.voiceTag, isSpeaking && styles.voiceTagActive]}>
              <Text style={[styles.voiceTagText, isSpeaking && styles.voiceTagTextActive]}>
                {isSpeaking ? 'Playing Voice...' : 'Tap to Listen'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryPillsRow}>
            <View style={styles.summaryPill}>
              <CheckCircle2 size={12} color="#15803D" style={{ marginRight: 3 }} />
              <Text style={styles.summaryPillText}>1st Preg: Yes</Text>
            </View>
            <View style={styles.summaryPill}>
              <CheckCircle2 size={12} color="#15803D" style={{ marginRight: 3 }} />
              <Text style={styles.summaryPillText}>BP: 118/76 (Normal)</Text>
            </View>
            <View style={[styles.summaryPill, styles.summaryPillAlert]}>
              <AlertCircle size={12} color="#B91C1C" style={{ marginRight: 3 }} />
              <Text style={[styles.summaryPillText, styles.summaryPillTextAlert]}>Hb: 11.2 (Mild Anemia)</Text>
            </View>
          </View>

          <Text style={styles.spokenScriptSnippet}>
            "{spokenSummary}"
          </Text>
        </TouchableOpacity>

        {/* Filled Form / History Tabs matching Screen 11 & 10 */}
        <View style={styles.tabWrap}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'Filled Form' && styles.activeTabBtn,
            ]}
            onPress={() => setActiveTab('Filled Form')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'Filled Form' && styles.activeTabText,
              ]}
            >
              Filled Form
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'History' && styles.activeTabBtn,
            ]}
            onPress={() => setActiveTab('History')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'History' && styles.activeTabText,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Read-Only Form Values with Abnormal Highlighting */}
        <View style={styles.dataCard}>
          {formEntries.map((entry, idx) => (
            <View
              key={idx}
              style={[
                styles.dataRow,
                idx === formEntries.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.dataLabel}>{entry.label}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.dataValue,
                    !entry.isNormal && styles.abnormalValue,
                  ]}
                >
                  {entry.value}
                </Text>
                {entry.note ? (
                  <Text style={styles.abnormalNote}>{entry.note}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#BE185D',
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  patientMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabBtn: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  dataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dataLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  abnormalValue: {
    color: Colors.urgentRed,
  },
  abnormalNote: {
    fontSize: 11,
    color: Colors.urgentRed,
    fontWeight: '600',
    marginTop: 2,
  },
  // Smart Summary Card Styles
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  summaryCardSpeaking: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  speakerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  speakerCircleActive: {
    backgroundColor: '#10B981',
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  voiceTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voiceTagActive: {
    backgroundColor: '#DCFCE7',
  },
  voiceTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  voiceTagTextActive: {
    color: '#15803D',
  },
  summaryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryPillAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  summaryPillText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  summaryPillTextAlert: {
    color: '#B91C1C',
  },
  spokenScriptSnippet: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 16,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
});
