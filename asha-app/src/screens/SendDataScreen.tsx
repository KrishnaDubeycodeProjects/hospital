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
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  // Assigned ANM from the server profile (anm_phone). Used when the ANM scans "मेरा QR".
  const assignedAnmPhone = (() => {
    const d = (user.assignedAnm || '').replace(/[^0-9]/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
  })();
  const [handoffError, setHandoffError] = useState<string | null>(null);

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
    setSyncFeedback(tr('डेटा आ रहा है…', 'डेटा येत आहे…', 'Fetching data…'));
    const res = await triggerSync();
    setSyncFeedback(res.message || tr('डेटा मिल गया', 'डेटा मिळाला', 'Data received'));
  };

  const handleOutwardsSync = async () => {
    setSyncFeedback(tr('भेजा जा रहा है…', 'पाठवत आहे…', 'Sending…'));
    const res = await triggerSync();
    setSyncFeedback(res.message || tr('सब भेज दिया', 'सर्व पाठवले', 'All sent'));
  };

  const handleQrImageFile = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setIsDecoding(true);
    setScanStatusMessage(tr('QR पढ़ा जा रहा है…', 'QR वाचत आहे…', 'Reading QR…'));

    try {
      const decodedRaw = await scanQrFromImageFile(file);
      const parsed = parseQrIdentifier(decodedRaw);
      setIsDecoding(false);
      setManualCode(parsed);
      setScanStatusMessage(`${tr('QR मिला', 'QR सापडला', 'QR found')}: ${parsed}`);
      await handleDirectScan(parsed);
    } catch (err: any) {
      setIsDecoding(false);
      setScanStatusMessage(tr('QR नहीं मिला, साफ़ फ़ोटो लें', 'QR सापडला नाही, स्पष्ट फोटो घ्या', 'QR not found, take a clear photo'));
    }
  };

  // Accurate counts for each clustered category
  const childVaxCount = childVaccinations.length || members.filter((m) => m.isChild || (m.age && m.age <= 5)).length;
  // Strictly female pregnant members
  const ancCount = members.filter((m) => m.gender === 'Female' && m.isPregnant && (!m.age || m.age >= 12)).length;
  const ncdCount = members.filter((m) => m.hasChronicCondition || m.isNcdPatient).length || surveys.filter((s) => s.categoryCode === 'DISEASE').length;

  /** Send this category to the ANM whose session QR was scanned / typed (or the assigned ANM). */
  const handleDirectScan = async (codeToUse?: string) => {
    setHandoffError(null);
    const raw = (codeToUse || manualCode).trim();
    const code = parseQrIdentifier(raw) || assignedAnmPhone;
    if (!code) {
      setHandoffError(tr('एएनएम का QR स्कैन करें या कोड लिखें', 'एएनएमचा QR स्कॅन करा किंवा कोड लिहा', 'Scan the ANM QR or enter the code'));
      return;
    }
    const res = await sendToAnm(selectedCluster, code);
    if (!res.success) {
      setHandoffError(
        res.message === 'ANM_NOT_FOUND'
          ? tr('यह एएनएम कोड नहीं मिला। सही QR स्कैन करें।', 'हा एएनएम कोड सापडला नाही. योग्य QR स्कॅन करा.', 'This ANM code was not found. Scan the correct QR.')
          : res.message === 'SESSION_EXPIRED'
          ? tr('सत्र समाप्त — पुनः लॉगिन करें। डेटा फोन में सुरक्षित है।', 'सत्र संपले — पुन्हा लॉगिन करा. डेटा फोनमध्ये सुरक्षित आहे.', 'Session expired — log in again. Data is safe on the phone.')
          : tr('भेजा नहीं जा सका, फिर कोशिश करें', 'पाठवता आले नाही, पुन्हा प्रयत्न करा', 'Could not send, try again')
      );
      return;
    }
    onSuccess();
  };

  /**
   * "मेरा QR": the ANM scanned this phone's QR with her own app (offline handoff). Record it so the
   * same records are marked as given to the assigned ANM — online now, or queued until signal.
   */
  const handleAnmScannedMyQr = () => handleDirectScan(assignedAnmPhone);

  const setTestCode = (code: string, cluster: Cluster) => {
    setSelectedCluster(cluster);
    setManualCode(code);
    setShowManualInput(true);
    setScanStatusMessage('');
  };

  const clusters: { key: Cluster; icon: LucideIcon; tone: Tone; label: string; count: number }[] = [
    { key: 'CHILD_VAX', icon: Syringe, tone: 'accent', label: tr('बाल टीकाकरण', 'बाल लसीकरण', 'Child immunisation'), count: childVaxCount },
    { key: 'ANC', icon: Baby, tone: 'red', label: tr('गर्भवती जाँच', 'गर्भवती तपासणी', 'Pregnancy check'), count: ancCount },
    { key: 'NCD', icon: Activity, tone: 'amber', label: tr('रोग जाँच', 'रोग तपासणी', 'Disease screening'), count: ncdCount },
  ];
  const current = clusters.find((c) => c.key === selectedCluster)!;
  const busy = isSyncing || isDecoding;
  const openPicker = (ref: React.MutableRefObject<any>) => {
    if (Platform.OS === 'web' && ref.current) ref.current.click();
    else handleDirectScan();
  };

  return (
    <View style={styles.flex}>
      <AppBar title={tr('डेटा भेजें', 'डेटा पाठवा', 'Send data')} onBack={onBack} backLabel={tr('वापस', 'मागे', 'Back')} />
      <Screen>
        <Segmented
          value={syncMode}
          onChange={setSyncMode}
          options={[
            { key: 'ANM_QR', label: tr('एएनएम QR', 'एएनएम QR', 'ANM QR'), icon: QrCode },
            { key: 'IN_OUT', label: tr('सर्वर सिंक', 'सर्व्हर सिंक', 'Server sync'), icon: RefreshCw },
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
                <Text style={[text.heading, styles.flex]}>{tr('अस्पताल से प्राप्त', 'रुग्णालयाकडून', 'Received from hospital')}</Text>
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
                <Button label={tr('डेटा लें', 'डेटा घ्या', 'Get data')} icon={RefreshCw} loading={isSyncing} onPress={handleInwardsSync} />
              </View>
            </Card>

            {/* Outwards: outbox to server / CHO */}
            <Card>
              <View style={styles.inline}>
                <IconBadge icon={ArrowUpCircle} tone="green" />
                <Text style={[text.heading, styles.flex]}>{tr('सर्वर को भेजें', 'सर्व्हरला पाठवा', 'Send to server')}</Text>
              </View>
              <View style={styles.stats}>
                <Stat value={pendingSyncCount} label={tr('बाकी', 'बाकी', 'Pending')} tone={pendingSyncCount ? 'amber' : 'green'} />
                <Stat value={followUps.filter((f) => f.referredToCho).length} label={tr('सीएचओ रेफरल', 'सीएचओ संदर्भ', 'CHO referral')} tone="accent" />
                <Stat value={followUps.filter((f) => f.isCompleted).length} label={tr('पूर्ण', 'पूर्ण', 'Done')} tone="green" />
              </View>
              <Button label={tr('अभी भेजें', 'आता पाठवा', 'Send now')} icon={Send} loading={isSyncing} onPress={handleOutwardsSync} />
            </Card>
          </>
        ) : (
          <>
            <Text style={text.label}>{tr('श्रेणी चुनें', 'श्रेणी निवडा', 'Choose category')}</Text>
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

            {handoffError ? (
              <Card tone="red">
                <Text style={[text.body, { color: color.redText }]}>{handoffError}</Text>
              </Card>
            ) : null}

            <Segmented
              value={qrSubMode}
              onChange={setQrSubMode}
              options={[
                { key: 'SCAN', label: tr('QR स्कैन', 'QR स्कॅन', 'Scan QR'), icon: Scan },
                { key: 'SHOW', label: tr('मेरा QR', 'माझा QR', 'My QR'), icon: QrCode },
              ]}
            />

            {qrSubMode === 'SHOW' ? (
              <Card>
                <View style={styles.inline}>
                  <Text style={[text.heading, styles.flex]}>{current.label}</Text>
                  <IconButton
                    icon={Maximize2}
                    label={isQrZoomed ? tr('छोटा करें', 'लहान करा', 'Smaller') : tr('बड़ा करें', 'मोठे करा', 'Larger')}
                    onPress={() => setIsQrZoomed(!isQrZoomed)}
                  />
                </View>
                <View style={styles.qr}>
                  {ashaQrData ? (
                    <RealQrCode value={ashaQrData} size={isQrZoomed ? 260 : 200} />
                  ) : (
                    <ActivityIndicator size="large" color={color.accent} />
                  )}
                  <StatusPill tone="accent" label={`${current.count} ${tr('रिकॉर्ड', 'नोंदी', 'Records')}`} />
                  <Text style={[text.caption, styles.center]}>{tr('एएनएम यह QR स्कैन करें', 'एएनएमने हा QR स्कॅन करावा', 'ANM, scan this QR')}</Text>
                </View>
                {/* After the ANM scans: mark these records as handed over to her (no fake code). */}
                <Text style={[text.caption, styles.center]}>
                  {assignedAnmPhone
                    ? tr('एएनएम के स्कैन करने के बाद नीचे दबाएँ — ये रिकॉर्ड उन्हें सौंपे गए माने जाएँगे।', 'एएनएमने स्कॅन केल्यानंतर खाली दाबा — या नोंदी त्यांना दिल्या असे नोंदवले जाईल.', 'Press below after the ANM scans — these records will be treated as handed over to them.')
                    : tr('आपका एएनएम तय नहीं है — CHO से संपर्क करें।', 'तुमची एएनएम ठरलेली नाही — CHO शी संपर्क करा.', 'Your ANM is not assigned — contact the CHO.')}
                </Text>
                <Button
                  label={tr('एएनएम ने स्कैन कर लिया', 'एएनएमने स्कॅन केले', 'ANM has scanned')}
                  icon={CircleCheck}
                  loading={isSyncing}
                  disabled={!assignedAnmPhone || !ashaQrData || current.count === 0}
                  onPress={handleAnmScannedMyQr}
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
                      <Button label={tr('कैमरा', 'कॅमेरा', 'Camera')} icon={Camera} disabled={busy} onPress={() => openPicker(cameraInputRef)} />
                    </View>
                    <View style={styles.flex}>
                      <Button label={tr('फ़ोटो', 'फोटो', 'Photo')} icon={ImageIcon} variant="secondary" disabled={busy} onPress={() => openPicker(fileInputRef)} />
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
                    <Text style={text.label}>{tr('सक्रिय सत्र', 'सक्रिय सत्र', 'Active session')}</Text>
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
                  <Field label={tr('सत्र कोड', 'सत्र कोड', 'Session code')} value={manualCode} onChangeText={setManualCode} />
                ) : null}

                <Button label={tr('एएनएम को भेजें', 'एएनएमला पाठवा', 'Send to ANM')} icon={Send} loading={isSyncing} onPress={() => handleDirectScan()} />
                <Button
                  label={showManualInput ? tr('कोड छिपाएँ', 'कोड लपवा', 'Hide code') : tr('कोड लिखें', 'कोड लिहा', 'Enter code')}
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
