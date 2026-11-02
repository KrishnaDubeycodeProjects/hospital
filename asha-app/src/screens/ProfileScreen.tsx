import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LanguageCode } from '../context/LanguageContext';
import { User, Phone, MapPin, BadgeCheck, Languages, Check, Save, LogOut, Shield, Lock } from 'lucide-react-native';

export const ProfileScreen: React.FC<{ onOpenMeetings?: () => void }> = () => {
  const { user, updateProfile, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  // Profile Pic Zooming Animation Values
  const zoomScale = useRef(new Animated.Value(0.3)).current;
  const zoomOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Initial spring zoom-in on screen open
    Animated.parallel([
      Animated.spring(zoomScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(zoomOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Continuous subtle breathing zoom loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.06,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1.0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  // Interactive tap zoom effect
  const handleAvatarZoomPress = () => {
    Animated.sequence([
      Animated.timing(zoomScale, {
        toValue: 0.9,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(zoomScale, {
        toValue: 1.12,
        friction: 3,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(zoomScale, {
        toValue: 1.0,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const [name, setName] = useState(user.name);
  const [village, setVillage] = useState(user.village);
  const [phone, setPhone] = useState(user.phone);
  const [ashaId, setAshaId] = useState(user.ashaId || 'ASHA-UP-VNS-042');
  const [assignedAnm, setAssignedAnm] = useState(user.assignedAnm || 'Rekha Sharma (+91 98765 11111)');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    updateProfile({
      name: name.trim(),
      village: village.trim(),
      phone: phone.trim(),
      ashaId: ashaId.trim(),
      assignedAnm: assignedAnm.trim(),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const languagesList: { code: LanguageCode; label: string; native: string }[] = [
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
  ];

  const roleEmoji = user.role === 'CHO' ? '🏥' : user.role === 'ANM' ? '🩺' : '🌸';

  const logoSource = Platform.OS === 'web'
    ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
    : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Profile Avatar Header */}
      <View style={styles.headerCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleAvatarZoomPress}
          style={styles.avatarTouchWrapper}
        >
          <Animated.View
            style={[
              styles.avatarSquircle,
              {
                opacity: zoomOpacity,
                transform: [
                  { scale: Animated.multiply(zoomScale, pulseScale) },
                ],
              },
            ]}
          >
            <Image
              source={logoSource}
              style={styles.profileLogoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={styles.headerName}>{name || user.name}</Text>
        <Text style={styles.headerRole}>{user.roleTitle}</Text>
        <Text style={styles.headerVillage}>{village || user.village}</Text>

        {/* Locked Official Role Verification Badge */}
        <View style={styles.roleLockedPill}>
          <Text style={{ fontSize: 13, marginRight: 4 }}>{roleEmoji}</Text>
          <Text style={styles.roleLockedPillText}>आधिकारिक पद: {user.role}</Text>
          <View style={styles.verifiedTag}>
            <Lock size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
            <Text style={styles.verifiedTagText}>सत्यापित (Locked)</Text>
          </View>
        </View>
      </View>

      {/* Language Selector Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Languages size={18} color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{t('appLanguage')}</Text>
        </View>
        <View style={styles.languageOptionsRow}>
          {languagesList.map((item) => {
            const isSelected = language === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.languageButton,
                  isSelected && styles.languageButtonSelected,
                ]}
                onPress={() => setLanguage(item.code)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.languageNative,
                    isSelected && styles.languageNativeSelected,
                  ]}
                >
                  {item.native}
                </Text>
                <Text
                  style={[
                    styles.languageLabel,
                    isSelected && styles.languageLabelSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {isSelected && (
                  <View style={styles.langCheck}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Editable Worker Information Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <BadgeCheck size={18} color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{t('workerDetails')}</Text>
        </View>

        {/* Worker Name */}
        <Text style={styles.inputLabel}>{t('workerName')}</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Sunita Devi"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Worker Phone */}
        <Text style={styles.inputLabel}>{t('workerPhone')}</Text>
        <TextInput
          style={styles.textInput}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="e.g. +91 98765 43210"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Village / Sub-Center */}
        <Text style={styles.inputLabel}>{t('villageSubCenter')}</Text>
        <TextInput
          style={styles.textInput}
          value={village}
          onChangeText={setVillage}
          placeholder="e.g. Chandpur Village"
          placeholderTextColor={Colors.textMuted}
        />

        {/* ASHA Registration ID */}
        <Text style={styles.inputLabel}>{t('ashaId')}</Text>
        <TextInput
          style={styles.textInput}
          value={ashaId}
          onChangeText={setAshaId}
          placeholder="e.g. ASHA-UP-VNS-042"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Assigned ANM Details */}
        <Text style={styles.inputLabel}>{t('assignedAnm')}</Text>
        <TextInput
          style={styles.textInput}
          value={assignedAnm}
          onChangeText={setAssignedAnm}
          placeholder="e.g. Rekha Sharma (+91 98765 11111)"
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Success Notification Banner */}
      {saveSuccess && (
        <View style={styles.successBanner}>
          <Check size={16} color={Colors.visitedGreen} style={{ marginRight: 6 }} />
          <Text style={styles.successText}>{t('profileSaved')}</Text>
        </View>
      )}

      {/* Save Profile Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        activeOpacity={0.85}
      >
        <Save size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.saveButtonText}>{t('saveProfileChanges')}</Text>
      </TouchableOpacity>

      {/* Logout / Switch Account Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => logout()}
        activeOpacity={0.85}
      >
        <LogOut size={18} color="#DC2626" style={{ marginRight: 8 }} />
        <Text style={styles.logoutButtonText}>खाते से लॉगआउट करें (Sign Out)</Text>
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
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarTouchWrapper: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSquircle: {
    width: 92,
    height: 92,
    borderRadius: 24, // Round square / squircle
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 2,
    borderColor: '#DBEAFE',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  profileLogoImage: {
    width: 74,
    height: 74,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerRole: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  headerVillage: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleLockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  roleLockedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    marginRight: 6,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  verifiedTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  languageOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  languageButtonSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.primary,
  },
  languageNative: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  languageNativeSelected: {
    color: Colors.primary,
  },
  languageLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  languageLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  langCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.visitedGreen,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    paddingVertical: 13,
    borderRadius: 10,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
});
