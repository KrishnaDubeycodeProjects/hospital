import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Plus,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Calendar,
  Activity,
  FileText,
} from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { FamilyMember } from '../types/storage';
import { generateClinicalSummary } from '../services/clinicalSummary';
import { SpeechEngine } from '../voice/speechEngine';

interface MemberResponsesScreenProps {
  member: FamilyMember;
  houseNo: number | string;
  familyName: string;
  onBack: () => void;
  onStartNewSurvey: () => void;
}

export const MemberResponsesScreen: React.FC<MemberResponsesScreenProps> = ({
  member,
  houseNo,
  familyName,
  onBack,
  onStartNewSurvey,
}) => {
  const { t, language, localeCode, ttsEnabled } = useLanguage();
  const { surveys } = useOfflineData();

  // Find member's survey responses
  const memberSurveys = surveys.filter((s) => s.familyMemberId === member.id);
  const latestSurvey = memberSurveys[0]; // Most recent survey

  const clinicalSummary = generateClinicalSummary(member, latestSurvey, language);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDetailedForm, setShowDetailedForm] = useState(false);

  /**
   * Tapping anywhere on the Smart Summary Card triggers offline Text-to-Speech
   */
  const handleToggleSpeak = () => {
    if (isSpeaking) {
      SpeechEngine.stop();
      setIsSpeaking(false);
      return;
    }

    if (!ttsEnabled) return;

    SpeechEngine.speak(
      clinicalSummary.spokenText,
      localeCode,
      0.9,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{member.name}</Text>
          <Text style={styles.headerSub}>
            {familyName} {t('families')} • {t('houseNumberLabel')}: {houseNo}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newSurveyBtn}
          onPress={onStartNewSurvey}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newSurveyBtnText}>{t('add')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Member Profile Overview Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{member.initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{member.name}</Text>
              {member.isPregnant && (
                <View style={styles.pregnantChip}>
                  <View style={[styles.statusDot, { backgroundColor: '#BE185D' }]} />
                  <Text style={styles.pregnantChipText}>{t('pregnant')}</Text>
                </View>
              )}
              {member.hasChronicCondition && (
                <View style={styles.chronicChip}>
                  <Activity size={12} color="#B91C1C" style={{ marginRight: 3 }} />
                  <Text style={styles.chronicChipText}>
                    {member.chronicConditionType || t('chronicIssue')}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.profileMeta}>
              {member.gender} • {member.age} yrs • {member.relationship}
            </Text>

            <View style={styles.contactRow}>
              {member.dob && (
                <View style={styles.contactItem}>
                  <Calendar size={11} color={Colors.textSecondary} style={{ marginRight: 3 }} />
                  <Text style={styles.contactText}>DOB: {member.dob}</Text>
                </View>
              )}
              {member.phone && (
                <View style={styles.contactItem}>
                  <Phone size={11} color={Colors.textSecondary} style={{ marginRight: 3 }} />
                  <Text style={styles.contactText}>{member.phone}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* SMART CLINICAL SUMMARY CARD (Centerpiece of offline voice) */}
        {/* Tapping ANYWHERE on this card speaks the summary offline!   */}
        {/* ============================================================ */}
        <TouchableOpacity
          style={[
            styles.summaryCard,
            isSpeaking && styles.summaryCardSpeaking,
          ]}
          onPress={handleToggleSpeak}
          activeOpacity={0.85}
        >
          {/* Card Top Action Bar */}
          <View style={styles.summaryHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.summaryIconCircle, isSpeaking && styles.summaryIconCircleActive]}>
                {isSpeaking ? (
                  <VolumeX size={18} color="#FFFFFF" />
                ) : (
                  <Volume2 size={18} color={Colors.primary} />
                )}
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.summaryTitle}>
                  {clinicalSummary.categoryTitle}
                </Text>
                <Text style={styles.summaryDate}>
                  {t('lastSurvey')}: {clinicalSummary.surveyDate}
                </Text>
              </View>
            </View>

            {/* Offline Speech Indicator Chip */}
            <View
              style={[
                styles.voiceBadge,
                isSpeaking ? styles.voiceBadgeActive : styles.voiceBadgeIdle,
              ]}
            >
              <Text
                style={[
                  styles.voiceBadgeText,
                  isSpeaking && styles.voiceBadgeTextActive,
                ]}
              >
                {isSpeaking ? t('speakingSummary') : t('tapToListenSummary')}
              </Text>
            </View>
          </View>

          {/* Key Findings Grid: Important extracted Yes/No, tick marks & alerts */}
          <Text style={styles.findingsSectionHeading}>
            {t('keyFindings')}
          </Text>

          <View style={styles.highlightsWrap}>
            {clinicalSummary.highlights.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.highlightPill,
                  item.isAlert && styles.highlightPillAlert,
                ]}
              >
                {item.statusType === 'check' ? (
                  <CheckCircle2 size={13} color="#15803D" style={{ marginRight: 4 }} />
                ) : item.statusType === 'alert' ? (
                  <AlertCircle size={13} color="#B91C1C" style={{ marginRight: 4 }} />
                ) : (
                  <View style={[styles.statusDot, { backgroundColor: Colors.primary }]} />
                )}
                <Text style={styles.highlightLabel}>{item.label}: </Text>
                <Text
                  style={[
                    styles.highlightValue,
                    item.isAlert && styles.highlightValueAlert,
                  ]}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Natural Language Spoken Script Container */}
          <View style={styles.spokenScriptBox}>
            <Text style={styles.spokenScriptHeading}>
              {isSpeaking ? '🔊 ' + t('speakingSummary') : '📝 ' + t('spokenNotesLabel')}
            </Text>
            <Text style={styles.spokenScriptText}>
              "{clinicalSummary.spokenText}"
            </Text>
          </View>

          {/* Bottom Tap Feedback Tip */}
          <View style={styles.tapTipRow}>
            <Text style={styles.tapTipText}>
              {isSpeaking
                ? '⏹ ' + t('stopSpeaking')
                : '👆 ' + t('tapToListenSummary')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ============================================================ */}
        {/* ACCORDION TOGGLE: DETAILED QUESTIONNAIRE (Default Collapsed) */}
        {/* ============================================================ */}
        {clinicalSummary.detailedEntries.length > 0 && (
          <View style={styles.detailedSectionWrap}>
            <TouchableOpacity
              style={styles.toggleDetailedBtn}
              onPress={() => setShowDetailedForm(!showDetailedForm)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FileText size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.toggleDetailedBtnText}>
                  {showDetailedForm
                    ? t('hideDetailedResponses')
                    : `${t('viewDetailedResponses')} (${clinicalSummary.detailedEntries.length})`}
                </Text>
              </View>
              {showDetailedForm ? (
                <ChevronUp size={18} color={Colors.textSecondary} />
              ) : (
                <ChevronDown size={18} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>

            {showDetailedForm && (
              <View style={styles.detailedCard}>
                {clinicalSummary.detailedEntries.map((entry, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.detailedRow,
                      idx === clinicalSummary.detailedEntries.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.questionNumBadge}>
                      <Text style={styles.questionNumText}>{entry.questionNumber}</Text>
                    </View>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.questionTitle}>{entry.questionText}</Text>
                      {entry.note ? (
                        <Text style={styles.questionNote}>{entry.note}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.answerBadge,
                        !entry.isNormal && styles.answerBadgeAlert,
                      ]}
                    >
                      <Text
                        style={[
                          styles.answerText,
                          !entry.isNormal && styles.answerTextAlert,
                        ]}
                      >
                        {entry.answerText}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Start New Survey Button at Bottom */}
        <TouchableOpacity
          style={styles.bottomActionBtn}
          onPress={onStartNewSurvey}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.bottomActionBtnText}>{t('startNewSurvey')}</Text>
        </TouchableOpacity>
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
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  newSurveyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newSurveyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Profile Overview Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  profileMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  pregnantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pregnantChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE185D',
  },
  chronicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chronicChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  // Smart Summary Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardSpeaking: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconCircleActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryDate: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  voiceBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  voiceBadgeIdle: {
    backgroundColor: '#E0F2FE',
  },
  voiceBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  voiceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  voiceBadgeTextActive: {
    color: '#15803D',
  },
  findingsSectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  highlightsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  highlightPillAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  highlightLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  highlightValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  highlightValueAlert: {
    color: '#B91C1C',
  },
  spokenScriptBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  spokenScriptHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  spokenScriptText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  tapTipRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  tapTipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Detailed Section
  detailedSectionWrap: {
    marginBottom: 14,
  },
  toggleDetailedBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleDetailedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  detailedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  questionNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  questionNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  questionTitle: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  questionNote: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
    fontWeight: '600',
  },
  answerBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  answerBadgeAlert: {
    backgroundColor: '#FEE2E2',
  },
  answerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  answerTextAlert: {
    color: '#B91C1C',
  },
  bottomActionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  bottomActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
