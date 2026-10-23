import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  ArrowLeft,
  QrCode,
  Keyboard,
  Info,
  CheckCircle,
  Syringe,
  Baby,
  Activity,
  Send,
  Camera,
  Image as ImageIcon,
  FlaskConical,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Stethoscope,
  Phone,
  ShieldCheck,
  Pill,
  Clock,
  Maximize2,
  Share2,
  CheckCircle2,
  Scan,
} from 'lucide-react-native';
import jsQR from 'jsqr';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';
import { RealQrCode } from '../components/RealQrCode';
import { OfflineStorageService } from '../storage/OfflineStorageService';

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
    pendingSyncCount,
    isSyncing,
    triggerSync,
    sendToAnm,
  } = useOfflineData();
  const { t } = useLanguage();

  const [syncMode, setSyncMode] = useState<'IN_OUT' | 'ANM_QR'>('ANM_QR');
  const [qrSubMode, setQrSubMode] = useState<'SCAN' | 'SHOW'>('SCAN');
  const [ashaQrData, setAshaQrData] = useState<string>('');
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<'CHILD_VAX' | 'ANC' | 'NCD'>('CHILD_VAX');
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
    setSyncFeedback('अस्पताल सर्वर से आवक डेटा (रेफरल एवं प्रिस्क्रिप्शन) डाउनलोड हो रहा है...');
    const res = await triggerSync();
    setSyncFeedback(res.message || '✓ अस्पताल से नवीनतम आवक रेफरल एवं दवा समयसीमा सफलतापूर्वक प्राप्त हुईं।');
  };

  const handleOutwardsSync = async () => {
    setSyncFeedback('सीएचओ एडमिन को जावक रेफरल एवं सर्वे डेटा प्रेषित किया जा रहा है...');
    const res = await triggerSync();
    setSyncFeedback(res.message || '✓ सीएचओ एडमिन को सभी जावक रेफरल एवं सर्वे सफलतापूर्वक प्रेषित किए गए।');
  };

  const handleQrImageFile = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setIsDecoding(true);
    setScanStatusMessage('QR कोड स्कैन किया जा रहा है...');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsDecoding(false);
          setScanStatusMessage('स्कैनर प्रारंभ नहीं हो सका');
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const imageData = ctx.getImageData(0, 0, targetW, targetH);
        const code = jsQR(imageData.data, targetW, targetH);

        setIsDecoding(false);
        if (code && code.data) {
          setManualCode(code.data);
          setScanStatusMessage(`✓ QR कोड पहचाना गया: ${code.data}. डेटा भेजा जा रहा है...`);
          handleDirectScan(code.data);
        } else {
          setScanStatusMessage('⚠️ QR कोड नहीं मिला। कृपया फोटो स्पष्ट रूप से लें।');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Accurate counts for each clustered category
  const childVaxCount = childVaccinations.length || members.filter((m) => m.isChild || (m.age && m.age <= 5)).length;
  // Strictly female pregnant members
  const ancCount = members.filter((m) => m.gender === 'Female' && m.isPregnant && (!m.age || m.age >= 12)).length;
  const ncdCount = members.filter((m) => m.hasChronicCondition || m.isNcdPatient).length || surveys.filter((s) => s.categoryCode === 'DISEASE').length;

  const handleDirectScan = async (codeToUse?: string) => {
    const code = (codeToUse || manualCode).trim() || `ANM-QR-${selectedCluster}-SYNCED`;
    await sendToAnm(selectedCluster, code);
    onSuccess();
  };

  const setTestCode = (code: string, cluster: 'CHILD_VAX' | 'ANC' | 'NCD') => {
    setSelectedCluster(cluster);
    setManualCode(code);
    setShowManualInput(true);
    setScanStatusMessage(`✓ टेस्ट कोड लोड हुआ: ${code}`);
  };

  const getClusterInfo = () => {
    switch (selectedCluster) {
      case 'CHILD_VAX':
        return {
          title: 'बाल टीकाकरण (Child Vaccination)',
          count: childVaxCount,
          desc: 'बच्चों के टीकाकरण रिकॉर्ड सीधे एएनएम सत्र में भेजे जाएंगे।',
        };
      case 'ANC':
        return {
          title: 'मातृ स्वास्थ्य (Pregnancy ANC)',
          count: ancCount,
          desc: 'गर्भवती महिलाओं की स्वास्थ्य जांच सीधे एएनएम को भेजी जाएगी।',
        };
      case 'NCD':
      default:
        return {
          title: 'रोग जांच (NCD Screening)',
          count: ncdCount,
          desc: 'बीपी, शुगर एवं कैंसर स्क्रीनिंग रिकॉर्ड भेजे जाएंगे।',
        };
    }
  };

  const clusterInfo = getClusterInfo();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>डेटा सिंक एवं रेफरल प्रेषण हब</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Top Sync Mode Switcher */}
        <View style={styles.syncModeTabRow}>
          <TouchableOpacity
            style={[styles.syncModeTabBtn, syncMode === 'IN_OUT' && styles.syncModeTabBtnActive]}
            onPress={() => setSyncMode('IN_OUT')}
          >
            <ArrowDownCircle size={15} color={syncMode === 'IN_OUT' ? '#FFFFFF' : '#0284C7'} style={{ marginRight: 6 }} />
            <Text style={[styles.syncModeTabText, syncMode === 'IN_OUT' && styles.syncModeTabTextActive]}>
              आवक व जावक सिंक (Cloud Hub)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.syncModeTabBtn, syncMode === 'ANM_QR' && styles.syncModeTabBtnActive]}
            onPress={() => setSyncMode('ANM_QR')}
          >
            <QrCode size={15} color={syncMode === 'ANM_QR' ? '#FFFFFF' : Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.syncModeTabText, syncMode === 'ANM_QR' && styles.syncModeTabTextActive]}>
              एएनएम डायरेक्ट QR
            </Text>
          </TouchableOpacity>
        </View>

        {syncFeedback && (
          <View style={styles.syncFeedbackCard}>
            <CheckCircle size={18} color="#059669" style={{ marginRight: 8 }} />
            <Text style={styles.syncFeedbackText}>{syncFeedback}</Text>
          </View>
        )}

        {syncMode === 'IN_OUT' ? (
          <View style={styles.inOutContainer}>
            {/* 1. INWARDS SYNC PANEL: Hospital -> ASHA Worker */}
            <View style={styles.syncCard}>
              <View style={styles.syncCardHeader}>
                <View style={[styles.syncCardIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <ArrowDownCircle size={22} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncCardTitle}>आवक सिंक (Inwards: अस्पताल से प्राप्त)</Text>
                  <Text style={styles.syncCardSub}>
                    डॉक्टर द्वारा दिए गए रेफरल, दवा निर्देश एवं प्रिस्क्रिप्शन समयसीमा
                  </Text>
                </View>
              </View>

              {/* Inwards Items Preview */}
              <View style={styles.syncItemsList}>
                {followUps.slice(0, 3).map((f) => (
                  <View key={f.id} style={styles.syncItemRow}>
                    <View style={styles.syncItemAvatar}>
                      <Text style={styles.syncItemInitials}>{f.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.syncItemName}>{f.name}</Text>
                        {f.phone && <Text style={styles.syncItemPhone}>📞 {f.phone}</Text>}
                      </View>
                      <Text style={styles.syncItemTask} numberOfLines={1}>{f.taskType}</Text>
                      {f.prescriptionDeadline && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <Clock size={10} color="#DC2626" style={{ marginRight: 3 }} />
                          <Text style={styles.syncItemDeadline}>समयसीमा: {f.prescriptionDeadline}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.inwardsActionBtn}
                onPress={handleInwardsSync}
                disabled={isSyncing}
                activeOpacity={0.85}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.inwardsActionBtnText}>
                  {isSyncing ? 'सिंक हो रहा है...' : '🔄 अस्पताल से नया डेटा प्राप्त करें (Download Inwards)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. OUTWARDS SYNC PANEL: ASHA Worker -> CHO Admin & Hospital */}
            <View style={styles.syncCard}>
              <View style={styles.syncCardHeader}>
                <View style={[styles.syncCardIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <ArrowUpCircle size={22} color="#15803D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.syncCardTitle}>जावक सिंक (Outwards: सीएचओ को प्रेषित)</Text>
                  <Text style={styles.syncCardSub}>
                    आशा द्वारा सीएचओ एडमिन को भेजे गए नए रेफरल एवं स्वास्थ्य सर्वे
                  </Text>
                </View>
              </View>

              {/* Outbox Items Count / Status */}
              <View style={styles.outboxStatusBox}>
                <View style={styles.outboxStatCol}>
                  <Text style={styles.outboxStatNum}>{pendingSyncCount}</Text>
                  <Text style={styles.outboxStatLbl}>लंबित प्रेषण रिकॉर्ड</Text>
                </View>
                <View style={styles.outboxStatCol}>
                  <Text style={[styles.outboxStatNum, { color: '#2563EB' }]}>
                    {followUps.filter((f) => f.referredToCho).length}
                  </Text>
                  <Text style={styles.outboxStatLbl}>सीएचओ रेफरल</Text>
                </View>
                <View style={styles.outboxStatCol}>
                  <Text style={[styles.outboxStatNum, { color: '#059669' }]}>
                    {followUps.filter((f) => f.isCompleted).length}
                  </Text>
                  <Text style={styles.outboxStatLbl}>पूर्ण अनुवर्ती</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.outwardsActionBtn}
                onPress={handleOutwardsSync}
                disabled={isSyncing}
                activeOpacity={0.85}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Send size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.outwardsActionBtnText}>
                  {isSyncing ? 'डेटा प्रेषित हो रहा है...' : '📤 सीएचओ को जावक डेटा भेजें (Upload Outwards)'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            {/* Voice Guide Banner */}
            <VoiceGuideBanner
              sectionName="एएनएम डायरेक्ट QR सिंक"
              explanationHi="क्लस्टर चुनें और एएनएम का QR कोड स्कैन करके ऑफलाइन डेटा तुरंत भेजें।"
              explanationMr="क्लस्टर निवडा आणि एएनएमचा QR कोड स्कॅन करून डेटा त्वरित पाठवा."
              explanationEn="Select cluster and scan ANM session QR code to transfer offline records directly."
            />

        {/* 1. Clustered Section Options (Direct Buttons) */}
        <Text style={styles.sectionHeading}>भेजने हेतु श्रेणी चुनें:</Text>
        <View style={styles.clusterOptionsCol}>
          {/* Child Vaccination Cluster */}
          <TouchableOpacity
            style={[
              styles.clusterCard,
              selectedCluster === 'CHILD_VAX' && styles.clusterCardSelected,
            ]}
            onPress={() => setSelectedCluster('CHILD_VAX')}
            activeOpacity={0.8}
          >
            <View style={styles.clusterIconCircle}>
              <Syringe size={20} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clusterTitle}>💉 बाल टीकाकरण (Child Vaccination)</Text>
              <Text style={styles.clusterMeta}>{childVaxCount} बच्चों का टीकाकरण रिकॉर्ड</Text>
            </View>
            <View style={styles.clusterBadge}>
              <Text style={styles.clusterBadgeText}>{childVaxCount} रिकॉर्ड</Text>
            </View>
          </TouchableOpacity>

          {/* Pregnancy ANC Cluster */}
          <TouchableOpacity
            style={[
              styles.clusterCard,
              selectedCluster === 'ANC' && styles.clusterCardSelected,
            ]}
            onPress={() => setSelectedCluster('ANC')}
            activeOpacity={0.8}
          >
            <View style={styles.clusterIconCircle}>
              <Baby size={20} color={Colors.urgentRed} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clusterTitle}>🤰 मातृ स्वास्थ्य (Pregnancy ANC)</Text>
              <Text style={styles.clusterMeta}>{ancCount} गर्भवती महिलाओं की जाँच</Text>
            </View>
            <View style={styles.clusterBadge}>
              <Text style={styles.clusterBadgeText}>{ancCount} रिकॉर्ड</Text>
            </View>
          </TouchableOpacity>

          {/* NCD Cluster */}
          <TouchableOpacity
            style={[
              styles.clusterCard,
              selectedCluster === 'NCD' && styles.clusterCardSelected,
            ]}
            onPress={() => setSelectedCluster('NCD')}
            activeOpacity={0.8}
          >
            <View style={styles.clusterIconCircle}>
              <Activity size={20} color="#BE185D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clusterTitle}>🩺 रोग जांच (NCD Screening)</Text>
              <Text style={styles.clusterMeta}>{ncdCount} स्क्रीनिंग रिकॉर्ड</Text>
            </View>
            <View style={styles.clusterBadge}>
              <Text style={styles.clusterBadgeText}>{ncdCount} रिकॉर्ड</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 2. Ready to Transmit Box */}
        <View style={styles.readyBox}>
          <Text style={styles.readyTitle}>चयनित: {clusterInfo.title}</Text>
          <Text style={styles.readyDesc}>{clusterInfo.desc}</Text>
        </View>

        {/* Sub-mode Switcher: Scan ANM QR vs Show ASHA Data QR */}
        <View style={styles.qrSubModeToggleRow}>
          <TouchableOpacity
            style={[styles.qrSubModeBtn, qrSubMode === 'SCAN' && styles.qrSubModeBtnActive]}
            onPress={() => setQrSubMode('SCAN')}
            activeOpacity={0.8}
          >
            <Scan size={15} color={qrSubMode === 'SCAN' ? '#FFFFFF' : Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.qrSubModeText, qrSubMode === 'SCAN' && styles.qrSubModeTextActive]}>
              एएनएम QR स्कैन करें
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.qrSubModeBtn, qrSubMode === 'SHOW' && styles.qrSubModeBtnActive]}
            onPress={() => setQrSubMode('SHOW')}
            activeOpacity={0.8}
          >
            <QrCode size={15} color={qrSubMode === 'SHOW' ? '#FFFFFF' : Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.qrSubModeText, qrSubMode === 'SHOW' && styles.qrSubModeTextActive]}>
              आशा डेटा QR दिखाएं
            </Text>
          </TouchableOpacity>
        </View>

        {qrSubMode === 'SHOW' ? (
          <View style={styles.showQrCard}>
            <View style={styles.showQrHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.showQrTitle}>आशा कार्यकर्ता डेटा ट्रांसमिशन QR</Text>
                <Text style={styles.showQrSub}>
                  एएनएम कार्यकर्ता से कहें कि अपने फोन से इस QR को स्कैन करें।
                </Text>
              </View>
              <TouchableOpacity
                style={styles.zoomIconBtn}
                onPress={() => setIsQrZoomed(!isQrZoomed)}
                activeOpacity={0.8}
              >
                <Maximize2 size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.qrCodeWrapper}>
              <RealQrCode
                value={ashaQrData || `ASHA-DATA-${selectedCluster}-DEFAULT`}
                size={isQrZoomed ? 250 : 190}
                label={`क्लस्टर: ${clusterInfo.title} (${clusterInfo.count} रिकॉर्ड)`}
              />
            </View>

            <View style={styles.qrDataInfoBox}>
              <View style={styles.qrDataRow}>
                <Text style={styles.qrDataLabel}>कार्यकर्ता:</Text>
                <Text style={styles.qrDataValue}>सुनीता देवी (9876543210)</Text>
              </View>
              <View style={styles.qrDataRow}>
                <Text style={styles.qrDataLabel}>गाँव / उपकेंद्र:</Text>
                <Text style={styles.qrDataValue}>चाँदपुर (Chandpur Village)</Text>
              </View>
              <View style={styles.qrDataRow}>
                <Text style={styles.qrDataLabel}>चयनित क्लस्टर:</Text>
                <Text style={styles.qrDataValue}>{clusterInfo.title}</Text>
              </View>
              <View style={styles.qrDataRow}>
                <Text style={styles.qrDataLabel}>कुल रिकॉर्ड्स:</Text>
                <Text style={[styles.qrDataValue, { fontWeight: '700', color: Colors.primary }]}>
                  {clusterInfo.count} रिकॉर्ड्स तैयार
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.markSyncedSuccessBtn}
              onPress={() => handleDirectScan('ASHA_DIRECT_QR_TRANSMITTED')}
              activeOpacity={0.85}
              disabled={isSyncing}
            >
              <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.markSyncedSuccessBtnText}>
                {isSyncing ? 'डेटा प्रेषित किया जा रहा है...' : '✓ एएनएम द्वारा स्कैन हो गया (डेटा प्रेषित मार्क करें)'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Hidden Inputs for Direct Camera and File Pick */}
            {Platform.OS === 'web' && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  style={{ display: 'none' }}
                  onChange={handleQrImageFile}
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleQrImageFile}
                />
              </>
            )}

            {/* 3. Direct QR Scan Viewfinder Card */}
            <View style={styles.viewfinderCard}>
              <View style={styles.reticle}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                {isSyncing || isDecoding ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : (
                  <QrCode size={56} color={Colors.primary} />
                )}
              </View>
              <Text style={styles.reticleHintText}>
                एएनएम के सत्र का QR कोड स्कैन करें
              </Text>

              {/* Camera & Gallery Action Buttons */}
              <View style={styles.scanActionRow}>
                <TouchableOpacity
                  style={styles.scanActionBtn}
                  onPress={() => {
                    if (Platform.OS === 'web' && cameraInputRef.current) {
                      cameraInputRef.current.click();
                    } else {
                      handleDirectScan();
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={isSyncing || isDecoding}
                >
                  <Camera size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.scanActionBtnText}>कैमरा खोलें</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scanActionBtn, styles.scanActionBtnAlt]}
                  onPress={() => {
                    if (Platform.OS === 'web' && fileInputRef.current) {
                      fileInputRef.current.click();
                    } else {
                      handleDirectScan();
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={isSyncing || isDecoding}
                >
                  <ImageIcon size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.scanActionBtnAltText}>QR फ़ोटो चुनें</Text>
                </TouchableOpacity>
              </View>
            </View>

            {scanStatusMessage ? (
              <View style={styles.scanStatusNotice}>
                <Text style={styles.scanStatusNoticeText}>{scanStatusMessage}</Text>
              </View>
            ) : null}

            {/* 4. One-Click Example Test Codes for ASHA Worker */}
            <View style={styles.testSection}>
              <View style={styles.testHeaderRow}>
                <FlaskConical size={14} color={Colors.primary} style={{ marginRight: 5 }} />
                <Text style={styles.testSectionTitle}>सक्रिय एएनएम सत्र कोड (ANM Session Codes):</Text>
              </View>
              <View style={styles.testPillRow}>
                <TouchableOpacity
                  style={[
                    styles.testPill,
                    manualCode === 'ANM-QR-CHILD-VAX-CHANDPUR' && styles.testPillActive,
                  ]}
                  onPress={() => setTestCode('ANM-QR-CHILD-VAX-CHANDPUR', 'CHILD_VAX')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.testPillText, manualCode === 'ANM-QR-CHILD-VAX-CHANDPUR' && styles.testPillTextActive]}>
                    ANM-QR-CHILD-VAX-CHANDPUR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testPill,
                    manualCode === 'ANM-QR-ANC-CHANDPUR' && styles.testPillActive,
                  ]}
                  onPress={() => setTestCode('ANM-QR-ANC-CHANDPUR', 'ANC')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.testPillText, manualCode === 'ANM-QR-ANC-CHANDPUR' && styles.testPillTextActive]}>
                    ANM-QR-ANC-CHANDPUR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testPill,
                    manualCode === 'ANM-QR-NCD-CHANDPUR' && styles.testPillActive,
                  ]}
                  onPress={() => setTestCode('ANM-QR-NCD-CHANDPUR', 'NCD')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.testPillText, manualCode === 'ANM-QR-NCD-CHANDPUR' && styles.testPillTextActive]}>
                    ANM-QR-NCD-CHANDPUR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testPill,
                    manualCode === 'ANM-QR-9876543211' && styles.testPillActive,
                  ]}
                  onPress={() => setTestCode('ANM-QR-9876543211', 'CHILD_VAX')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.testPillText, manualCode === 'ANM-QR-9876543211' && styles.testPillTextActive]}>
                    ANM-QR-9876543211 (रेखा शर्मा)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Button directly below QR viewfinder */}
            <TouchableOpacity
              style={styles.directSendBtn}
              onPress={() => handleDirectScan()}
              activeOpacity={0.85}
              disabled={isSyncing}
            >
              <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.directSendBtnText}>
                {isSyncing ? 'डेटा भेजा जा रहा है...' : 'डेटा सीधे एएनएम को भेजें'}
              </Text>
            </TouchableOpacity>

            {/* Manual Code Option */}
            {showManualInput ? (
              <View style={styles.manualInputRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="सत्र कोड (उदा. ANM-QR-CHILD-VAX-CHANDPUR)"
                  placeholderTextColor={Colors.textMuted}
                  value={manualCode}
                  onChangeText={setManualCode}
                />
                <TouchableOpacity
                  style={styles.manualSendBtn}
                  onPress={() => handleDirectScan()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manualSendText}>भेजें</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.manualToggleBtn}
              onPress={() => setShowManualInput(!showManualInput)}
              activeOpacity={0.8}
            >
              <Keyboard size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.manualToggleText}>
                {showManualInput ? 'कोड इनपुट छिपाएं' : 'सत्र कोड मैन्युअल दर्ज करें'}
              </Text>
            </TouchableOpacity>
          </>
        )}
          </View>
        )}
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
    paddingTop: 12,
    paddingBottom: 12,
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
    padding: 14,
    paddingBottom: 40,
  },
  syncModeTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  syncModeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  syncModeTabBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  syncModeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  syncModeTabTextActive: {
    color: '#FFFFFF',
  },
  syncFeedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  syncFeedbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  qrSubModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  qrSubModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
  },
  qrSubModeBtnActive: {
    backgroundColor: Colors.primary,
  },
  qrSubModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  qrSubModeTextActive: {
    color: '#FFFFFF',
  },
  showQrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  showQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  showQrTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  showQrSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  zoomIconBtn: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  qrCodeWrapper: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    alignItems: 'center',
  },
  qrDataInfoBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  qrDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qrDataLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  qrDataValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  markSyncedSuccessBtn: {
    width: '100%',
    backgroundColor: Colors.visitedGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    shadowColor: Colors.visitedGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  markSyncedSuccessBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inOutContainer: {
    gap: 14,
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  syncCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncCardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  syncCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  syncCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  syncItemsList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 8,
    marginBottom: 12,
    gap: 8,
  },
  syncItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  syncItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  syncItemInitials: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  syncItemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  syncItemPhone: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  syncItemTask: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  syncItemDeadline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  inwardsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 12,
  },
  inwardsActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outboxStatusBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  outboxStatCol: {
    alignItems: 'center',
  },
  outboxStatNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D97706',
  },
  outboxStatLbl: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  outwardsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingVertical: 12,
  },
  outwardsActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  clusterOptionsCol: {
    gap: 8,
    marginBottom: 12,
  },
  clusterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  clusterCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.primary,
  },
  clusterIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clusterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  clusterMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clusterBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clusterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  readyBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  readyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  readyDesc: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  viewfinderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reticle: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: Colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  reticleHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 12,
  },
  scanActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  scanActionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  scanActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scanActionBtnAlt: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  scanActionBtnAltText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  scanStatusNotice: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  scanStatusNoticeText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
    textAlign: 'center',
  },
  testSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  testHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  testPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  testPill: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  testPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  testPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  testPillTextActive: {
    color: Colors.primary,
  },
  directSendBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  directSendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  manualSendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualSendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  manualToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  manualToggleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
