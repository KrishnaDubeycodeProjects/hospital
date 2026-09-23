import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Languages,
  Volume2,
  Moon,
  RefreshCw,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';

export const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const { language, setLanguage, ttsEnabled, setTtsEnabled } = useLanguage();

  const toggleLanguage = () => {
    if (language === 'hi') setLanguage('en');
    else if (language === 'en') setLanguage('mr');
    else setLanguage('hi');
  };

  const getLanguageLabel = () => {
    if (language === 'hi') return 'हिंदी (Hindi)';
    if (language === 'mr') return 'मराठी (Marathi)';
    return 'English';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card matching Screen 9 */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name.split(' ').map((n) => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>{user.roleTitle}</Text>
          <Text style={styles.userVillage}>{user.village}</Text>
        </View>
      </View>

      {/* Settings Options List */}
      <View style={styles.sectionCard}>
        {/* Language Selection */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={toggleLanguage}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Languages size={20} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>Language</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.settingValue}>{getLanguageLabel()}</Text>
            <ChevronRight size={18} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Text to Speech Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.rowLeft}>
            <Volume2 size={20} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>Text to Speech</Text>
          </View>
          <Switch
            value={ttsEnabled}
            onValueChange={setTtsEnabled}
            trackColor={{ false: '#D1D5DB', true: Colors.primaryLight }}
            thumbColor={ttsEnabled ? Colors.primary : '#9CA3AF'}
          />
        </View>

        {/* App Theme */}
        <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Moon size={20} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>App Theme</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.settingValue}>Light</Text>
            <ChevronRight size={18} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Sync Settings */}
        <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <RefreshCw size={20} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>Sync Settings</Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Help & Support */}
        <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <HelpCircle size={20} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>Help & Support</Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* About */}
        <TouchableOpacity
          style={[styles.settingRow, { borderBottomWidth: 0 }]}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Info size={20} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>About</Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Prominent Red Logout Button matching Screen 9 */}
      <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85}>
        <LogOut size={18} color={Colors.urgentRed} style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userRole: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  userVillage: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginLeft: 12,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  logoutBtn: {
    backgroundColor: Colors.urgentRedBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: Colors.urgentRed,
    fontSize: 15,
    fontWeight: '700',
  },
});
