import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { User, RefreshCw, CloudOff, CheckCircle, Wifi, Globe } from 'lucide-react-native';

interface HeaderProps {
  onRolePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRolePress }) => {
  const { user, setRole } = useAuth();
  const { pendingSyncCount, isSyncing, isOnline, triggerSync } = useOfflineData();
  const { language, setLanguage, t } = useLanguage();

  const cycleRole = () => {
    if (user.role === 'ASHA') setRole('ANM');
    else if (user.role === 'ANM') setRole('CHO');
    else setRole('ASHA');
  };

  const cycleLanguage = () => {
    if (language === 'hi') setLanguage('mr');
    else if (language === 'mr') setLanguage('en');
    else setLanguage('hi');
  };

  const currentLangLabel = language === 'hi' ? 'हिं' : language === 'mr' ? 'मरा' : 'EN';

  return (
    <View style={styles.container}>
      <View style={styles.brandingRow}>
        <Image
          source={require('../../assets/aarogya_flow_logo_hd.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titleCol}>
          <Text style={styles.appTitle}>{t('appTitle')}</Text>
          <Text style={styles.appSubtitle}>{t('appSubtitle')}</Text>
        </View>
      </View>

      <View style={styles.rightActions}>
        {/* Quick Language Toggle Pill */}
        <TouchableOpacity
          style={styles.langBadge}
          onPress={cycleLanguage}
          activeOpacity={0.8}
        >
          <Globe size={13} color={Colors.primary} />
          <Text style={styles.langText}>{currentLangLabel}</Text>
        </TouchableOpacity>

        {/* Internet Connection / Local Storage Status Indicator */}
        <TouchableOpacity
          style={styles.storageBadge}
          onPress={() => triggerSync()}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <>
              <RefreshCw size={12} color={Colors.primary} />
              <Text style={[styles.storageText, { color: Colors.primary }]}>{t('syncing')}</Text>
            </>
          ) : isOnline ? (
            <>
              <Wifi size={12} color={Colors.visitedGreen} />
              <Text style={[styles.storageText, { color: Colors.visitedGreen }]}>{t('online')}</Text>
            </>
          ) : pendingSyncCount > 0 ? (
            <>
              <CloudOff size={12} color="#D97706" />
              <Text style={styles.storageText}>{pendingSyncCount} local</Text>
            </>
          ) : (
            <>
              <CheckCircle size={12} color={Colors.visitedGreen} />
              <Text style={[styles.storageText, { color: Colors.visitedGreen }]}>{t('saved')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Role Switcher */}
        <TouchableOpacity
          style={styles.roleBadge}
          onPress={onRolePress || cycleRole}
          activeOpacity={0.8}
        >
          <User size={14} color={Colors.primary} />
          <Text style={styles.roleText}>{user.role}</Text>
          <RefreshCw size={10} color={Colors.textMuted} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  titleCol: {
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  appSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  storageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 3,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 4,
  },
  langText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
});
