/**
 * डेटा भेजें — offline ANM QR handoff (scan ANM session / show ASHA data QR) and server in/out sync.
 */
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import {
  QrCode,
  Keyboard,
  Info,
  Syringe,
  Baby,
  Activity,
  Send,
  Camera,
  Image as ImageIcon,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Maximize2,
  CircleCheck,
  Scan,
  LucideIcon,
} from 'lucide-react-native';
import { scanQrFromImageFile, parseQrIdentifier } from '../utils/qrScannerHelper';
import { useOfflineData } from '../context/OfflineDataContext';
import { RealQrCode } from '../components/RealQrCode';
import { OfflineStorageService } from '../storage/OfflineStorageService';
import {
  AppBar,
  Screen,
  Card,
  Button,
  IconButton,
  IconBadge,
  StatusPill,
  Stat,
  Segmented,
  Chips,
  Field,
  Tone,
  color,
  radius,
  space,
  text,
  useTr,
} from '../ui';

type Cluster = 'CHILD_VAX' | 'ANC' | 'NCD';

interface SendDataScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const SendDataScreen: React.FC<SendDataScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const {
    childVaccinations,
    surveys,
    members,
    followUps,
    outbox,
    anmSessions,
    pendingSyncCount,
    isSyncing,
    triggerSync,
    sendToAnm,
  } = useOfflineData();
  const tr = useTr();

  const [syncMode, setSyncMode] = useState<'IN_OUT' | 'ANM_QR'>('ANM_QR');
  const [qrSubMode, setQrSubMode] = useState<'SCAN' | 'SHOW'>('SCAN');
  const [ashaQrData, setAshaQrData] = useState<string>('');
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Cluster>('CHILD_VAX');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const fileInputRef = useRef<any>(null);
  const cameraInputRef = useRef<any>(null);

  React.useEffect(() => {
    OfflineStorageService.exportClusterDataJson(selectedCluster).then((data) => {
      setAshaQrData(data);
    });
  }, [selectedCluster]);

  const handleInwardsSync = async () => {
    setSyncFeedback(tr('डेटा आ रहा है…', 'डेटा येत आहे…'));
    const res = await triggerSync();
    setSyncFeedback(res.message || tr('डेटा मिल गया', 'डेटा मिळाला'));
  };

  const handleOutwardsSync = async () => {
    setSyncFeedback(tr('भेजा जा रहा है…', 'पाठवत आहे…'));
    const res = await triggerSync();
    setSyncFeedback(res.message || tr('सब भेज दिया', 'सर्व पाठवले'));
  };

  const handleQrImageFile = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setIsDecoding(true);
    setScanStatusMessage(tr('QR पढ़ा जा रहा है…', 'QR वाचत आहे…'));

    try {
      const decodedRaw = await scanQrFromImageFile(file);
      const parsed = parseQrIdentifier(decodedRaw);
      setIsDecoding(false);
      setManualCode(parsed);
      setScanStatusMessage(`${tr('QR मिला', 'QR सापडला')}: ${parsed}`);
      await handleDirectScan(parsed);
    } catch (err: any) {
      setIsDecoding(false);
      setScanStatusMessage(tr('QR नहीं मिला, साफ़ फ़ोटो लें', 'QR सापडला नाही, स्पष्ट फोटो घ्या'));
    }
  };

  // Accurate counts for each clustered category
  const childVaxCount = childVaccinations.length || members.filter((m) => m.isChild || (m.age && m.age <= 5)).length;
  // Strictly female pregnant members
  const ancCount = members.filter((m) => m.gender === 'Female' && m.isPregnant && (!m.age || m.age >= 12)).length;
  const ncdCount = members.filter((m) => m.hasChronicCondition || m.isNcdPatient).length || surveys.filter((s) => s.categoryCode === 'DISEASE').length;

  const handleDirectScan = async (codeToUse?: string) => {
    const raw = (codeToUse || manualCode).trim();
    const code = parseQrIdentifier(raw) || `ANM-QR-${selectedCluster}-SYNCED`;
    await sendToAnm(selectedCluster, code);
    onSuccess();
  };

  const setTestCode = (code: string, cluster: Cluster) => {
    setSelectedCluster(cluster);
    setManualCode(code);
    setShowManualInput(true);
    setScanStatusMessage('');
  };

  const clusters: { key: Cluster; icon: LucideIcon; tone: Tone; label: string; count: number }[] = [
    { key: 'CHILD_VAX', icon: Syringe, tone: 'accent', label: tr('बाल टीकाकरण', 'बाल लसीकरण'), count: childVaxCount },
    { key: 'ANC', icon: Baby, tone: 'red', label: tr('गर्भवती जाँच', 'गर्भवती तपासणी'), count: ancCount },
    { key: 'NCD', icon: Activity, tone: 'amber', label: tr('रोग जाँच', 'रोग तपासणी'), count: ncdCount },
  ];
  const current = clusters.find((c) => c.key === selectedCluster)!;
  const busy = isSyncing || isDecoding;
  const openPicker = (ref: React.MutableRefObject<any>) => {
    if (Platform.OS === 'web' && ref.current) ref.current.click();
    else handleDirectScan();
  };

  return (
    <View style={styles.flex}>
      <AppBar title={tr('डेटा भेजें', 'डेटा पाठवा')} onBack={onBack} backLabel={tr('वापस', 'मागे')} />
      <Screen>
        <Segmented
          value={syncMode}
          onChange={setSyncMode}
          options={[
            { key: 'ANM_QR', label: tr('एएनएम QR', 'एएनएम QR'), icon: QrCode },
            { key: 'IN_OUT', label: tr('सर्वर सिंक', 'सर्व्हर सिंक'), icon: RefreshCw },
          ]}
        />

        {syncFeedback ? (
          <Card tone="green">
            <View style={styles.inline}>
              <CircleCheck size={18} color={color.green} strokeWidth={2} />
              <Text style={[text.body, styles.flex]}>{syncFeedback}</Text>
            </View>
          </Card>
        ) : null}

        {syncMode === 'IN_OUT' ? (
          <>
            {/* Inwards: referrals & prescriptions from facility */}
            <Card>
              <View style={styles.inline}>
                <IconBadge icon={ArrowDownCircle} tone="accent" />
                <Text style={[text.heading, styles.flex]}>{tr('अस्पताल से प्राप्त', 'रुग्णालयाकडून')}</Text>
              </View>
              {followUps.slice(0, 3).map((f) => (
                <View key={f.id} style={styles.preview}>
                  <Text style={[text.label, styles.flex]} numberOfLines={1}>
                    {f.name}
                  </Text>
                  {f.prescriptionDeadline ? (
                    <View style={styles.inline}>
                      <Clock size={14} color={color.red} strokeWidth={2} />
                      <Text style={[text.caption, { color: color.redText }]}>{f.prescriptionDeadline}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
              <View style={styles.gapTop}>
                <Button label={tr('डेटा लें', 'डेटा घ्या')} icon={RefreshCw} loading={isSyncing} onPress={handleInwardsSync} />
              </View>
            </Card>

            {/* Outwards: outbox to server / CHO */}
            <Card>
              <View style={styles.inline}>
                <IconBadge icon={ArrowUpCircle} tone="green" />
                <Text style={[text.heading, styles.flex]}>{tr('सर्वर को भेजें', 'सर्व्हरला पाठवा')}</Text>
              </View>
              <View style={styles.stats}>
                <Stat value={pendingSyncCount} label={tr('बाकी', 'बाकी')} tone={pendingSyncCount ? 'amber' : 'green'} />
                <Stat value={followUps.filter((f) => f.referredToCho).length} label={tr('सीएचओ रेफरल', 'सीएचओ संदर्भ')} tone="accent" />
                <Stat value={followUps.filter((f) => f.isCompleted).length} label={tr('पूर्ण', 'पूर्ण')} tone="green" />
              </View>
              <Button label={tr('अभी भेजें', 'आता पाठवा')} icon={Send} loading={isSyncing} onPress={handleOutwardsSync} />
            </Card>
          </>
        ) : (
          <>
            <Text style={text.label}>{tr('श्रेणी चुनें', 'श्रेणी निवडा')}</Text>
            {clusters.map((c) => {
              const selected = c.key === selectedCluster;
              return (
                <Card
                  key={c.key}
                  onPress={() => setSelectedCluster(c.key)}
                  accessibilityLabel={`${c.label}, ${c.count}`}
                  style={selected ? styles.selected : undefined}
                >
                  <View style={styles.inline}>
                    <IconBadge icon={c.icon} tone={c.tone} />
                    <Text style={[text.heading, styles.flex]}>{c.label}</Text>
                    <StatusPill tone={selected ? 'accent' : 'neutral'} label={`${c.count}`} />
                    {selected ? <CircleCheck size={22} color={color.accent} strokeWidth={2.2} /> : null}
                  </View>
                </Card>
              );
            })}

            <Segmented
              value={qrSubMode}
              onChange={setQrSubMode}
              options={[
                { key: 'SCAN', label: tr('QR स्कैन', 'QR स्कॅन'), icon: Scan },
                { key: 'SHOW', label: tr('मेरा QR', 'माझा QR'), icon: QrCode },
              ]}
            />

            {qrSubMode === 'SHOW' ? (
              <Card>
                <View style={styles.inline}>
                  <Text style={[text.heading, styles.flex]}>{current.label}</Text>
                  <IconButton
                    icon={Maximize2}
                    label={isQrZoomed ? tr('छोटा करें', 'लहान करा') : tr('बड़ा करें', 'मोठे करा')}
                    onPress={() => setIsQrZoomed(!isQrZoomed)}
                  />
                </View>
                <View style={styles.qr}>
                  <RealQrCode value={ashaQrData || `ASHA-DATA-${selectedCluster}-DEFAULT`} size={isQrZoomed ? 260 : 200} />
                  <StatusPill tone="accent" label={`${current.count} ${tr('रिकॉर्ड', 'नोंदी')}`} />
                  <Text style={[text.caption, styles.center]}>{tr('एएनएम यह QR स्कैन करें', 'एएनएमने हा QR स्कॅन करावा')}</Text>
                </View>
                <Button
                  label={tr('स्कैन हो गया', 'स्कॅन झाले')}
                  icon={CircleCheck}
                  loading={isSyncing}
                  onPress={() => handleDirectScan('ASHA_DIRECT_QR_TRANSMITTED')}
                />
              </Card>
            ) : (
              <>
                {Platform.OS === 'web' ? (
                  <>
                    <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: 'none' }} onChange={handleQrImageFile} />
                    <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleQrImageFile} />
                  </>
                ) : null}

                <Card>
                  <View style={styles.reticle}>
                    {busy ? <ActivityIndicator size="large" color={color.accent} /> : <QrCode size={64} color={color.accent} strokeWidth={1.6} />}
                  </View>
                  <View style={styles.row2}>
                    <View style={styles.flex}>
                      <Button label={tr('कैमरा', 'कॅमेरा')} icon={Camera} disabled={busy} onPress={() => openPicker(cameraInputRef)} />
                    </View>
                    <View style={styles.flex}>
                      <Button label={tr('फ़ोटो', 'फोटो')} icon={ImageIcon} variant="secondary" disabled={busy} onPress={() => openPicker(fileInputRef)} />
                    </View>
                  </View>
                </Card>

                {scanStatusMessage ? (
                  <View style={styles.inline}>
                    <Info size={16} color={color.muted} strokeWidth={2} />
                    <Text style={[text.caption, styles.flex]}>{scanStatusMessage}</Text>
                  </View>
                ) : null}

                {anmSessions && anmSessions.length > 0 ? (
                  <>
                    <Text style={text.label}>{tr('सक्रिय सत्र', 'सक्रिय सत्र')}</Text>
                    <Chips
                      value={manualCode}
                      onChange={(code: string) => {
                        const s = anmSessions.find((x) => x.qrCodeValue === code);
                        if (s) setTestCode(s.qrCodeValue, s.category);
                      }}
                      options={anmSessions.map((s) => ({ key: s.qrCodeValue, label: s.title }))}
                    />
                  </>
                ) : null}

                {showManualInput ? (
                  <Field label={tr('सत्र कोड', 'सत्र कोड')} value={manualCode} onChangeText={setManualCode} />
                ) : null}

                <Button label={tr('एएनएम को भेजें', 'एएनएमला पाठवा')} icon={Send} loading={isSyncing} onPress={() => handleDirectScan()} />
                <Button
                  label={showManualInput ? tr('कोड छिपाएँ', 'कोड लपवा') : tr('कोड लिखें', 'कोड लिहा')}
                  icon={Keyboard}
                  variant="ghost"
                  onPress={() => setShowManualInput(!showManualInput)}
                />
              </>
            )}
          </>
        )}
      </Screen>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gapTop: { marginTop: space.md },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
  },
  stats: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  selected: { borderColor: color.accent, borderWidth: 2, backgroundColor: color.accentSoft },
  qr: { alignItems: 'center', gap: space.md, marginVertical: space.lg },
  center: { textAlign: 'center' },
  reticle: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.accentLine,
    borderRadius: radius.card,
    backgroundColor: color.accentSoft,
    marginBottom: space.md,
  },
  row2: { flexDirection: 'row', gap: space.md },
});
