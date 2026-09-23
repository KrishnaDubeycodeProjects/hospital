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
  QrCode,
  Plus,
  X,
  Syringe,
  Baby,
  Activity,
  CheckCircle,
  Users,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';
import { RealQrCode } from '../components/RealQrCode';

interface AnmSessionFolder {
  id: string;
  title: string;
  category: 'CHILD_VAX' | 'ANC' | 'NCD';
  date: string;
  qrCodeValue: string;
  recordsCount: number;
}

interface AnmOpenFormsScreenProps {
  onSelectAsha?: (worker: any) => void;
}

export const AnmOpenFormsScreen: React.FC<AnmOpenFormsScreenProps> = () => {
  const { childVaccinations, surveys } = useOfflineData();

  // ANM Session Folders
  const [sessions, setSessions] = useState<AnmSessionFolder[]>([
    {
      id: 'sess-01',
      title: 'विशेष बाल टीकाकरण सत्र (VHND Drive)',
      category: 'CHILD_VAX',
      date: '18/08/2025',
      qrCodeValue: 'ANM-QR-CHILD-VAX-CHANDPUR',
      recordsCount: childVaccinations.length,
    },
    {
      id: 'sess-02',
      title: 'मातृ स्वास्थ्य एवं प्रसव पूर्व जांच (ANC Clinic)',
      category: 'ANC',
      date: '16/08/2025',
      qrCodeValue: 'ANM-QR-ANC-CHANDPUR',
      recordsCount: surveys.filter((s) => s.categoryCode === 'PREGNANCY').length,
    },
    {
      id: 'sess-03',
      title: 'एनसीडी एवं मुख कैंसर जांच सत्र (NCD Camp)',
      category: 'NCD',
      date: '12/08/2025',
      qrCodeValue: 'ANM-QR-NCD-CHANDPUR',
      recordsCount: surveys.filter((s) => s.categoryCode === 'DISEASE').length,
    },
  ]);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'CHILD_VAX' | 'ANC' | 'NCD'>('CHILD_VAX');

  // Active Session QR Code Modal
  const [activeQrSession, setActiveQrSession] = useState<AnmSessionFolder | null>(null);

  // Selected Session Drilldown Modal
  const [inspectedSession, setInspectedSession] = useState<AnmSessionFolder | null>(null);

  const handleCreateSession = () => {
    if (!newTitle.trim()) return;

    const codeSuffix =
      newCategory === 'CHILD_VAX' ? 'VAX' : newCategory === 'ANC' ? 'ANC' : 'NCD';

    const newFolder: AnmSessionFolder = {
      id: `sess-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      date: new Date().toLocaleDateString('en-GB'),
      qrCodeValue: `ANM-QR-${codeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`,
      recordsCount: 0,
    };

    setSessions([newFolder, ...sessions]);
    setNewTitle('');
    setShowCreateModal(false);
    // Directly open QR code for ASHA to scan
    setActiveQrSession(newFolder);
  };

  const getCategoryIcon = (category: AnmSessionFolder['category']) => {
    switch (category) {
      case 'CHILD_VAX':
        return <Syringe size={20} color="#0284C7" />;
      case 'ANC':
        return <Baby size={20} color={Colors.urgentRed} />;
      case 'NCD':
      default:
        return <Activity size={20} color="#BE185D" />;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Offline Audio Guide for ANM */}
        <VoiceGuideBanner
          sectionTitle="एएनएम सत्र क्लस्टर एवं क्यूआर कोड"
          guideTextHi="एएनएम पोर्टल: नया टीकाकरण या स्वास्थ्य सत्र बनाएं, क्यूआर कोड खोलें जिससे आशा कार्यकर्ता सीधे क्लस्टर डेटा सिंक कर सकें।"
          guideTextMr="एएनएम पोर्टल: नवीन लसीकरण सत्र तयार करा, क्यूआर कोड दाखवा जेणेकरून आशा कार्यकर्त्या डेटा सिंक करू शकतील."
          guideTextEn="ANM Session Manager. Create immunization sessions, generate session QR codes, and receive clustered records from ASHAs."
        />

        {/* Action Header */}
        <View style={styles.actionBar}>
          <View>
            <Text style={styles.pageTitle}>सत्र फ़ोल्डर ({sessions.length})</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>+ नया सत्र बनाएं</Text>
          </TouchableOpacity>
        </View>

        {/* Session Folders List */}
        {sessions.map((sess) => (
          <View key={sess.id} style={styles.sessionCard}>
            <View style={styles.sessionTopRow}>
              <View style={styles.iconCircle}>{getCategoryIcon(sess.category)}</View>

              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>{sess.title}</Text>
                <Text style={styles.sessionDate}>दिनांक: {sess.date}</Text>
              </View>

              {/* Show Session QR Code Button */}
              <TouchableOpacity
                style={styles.qrButton}
                onPress={() => setActiveQrSession(sess)}
                activeOpacity={0.8}
              >
                <QrCode size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.qrButtonText}>QR कोड</Text>
              </TouchableOpacity>
            </View>

            {/* Clustered Records Preview Bar */}
            <TouchableOpacity
              style={styles.recordsSummaryBar}
              onPress={() => setInspectedSession(sess)}
              activeOpacity={0.75}
            >
              <Users size={14} color="#0369A1" style={{ marginRight: 6 }} />
              <Text style={styles.recordsCountText}>
                {sess.recordsCount > 0
                  ? `${sess.recordsCount} क्लस्टर्ड रिकॉर्ड प्राप्त हुए (क्लिक करके देखें)`
                  : 'अभी तक कोई डेटा प्राप्त नहीं हुआ (QR स्कैन करवाएं)'}
              </Text>
              <ChevronRight size={16} color="#0369A1" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Modal 1: Create New Session Folder */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>नया सत्र फ़ोल्डर बनाएं</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>सत्र की श्रेणी (Category)</Text>
            <View style={styles.categoryRow}>
              {(
                [
                  { key: 'CHILD_VAX', label: '💉 बाल टीकाकरण', desc: 'Child Vaccination' },
                  { key: 'ANC', label: '🤰 प्रसव पूर्व जांच', desc: 'Antenatal Care' },
                  { key: 'NCD', label: '🩺 एनसीडी / कैंसर', desc: 'NCD Screening' },
                ] as const
              ).map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.catOption,
                    newCategory === cat.key && styles.catOptionActive,
                  ]}
                  onPress={() => setNewCategory(cat.key)}
                >
                  <Text
                    style={[
                      styles.catOptionText,
                      newCategory === cat.key && styles.catOptionTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>सत्र का शीर्षक / नाम</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="उदा. प्राथमिक स्वास्थ्य केंद्र टीकाकरण दिवस (VHND)"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreateSession}
              activeOpacity={0.85}
            >
              <Text style={styles.createBtnText}>सत्र बनाएं एवं QR कोड उत्पन्न करें</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Generated Session QR Code for ASHA to Scan */}
      {activeQrSession && (
        <Modal visible={!!activeQrSession} transparent animationType="fade">
          <View style={styles.modalOverlayCenter}>
            <View style={styles.qrModalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{activeQrSession.title}</Text>
                  <Text style={styles.modalSub}>
                    {activeQrSession.category === 'CHILD_VAX'
                      ? 'बाल टीकाकरण क्लस्टर'
                      : activeQrSession.category === 'ANC'
                      ? 'मातृ स्वास्थ्य क्लस्टर'
                      : 'एनसीडी स्क्रीनिंग क्लस्टर'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveQrSession(null)}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* QR Code Presentation Box */}
              <View style={styles.qrDisplayBox}>
                <RealQrCode value={activeQrSession.qrCodeValue} size={180} />
                <View style={styles.qrCodeTag}>
                  <Text style={styles.qrCodeTagText}>{activeQrSession.qrCodeValue}</Text>
                </View>
              </View>

              <Text style={styles.qrInstruction}>
                📲 आशा कार्यकर्ता से कहें कि अपने फोन से इस QR कोड को स्कैन करें। डेटा तुरंत इस सत्र में क्लस्टर हो जाएगा।
              </Text>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setActiveQrSession(null)}
                activeOpacity={0.85}
              >
                <CheckCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.doneBtnText}>पूर्ण (बंद करें)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal 3: Clustered Records Drilldown */}
      {inspectedSession && (
        <Modal visible={!!inspectedSession} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{inspectedSession.title}</Text>
                  <Text style={styles.modalSub}>प्राप्त क्लस्टर्ड रिकॉर्ड सूची</Text>
                </View>
                <TouchableOpacity onPress={() => setInspectedSession(null)}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 380 }}>
                {inspectedSession.category === 'CHILD_VAX' ? (
                  childVaccinations.map((c) => (
                    <View key={c.id} style={styles.clusteredRecordItem}>
                      <ShieldCheck size={16} color="#0284C7" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recordName}>{c.childName}</Text>
                        <Text style={styles.recordMeta}>
                          पिता: {c.fatherName} • {c.ageMonths} माह • MCTS: {c.mctsCode}
                        </Text>
                      </View>
                      <View style={styles.recordBadge}>
                        <Text style={styles.recordBadgeText}>टीकाकरण पूर्ण</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <CheckCircle size={32} color={Colors.visitedGreen} />
                    <Text style={{ fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                      क्लस्टर डेटा सुरक्षित एवं समक्रमित है।
                    </Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setInspectedSession(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeBtnText}>बंद करें</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pageSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sessionDate: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qrButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recordsSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  recordsCountText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  qrModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  catOption: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  catOptionActive: {
    backgroundColor: '#DCFCE7',
    borderColor: Colors.primary,
  },
  catOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  catOptionTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  qrDisplayBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    marginVertical: 12,
  },
  qrCodeTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  qrCodeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  qrInstruction: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clusteredRecordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recordName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recordMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  recordBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recordBadgeText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
