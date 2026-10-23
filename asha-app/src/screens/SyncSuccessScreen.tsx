import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { ArrowLeft, CheckCircle2, QrCode, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { RealQrCode } from '../components/RealQrCode';

interface SyncSuccessScreenProps {
  onSendAnother: () => void;
  onBackToHome: () => void;
}

export const SyncSuccessScreen: React.FC<SyncSuccessScreenProps> = ({
  onSendAnother,
  onBackToHome,
}) => {
  const { t } = useLanguage();
  const { lastSyncResult } = useOfflineData();
  const [showQr, setShowQr] = useState(false);

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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Giant Green Checkmark */}
        <View style={styles.checkCircleWrap}>
          <CheckCircle2 size={80} color={Colors.visitedGreen} />
        </View>

        <Text style={styles.successTitle}>{t('dataSentSuccess')}</Text>
        <Text style={styles.successSubtitle}>
          {lastSyncResult?.message || t('dataSentSubtitle')}
        </Text>

        {/* Sync Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <ShieldCheck size={18} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.summaryLabel}>सिंक स्थिति:</Text>
            <Text style={styles.summaryValue}>
              {lastSyncResult?.mode === 'ONLINE_SYNCED' ? 'ऑनलाइन सर्वर प्रेषित ✓' : 'ऑफलाइन QR ट्रांसफर तैयार ✓'}
            </Text>
          </View>
          {lastSyncResult?.syncedCount !== undefined && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>कुल प्रेषित रिकॉर्ड्स:</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary, fontWeight: '700' }]}>
                {lastSyncResult.syncedCount} रिकॉर्ड
              </Text>
            </View>
          )}
        </View>

        {/* View QR Code Toggle if QR payload exists */}
        {lastSyncResult?.qrPayload ? (
          <View style={styles.qrSection}>
            <TouchableOpacity
              style={styles.qrToggleBtn}
              onPress={() => setShowQr(!showQr)}
              activeOpacity={0.8}
            >
              <QrCode size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.qrToggleText}>
                {showQr ? 'QR कोड छिपाएं' : 'स्थानांतरण QR कोड देखें'}
              </Text>
              {showQr ? <ChevronUp size={16} color={Colors.primary} /> : <ChevronDown size={16} color={Colors.primary} />}
            </TouchableOpacity>

            {showQr && (
              <View style={styles.qrBox}>
                <RealQrCode value={lastSyncResult.qrPayload} size={190} />
                <Text style={styles.qrHint}>
                  एएनएम कार्यकर्ता किसी भी समय इस QR को स्कैन करके डेटा प्राप्त कर सकते हैं।
                </Text>
              </View>
            )}
          </View>
        ) : null}

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
      </ScrollView>
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
    paddingTop: 14,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 60,
  },
  checkCircleWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.visitedGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  qrSection: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  qrToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    width: '100%',
  },
  qrToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 6,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },
  qrHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
  },
});
