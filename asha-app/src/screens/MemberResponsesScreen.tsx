/**
 * सदस्य सारांश — member profile · tap-to-hear clinical summary · detailed answers · CHO referral (physical).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import {
  Volume2,
  VolumeX,
  Plus,
  CircleCheck,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  Phone,
  CalendarDays,
  Activity,
  Baby,
  Route,
  Send,
  ShieldCheck,
} from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { FamilyMember } from '../types/storage';
import { generateClinicalSummary } from '../services/clinicalSummary';
import { SpeechEngine } from '../voice/speechEngine';
import {
  AppBar,
  Screen,
  Card,
  Button,
  IconButton,
  IconBadge,
  StatusPill,
  Chips,
  Field,
  Sheet,
  color,
  radius,
  space,
  text,
  type,
  useTr,
} from '../ui';

/** Urgency keys are kept as before (stored/compared values); display labels are localized below. */
const URGENT = 'अति-आवश्यक (7 दिन)' as const;
const MEDIUM = 'मध्यम (14 दिन)' as const;
type Urgency = typeof URGENT | typeof MEDIUM;

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
  const tr = useTr();
  const { language, localeCode, ttsEnabled } = useLanguage();
  const { surveys, families, createReferralToCho } = useOfflineData();
  // Members share the household head's phone unless they have their own number.
  const family = families.find((f) => f.id === member.familyUnitId);
  const contactPhone = member.phone?.trim() || family?.primaryPhone?.trim() || '';

  // Find member's survey responses
  const memberSurveys = surveys.filter((s) => s.familyMemberId === member.id);
  const latestSurvey = memberSurveys[0]; // Most recent survey

  const clinicalSummary = generateClinicalSummary(member, latestSurvey, language);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDetailedForm, setShowDetailedForm] = useState(false);

  // Referral to CHO State
  const [showReferModal, setShowReferModal] = useState(false);
  const [referReason, setReferReason] = useState(
    member.isHrp
      ? tr('उच्च जोखिम गर्भावस्था', 'उच्च जोखमीची गर्भधारणा')
      : member.hasChronicCondition
      ? member.chronicConditionType || ''
      : ''
  );
  const [referUrgency, setReferUrgency] = useState<Urgency>(URGENT);
  const [referVitals, setReferVitals] = useState('');
  const [referSuccessMsg, setReferSuccessMsg] = useState(false);

  const handleConfirmReferral = async () => {
    await createReferralToCho({
      familyUnitId: member.familyUnitId,
      familyMemberId: member.id,
      name: member.name,
      phone: contactPhone || undefined,
      abhaNumber: member.abhaNumber,
      houseNumber: houseNo,
      villageName: family?.villageName || undefined,
      reason: referReason,
      vitals: referVitals,
      urgencyDays: referUrgency === URGENT ? 'गंभीर (Severe)' : 'मध्यम (Medium)',
      prescriptionDeadline: referUrgency === URGENT ? '7 days' : '14 days',
    });

    setReferSuccessMsg(true);
    setTimeout(() => {
      setReferSuccessMsg(false);
      setShowReferModal(false);
    }, 1400);
  };

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

  const genderLabel =
    member.gender === 'Female' ? tr('महिला', 'स्त्री') : member.gender === 'Male' ? tr('पुरुष', 'पुरुष') : member.gender ? tr('अन्य', 'इतर') : '';
  const metaLine = [genderLabel, member.age != null ? `${member.age} ${tr('वर्ष', 'वर्षे')}` : '', member.relationship]
    .filter(Boolean)
    .join(' · ');
  const urgencyLabel = (u: Urgency) => (u === URGENT ? tr('गंभीर · 7 दिन', 'गंभीर · 7 दिवस') : tr('मध्यम · 14 दिन', 'मध्यम · 14 दिवस'));

  return (
    <View style={styles.flex}>
      <AppBar
        title={member.name}
        subtitle={`${familyName} · ${tr('घर', 'घर')} ${houseNo}`}
        onBack={onBack}
        backLabel={tr('वापस', 'मागे')}
        right={<IconButton icon={Plus} label={tr('नया सर्वे', 'नवीन सर्वे')} tone="accent" onPress={onStartNewSurvey} />}
      />
      <Screen>
        {/* Profile */}
        <Card>
          <View style={styles.inline}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{member.initials}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={text.heading} numberOfLines={1}>
                {member.name}
              </Text>
              {metaLine ? <Text style={text.caption}>{metaLine}</Text> : null}
            </View>
          </View>
          <View style={styles.pills}>
            {member.isPregnant ? <StatusPill tone="red" icon={Baby} label={tr('गर्भवती', 'गर्भवती')} /> : null}
            {member.isHrp ? <StatusPill tone="red" icon={TriangleAlert} label={tr('उच्च जोखिम', 'उच्च जोखीम')} /> : null}
            {member.hasChronicCondition ? (
              <StatusPill tone="amber" icon={Activity} label={member.chronicConditionType || tr('पुराना रोग', 'जुनाट आजार')} />
            ) : null}
            {member.abhaNumber ? <StatusPill tone="green" icon={ShieldCheck} label={`ABHA ${member.abhaNumber}`} /> : null}
          </View>
          {member.dob ? (
            <View style={styles.meta}>
              <CalendarDays size={16} color={color.muted} strokeWidth={2} />
              <Text style={text.caption}>{member.dob}</Text>
            </View>
          ) : null}
          {contactPhone ? (
            <View style={styles.gapTop}>
              <Button
                label={`${tr('कॉल करें', 'कॉल करा')} · ${contactPhone}`}
                icon={Phone}
                variant="secondary"
                onPress={() => Linking.openURL(`tel:${contactPhone}`)}
              />
            </View>
          ) : null}
        </Card>

        {/* Clinical summary — tap anywhere to hear it */}
        <Card
          tone={isSpeaking ? 'accent' : undefined}
          onPress={handleToggleSpeak}
          accessibilityLabel={isSpeaking ? tr('रोकें', 'थांबवा') : tr('सारांश सुनें', 'सारांश ऐका')}
          style={isSpeaking ? styles.speaking : undefined}
        >
          <View style={styles.inline}>
            <IconBadge icon={isSpeaking ? VolumeX : Volume2} tone="accent" />
            <View style={styles.flex}>
              <Text style={text.heading}>{clinicalSummary.categoryTitle}</Text>
              <Text style={text.caption}>
                {tr('अंतिम सर्वे', 'शेवटचा सर्वे')}: {clinicalSummary.surveyDate}
              </Text>
            </View>
            <StatusPill tone={isSpeaking ? 'green' : 'accent'} label={isSpeaking ? tr('बोल रहा है', 'बोलत आहे') : tr('सुनें', 'ऐका')} />
          </View>

          {clinicalSummary.highlights.length > 0 ? (
            <View style={styles.highlights}>
              {clinicalSummary.highlights.map((h) => (
                <View key={h.id} style={[styles.highlight, h.isAlert && styles.highlightAlert]}>
                  {h.statusType === 'check' ? (
                    <CircleCheck size={16} color={color.green} strokeWidth={2} />
                  ) : h.statusType === 'alert' ? (
                    <TriangleAlert size={16} color={color.red} strokeWidth={2} />
                  ) : (
                    <View style={styles.dot} />
                  )}
                  <Text style={[text.caption, styles.flex]}>{h.label}</Text>
                  <Text style={[text.label, h.isAlert && { color: color.redText }]}>{h.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[text.body, styles.spoken]}>{clinicalSummary.spokenText}</Text>
        </Card>

        {/* Detailed responses (collapsed) */}
        {clinicalSummary.detailedEntries.length > 0 ? (
          <>
            <Button
              label={
                showDetailedForm
                  ? tr('उत्तर छिपाएँ', 'उत्तरे लपवा')
                  : `${tr('सभी उत्तर', 'सर्व उत्तरे')} (${clinicalSummary.detailedEntries.length})`
              }
              icon={showDetailedForm ? ChevronUp : ChevronDown}
              variant="ghost"
              onPress={() => setShowDetailedForm(!showDetailedForm)}
            />
            {showDetailedForm ? (
              <Card>
                {clinicalSummary.detailedEntries.map((entry, idx) => {
                  const long = Boolean(entry.answerText && entry.answerText.length > 20);
                  const isLast = idx === clinicalSummary.detailedEntries.length - 1;
                  const answer = (
                    <View style={[styles.answer, !entry.isNormal && styles.answerAlert, long && styles.answerLong]}>
                      <Text style={[text.label, !entry.isNormal && { color: color.redText }]}>{entry.answerText}</Text>
                    </View>
                  );
                  return (
                    <View key={idx} style={[styles.qRow, isLast && styles.qRowLast]}>
                      <View style={styles.inlineTop}>
                        <View style={styles.qNum}>
                          <Text style={styles.qNumText}>{entry.questionNumber}</Text>
                        </View>
                        <View style={styles.flex}>
                          <Text style={text.body}>{entry.questionText}</Text>
                          {entry.note ? <Text style={text.caption}>{entry.note}</Text> : null}
                        </View>
                        {!long ? answer : null}
                      </View>
                      {long ? answer : null}
                    </View>
                  );
                })}
              </Card>
            ) : null}
          </>
        ) : null}

        <View style={styles.row2}>
          <View style={styles.flex}>
            <Button label={tr('सीएचओ रेफरल', 'सीएचओ संदर्भ')} icon={Route} variant="danger" onPress={() => setShowReferModal(true)} />
          </View>
          <View style={styles.flex}>
            <Button label={tr('नया सर्वे', 'नवीन सर्वे')} icon={Plus} onPress={onStartNewSurvey} />
          </View>
        </View>
      </Screen>

      <Sheet
        visible={showReferModal}
        onClose={() => setShowReferModal(false)}
        title={tr('सीएचओ को रेफर करें', 'सीएचओकडे संदर्भ')}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        {referSuccessMsg ? (
          <View style={styles.success}>
            <CircleCheck size={56} color={color.green} strokeWidth={1.8} />
            <Text style={text.heading}>{tr('रेफरल भेजा गया', 'संदर्भ पाठवला')}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={text.caption}>
              {member.name} · {familyName} · {tr('घर', 'घर')} {houseNo}
            </Text>
            <Text style={text.label}>{tr('प्राथमिकता', 'प्राधान्य')}</Text>
            <Chips
              value={referUrgency}
              onChange={setReferUrgency}
              options={[URGENT, MEDIUM].map((u) => ({ key: u, label: urgencyLabel(u) }))}
            />
            <Field label={tr('कारण', 'कारण')} voice="long" value={referReason} onChangeText={setReferReason} />
            <Field label={tr('जाँच / लक्षण', 'तपासणी / लक्षणे')} voice="long" value={referVitals} onChangeText={setReferVitals} placeholder="BP 120/80, Hb 11" />
            <Button label={tr('रेफरल भेजें', 'संदर्भ पाठवा')} icon={Send} disabled={!referReason.trim()} onPress={handleConfirmReferral} />
          </View>
        )}
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  inlineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  gapTop: { marginTop: space.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type(18, '800', color.accent) },
  speaking: { borderWidth: 2, backgroundColor: color.accentSoft },
  highlights: { gap: space.sm, marginTop: space.md },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    backgroundColor: color.canvas,
  },
  highlightAlert: { backgroundColor: color.redSoft },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent, marginHorizontal: 4 },
  spoken: { marginTop: space.md, color: color.muted },
  qRow: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.lineSoft, gap: space.sm },
  qRowLast: { borderBottomWidth: 0 },
  qNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qNumText: { ...type(13, '800', color.muted) },
  answer: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.greenSoft,
  },
  answerAlert: { backgroundColor: color.redSoft },
  answerLong: { borderRadius: radius.control, marginLeft: 28 + space.md },
  row2: { flexDirection: 'row', gap: space.md },
  form: { gap: space.md },
  success: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
});
