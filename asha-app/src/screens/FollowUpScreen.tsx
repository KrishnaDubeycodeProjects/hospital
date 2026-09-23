import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Check, Zap, AlertCircle } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';

export const FollowUpScreen: React.FC = () => {
  const { followUps, toggleFollowUp, simulateMissedReferral, isSyncing, isOnline } = useOfflineData();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'Pending' | 'Completed'>('Pending');
  const [simStatus, setSimStatus] = useState<string | null>(null);

  const pendingCount = followUps.filter((t) => !t.isCompleted).length;
  const completedCount = followUps.filter((t) => t.isCompleted).length;

  const filteredTasks = followUps.filter((t) =>
    activeTab === 'Pending' ? !t.isCompleted : t.isCompleted
  );

  return (
    <View style={styles.container}>
      {/* Top Tabs */}
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

      {/* Task List - Entire task card is clickable anywhere to toggle completion */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.simCard}>
            <View style={styles.simHeader}>
              <View style={styles.simTitleRow}>
                <Zap size={16} color={Colors.urgentRed} style={{ marginRight: 6 }} />
                <Text style={styles.simTitle}>Hospital Missed Referral Sync Test</Text>
              </View>
              <Text style={styles.simSub}>
                Test 7d (Red), 15d (Pink), 30d (Yellow) overdue referrals. Ingests patient into local storage, creates follow-up task, and updates matrix dot color instantly.
              </Text>
            </View>

            <View style={styles.simButtonRow}>
              <TouchableOpacity
                style={[styles.simBtn, styles.simBtnRed]}
                onPress={async () => {
                  setSimStatus('Ingesting 7-Day Missed Referral (House 12)...');
                  await simulateMissedReferral(7, 12, 'High-Risk ANC 3rd Trimester', 'Suman Verma');
                  setSimStatus('House 12 updated to 7-day urgent visit (Red indicator). Task created.');
                  setTimeout(() => setSimStatus(null), 5000);
                }}
                disabled={isSyncing}
                activeOpacity={0.8}
              >
                <View style={[styles.circleBadgeDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.simBtnTextRed}>7d Missed (H#12)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simBtn, styles.simBtnPink]}
                onPress={async () => {
                  setSimStatus('Ingesting 15-Day Missed Referral (House 12)...');
                  await simulateMissedReferral(15, 12, 'Severe Hypertension Review', 'Rajesh Verma');
                  setSimStatus('House 12 updated to 15-day follow-up (Pink indicator). Task created.');
                  setTimeout(() => setSimStatus(null), 5000);
                }}
                disabled={isSyncing}
                activeOpacity={0.8}
              >
                <View style={[styles.circleBadgeDot, { backgroundColor: '#DB2777' }]} />
                <Text style={styles.simBtnTextPink}>15d Missed (H#12)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simBtn, styles.simBtnYellow]}
                onPress={async () => {
                  setSimStatus('Ingesting 30-Day Missed Referral (House 14)...');
                  await simulateMissedReferral(30, 14, 'Pediatric Immunization MMR', 'Aarav Patel');
                  setSimStatus('House 14 updated to 30-day routine visit (Yellow indicator). Task created.');
                  setTimeout(() => setSimStatus(null), 5000);
                }}
                disabled={isSyncing}
                activeOpacity={0.8}
              >
                <View style={[styles.circleBadgeDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.simBtnTextYellow}>30d Missed (H#14)</Text>
              </TouchableOpacity>
            </View>

            {simStatus && (
              <View style={styles.simToast}>
                <Text style={styles.simToastText}>{simStatus}</Text>
              </View>
            )}
          </View>
        }
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
            item.taskType.toLowerCase().includes('referral missed');

          return (
            <TouchableOpacity
              style={[
                styles.taskCard,
                isReferralMissed && styles.referralTaskCard,
              ]}
              onPress={() => toggleFollowUp(item.id)}
              activeOpacity={0.7}
            >
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

              {/* Middle Info */}
              <View style={styles.taskInfo}>
                {isReferralMissed && (
                  <View style={styles.referralTagRow}>
                    <AlertCircle size={11} color={Colors.urgentRed} style={{ marginRight: 3 }} />
                    <Text style={styles.referralTagText}>HOSPITAL REFERRAL MISSED</Text>
                  </View>
                )}
                <Text style={styles.taskName}>{item.name}</Text>
                <Text style={styles.taskType}>{item.taskType}</Text>
                <Text style={styles.taskDueDate}>{item.dueDate}</Text>
              </View>

              {/* Right Action & Urgency Chip */}
              <View style={styles.actionCol}>
                <View
                  style={[
                    styles.urgencyChip,
                    item.urgencyDays.includes('2') || isReferralMissed
                      ? styles.urgentRedChip
                      : styles.urgentYellowChip,
                  ]}
                >
                  <Text
                    style={[
                      styles.urgencyText,
                      item.urgencyDays.includes('2') || isReferralMissed
                        ? styles.urgentRedText
                        : styles.urgentYellowText,
                    ]}
                  >
                    {item.urgencyDays}
                  </Text>
                </View>

                <View
                  style={[
                    styles.checkCircleBtn,
                    item.isCompleted && styles.checkCircleCompleted,
                  ]}
                >
                  {item.isCompleted && <Check size={14} color="#FFFFFF" />}
                </View>
              </View>
            </TouchableOpacity>
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
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: 14,
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  completedAvatar: {
    backgroundColor: Colors.visitedGreenBg,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  completedInitials: {
    color: Colors.visitedGreen,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  taskType: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  taskDueDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 48,
  },
  urgencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentRedChip: {
    backgroundColor: '#FEE2E2',
  },
  urgentYellowChip: {
    backgroundColor: '#FEF3C7',
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  urgentRedText: {
    color: Colors.urgentRed,
  },
  urgentYellowText: {
    color: '#B45309',
  },
  checkCircleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleCompleted: {
    backgroundColor: Colors.visitedGreen,
    borderColor: Colors.visitedGreen,
  },
  // Missed Referral Simulation Styles
  simCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  simHeader: {
    marginBottom: 10,
  },
  simTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  simTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  simSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  simButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  simBtn: {
    flex: 1,
    minWidth: 95,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  circleBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  simBtnRed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  simBtnTextRed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  simBtnPink: {
    backgroundColor: '#FCE7F3',
    borderColor: '#F9A8D4',
  },
  simBtnTextPink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE185D',
  },
  simBtnYellow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  simBtnTextYellow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  simToast: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  simToastText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Missed Referral Task Card Accents
  referralTaskCard: {
    borderColor: '#FCA5A5',
    borderLeftWidth: 5,
    borderLeftColor: Colors.urgentRed,
    backgroundColor: '#FFFBFB',
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
    marginBottom: 3,
  },
  referralTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.urgentRed,
    letterSpacing: 0.4,
  },
});
