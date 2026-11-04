/**
 * ग्राम बैठकें — VHSNC / cluster / sector meetings register.
 * No pre-filled sample values; voice dictation for decisions; read-aloud per meeting.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users, CalendarDays, MapPin, Package, FileText, Plus, Volume2, CircleCheck } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { AshaMeetingRecord } from '../types/storage';
import { SpeechEngine } from '../voice/speechEngine';
import { getStorageWorkerPhone } from '../storage/OfflineStorageService';
import { formatClinicalDate } from '../services/maternalMath';
import {
  AppBar,
  Screen,
  Card,
  Button,
  IconButton,
  Field,
  Sheet,
  StatusPill,
  EmptyState,
  Chips,
  color,
  radius,
  space,
  text,
  touch,
  useTr,
} from '../ui';

type MeetingType = AshaMeetingRecord['meetingType'];

export const AshaMeetingsScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const tr = useTr();
  const { meetings, saveMeeting } = useOfflineData();
  const { localeCode, ttsEnabled } = useLanguage();

  const typeLabel = (t: MeetingType) =>
    t === 'VHSNC'
      ? tr('ग्राम स्वास्थ्य समिति', 'ग्राम आरोग्य समिती')
      : t === 'ASHA Cluster'
      ? tr('आशा क्लस्टर', 'आशा क्लस्टर')
      : t === 'Sector Monthly'
      ? tr('सेक्टर मासिक', 'सेक्टर मासिक')
      : tr('स्वास्थ्य दिवस योजना', 'आरोग्य दिन नियोजन');

  const [open, setOpen] = useState(false);
  const [meetingType, setMeetingType] = useState<MeetingType>('VHSNC');
  const [meetingDate, setMeetingDate] = useState(formatClinicalDate(new Date()));
  const [venue, setVenue] = useState('');
  const [attendeesCount, setAttendeesCount] = useState('');
  const [materialsAvailable, setMaterialsAvailable] = useState('');
  const [decisionsTaken, setDecisionsTaken] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setMeetingType('VHSNC');
    setMeetingDate(formatClinicalDate(new Date()));
    setVenue('');
    setAttendeesCount('');
    setMaterialsAvailable('');
    setDecisionsTaken('');
    setError(null);
  };

  const handleSave = async () => {
    if (!venue.trim() || !decisionsTaken.trim()) {
      setError(tr('स्थान और निर्णय भरें', 'स्थळ व निर्णय भरा'));
      return;
    }
    await saveMeeting({
      meetingType,
      meetingDate,
      venue: venue.trim(),
      attendeesCount: Number(attendeesCount) || 0,
      materialsAvailable: materialsAvailable.trim(),
      discussionPoints: '',
      decisionsTaken: decisionsTaken.trim(),
      ashaWorkerPhone: getStorageWorkerPhone(),
    });
    resetForm();
    setOpen(false);
  };

  const speakMeeting = (m: AshaMeetingRecord) => {
    if (speakingId === m.id) {
      SpeechEngine.stop();
      setSpeakingId(null);
      return;
    }
    if (!ttsEnabled) return;
    const spoken = tr(
      `बैठक: ${typeLabel(m.meetingType)}. दिनांक ${m.meetingDate}, स्थान ${m.venue}. ${m.attendeesCount} सदस्य उपस्थित. निर्णय: ${m.decisionsTaken}.`,
      `बैठक: ${typeLabel(m.meetingType)}. तारीख ${m.meetingDate}, स्थळ ${m.venue}. ${m.attendeesCount} सदस्य उपस्थित. निर्णय: ${m.decisionsTaken}.`
    );
    SpeechEngine.speak(spoken, localeCode, 0.9, () => setSpeakingId(m.id), () => setSpeakingId(null));
  };

  return (
    <View style={styles.flex}>
      {onBack ? <AppBar title={tr('ग्राम बैठकें', 'ग्राम बैठका')} onBack={onBack} backLabel={tr('वापस', 'मागे')} /> : null}
      <Screen>
        <Button label={tr('नई बैठक', 'नवीन बैठक')} icon={Plus} onPress={() => setOpen(true)} />

        {meetings.length === 0 ? (
          <EmptyState icon={Users} tone="accent" title={tr('अभी कोई बैठक नहीं', 'अजून बैठक नाही')} />
        ) : (
          meetings.map((m) => {
            const speaking = speakingId === m.id;
            return (
              <Card key={m.id}>
                <View style={styles.head}>
                  <View style={styles.flex}>
                    <Text style={text.heading} numberOfLines={1}>
                      {typeLabel(m.meetingType)}
                    </Text>
                    <View style={styles.meta}>
                      <CalendarDays size={15} color={color.muted} strokeWidth={2} />
                      <Text style={text.caption}>{m.meetingDate}</Text>
                      <MapPin size={15} color={color.muted} strokeWidth={2} />
                      <Text style={[text.caption, styles.flex]} numberOfLines={1}>
                        {m.venue}
                      </Text>
                    </View>
                  </View>
                  <IconButton
                    icon={Volume2}
                    tone={speaking ? 'green' : 'accent'}
                    filled={speaking}
                    label={tr('सुनें', 'ऐका')}
                    onPress={() => speakMeeting(m)}
                  />
                </View>
                <View style={styles.pills}>
                  <StatusPill tone="green" icon={Users} label={`${m.attendeesCount} ${tr('उपस्थित', 'उपस्थित')}`} />
                </View>
                {m.materialsAvailable ? (
                  <View style={styles.meta}>
                    <Package size={16} color={color.muted} strokeWidth={2} />
                    <Text style={[text.caption, styles.flex]}>{m.materialsAvailable}</Text>
                  </View>
                ) : null}
                {m.decisionsTaken ? (
                  <View style={styles.meta}>
                    <FileText size={16} color={color.muted} strokeWidth={2} />
                    <Text style={[text.body, styles.flex]}>{m.decisionsTaken}</Text>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </Screen>

      <Sheet visible={open} onClose={() => setOpen(false)} title={tr('नई बैठक', 'नवीन बैठक')} closeLabel={tr('बंद करें', 'बंद करा')}>
        <View style={styles.form}>
          <Text style={text.label}>{tr('बैठक का प्रकार', 'बैठकीचा प्रकार')}</Text>
          <Chips
            value={meetingType}
            onChange={setMeetingType}
            options={(['VHSNC', 'ASHA Cluster', 'Sector Monthly', 'VHND Planning'] as MeetingType[]).map((k) => ({
              key: k,
              label: typeLabel(k),
            }))}
          />
          <View style={styles.row2}>
            <View style={styles.flex}>
              <Field label={tr('तारीख', 'तारीख')} value={meetingDate} onChangeText={setMeetingDate} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={styles.flex}>
              <Field label={tr('उपस्थित', 'उपस्थित')} voice="number" value={attendeesCount} onChangeText={setAttendeesCount} keyboardType="numeric" />
            </View>
          </View>
          <Field label={tr('स्थान', 'स्थळ')} voice="text" value={venue} onChangeText={setVenue} />
          <Field label={tr('किट सामग्री', 'किट साहित्य')} voice="text" value={materialsAvailable} onChangeText={setMaterialsAvailable} />
          <Field label={tr('निर्णय', 'निर्णय')} value={decisionsTaken} onChangeText={setDecisionsTaken} multiline error={error} voice="long" />
          <Button label={tr('सहेजें', 'जतन करा')} icon={CircleCheck} onPress={handleSave} />
        </View>
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, flexWrap: 'wrap' },
  pills: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  form: { gap: space.md },
  row2: { flexDirection: 'row', gap: space.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mic: {
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
  micActive: { backgroundColor: color.red, borderColor: color.red },
  micText: { ...text.label, color: color.accent },
});
