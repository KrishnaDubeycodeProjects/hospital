import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { X, Check, Clock, AlertCircle, Volume2, ShieldCheck, Calendar, Hash } from 'lucide-react-native';
import { ChildVaccinationRecord } from '../types/storage';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { SpeechEngine } from '../voice/speechEngine';

interface ChildVaccinationModalProps {
  visible: boolean;
  childRecord?: ChildVaccinationRecord | null;
  onClose: () => void;
}

interface VaccineGroup {
  ageLabel: string;
  vaccines: { code: string; nameHi: string; nameEn: string }[];
}

const VACCINE_SCHEDULE: VaccineGroup[] = [
  {
    ageLabel: 'जन्म पर (At Birth)',
    vaccines: [
      { code: 'BCG', nameHi: 'बीसीजी (BCG)', nameEn: 'BCG' },
      { code: 'OPV-0', nameHi: 'ओपीवी-0 (OPV 0)', nameEn: 'OPV 0' },
      { code: 'Hepatitis-B-0', nameHi: 'हेपेटाइटिस बी-0 (Hep-B 0)', nameEn: 'Hepatitis B 0' },
    ],
  },
  {
    ageLabel: '६ सप्ताह (6 Weeks)',
    vaccines: [
      { code: 'OPV-1', nameHi: 'ओपीवी-1 (OPV 1)', nameEn: 'OPV 1' },
      { code: 'Pentavalent-1', nameHi: 'पेंटावेलेंट-1 (Penta 1)', nameEn: 'Pentavalent 1' },
      { code: 'fIPV-1', nameHi: 'एफ-आईपीवी 1 (fIPV 1)', nameEn: 'fIPV 1' },
      { code: 'Rotavirus-1', nameHi: 'रोटावायरस 1 (Rota 1)', nameEn: 'Rotavirus 1' },
      { code: 'PCV-1', nameHi: 'पीसीवी-1 (PCV 1)', nameEn: 'PCV 1' },
    ],
  },
  {
    ageLabel: '१० सप्ताह (10 Weeks)',
    vaccines: [
      { code: 'OPV-2', nameHi: 'ओपीवी-2 (OPV 2)', nameEn: 'OPV 2' },
      { code: 'Pentavalent-2', nameHi: 'पेंटावेलेंट-2 (Penta 2)', nameEn: 'Pentavalent 2' },
      { code: 'Rotavirus-2', nameHi: 'रोटावायरस 2 (Rota 2)', nameEn: 'Rotavirus 2' },
    ],
  },
  {
    ageLabel: '१४ सप्ताह (14 Weeks)',
    vaccines: [
      { code: 'OPV-3', nameHi: 'ओपीवी-3 (OPV 3)', nameEn: 'OPV 3' },
      { code: 'Pentavalent-3', nameHi: 'पेंटावेलेंट-3 (Penta 3)', nameEn: 'Pentavalent 3' },
      { code: 'Rotavirus-3', nameHi: 'रोटावायरस 3 (Rota 3)', nameEn: 'Rotavirus 3' },
      { code: 'fIPV-2', nameHi: 'एफ-आईपीवी 2 (fIPV 2)', nameEn: 'fIPV 2' },
      { code: 'PCV-2', nameHi: 'पीसीवी-2 (PCV 2)', nameEn: 'PCV 2' },
    ],
  },
  {
    ageLabel: '९-१२ माह (9-12 Months)',
    vaccines: [
      { code: 'MR-1', nameHi: 'एमआर-1 खसरा (MR 1)', nameEn: 'MR 1 (Measles-Rubella)' },
      { code: 'PCV Booster', nameHi: 'पीसीवी बूस्टर (PCV Booster)', nameEn: 'PCV Booster' },
      { code: 'JE-1', nameHi: 'जेई-1 (JE 1)', nameEn: 'JE 1' },
      { code: 'Vitamin-A 1', nameHi: 'विटामिन-ए 1 (Vit-A 1)', nameEn: 'Vitamin A Dose 1' },
    ],
  },
  {
    ageLabel: '१६-२४ माह (16-24 Months)',
    vaccines: [
      { code: 'MR-2', nameHi: 'एमआर-2 (MR 2)', nameEn: 'MR 2' },
      { code: 'DPT Booster-1', nameHi: 'डीपीटी बूस्टर-1 (DPT B1)', nameEn: 'DPT Booster 1' },
      { code: 'OPV Booster', nameHi: 'ओपीवी बूस्टर (OPV Booster)', nameEn: 'OPV Booster' },
      { code: 'JE-2', nameHi: 'जेई-2 (JE 2)', nameEn: 'JE 2' },
    ],
  },
  {
    ageLabel: '५-६ वर्ष (5-6 Years)',
    vaccines: [
      { code: 'DPT Booster-2', nameHi: 'डीपीटी बूस्टर-2 (DPT B2)', nameEn: 'DPT Booster 2' },
    ],
  },
];

