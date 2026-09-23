import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LanguageCode } from '../context/LanguageContext';
import { User, Phone, MapPin, BadgeCheck, Languages, Check, Save } from 'lucide-react-native';

export const ProfileScreen: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();

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
    { code: 'en', label: 'English', native: 'English' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Profile Avatar Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarCircle}>
          <User size={36} color={Colors.primary} />
        </View>
        <Text style={styles.headerName}>{name || user.name}</Text>
        <Text style={styles.headerRole}>{user.roleTitle}</Text>
        <Text style={styles.headerVillage}>{village || user.village}</Text>
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
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
