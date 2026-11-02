import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Thin crimson status strip shown only when the server rejected outbox records.
 * Records are never deleted — "पुनः भेजें" re-queues them and syncs immediately.
 */
export const FailedSyncBar: React.FC = () => {
  const { failedSyncCount, retryFailedRecords, isSyncing } = useOfflineData();
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const tr = (hi: string, mr: string) => (language === 'mr' ? mr : hi);

  if (failedSyncCount === 0) return null;

  const onRetry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await retryFailedRecords();
    } finally {
      setBusy(false);
    }
  };

  const working = busy || isSyncing;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <View style={styles.left}>
        <View style={styles.iconBadge}>
          <AlertTriangle size={14} color="#DC2626" />
        </View>
        <Text style={styles.countText}>{failedSyncCount}</Text>
        <Text style={styles.labelText}>{tr('अस्वीकृत', 'नाकारल्या')}</Text>
      </View>

      <TouchableOpacity
        style={[styles.retryBtn, working && styles.retryBtnBusy]}
        onPress={onRetry}
        disabled={working}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={tr('पुनः भेजें', 'पुन्हा पाठवा')}
      >
        {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RotateCcw size={16} color="#FFFFFF" />}
        <Text style={styles.retryText}>{tr('पुनः भेजें', 'पुन्हा पाठवा')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 52,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 20, fontWeight: '800', color: '#991B1B' },
  labelText: { fontSize: 13, fontWeight: '600', color: '#991B1B', lineHeight: 18 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#DC2626',
  },
  retryBtnBusy: { opacity: 0.7 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 19 },
});
