import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Phone,
  Pill,
  Clock,
  ShieldCheck,
  Send,
  UserPlus,
  Plus,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';

export const ChoDashboardScreen: React.FC = () => {
  const { addWorkerByCho } = useAuth();
  const { families, members, followUps, surveys, approveReferralByCho } = useOfflineData();

  // Active Tab: 'Overview' | 'Workers' | 'Referrals'
  const [activeTab, setActiveTab] = useState<'Overview' | 'Workers' | 'Referrals'>('Overview');

  // Selected ASHA Worker for drilldown modal
  const [selectedWorker, setSelectedWorker] = useState<any>(null);

  // CHO Authorized Workers State
  const [authorizedWorkers, setAuthorizedWorkers] = useState<any[]>([]);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState<'ASHA' | 'ANM'>('ASHA');
  const [newWorkerVillage, setNewWorkerVillage] = useState('');
  const [addWorkerLoading, setAddWorkerLoading] = useState(false);
  const [addWorkerStatus, setAddWorkerStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAuthorizedWorkers = async () => {
    try {
      const raw = await AsyncStorage.getItem('@cho_authorized_workers_v6');
      if (raw) {
        setAuthorizedWorkers(JSON.parse(raw));
      }
    } catch {}
  };

  useEffect(() => {
    loadAuthorizedWorkers();
  }, []);

  const handleAddWorkerSubmit = async () => {
    if (!newWorkerName.trim()) {
      setAddWorkerStatus({ type: 'error', text: 'कृपया कार्यकर्ता का नाम दर्ज करें।' });
      return;
    }
    const cleanDigits = newWorkerPhone.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 10) {
      setAddWorkerStatus({ type: 'error', text: 'कृपया 10-अंकीय मान्य मोबाइल नंबर दर्ज करें।' });
      return;
    }

    setAddWorkerLoading(true);
    setAddWorkerStatus(null);
    const result = await addWorkerByCho({
      name: newWorkerName.trim(),
      phone: cleanDigits,
      role: newWorkerRole,
      village: newWorkerVillage.trim() || 'सेक्टर क्षेत्र',
    });
    setAddWorkerLoading(false);

    if (result.success) {
      setAddWorkerStatus({ type: 'success', text: result.message });
      await loadAuthorizedWorkers();
      setTimeout(() => {
        setShowAddWorkerModal(false);
        setNewWorkerName('');
        setNewWorkerPhone('');
        setNewWorkerVillage('');
        setAddWorkerStatus(null);
      }, 1600);
    } else {
      setAddWorkerStatus({ type: 'error', text: result.message });
    }
  };

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

  const allWorkers = [
    ...authorizedWorkers.map((w) => ({
      id: w.id || `w-${w.phone}`,
      name: w.name,
      role: w.role || 'ASHA',
      village: w.village || 'सेक्टर क्षेत्र',
      phone: w.phone,
      families: 0,
      surveys: 0,
      referrals: 0,
      isChoAdded: true,
    })),
    ...workersPerformance.map((w) => ({ ...w, role: 'ASHA', isChoAdded: false })),
  ];

  const handleApproveReferral = async (id: string) => {
    setApprovedReferralIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    await approveReferralByCho(id);
  };

  const handleSaveTeleconsultAdvice = async () => {
    if (teleconsultPatient) {
      await approveReferralByCho(teleconsultPatient.id, doctorNotes);
      setApprovedReferralIds((prev) => {
        const next = new Set(prev);
        next.add(teleconsultPatient.id);
        return next;
      });
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
            {/* Top Action Header: Add New ASHA / ANM Worker */}
            <View style={styles.workersHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeading}>स्वास्थ्य कार्यकर्ता (ASHA & ANM)</Text>
                <Text style={styles.sectionSubHeading}>
                  कुल कार्यकर्ता: {allWorkers.length} • उपस्थिति व कार्य कवरेज
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addWorkerTopBtn}
                onPress={() => {
                  setAddWorkerStatus(null);
                  setShowAddWorkerModal(true);
                }}
                activeOpacity={0.8}
              >
                <UserPlus size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.addWorkerTopBtnText}>+ कार्यकर्ता जोड़ें</Text>
              </TouchableOpacity>
            </View>

            {allWorkers.map((worker) => (
              <View key={worker.id} style={styles.workerCard}>
                <View style={styles.workerHeader}>
                  <View style={[styles.workerAvatar, worker.role === 'ANM' && { backgroundColor: '#EDE9FE' }]}>
                    <Text style={[styles.workerAvatarText, worker.role === 'ANM' && { color: '#7C3AED' }]}>
                      {worker.name
                        .split(' ')
                        .map((w: string) => w[0])
                        .join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={styles.workerName}>{worker.name}</Text>
                      <View style={[styles.roleBadgePill, worker.role === 'ANM' ? styles.roleBadgeAnm : styles.roleBadgeAsha]}>
                        <Text style={[styles.roleBadgePillText, worker.role === 'ANM' ? styles.roleBadgeAnmText : styles.roleBadgeAshaText]}>
                          {worker.role === 'ANM' ? '🩺 ANM' : '🌸 ASHA'}
                        </Text>
                      </View>
                      {worker.isChoAdded && (
                        <View style={styles.choAddedBadge}>
                          <Text style={styles.choAddedBadgeText}>सीएचओ अधिकृत</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.workerVillage}>
                      गाँव / उपकेंद्र: {worker.village} • {worker.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.workerViewBtn}
                    onPress={() => setSelectedWorker(worker)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.workerViewBtnText}>विवरण</Text>
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
                const isApproved = approvedReferralIds.has(task.id) || task.choStatus === 'APPROVED_CHO';
                return (
                  <View key={task.id} style={styles.referralCard}>
                    <View style={styles.referralHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={styles.patientName}>
                            {task.name} {task.age ? `(${task.age} वर्ष${task.gender ? ` • ${task.gender}` : ''})` : ''}
                          </Text>
                          {task.houseNumber && (
                            <Text style={styles.referralHousePill}>
                              घर #{task.houseNumber} • {task.villageName || 'गाँव'}
                            </Text>
                          )}
                        </View>

                        {/* Attached Contact Number & ABHA ID Number */}
                        <View style={styles.patientNumbersRow}>
                          {task.phone && (
                            <TouchableOpacity
                              style={styles.phoneBadgeBtn}
                              onPress={() => Linking.openURL(`tel:${task.phone}`)}
                              activeOpacity={0.7}
                            >
                              <Phone size={11} color="#0284C7" style={{ marginRight: 4 }} />
                              <Text style={styles.phoneBadgeText}>{task.phone}</Text>
                              <Text style={styles.callNowHint}>कॉल</Text>
                            </TouchableOpacity>
                          )}
                          {task.abhaNumber && (
                            <View style={styles.abhaBadgePill}>
                              <ShieldCheck size={11} color="#059669" style={{ marginRight: 3 }} />
                              <Text style={styles.abhaBadgeText}>ABHA: {task.abhaNumber}</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.referralReason}>{task.taskType}</Text>

                        {/* Clinical Condition & Vitals */}
                        {(task.condition || task.vitals) && (
                          <View style={styles.vitalsBox}>
                            {task.condition && (
                              <Text style={styles.vitalsConditionText}>निदान: {task.condition}</Text>
                            )}
                            {task.vitals && (
                              <Text style={styles.vitalsReadingText}>जाँच: {task.vitals}</Text>
                            )}
                          </View>
                        )}

                        {/* Doctor Prescriptions & Prescription Deadline */}
                        {task.prescriptionDetails && (
                          <View style={styles.rxDeadlineBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Pill size={11} color="#B45309" style={{ marginRight: 4 }} />
                              <Text style={styles.rxLabel}>दवा सलाह:</Text>
                            </View>
                            <Text style={styles.rxDetails}>{task.prescriptionDetails}</Text>
                            {task.prescriptionDeadline && (
                              <View style={styles.deadlineRow}>
                                <Clock size={11} color="#DC2626" style={{ marginRight: 4 }} />
                                <Text style={styles.deadlineHighlight}>
                                  समयसीमा: {task.prescriptionDeadline}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Referring Source & ASHA Details */}
                        <View style={styles.referralMetaRow}>
                          <Text style={styles.referralAshaSource}>
                            रेफरल स्रोत: {task.doctorName ? `डॉक्टर ${task.doctorName}` : `आशा कार्यकर्ता (${task.ashaWorkerPhone})`}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                            <Calendar size={11} color={Colors.textSecondary} style={{ marginRight: 3 }} />
                            <Text style={styles.referralDueDate}>{task.dueDate}</Text>
                          </View>
                        </View>

                        {/* Existing CHO Advice if recorded */}
                        {task.choAdvice && (
                          <View style={styles.existingAdviceBox}>
                            <Text style={styles.existingAdviceLabel}>सीएचओ परामर्श टिप्पणी:</Text>
                            <Text style={styles.existingAdviceText}>"{task.choAdvice}"</Text>
                          </View>
                        )}
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
                        <Text style={styles.teleconsultBtnText}>टेली-परामर्श व दवा सलाह</Text>
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

      {/* CHO Add New ASHA / ANM Worker Modal */}
      {showAddWorkerModal && (
        <Modal visible={showAddWorkerModal} transparent animationType="fade">
          <View style={styles.addWorkerModalOverlay}>
            <View style={styles.addWorkerModalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>नया स्वास्थ्य कार्यकर्ता जोड़ें</Text>
                  <Text style={styles.modalSub}>ASHA / ANM Authorize & Grant Immediate Portal Access</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddWorkerModal(false)}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {addWorkerStatus && (
                <View
                  style={[
                    styles.addWorkerAlert,
                    addWorkerStatus.type === 'success'
                      ? styles.addWorkerAlertSuccess
                      : styles.addWorkerAlertError,
                  ]}
                >
                  <Text
                    style={[
                      styles.addWorkerAlertText,
                      {
                        color:
                          addWorkerStatus.type === 'success' ? '#15803D' : '#B91C1C',
                      },
                    ]}
                  >
                    {addWorkerStatus.text}
                  </Text>
                </View>
              )}

              {/* Role Select Tabs */}
              <Text style={styles.addWorkerInputLabel}>पद / भूमिका चुनें (Role):</Text>
              <View style={styles.addWorkerRoleSelector}>
                <TouchableOpacity
                  style={[
                    styles.addWorkerRoleTab,
                    newWorkerRole === 'ASHA' && styles.addWorkerRoleTabActive,
                  ]}
                  onPress={() => setNewWorkerRole('ASHA')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.addWorkerRoleTabText,
                      newWorkerRole === 'ASHA' && styles.addWorkerRoleTabTextActive,
                    ]}
                  >
                    🌸 ASHA (आशा)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.addWorkerRoleTab,
                    newWorkerRole === 'ANM' && styles.addWorkerRoleTabActive,
                  ]}
                  onPress={() => setNewWorkerRole('ANM')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.addWorkerRoleTabText,
                      newWorkerRole === 'ANM' && styles.addWorkerRoleTabTextActive,
                    ]}
                  >
                    🩺 ANM (एएनएम)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Worker Name Input */}
              <Text style={styles.addWorkerInputLabel}>कार्यकर्ता का पूरा नाम (Full Name):</Text>
              <TextInput
                style={styles.addWorkerInput}
                placeholder="उदा: सुनीता देवी या रेखा शर्मा"
                placeholderTextColor={Colors.textMuted}
                value={newWorkerName}
                onChangeText={setNewWorkerName}
              />

              {/* Worker Mobile Phone */}
              <Text style={styles.addWorkerInputLabel}>10-अंकीय मोबाइल नंबर (Phone Number):</Text>
              <TextInput
                style={styles.addWorkerInput}
                placeholder="उदा: 9876543210"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={newWorkerPhone}
                onChangeText={(val) => setNewWorkerPhone(val.replace(/[^0-9]/g, ''))}
              />

              {/* Village / Subcenter Input */}
              <Text style={styles.addWorkerInputLabel}>कार्यक्षेत्र गाँव / उपकेंद्र (Village / PHC Area):</Text>
              <TextInput
                style={styles.addWorkerInput}
                placeholder="उदा: चाँदपुर गाँव"
                placeholderTextColor={Colors.textMuted}
                value={newWorkerVillage}
                onChangeText={setNewWorkerVillage}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.addWorkerSubmitBtn, addWorkerLoading && { opacity: 0.7 }]}
                onPress={handleAddWorkerSubmit}
                disabled={addWorkerLoading}
                activeOpacity={0.85}
              >
                {addWorkerLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.addWorkerSubmitBtnText}>
                    कार्यकर्ता अधिकृत करें व जोड़ें (Authorize Worker)
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addWorkerCancelBtn}
                onPress={() => setShowAddWorkerModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.addWorkerCancelBtnText}>रद्द करें (Cancel)</Text>
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
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  referralHousePill: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  patientNumbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  phoneBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  phoneBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  callNowHint: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 5,
  },
  abhaBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  abhaBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },
  vitalsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 6,
    marginVertical: 4,
  },
  vitalsConditionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  vitalsReadingText: {
    fontSize: 10.5,
    color: '#475569',
    marginTop: 1,
  },
  rxDeadlineBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
  },
  rxLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
  },
  rxDetails: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
    marginTop: 1,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  deadlineHighlight: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  referralAshaSource: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  existingAdviceBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
  existingAdviceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  existingAdviceText: {
    fontSize: 10.5,
    color: '#14532D',
    fontStyle: 'italic',
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
  workersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionSubHeading: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addWorkerTopBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addWorkerTopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  roleBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleBadgeAsha: {
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  roleBadgeAshaText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#BE185D',
  },
  roleBadgeAnm: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  roleBadgeAnmText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  choAddedBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  choAddedBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#047857',
  },
  addWorkerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  addWorkerModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  addWorkerAlert: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  addWorkerAlertSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  addWorkerAlertError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  addWorkerAlertText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  addWorkerRoleSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addWorkerRoleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  addWorkerRoleTabActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  addWorkerRoleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  addWorkerRoleTabTextActive: {
    color: Colors.primary,
  },
  addWorkerInputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 6,
  },
  addWorkerInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: Colors.textPrimary,
  },
  addWorkerSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  addWorkerSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  addWorkerCancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addWorkerCancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
  },
});
