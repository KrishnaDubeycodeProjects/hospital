/**
 * सिंक (Sync) — one place for the offline outbox:
 * connection state · pending / failed counts · sync now · resend failed · send to ANM (QR).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudOff, Wifi, RefreshCw, RotateCcw, QrCode, CircleCheck, AlertTriangle, Clock } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { Screen, Card, IconBadge, Stat, Button, ListRow, SectionTitle, StatusPill, color, space, text, useTr } from '../ui';

interface SyncScreenProps {
  onOpenSendToAnm: () => void;
}

export const SyncScreen: React.FC<SyncScreenProps> = ({ onOpenSendToAnm }) => {
  const tr = useTr();
  const { isOnline, isSyncing, pendingSyncCount, failedSyncCount, outbox, triggerSync, retryFailedRecords, lastSyncResult } =
    useOfflineData();
  const [busy, setBusy] = useState(false);

  const syncedCount = outbox.filter((o) => o.status === 'SYNCED').length;
  const lastSynced = outbox
    .filter((o) => o.syncedAt)
    .map((o) => o.syncedAt as string)
    .sort()
    .pop();
  const lastSyncedText = lastSynced
    ? new Date(lastSynced).toLocaleString(tr('hi-IN', 'mr-IN', 'en-IN'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const allClear = pendingSyncCount === 0 && failedSyncCount === 0;
  const heroTone = failedSyncCount > 0 ? 'red' : pendingSyncCount > 0 ? 'amber' : 'green';

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card tone={heroTone}>
        <View style={styles.hero}>
          <IconBadge icon={allClear ? CircleCheck : isOnline ? RefreshCw : CloudOff} tone={heroTone} size="lg" />
          <View style={styles.heroText}>
            <Text style={text.title}>
              {allClear ? tr('सब सुरक्षित', 'सर्व सुरक्षित', 'All safe') : failedSyncCount > 0 ? tr('ध्यान दें', 'लक्ष द्या', 'Needs attention') : tr('भेजना बाकी', 'पाठवणे बाकी', 'Pending to send')}
            </Text>
            <StatusPill
              tone={isOnline ? 'green' : 'amber'}
              icon={isOnline ? Wifi : CloudOff}
              label={isOnline ? tr('ऑनलाइन', 'ऑनलाइन', 'Online') : tr('ऑफलाइन', 'ऑफलाइन', 'Offline')}
            />
          </View>
        </View>
        <View style={styles.stats}>
          <Stat value={pendingSyncCount} label={tr('बाकी', 'बाकी', 'Pending')} tone="amber" />
          <Stat value={failedSyncCount} label={tr('नहीं भेजे', 'पाठवले नाहीत', 'Not sent')} tone="red" />
          <Stat value={syncedCount} label={tr('भेजे गए', 'पाठवले', 'Sent')} tone="green" />
        </View>
      </Card>

      <Button
        label={tr('अभी भेजें', 'आता पाठवा', 'Send now')}
        icon={RefreshCw}
        loading={isSyncing || busy}
        disabled={!isOnline}
        onPress={() => run(triggerSync)}
      />
      {!isOnline ? (
        <Text style={styles.note}>{tr('नेटवर्क मिलते ही अपने आप सिंक', 'नेटवर्क मिळताच आपोआप सिंक', 'Syncs automatically when network is available')}</Text>
      ) : null}

      {failedSyncCount > 0 ? (
        <>
          <Button label={tr('पुनः भेजें', 'पुन्हा पाठवा', 'Resend')} icon={RotateCcw} variant="danger" loading={busy} onPress={() => run(retryFailedRecords)} />
          <Text style={styles.note}>
            {tr('डेटा फ़ोन में सुरक्षित', 'डेटा फोनमध्ये सुरक्षित', 'Data safe on phone')}
          </Text>
        </>
      ) : null}

      {lastSyncResult?.message ? (
        <Card tone={lastSyncResult.success ? 'green' : 'amber'}>
          <View style={styles.msgRow}>
            {lastSyncResult.success ? (
              <CircleCheck size={18} color={color.green} />
            ) : (
              <AlertTriangle size={18} color={color.amber} />
            )}
            <Text style={[text.body, styles.flex]}>{lastSyncResult.message}</Text>
          </View>
        </Card>
      ) : null}

      <SectionTitle label={tr('अन्य', 'इतर', 'Other')} />
      <ListRow icon={QrCode} title={tr('एएनएम को भेजें', 'एएनएमला पाठवा', 'Send to ANM')} subtitle={tr('QR या कोड', 'QR किंवा कोड', 'QR or code')} onPress={onOpenSendToAnm} />
      <ListRow icon={Clock} tone="neutral" title={tr('अंतिम सिंक', 'शेवटचा सिंक', 'Last sync')} right={<Text style={text.label}>{lastSyncedText}</Text>} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroText: { flex: 1, gap: space.sm },
  stats: { flexDirection: 'row', marginTop: space.lg, gap: space.md },
  note: { ...text.caption, textAlign: 'center' },
  msgRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
