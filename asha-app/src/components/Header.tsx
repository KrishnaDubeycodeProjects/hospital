import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { RefreshCw, CloudOff, CheckCircle, Wifi, Globe, Shield } from 'lucide-react-native';

interface HeaderProps {
  onRolePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRolePress }) => {
  const { user } = useAuth();
  const { pendingSyncCount, isSyncing, isOnline, triggerSync } = useOfflineData();
  const { language, setLanguage, t } = useLanguage();

  const cycleLanguage = () => setLanguage(language === 'hi' ? 'mr' : 'hi');

  const currentLangLabel = language === 'hi' ? 'हिं' : 'मरा';

  const logoSource = Platform.OS === 'web'
    ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
    : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  const roleEmoji = user.role === 'CHO' ? '🏥' : user.role === 'ANM' ? '🩺' : '🌸';

  return (
    <View style={styles.container}>
      <View style={styles.brandingRow}>
        <View style={styles.logoContainer}>
          <Image
            source={logoSource}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.appTitle} numberOfLines={1}>{t('appTitle')}</Text>
          <Text style={styles.appSubtitle} numberOfLines={1} ellipsizeMode="tail">{t('appSubtitle')}</Text>
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
              <Text style={styles.storageText}>{pendingSyncCount} {language === 'mr' ? 'बाकी' : 'शेष'}</Text>
            </>
          ) : (
            <>
              <CheckCircle size={12} color={Colors.visitedGreen} />
              <Text style={[styles.storageText, { color: Colors.visitedGreen }]}>{t('saved')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Locked Official Cadre Badge (Verified by NHM - Non-Switchable) */}
        <TouchableOpacity
          style={styles.roleBadge}
          onPress={onRolePress}
          activeOpacity={0.85}
        >
          <Text style={styles.roleEmojiText}>{roleEmoji}</Text>
          <Text style={styles.roleText}>{user.role}</Text>
          <Shield size={11} color={Colors.primary} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 52,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  logoContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
    flexShrink: 0,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  storageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 3,
  },
  storageText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    borderRadius: 12,
  },
  roleEmojiText: {
    fontSize: 12,
    marginRight: 2,
  },
  roleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 2,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 3,
  },
  langText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
  },
});