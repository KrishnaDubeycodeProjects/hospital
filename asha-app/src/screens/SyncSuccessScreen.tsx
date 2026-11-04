/**
 * भेजा गया — sync result: online-synced or offline QR handoff ready.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CircleCheck, QrCode, Send, House, ChevronUp } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { RealQrCode } from '../components/RealQrCode';
import { AppBar, Screen, Card, Button, StatusPill, color, space, text, type, useTr } from '../ui';

interface SyncSuccessScreenProps {
  onSendAnother: () => void;
  onBackToHome: () => void;
}

export const SyncSuccessScreen: React.FC<SyncSuccessScreenProps> = ({ onSendAnother, onBackToHome }) => {
  const tr = useTr();
  const { lastSyncResult } = useOfflineData();
  const [showQr, setShowQr] = useState(false);
  const online = lastSyncResult?.mode === 'ONLINE_SYNCED';

  return (
    <View style={styles.flex}>
      <AppBar title={tr('डेटा भेजें', 'डेटा पाठवा', 'Send data')} onBack={onBackToHome} backLabel={tr('वापस', 'मागे', 'Back')} />
      <Screen>
        <View style={styles.hero}>
          <CircleCheck size={80} color={color.green} strokeWidth={1.8} />
          <Text style={styles.title}>{online ? tr('डेटा भेजा गया', 'डेटा पाठवला', 'Data sent') : tr('QR तैयार', 'QR तयार', 'QR ready')}</Text>
          <View style={styles.pills}>
            <StatusPill tone={online ? 'green' : 'amber'} label={online ? tr('ऑनलाइन', 'ऑनलाइन', 'Online') : tr('ऑफलाइन', 'ऑफलाइन', 'Offline')} />
            {lastSyncResult?.syncedCount !== undefined ? (
              <StatusPill tone="accent" label={`${lastSyncResult.syncedCount} ${tr('रिकॉर्ड', 'नोंदी', 'Records')}`} />
            ) : null}
          </View>
        </View>

        {lastSyncResult?.qrPayload ? (
          <Card>
            <Button
              label={showQr ? tr('QR छिपाएँ', 'QR लपवा', 'Hide QR') : tr('QR देखें', 'QR पहा', 'View QR')}
              icon={showQr ? ChevronUp : QrCode}
              variant="secondary"
              onPress={() => setShowQr(!showQr)}
            />
            {showQr ? (
              <View style={styles.qr}>
                <RealQrCode value={lastSyncResult.qrPayload} size={200} />
                <Text style={[text.caption, styles.center]}>{tr('एएनएम यह QR स्कैन करें', 'एएनएमने हा QR स्कॅन करावा', 'ANM, scan this QR')}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Button label={tr('और भेजें', 'आणखी पाठवा', 'Send more')} icon={Send} onPress={onSendAnother} />
        <Button label={tr('होम', 'होम', 'Home')} icon={House} variant="secondary" onPress={onBackToHome} />
      </Screen>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  hero: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  title: { ...type(24, '800'), textAlign: 'center' },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  qr: { alignItems: 'center', gap: space.md, marginTop: space.lg },
  center: { textAlign: 'center' },
});
