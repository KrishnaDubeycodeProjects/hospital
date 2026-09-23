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
  const { childVaccinations, surveys, isSyncing, sendToAnm } = useOfflineData();
  const { t } = useLanguage();

  const [selectedCluster, setSelectedCluster] = useState<'CHILD_VAX' | 'ANC' | 'NCD'>('CHILD_VAX');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const fileInputRef = useRef<any>(null);

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

  // Counts for each clustered category
  const childVaxCount = childVaccinations.length;
  const ancCount = surveys.filter((s) => s.categoryCode === 'PREGNANCY').length;
  const ncdCount = surveys.filter((s) => s.categoryCode === 'DISEASE').length;

  const handleDirectScan = async () => {
    const code = manualCode.trim() || `ANM-QR-${selectedCluster}-SYNCED`;
    await sendToAnm(selectedCluster, code);
    onSuccess();
  };

  const getClusterInfo = () => {
    switch (selectedCluster) {
      case 'CHILD_VAX':
        return {
          title: 'बाल टीकाकरण क्लस्टर (Child Vaccination)',
          count: childVaxCount,
          desc: 'सभी बच्चों के टीकाकरण रिकॉर्ड सीधे एएनएम के टीकाकरण सत्र में भेजे जाएंगे।',
        };
      case 'ANC':
        return {
          title: 'मातृ स्वास्थ्य क्लस्टर (Pregnancy ANC)',
          count: ancCount,
          desc: 'गर्भवती महिलाओं के प्रसव पूर्व जांच रिकॉर्ड सीधे एएनएम को भेजे जाएंगे।',
        };
      case 'NCD':
      default:
        return {
          title: 'गैर-संचारी रोग क्लस्टर (NCD / Cancer)',
          count: ncdCount,
          desc: 'बीपी, शुगर एवं कैंसर स्क्रीनिंग के क्लस्टर्ड फॉर्म भेजे जाएंगे।',
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
        <Text style={styles.headerTitle}>एएनएम को क्लस्टर डेटा भेजें</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Voice Guide Banner */}
        <VoiceGuideBanner
          sectionTitle="एएनएम डायरेक्ट QR सिंक"
          guideTextHi="क्लस्टर चुनें—जैसे बाल टीकाकरण या मातृ स्वास्थ्य—और एएनएम का QR कोड सीधे स्कैन करके सारा क्लस्टर डेटा तुरंत भेजें।"
          guideTextMr="क्लस्टर निवडा आणि एएनएमचा QR कोड थेट स्कॅन करून सर्व डेटा त्वरित पाठवा."
          guideTextEn="Select category cluster (Child Vaccination, ANC, or NCD) and scan the ANM's session QR code to transfer all records directly."
        />

        {/* 1. Clustered Section Options (Direct Buttons) */}
        <Text style={styles.sectionHeading}>भेजने हेतु श्रेणी क्लस्टर चुनें (Select Cluster):</Text>
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
              <Text style={styles.clusterMeta}>{childVaxCount} बच्चों का संपूर्ण टीकाकरण डेटा</Text>
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
              <Text style={styles.clusterMeta}>{ancCount} गर्भवती महिलाओं की स्वास्थ्य जांच</Text>
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
              <Text style={styles.clusterTitle}>🩺 रोग जांच (NCD / Cancer)</Text>
              <Text style={styles.clusterMeta}>{ncdCount} गैर-संचारी रोग स्क्रीनिंग फॉर्म</Text>
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

        {/* Hidden File Input for Real QR Image & Camera Decode */}
        {Platform.OS === 'web' && (
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleQrImageFile}
          />
        )}

        {/* 3. Direct QR Scan Viewfinder Card */}
        <TouchableOpacity
          style={styles.viewfinderCard}
          onPress={() => {
            if (Platform.OS === 'web' && fileInputRef.current) {
              fileInputRef.current.click();
            } else {
              handleDirectScan();
            }
          }}
          activeOpacity={0.85}
          disabled={isSyncing || isDecoding}
        >
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {isSyncing || isDecoding ? (
              <ActivityIndicator size="large" color={Colors.primary} />
            ) : (
              <Camera size={56} color={Colors.primary} />
            )}
          </View>
          <Text style={styles.reticleHintText}>
            कैमरा या QR फोटो से स्कैन करने के लिए टैप करें
          </Text>
        </TouchableOpacity>

        {scanStatusMessage ? (
          <View style={styles.scanStatusNotice}>
            <Text style={styles.scanStatusNoticeText}>{scanStatusMessage}</Text>
          </View>
        ) : null}

        {/* Action Button directly below QR viewfinder */}
        <TouchableOpacity
          style={styles.directSendBtn}
          onPress={handleDirectScan}
          activeOpacity={0.85}
          disabled={isSyncing}
        >
          <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.directSendBtnText}>
            {isSyncing ? 'डेटा भेजा जा रहा है...' : 'डायरेक्ट QR कोड से डेटा भेजें'}
          </Text>
        </TouchableOpacity>

        {/* Manual Code Option */}
        {showManualInput ? (
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="एएनएम सत्र कोड (उदा. ANM-QR-CHILD-VAX)"
              placeholderTextColor={Colors.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
            />
            <TouchableOpacity
              style={styles.manualSendBtn}
              onPress={handleDirectScan}
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
    paddingTop: 45,
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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  clusterMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clusterBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clusterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  readyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  readyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  readyDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  viewfinderCard: {
    width: '100%',
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  reticle: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
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
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    fontWeight: '600',
  },
  scanStatusNotice: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  scanStatusNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  directSendBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  directSendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  manualInputRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  manualSendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    marginLeft: 8,
  },
  manualSendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  manualToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  manualToggleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
