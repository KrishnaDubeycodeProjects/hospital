import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  Users,
  FileText,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  PhoneCall,
  Check,
  X,
  Building2,
  Calendar,
  Activity,
  ShieldAlert,
} from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';

export const ChoDashboardScreen: React.FC = () => {
  const { families, members, followUps, surveys } = useOfflineData();

  // Active Tab: 'Overview' | 'Workers' | 'Referrals'
  const [activeTab, setActiveTab] = useState<'Overview' | 'Workers' | 'Referrals'>('Overview');

  // Selected ASHA Worker for drilldown modal
  const [selectedWorker, setSelectedWorker] = useState<any>(null);

  // Teleconsultation & Approval Modal State
  const [teleconsultPatient, setTeleconsultPatient] = useState<any>(null);
  const [approvedReferralIds, setApprovedReferralIds] = useState<Set<string>>(new Set());
  const [doctorNotes, setDoctorNotes] = useState('');
  const [showNotesSuccess, setShowNotesSuccess] = useState(false);

  // Live Metrics Calculation
  const totalFamiliesCount = families.length;
  const pregnantCount = members.filter((m) => m.isPregnant).length;
  const hrpCount = members.filter((m) => m.isPregnant && m.isHrp).length;
  const ncdCount = members.filter((m) => m.hasChronicCondition || m.isNcdPatient).length;
  const urgentTasks = followUps.filter((f) => !f.isCompleted);

  const workersPerformance = [
    {
      id: 'w1',
      name: 'Sunita Devi',
      village: 'Chandpur',
      phone: '+91 98765 43210',
      families: families.length,
      surveys: surveys.length,
      referrals: urgentTasks.length,
    },
    {
      id: 'w2',
      name: 'Meera Kumari',
      village: 'Rampur',
      phone: '+91 98765 43211',
      families: 18,
      surveys: 24,
      referrals: 2,
    },
    {
      id: 'w3',
      name: 'Lalita Bai',
      village: 'Kheda',
      phone: '+91 98765 43212',
      families: 22,
      surveys: 31,
      referrals: 4,
    },
    {
      id: 'w4',
      name: 'Pooja Sharma',
      village: 'Barkheda',
      phone: '+91 98765 43213',
      families: 20,
      surveys: 19,
      referrals: 1,
    },
  ];

  const handleApproveReferral = (id: string) => {
    setApprovedReferralIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleSaveTeleconsultAdvice = () => {
    if (teleconsultPatient) {
      handleApproveReferral(teleconsultPatient.id);
      setShowNotesSuccess(true);
      setTimeout(() => {
        setShowNotesSuccess(false);
        setTeleconsultPatient(null);
        setDoctorNotes('');
      }, 1500);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* CHO Specific Header with Official HWC Branding */}
        <View style={styles.choBanner}>
          <View style={styles.choBannerIcon}>
            <Building2 size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.choTitle}>आयुष्मान आरोग्य मंदिर (HWC)</Text>
            <Text style={styles.choSub}>कम्युनिटी हेल्थ ऑफिसर (CHO) कार्यक्षेत्र पोर्टल</Text>
          </View>
        </View>

        {/* Offline Audio Guidance for CHO */}
        <VoiceGuideBanner
          sectionTitle="सीएचओ सेक्टर अवलोकन (CHO Dashboard)"
          guideTextHi="सीएचओ डैशबोर्ड में आपका स्वागत है। यहाँ आप अपने सेक्टर की आशा कार्यकर्ताओं की प्रगति, उच्च जोखिम रेफरल और टेली-परामर्श का प्रबंधन कर सकते हैं।"
          guideTextMr="सीएचओ डॅशबोर्डवर आपले स्वागत आहे. येथे आपण आशा कार्यकर्त्यांची प्रगती आणि उच्च-जोखीम रेफरल्सचे व्यवस्थापन करू शकता."
          guideTextEn="Welcome to CHO Health Officer portal. Review ASHA worker coverage, approve urgent referrals, and conduct teleconsultations."
        />

        {/* CHO Navigation Tabs */}
        <View style={styles.tabRow}>
          {(['Overview', 'Workers', 'Referrals'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                  {tab === 'Overview'
                    ? '📊 सेक्टर अवलोकन'
                    : tab === 'Workers'
                    ? '👩‍⚕️ आशा कार्यकर्ता'
                    : `⚠️ गंभीर रेफरल (${urgentTasks.length})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'Overview' && (
          <View>
            {/* Live KPI Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Users size={18} color="#2563EB" />
                </View>
                <Text style={styles.kpiValue}>4 आशा</Text>
                <Text style={styles.kpiTitle}>सक्रिय आशा कार्यकर्ता</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: Colors.primaryLight }]}>
                  <FileText size={18} color={Colors.primary} />
                </View>
                <Text style={styles.kpiValue}>{totalFamiliesCount} घर</Text>
                <Text style={styles.kpiTitle}>पंजीकृत परिवार</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF2F2' }]}>
                  <ShieldAlert size={18} color={Colors.urgentRed} />
                </View>
                <Text style={[styles.kpiValue, { color: Colors.urgentRed }]}>{hrpCount} HRP</Text>
                <Text style={styles.kpiTitle}>उच्च जोखिम गर्भवती</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#FDF2F8' }]}>
                  <Activity size={18} color="#BE185D" />
                </View>
                <Text style={[styles.kpiValue, { color: '#BE185D' }]}>{ncdCount} रोगी</Text>
                <Text style={styles.kpiTitle}>NCD कैंसर / BP रोगी</Text>
              </View>
            </View>

            {/* Critical Action Card: Direct Teleconsultation */}
            <View style={styles.actionCard}>
              <View style={styles.actionCardHeader}>
                <Stethoscope size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.actionCardTitle}>तत्काल टेली-परामर्श एवं रेफरल अनुमोदन</Text>
              </View>

              <TouchableOpacity
                style={styles.actionCardBtn}
                onPress={() => setActiveTab('Referrals')}
                activeOpacity={0.85}
              >
                <Text style={styles.actionCardBtnText}>रेफरल समीक्षा करें ({urgentTasks.length})</Text>
              </TouchableOpacity>
            </View>

            {/* Disease Distribution Line Listing Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>गैर-संचारी रोग (NCD) एवं कैंसर स्थिति</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>उच्च रक्तचाप (Hypertension):</Text>
                <Text style={styles.statValue}>12 मरीज (नियमित दवा पर)</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>मधुमेह (Diabetes):</Text>
                <Text style={styles.statValue}>8 मरीज (रक्त शर्करा नियंत्रित)</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>मुख / स्तन कैंसर स्क्रीनिंग:</Text>
                <Text style={styles.statValue}>2 मरीज (बीएचयू रेफरल)</Text>
              </View>
            </View>
          </View>
        )}

        {/* ===================== TAB 2: WORKERS ===================== */}
        {activeTab === 'Workers' && (
          <View>
            <Text style={styles.sectionHeading}>सेक्टर की आशा कार्यकर्ताओं की कार्य प्रगति</Text>
            {workersPerformance.map((worker) => (
              <View key={worker.id} style={styles.workerCard}>
                <View style={styles.workerHeader}>
                  <View style={styles.workerAvatar}>
                    <Text style={styles.workerAvatarText}>
                      {worker.name
                        .split(' ')
                        .map((w: string) => w[0])
                        .join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    <Text style={styles.workerVillage}>
                      गाँव: {worker.village} • {worker.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.workerViewBtn}
                    onPress={() => setSelectedWorker(worker)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.workerViewBtnText}>विवरण देखें</Text>
                  </TouchableOpacity>
                </View>

                {/* Worker Stats */}
                <View style={styles.workerStatsRow}>
                  <View style={styles.workerStatItem}>
                    <Text style={styles.workerStatNum}>{worker.families}</Text>
                    <Text style={styles.workerStatLbl}>परिवार</Text>
                  </View>
                  <View style={styles.workerStatItem}>
                    <Text style={styles.workerStatNum}>{worker.surveys}</Text>
                    <Text style={styles.workerStatLbl}>सर्वेक्षण पूर्ण</Text>
                  </View>
                  <View style={styles.workerStatItem}>
                    <Text
                      style={[
                        styles.workerStatNum,
                        worker.referrals > 0 && { color: Colors.urgentRed },
                      ]}
                    >
                      {worker.referrals}
                    </Text>
                    <Text style={styles.workerStatLbl}>लंबित रेफरल</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===================== TAB 3: REFERRALS ===================== */}
        {activeTab === 'Referrals' && (
          <View>
            <Text style={styles.sectionHeading}>
              उच्च-प्राथमिकता अस्पताल रेफरल एवं टेली-परामर्श सूची
            </Text>
            {urgentTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <CheckCircle size={36} color={Colors.visitedGreen} />
                <Text style={styles.emptyTitle}>कोई लंबित रेफरल नहीं है!</Text>
                <Text style={styles.emptySub}>सभी मरीजों का अनुवर्ती कार्य पूर्ण हो चुका है।</Text>
              </View>
            ) : (
              urgentTasks.map((task) => {
                const isApproved = approvedReferralIds.has(task.id);
                return (
                  <View key={task.id} style={styles.referralCard}>
                    <View style={styles.referralHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.patientName}>{task.name}</Text>
                        <Text style={styles.referralReason}>{task.taskType}</Text>
                        <View style={styles.referralMetaRow}>
                          <Calendar size={11} color={Colors.textSecondary} style={{ marginRight: 3 }} />
                          <Text style={styles.referralDueDate}>{task.dueDate}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.urgencyBadge,
                          isApproved && styles.urgencyBadgeApproved,
                        ]}
                      >
                        <Text
                          style={[
                            styles.urgencyBadgeText,
                            isApproved && styles.urgencyBadgeTextApproved,
                          ]}
                        >
                          {isApproved ? '✓ अनुमोदित' : 'अति-आवश्यक'}
                        </Text>
                      </View>
                    </View>

                    {/* CHO Functional Actions */}
                    <View style={styles.referralActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.approveBtn,
                          isApproved && styles.approveBtnDone,
                        ]}
                        onPress={() => handleApproveReferral(task.id)}
                        disabled={isApproved}
                        activeOpacity={0.8}
                      >
                        <Check size={14} color={isApproved ? Colors.visitedGreen : '#FFFFFF'} style={{ marginRight: 4 }} />
                        <Text
                          style={[
                            styles.approveBtnText,
                            isApproved && styles.approveBtnTextDone,
                          ]}
                        >
                          {isApproved ? 'अनुमोदित' : 'रेफरल स्वीकृत करें'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.teleconsultBtn}
                        onPress={() => setTeleconsultPatient(task)}
                        activeOpacity={0.8}
                      >
                        <PhoneCall size={14} color="#0369A1" style={{ marginRight: 4 }} />
                        <Text style={styles.teleconsultBtnText}>टेली-परामर्श</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Worker Detail Modal (Drilldown) */}
      {selectedWorker && (
        <Modal visible={!!selectedWorker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedWorker.name}</Text>
                  <Text style={styles.modalSub}>
                    आशा कार्यकर्ता • {selectedWorker.village}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedWorker(null)}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <Text style={styles.modalSectionTitle}>आवंटित परिवार एवं कवरेज</Text>
                <View style={styles.workerDetailBox}>
                  <Text style={styles.workerDetailItem}>
                    • कुल पंजीकृत घर: {selectedWorker.families}
                  </Text>
                  <Text style={styles.workerDetailItem}>
                    • पूर्ण किए गए स्वास्थ्य सर्वे: {selectedWorker.surveys}
                  </Text>
                  <Text style={styles.workerDetailItem}>
                    • सक्रिय रेफरल मामले: {selectedWorker.referrals}
                  </Text>
                  <Text style={styles.workerDetailItem}>
                    • संपर्क नंबर: {selectedWorker.phone}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setSelectedWorker(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closeModalBtnText}>बंद करें</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Teleconsultation & Clinical Advice Modal */}
      {teleconsultPatient && (
        <Modal visible={!!teleconsultPatient} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>टेली-परामर्श एवं चिकित्सा निर्देश</Text>
                  <Text style={styles.modalSub}>रोगी: {teleconsultPatient.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setTeleconsultPatient(null)}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>सीएचओ चिकित्सा परामर्श एवं निर्देश:</Text>
              <TextInput
                style={styles.modalInputArea}
                placeholder="रोगी को तत्काल प्राथमिक स्वास्थ्य केंद्र (PHC) भिजवाएं। IFA गोलियां एवं BP की निगरानी जारी रखें..."
                placeholderTextColor={Colors.textMuted}
                value={doctorNotes}
                onChangeText={setDoctorNotes}
                multiline
              />

              {showNotesSuccess && (
                <View style={styles.successPill}>
                  <Check size={14} color="#15803D" style={{ marginRight: 4 }} />
                  <Text style={styles.successPillText}>निर्देश दर्ज कर आशा को प्रेषित किए गए!</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.saveAdviceBtn}
                onPress={handleSaveTeleconsultAdvice}
                activeOpacity={0.85}
              >
                <Text style={styles.saveAdviceBtnText}>निर्देश सहेजें एवं रेफरल स्वीकृत करें</Text>
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
  choBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  choBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  choTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  choSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  kpiTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  actionCardSub: {
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 16,
    marginBottom: 10,
  },
  actionCardBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionCardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  workerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  workerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  workerVillage: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  workerViewBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  workerViewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  workerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  workerStatItem: {
    alignItems: 'center',
  },
  workerStatNum: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  workerStatLbl: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 10,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  referralReason: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    marginTop: 2,
  },
  referralMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  referralDueDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  urgencyBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyBadgeApproved: {
    backgroundColor: '#DCFCE7',
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  urgencyBadgeTextApproved: {
    color: '#15803D',
  },
  referralActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnDone: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  approveBtnTextDone: {
    color: '#15803D',
  },
  teleconsultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  teleconsultBtnText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  workerDetailBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  workerDetailItem: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  closeModalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  modalInputArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  successPillText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '700',
  },
  saveAdviceBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveAdviceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