export const ChildVaccinationModal: React.FC<ChildVaccinationModalProps> = ({
  visible,
  childRecord,
  onClose,
}) => {
  const { t, language, localeCode, ttsEnabled } = useLanguage();
  const { updateChildVaccine } = useOfflineData();
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!childRecord) return null;

  const currentVaccines = childRecord.vaccines || {};

  const handleSpeakOverview = () => {
    if (isSpeaking) {
      SpeechEngine.stop();
      setIsSpeaking(false);
      return;
    }
    if (!ttsEnabled) return;

    let givenCount = 0;
    let dueCount = 0;
    Object.values(currentVaccines).forEach((status) => {
      if (status === 'Given') givenCount++;
      if (status === 'Due') dueCount++;
    });

    let spoken = '';
    if (language === 'hi') {
      spoken = `बाल टीकाकरण पंजीयन। बच्चे का नाम ${childRecord.childName}, पिता ${childRecord.fatherName}, उम्र ${childRecord.ageMonths} माह। ${givenCount} टीके लग चुके हैं, और ${dueCount} टीके अभी बाकी हैं।`;
    } else if (language === 'mr') {
      spoken = `बाल लसीकरण नोंदवही. बाळाचे नाव ${childRecord.childName}, वडील ${childRecord.fatherName}, वय ${childRecord.ageMonths} महिने. ${givenCount} लसी दिल्या आहेत आणि ${dueCount} लसी देय आहेत.`;
    } else {
      spoken = `Child immunization registry for ${childRecord.childName}, age ${childRecord.ageMonths} months. ${givenCount} vaccines administered, ${dueCount} currently due.`;
    }

    SpeechEngine.speak(
      spoken,
      localeCode,
      0.9,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  const handleToggleStatus = async (vaccineCode: string) => {
    const currentStatus = currentVaccines[vaccineCode] || 'Not Given';
    let nextStatus: 'Given' | 'Due' | 'Not Given' = 'Given';
    if (currentStatus === 'Given') nextStatus = 'Due';
    else if (currentStatus === 'Due') nextStatus = 'Not Given';
    else nextStatus = 'Given';

    await updateChildVaccine(childRecord.childMemberId, vaccineCode, nextStatus);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ShieldCheck size={20} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>{childRecord.childName}</Text>
              </View>
              <Text style={styles.modalSub}>
                पिता: {childRecord.fatherName} • {childRecord.ageMonths} माह • {childRecord.gender === 'Female' ? 'बालिका' : 'बालक'}
              </Text>
            </View>

            <TouchableOpacity style={styles.speakBtn} onPress={handleSpeakOverview} activeOpacity={0.7}>
              <Volume2 size={18} color={isSpeaking ? '#FFFFFF' : Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* MCTS & DOB Metadata Card */}
          <View style={styles.metaCard}>
            <View style={styles.metaItem}>
              <Hash size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaLabel}>MCTS / RCH: </Text>
              <Text style={styles.metaValue}>{childRecord.mctsCode || 'उपलब्ध नहीं'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Calendar size={13} color={Colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaLabel}>जन्म: </Text>
              <Text style={styles.metaValue}>{childRecord.dob}</Text>
            </View>
          </View>

          {/* Quick instructions banner */}
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              💡 स्थिति बदलने के लिए किसी भी टीके पर टैप करें (दिया गया ➔ देय ➔ नहीं दिया)
            </Text>
          </View>

          {/* Vaccines Schedule by Age Group */}
          <ScrollView contentContainerStyle={styles.scheduleList}>
            {VACCINE_SCHEDULE.map((grp) => (
              <View key={grp.ageLabel} style={styles.stageBlock}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageTitle}>{grp.ageLabel}</Text>
                </View>

                {grp.vaccines.map((v) => {
                  const status = currentVaccines[v.code] || 'Not Given';
                  const isGiven = status === 'Given';
                  const isDue = status === 'Due';

                  return (
                    <TouchableOpacity
                      key={v.code}
                      style={[
                        styles.vaccineRow,
                        isGiven && styles.vaccineRowGiven,
                        isDue && styles.vaccineRowDue,
                      ]}
                      onPress={() => handleToggleStatus(v.code)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vaccineName}>
                          {language === 'en' ? v.nameEn : v.nameHi}
                        </Text>
                        <Text style={styles.vaccineCodeText}>{v.code}</Text>
                      </View>

                      {/* Status Pill */}
                      <View
                        style={[
                          styles.statusPill,
                          isGiven && styles.statusPillGiven,
                          isDue && styles.statusPillDue,
                          !isGiven && !isDue && styles.statusPillNotGiven,
                        ]}
                      >
                        {isGiven ? (
                          <>
                            <Check size={12} color="#15803D" style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextGiven}>दिया गया</Text>
                          </>
                        ) : isDue ? (
                          <>
                            <Clock size={12} color="#B45309" style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextDue}>देय</Text>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} color="#B91C1C" style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextNotGiven}>नहीं दिया</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Close CTA */}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>पूर्ण (बंद करें)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  speakBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  closeBtn: {
    padding: 6,
  },
  metaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  instructionBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 11,
    color: '#1E40AF',
    lineHeight: 15,
  },
  scheduleList: {
    paddingBottom: 16,
  },
  stageBlock: {
    marginBottom: 12,
  },
  stageHeader: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 6,
  },
  stageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  vaccineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  vaccineRowGiven: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  vaccineRowDue: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  vaccineName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  vaccineCodeText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  statusPillGiven: {
    backgroundColor: '#DCFCE7',
  },
  statusPillDue: {
    backgroundColor: '#FEF3C7',
  },
  statusPillNotGiven: {
    backgroundColor: '#FEE2E2',
  },
  statusTextGiven: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  statusTextDue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  statusTextNotGiven: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
