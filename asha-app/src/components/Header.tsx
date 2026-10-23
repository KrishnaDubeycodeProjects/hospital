import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { User, RefreshCw, CloudOff, CheckCircle, Wifi, Globe, Check, X, Shield, ChevronRight } from 'lucide-react-native';

interface HeaderProps {
  onRolePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRolePress }) => {
  const { user, setRole } = useAuth();
  const { pendingSyncCount, isSyncing, isOnline, triggerSync } = useOfflineData();
  const { language, setLanguage, t } = useLanguage();

  const [showRoleModal, setShowRoleModal] = React.useState(false);

  const selectRole = (newRole: 'ASHA' | 'ANM' | 'CHO') => {
    setRole(newRole);
    triggerSync().catch(() => {});
    setShowRoleModal(false);
  };

  const cycleRole = () => {
    setShowRoleModal(true);
  };

  const cycleLanguage = () => {
    if (language === 'hi') setLanguage('mr');
    else if (language === 'mr') setLanguage('en');
    else setLanguage('hi');
  };

  const currentLangLabel = language === 'hi' ? 'हिं' : language === 'mr' ? 'मरा' : 'EN';

  const logoSource = Platform.OS === 'web'
    ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
    : require('../../assets/aarogya_flow_icon_transparent_hd.png');

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
          onPress={onRolePress || (() => setShowRoleModal(true))}
          activeOpacity={0.8}
        >
          <User size={14} color={Colors.primary} />
          <Text style={styles.roleText}>{user.role}</Text>
          <RefreshCw size={10} color={Colors.textMuted} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
      {/* Role Selection Modal */}
      <Modal visible={showRoleModal} transparent animationType="fade">
        <View style={styles.roleModalOverlay}>
          <View style={styles.roleModalBox}>
            <View style={styles.roleModalHeader}>
              <View>
                <Text style={styles.roleModalTitle}>{t('roleLabel') || 'रोल चुनें (Select Role)'}</Text>
                <Text style={styles.roleModalSub}>सक्रिय स्वास्थ्य कार्यकर्ता प्रोफ़ाइल चुनें</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRoleModal(false)} style={styles.modalCloseBtn}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.rolesList}>
              {/* Option 1: ASHA */}
              <TouchableOpacity
                style={[styles.roleOptionCard, user.role === 'ASHA' && styles.roleOptionCardActive]}
                onPress={() => selectRole('ASHA')}
                activeOpacity={0.8}
              >
                <View style={[styles.roleAvatar, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={{ fontSize: 18 }}>🌸</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.roleCardTitle}>आशा कार्यकर्ता (ASHA Worker)</Text>
                    {user.role === 'ASHA' && <View style={styles.activePill}><Text style={styles.activePillText}>सक्रिय</Text></View>}
                  </View>
                  <Text style={styles.roleCardName}>सुनीता देवी • चंदपुर गाँव</Text>
                  <Text style={styles.roleCardDesc}>24-मकान सूची, गृह भेंट, मातृ-बाल स्वास्थ्य रजिस्टर</Text>
                </View>
                {user.role === 'ASHA' ? (
                  <Check size={20} color={Colors.visitedGreen} />
                ) : (
                  <ChevronRight size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>

              {/* Option 2: ANM */}
              <TouchableOpacity
                style={[styles.roleOptionCard, user.role === 'ANM' && styles.roleOptionCardActive]}
                onPress={() => selectRole('ANM')}
                activeOpacity={0.8}
              >
                <View style={[styles.roleAvatar, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={{ fontSize: 18 }}>🩺</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.roleCardTitle}>एएनएम (ANM - Auxiliary Midwife)</Text>
                    {user.role === 'ANM' && <View style={styles.activePill}><Text style={styles.activePillText}>सक्रिय</Text></View>}
                  </View>
                  <Text style={styles.roleCardName}>रेखा शर्मा • प्राथमिक स्वास्थ्य केंद्र</Text>
                  <Text style={styles.roleCardDesc}>टीकाकरण सत्र, क्लस्टर QR कोड, फॉर्म अप्रूवल</Text>
                </View>
                {user.role === 'ANM' ? (
                  <Check size={20} color={Colors.visitedGreen} />
                ) : (
                  <ChevronRight size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>

              {/* Option 3: CHO */}
              <TouchableOpacity
                style={[styles.roleOptionCard, user.role === 'CHO' && styles.roleOptionCardActive]}
                onPress={() => selectRole('CHO')}
                activeOpacity={0.8}
              >
                <View style={[styles.roleAvatar, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={{ fontSize: 18 }}>🏥</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.roleCardTitle}>सीएचओ (Community Health Officer)</Text>
                    {user.role === 'CHO' && <View style={styles.activePill}><Text style={styles.activePillText}>सक्रिय</Text></View>}
                  </View>
                  <Text style={styles.roleCardName}>डॉ. कविश आहूजा • ब्लॉक अस्पताल</Text>
                  <Text style={styles.roleCardDesc}>टेलीकंसल्टेशन, उच्च जोखिम रेफरल, ब्लॉक डैशबोर्ड</Text>
                </View>
                {user.role === 'CHO' ? (
                  <Check size={20} color={Colors.visitedGreen} />
                ) : (
                  <ChevronRight size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderRadius: 12,
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
  roleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  roleModalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  roleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  roleModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  roleModalSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  rolesList: {
    gap: 10,
  },
  roleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#FAFAFA',
  },
  roleOptionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDF4',
  },
  roleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  roleCardName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  roleCardDesc: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    marginLeft: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});