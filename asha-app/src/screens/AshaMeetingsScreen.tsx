import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  Users,
  Calendar,
  MapPin,
  Package,
  FileText,
  Plus,
  X,
  Volume2,
  Mic,
  CheckCircle2,
} from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';
import { AshaMeetingRecord } from '../types/storage';
import { SpeechEngine, VoiceRecognition } from '../voice/speechEngine';

export const AshaMeetingsScreen: React.FC = () => {
  const { meetings, saveMeeting } = useOfflineData();
  const { t, language, localeCode, ttsEnabled } = useLanguage();

  const [showAddModal, setShowAddModal] = useState(false);
  const [meetingType, setMeetingType] = useState<AshaMeetingRecord['meetingType']>('VHSNC');
  const [meetingDate, setMeetingDate] = useState('18/08/2025');
  const [venue, setVenue] = useState('आंगनवाड़ी केंद्र, चाँदपुर');
  const [attendeesCount, setAttendeesCount] = useState('16');
  const [materialsAvailable, setMaterialsAvailable] = useState('Hb meter, IFA, ORS, Chhaya, Nirodh');
  const [discussionPoints, setDiscussionPoints] = useState('');
  const [decisionsTaken, setDecisionsTaken] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speakingMeetingId, setSpeakingMeetingId] = useState<string | null>(null);

  const handleStartVoice = (target: 'discussion' | 'decisions') => {
    setIsListening(true);
    VoiceRecognition.start(
      localeCode,
      (text) => {
        if (target === 'discussion') {
          setDiscussionPoints((prev) => (prev ? prev + ' ' + text : text));
        } else {
          setDecisionsTaken((prev) => (prev ? prev + ' ' + text : text));
        }
        setIsListening(false);
      },
      () => setIsListening(false)
    );
  };

  const handleSave = async () => {
    if (!venue.trim() || !decisionsTaken.trim()) return;

    await saveMeeting({
      meetingType,
      meetingDate,
      venue: venue.trim(),
      attendeesCount: Number(attendeesCount) || 12,
      materialsAvailable: materialsAvailable.trim(),
      discussionPoints: discussionPoints.trim() || 'ग्राम स्वास्थ्य व पोषण पर चर्चा।',
      decisionsTaken: decisionsTaken.trim(),
      ashaWorkerPhone: '9876543210',
    });

    setDiscussionPoints('');
    setDecisionsTaken('');
    setShowAddModal(false);
  };

  const handleSpeakMeeting = (meeting: AshaMeetingRecord) => {
    if (speakingMeetingId === meeting.id) {
      SpeechEngine.stop();
      setSpeakingMeetingId(null);
      return;
    }
    if (!ttsEnabled) return;

    let text = '';
    if (language === 'hi') {
      text = `बैठक प्रकार: ${meeting.meetingType}. दिनांक ${meeting.meetingDate}, स्थान ${meeting.venue}. कुल ${meeting.attendeesCount} सदस्य उपस्थित थे. चर्चा के बिंदु: ${meeting.discussionPoints}. लिए गए निर्णय: ${meeting.decisionsTaken}. उपलब्ध किट सामग्री: ${meeting.materialsAvailable}.`;
    } else if (language === 'mr') {
      text = `बैठकीचा प्रकार: ${meeting.meetingType}. तारीख ${meeting.meetingDate}, स्थळ ${meeting.venue}. एकूण ${meeting.attendeesCount} सदस्य उपस्थित होते. निर्णय: ${meeting.decisionsTaken}. किट साहित्य: ${meeting.materialsAvailable}.`;
    } else {
      text = `Meeting type: ${meeting.meetingType}. Date ${meeting.meetingDate} at ${meeting.venue}. ${meeting.attendeesCount} attendees. Discussion: ${meeting.discussionPoints}. Decisions: ${meeting.decisionsTaken}. Kit materials: ${meeting.materialsAvailable}.`;
    }

    SpeechEngine.speak(
      text,
      localeCode,
      0.9,
      () => setSpeakingMeetingId(meeting.id),
      () => setSpeakingMeetingId(null)
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Offline Audio Guide Banner */}
        <VoiceGuideBanner
          sectionName="आशा ग्राम बैठक एवं समीक्षा पंजी (Section 5)"
          explanationHi="यहाँ आशा ग्राम स्वास्थ्य, स्वच्छता एवं पोषण समिति (VHSNC) और मासिक बैठकों का विवरण है। आप नई बैठक जोड़ सकती हैं और उपलब्ध किट सामग्री देख सकती हैं।"
          explanationMr="येथे आशा ग्राम आरोग्य, स्वच्छता आणि पोषण समिती (VHSNC) आणि मासिक बैठकांची नोंदवही आहे. आपण नवीन बैठक नोंदवू शकता."
          explanationEn="Here is the registry of Village Health, Sanitation and Nutrition Committee (VHSNC) and monthly cluster meetings. Record meetings and track medicine kits."
        />

        {/* Top Action Bar */}
        <View style={styles.actionBar}>
          <View>
            <Text style={styles.pageTitle}>ग्राम बैठकें एवं कार्यसूची</Text>
            <Text style={styles.pageSub}>कुल पंजीकृत बैठकें: {meetings.length}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>नई बैठक दर्ज करें</Text>
          </TouchableOpacity>
        </View>

        {/* Meetings List */}
        {meetings.map((item) => {
          const isSpeaking = speakingMeetingId === item.id;
          return (
            <View key={item.id} style={styles.meetingCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{item.meetingType}</Text>
                    </View>
                    <View style={styles.attendeeBadge}>
                      <Users size={12} color="#15803D" style={{ marginRight: 3 }} />
                      <Text style={styles.attendeeText}>{item.attendeesCount} उपस्थित</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Calendar size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.metaText}>{item.meetingDate}</Text>
                    <Text style={styles.metaDivider}>•</Text>
                    <MapPin size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.metaText}>{item.venue}</Text>
                  </View>
                </View>

                {/* TTS Speaker Button */}
                <TouchableOpacity
                  style={[styles.ttsBtn, isSpeaking && styles.ttsBtnActive]}
                  onPress={() => handleSpeakMeeting(item)}
                  activeOpacity={0.7}
                >
                  <Volume2 size={18} color={isSpeaking ? '#FFFFFF' : Colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Kit Materials Pill */}
              <View style={styles.kitBox}>
                <Package size={14} color="#0369A1" style={{ marginRight: 6 }} />
                <Text style={styles.kitLabel}>उपलब्ध किट सामग्री: </Text>
                <Text style={styles.kitValue} numberOfLines={2}>
                  {item.materialsAvailable}
                </Text>
              </View>

              {/* Discussion & Decisions */}
              <View style={styles.agendaBox}>
                <FileText size={14} color="#475569" style={{ marginRight: 6, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.agendaLabel}>चर्चा एवं निर्णय:</Text>
                  <Text style={styles.agendaText}>{item.decisionsTaken}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Meeting Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>नई बैठक दर्ज करें</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Meeting Type Selection */}
              <Text style={styles.inputLabel}>बैठक का प्रकार</Text>
              <View style={styles.typeSelectorRow}>
                {(['VHSNC', 'ASHA Cluster', 'Sector Monthly', 'VHND Planning'] as const).map(
                  (tp) => (
                    <TouchableOpacity
                      key={tp}
                      style={[styles.typeOption, meetingType === tp && styles.typeOptionActive]}
                      onPress={() => setMeetingType(tp)}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          meetingType === tp && styles.typeOptionTextActive,
                        ]}
                      >
                        {tp}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              {/* Date & Attendees */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>बैठक की तारीख</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={meetingDate}
                    onChangeText={setMeetingDate}
                    placeholder="DD/MM/YYYY"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>उपस्थित संख्या</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={attendeesCount}
                    onChangeText={setAttendeesCount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>स्थान / गंतव्य (Venue)</Text>
              <TextInput
                style={styles.modalInput}
                value={venue}
                onChangeText={setVenue}
                placeholder="उदा. ग्राम पंचायत भवन, चाँदपुर"
              />

              <Text style={styles.inputLabel}>उपलब्ध किट एवं दवाइयाँ</Text>
              <TextInput
                style={styles.modalInput}
                value={materialsAvailable}
                onChangeText={setMaterialsAvailable}
                placeholder="उदा. Hb meter strips, IFA, ORS, निरोध"
              />

              {/* Decisions Taken with Voice-to-Text */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>लिए गए निर्णय एवं कार्ययोजना</Text>
                <TouchableOpacity
                  style={[styles.voiceMicBtn, isListening && styles.voiceMicBtnActive]}
                  onPress={() => handleStartVoice('decisions')}
                >
                  <Mic size={14} color={isListening ? '#FFF' : Colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.voiceMicText, isListening && { color: '#FFF' }]}>
                    {isListening ? 'सुन रहे हैं...' : 'बोलकर लिखें'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                value={decisionsTaken}
                onChangeText={setDecisionsTaken}
                placeholder="गाँव में स्वच्छता अभियान, अति-आवश्यक गर्भवती महिलाओं का संस्थागत प्रसव आदि..."
                multiline
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>स्थानीय रूप से सहेजें</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pageSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  meetingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  attendeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  attendeeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaDivider: {
    marginHorizontal: 5,
    color: Colors.textMuted,
  },
  ttsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsBtnActive: {
    backgroundColor: Colors.primary,
  },
  kitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  kitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  kitValue: {
    fontSize: 11,
    color: '#0F172A',
    flex: 1,
  },
  agendaBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  agendaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  agendaText: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeOptionTextActive: {
    color: '#FFFFFF',
  },
  voiceMicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  voiceMicBtnActive: {
    backgroundColor: Colors.urgentRed,
  },
  voiceMicText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 20,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
