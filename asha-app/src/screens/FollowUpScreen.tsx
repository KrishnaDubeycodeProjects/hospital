import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Linking,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Check, AlertCircle, Phone, Stethoscope, Clock, ShieldCheck, Pill } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';

export const FollowUpScreen: React.FC = () => {
  const { followUps, toggleFollowUp } = useOfflineData();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'Pending' | 'Completed'>('Pending');

  const pendingCount = followUps.filter((t) => !t.isCompleted).length;
  const completedCount = followUps.filter((t) => t.isCompleted).length;

  const filteredTasks = followUps.filter((t) =>
    activeTab === 'Pending' ? !t.isCompleted : t.isCompleted
  );

  const formatUrgency = (text: string, isReferral: boolean) => {
    const lower = (text || '').toLowerCase();
    if (lower.includes('7') || lower.includes('urgent') || lower.includes('अति') || isReferral) {
      return 'गंभीर (Severe)';
    }
    if (lower.includes('15') || lower.includes('due') || lower.includes('समीक्षा')) {
      return 'मध्यम (Medium)';
    }
    if (lower.includes('30') || lower.includes('routine') || lower.includes('नियमित')) {
      return 'सामान्य (Normal)';
    }
    return text || 'सामान्य';
  };

  return (
    <View style={styles.container}>
      {/* Top Segmented Tabs */}
      <View style={styles.tabSection}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'Pending' && styles.activeTabBtn]}
          onPress={() => setActiveTab('Pending')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'Pending' && styles.activeTabBtnText,
            ]}
          >
            {t('pending')} ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'Completed' && styles.activeTabBtn,
          ]}
          onPress={() => setActiveTab('Completed')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'Completed' && styles.activeTabBtnText,
            ]}
          >
            {t('completed')} ({completedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List - Clean, Spacious Referral Cards */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === 'Pending'
                ? t('noPendingTasks')
                : t('noCompletedTasks')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isReferralMissed =
            item.taskType.toLowerCase().includes('hospital referral missed') ||
            item.taskType.toLowerCase().includes('referral missed') ||
            item.taskType.toLowerCase().includes('referral');

          const urgencyLabel = formatUrgency(item.urgencyDays, isReferralMissed);
          const isSevere = urgencyLabel.includes('Severe') || urgencyLabel.includes('गंभीर');
          const isMedium = urgencyLabel.includes('Medium') || urgencyLabel.includes('मध्यम');

          return (
            <View
              style={[
                styles.taskCard,
                isReferralMissed && styles.referralTaskCard,
              ]}
            >
              <View style={styles.cardMainRow}>
                {/* Beneficiary Avatar */}
                <View
                  style={[
                    styles.avatarCircle,
                    item.isCompleted && styles.completedAvatar,
                    isReferralMissed && !item.isCompleted && styles.referralAvatar,
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarInitials,
                      item.isCompleted && styles.completedInitials,
                      isReferralMissed && !item.isCompleted && styles.referralInitials,
                    ]}
                  >
                    {item.initials}
                  </Text>
                </View>

                {/* Middle Information */}
                <View style={styles.taskInfo}>
                  {isReferralMissed && (
                    <View style={styles.referralTagRow}>
                      <AlertCircle size={12} color={Colors.urgentRed} style={{ marginRight: 4 }} />
                      <Text style={styles.referralTagText}>अस्पताल रेफरल अनुवर्ती (REFERRAL FOLLOW-UP)</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.taskName}>{item.name}</Text>
                    {item.houseNumber && (
                      <Text style={styles.houseTag}>घर नं. {item.houseNumber}</Text>
                    )}
                  </View>

                  {/* Attached Real Contact Number & ABHA Number */}
                  <View style={styles.numberRow}>
                    {item.phone && (
                      <TouchableOpacity
                        style={styles.phoneChip}
                        onPress={() => Linking.openURL(`tel:${item.phone}`)}
                        activeOpacity={0.7}
                      >
                        <Phone size={11} color="#0284C7" style={{ marginRight: 4 }} />
                        <Text style={styles.phoneChipText}>{item.phone}</Text>
                      </TouchableOpacity>
                    )}
                    {item.abhaNumber && (
                      <View style={styles.abhaChip}>
                        <ShieldCheck size={11} color="#059669" style={{ marginRight: 3 }} />
                        <Text style={styles.abhaChipText}>ABHA: {item.abhaNumber}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.taskType}>{item.taskType}</Text>

                  {/* Doctor & Hospital Details */}
                  {item.doctorName && (
                    <View style={styles.doctorRow}>
                      <Stethoscope size={11} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.doctorText}>
                        {item.doctorName} {item.hospitalName ? `(${item.hospitalName})` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Prescriptions & Prescription Deadline */}
                  {item.prescriptionDetails && (
                    <View style={styles.prescriptionBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Pill size={11} color="#B45309" style={{ marginRight: 4 }} />
                        <Text style={styles.prescriptionLabel}>दवा निर्देश (Prescription):</Text>
                      </View>
                      <Text style={styles.prescriptionText}>{item.prescriptionDetails}</Text>
                      {item.prescriptionDeadline && (
                        <View style={styles.deadlineContainer}>
                          <Clock size={11} color="#DC2626" style={{ marginRight: 4 }} />
                          <Text style={styles.deadlineText}>
                            समयसीमा: {item.prescriptionDeadline}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Vitals & Observations */}
                  {item.vitals && (
                    <Text style={styles.vitalsText}>जाँच: {item.vitals}</Text>
                  )}

                  {/* CHO Status */}
                  {item.referredToCho && (
                    <View style={styles.choStatusRow}>
                      <Text style={styles.choStatusLabel}>
                        सीएचओ स्थिति:{' '}
                        <Text style={{ fontWeight: '700', color: item.choStatus === 'APPROVED_CHO' ? '#15803D' : '#D97706' }}>
                          {item.choStatus === 'APPROVED_CHO' ? '✓ स्वीकृत (Approved by CHO)' : '⏳ लंबित (Pending Review)'}
                        </Text>
                      </Text>
                    </View>
                  )}

                  <Text style={styles.taskDueDate}>देय तिथि: {item.dueDate}</Text>
                </View>

                {/* Right Action & Urgency Chip */}
                <View style={styles.actionCol}>
                  <View
                    style={[
                      styles.urgencyChip,
                      isSevere
                        ? styles.urgentRedChip
                        : isMedium
                        ? styles.urgentPinkChip
                        : styles.urgentYellowChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.urgencyText,
                        isSevere
                          ? styles.urgentRedText
                          : isMedium
                          ? styles.urgentPinkText
                          : styles.urgentYellowText,
                      ]}
                    >
                      {urgencyLabel}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.checkCircleBtn,
                      item.isCompleted && styles.checkCircleCompleted,
                    ]}
                    onPress={() => toggleFollowUp(item.id)}
                    activeOpacity={0.7}
                  >
                    {item.isCompleted && <Check size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabSection: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  activeTabBtn: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeTabBtnText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  houseTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  numberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  phoneChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  abhaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  abhaChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  doctorText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  prescriptionBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  prescriptionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  prescriptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#78350F',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#FEF2F2',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deadlineText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  vitalsText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 3,
  },
  choStatusRow: {
    marginTop: 4,
    paddingVertical: 2,
  },
  choStatusLabel: {
    fontSize: 11,
    color: '#334155',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  completedAvatar: {
    backgroundColor: Colors.visitedGreenBg,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  completedInitials: {
    color: Colors.visitedGreen,
  },
  taskInfo: {
    flex: 1,
    paddingRight: 6,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  taskType: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  taskDueDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    fontWeight: '500',
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 52,
  },
  urgencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentRedChip: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  urgentPinkChip: {
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#F9A8D4',
  },
  urgentYellowChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  urgencyText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  urgentRedText: {
    color: '#DC2626',
  },
  urgentPinkText: {
    color: '#BE185D',
  },
  urgentYellowText: {
    color: '#B45309',
  },
  checkCircleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleCompleted: {
    backgroundColor: Colors.visitedGreen,
    borderColor: Colors.visitedGreen,
  },
  // Referral Task Card Accents
  referralTaskCard: {
    borderColor: '#FCA5A5',
    borderLeftWidth: 5,
    borderLeftColor: Colors.urgentRed,
    backgroundColor: '#FFFAFA',
  },
  referralAvatar: {
    backgroundColor: '#FEE2E2',
  },
  referralInitials: {
    color: Colors.urgentRed,
  },
  referralTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  referralTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.urgentRed,
    letterSpacing: 0.2,
  },
});
