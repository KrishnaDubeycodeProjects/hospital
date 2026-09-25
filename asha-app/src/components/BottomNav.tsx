import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import {
  ClipboardList,
  Users,
  Clock,
  CalendarCheck,
  User,
  BarChart3,
  UserCheck,
  Stethoscope,
  Folder,
} from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export type TabKey = 'Home' | 'Families' | 'FollowUps' | 'Meetings' | 'Profile';

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  followUpCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  followUpCount = 0,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  // CHO bottom nav — only CHO-relevant tabs
  if (user.role === 'CHO') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onTabChange('Home')}
          activeOpacity={0.7}
        >
          <BarChart3
            size={20}
            color={activeTab === 'Home' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'Home' && styles.activeTabText]}>
            डैशबोर्ड
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onTabChange('Profile')}
          activeOpacity={0.7}
        >
          <User
            size={20}
            color={activeTab === 'Profile' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'Profile' && styles.activeTabText]}>
            प्रोफाइल
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ANM bottom nav — only ANM-relevant tabs
  if (user.role === 'ANM') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onTabChange('Home')}
          activeOpacity={0.7}
        >
          <Folder
            size={20}
            color={activeTab === 'Home' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'Home' && styles.activeTabText]}>
            सत्र
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => onTabChange('Profile')}
          activeOpacity={0.7}
        >
          <User
            size={20}
            color={activeTab === 'Profile' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'Profile' && styles.activeTabText]}>
            प्रोफाइल
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ASHA worker tabs (default)
  return (
    <View style={styles.container}>
      {/* Suchi (Home) Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Home')}
        activeOpacity={0.7}
      >
        <ClipboardList
          size={20}
          color={activeTab === 'Home' ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.tabText, activeTab === 'Home' && styles.activeTabText]}>
          {t('suchi')}
        </Text>
      </TouchableOpacity>

      {/* Families Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Families')}
        activeOpacity={0.7}
      >
        <Users
          size={20}
          color={activeTab === 'Families' ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.tabText, activeTab === 'Families' && styles.activeTabText]}>
          {t('families')}
        </Text>
      </TouchableOpacity>

      {/* Follow-ups Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('FollowUps')}
        activeOpacity={0.7}
      >
        <View>
          <Clock
            size={20}
            color={activeTab === 'FollowUps' ? Colors.primary : Colors.textMuted}
          />
          {followUpCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{followUpCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.tabText, activeTab === 'FollowUps' && styles.activeTabText]}>
          {t('followups')}
        </Text>
      </TouchableOpacity>

      {/* Meetings Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Meetings')}
        activeOpacity={0.7}
      >
        <CalendarCheck
          size={20}
          color={activeTab === 'Meetings' ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.tabText, activeTab === 'Meetings' && styles.activeTabText]}>
          {t('meetings')}
        </Text>
      </TouchableOpacity>

      {/* Profile Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('Profile')}
        activeOpacity={0.7}
      >
        <User
          size={20}
          color={activeTab === 'Profile' ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.tabText, activeTab === 'Profile' && styles.activeTabText]}>
          {t('profile')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 7,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabText: {
    fontSize: 10,
    marginTop: 3,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.urgentRed,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
