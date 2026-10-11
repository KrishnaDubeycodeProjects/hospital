import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Check, AlertCircle } from 'lucide-react-native';
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
            <TouchableOpacity
              style={[
                styles.taskCard,
                isReferralMissed && styles.referralTaskCard,
              ]}
              onPress={() => toggleFollowUp(item.id)}
              activeOpacity={0.75}
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

              {/* Middle Information */}
              <View style={styles.taskInfo}>
                {isReferralMissed && (
                  <View style={styles.referralTagRow}>
                    <AlertCircle size={12} color={Colors.urgentRed} style={{ marginRight: 4 }} />
                    <Text style={styles.referralTagText}>अस्पताल रेफरल अनुवर्ती (REFERRAL FOLLOW-UP)</Text>
                  </View>
                )}
                <Text style={styles.taskName}>{item.name}</Text>
                <Text style={styles.taskType}>{item.taskType}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
