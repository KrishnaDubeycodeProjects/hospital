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
} from 'lucide-react-native';
import jsQR from 'jsqr';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';

interface SendDataScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const SendDataScreen: React.FC<SendDataScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const { childVaccinations, surveys, members, isSyncing, sendToAnm } = useOfflineData();
  const { t } = useLanguage();

  const [selectedCluster, setSelectedCluster] = useState<'CHILD_VAX' | 'ANC' | 'NCD'>('CHILD_VAX');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const fileInputRef = useRef<any>(null);
  const cameraInputRef = useRef<any>(null);

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
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsDecoding(false);
          setScanStatusMessage('स्कैनर प्रारंभ नहीं हो सका');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        setIsDecoding(false);
        if (code && code.data) {
          setManualCode(code.data);
          setScanStatusMessage(`✓ QR कोड पहचाना गया: ${code.data}`);
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
        <Text style={styles.headerTitle}>एएनएम को डेटा भेजें</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
            <Text style={styles.testSectionTitle}>परीक्षण हेतु उदाहरण कोड (Test Codes):</Text>
          </View>
          <View style={styles.testPillRow}>
            <TouchableOpacity
              style={[
                styles.testPill,
                manualCode === 'ANM-QR-CHILD-VAX' && styles.testPillActive,
              ]}
              onPress={() => setTestCode('ANM-QR-CHILD-VAX', 'CHILD_VAX')}
              activeOpacity={0.8}
            >
              <Text style={[styles.testPillText, manualCode === 'ANM-QR-CHILD-VAX' && styles.testPillTextActive]}>
                ANM-QR-CHILD-VAX
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.testPill,
                manualCode === 'ANM-QR-ANC-SYNC' && styles.testPillActive,
              ]}
              onPress={() => setTestCode('ANM-QR-ANC-SYNC', 'ANC')}
              activeOpacity={0.8}
            >
              <Text style={[styles.testPillText, manualCode === 'ANM-QR-ANC-SYNC' && styles.testPillTextActive]}>
                ANM-QR-ANC-SYNC
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.testPill,
                manualCode === 'ANM-QR-NCD-SYNC' && styles.testPillActive,
              ]}
              onPress={() => setTestCode('ANM-QR-NCD-SYNC', 'NCD')}
              activeOpacity={0.8}
            >
              <Text style={[styles.testPillText, manualCode === 'ANM-QR-NCD-SYNC' && styles.testPillTextActive]}>
                ANM-QR-NCD-SYNC
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
              placeholder="सत्र कोड (उदा. ANM-QR-CHILD-VAX)"
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
