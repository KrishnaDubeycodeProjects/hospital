import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

interface SyncSuccessScreenProps {
  onSendAnother: () => void;
  onBackToHome: () => void;
}

export const SyncSuccessScreen: React.FC<SyncSuccessScreenProps> = ({
  onSendAnother,
  onBackToHome,
}) => {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackToHome} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('sendDataTitle')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        {/* Giant Green Checkmark */}
        <View style={styles.checkCircleWrap}>
          <CheckCircle2 size={80} color={Colors.visitedGreen} />
        </View>

        <Text style={styles.successTitle}>{t('dataSentSuccess')}</Text>
        <Text style={styles.successSubtitle}>
          {t('dataSentSubtitle')}
        </Text>

        <TouchableOpacity
          style={styles.sendAnotherBtn}
          onPress={onSendAnother}
          activeOpacity={0.85}
        >
          <Text style={styles.sendAnotherText}>{t('sendAnotherForm')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={onBackToHome}
          activeOpacity={0.8}
        >
          <Text style={styles.homeBtnText}>{t('backToHome')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  checkCircleWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.visitedGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  sendAnotherBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  sendAnotherText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  homeBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  homeBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
