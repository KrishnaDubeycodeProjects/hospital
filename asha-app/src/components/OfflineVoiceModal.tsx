import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  Mic,
  X,
  Check,
  Volume2,
  Settings,
  Download,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react-native';
import { SpeechEngine } from '../voice/speechEngine';

export interface VoiceModalProps {
  visible: boolean;
  lang?: string;
  onResult: (text: string) => void;
  onClose: () => void;
}

const COMMON_OFFLINE_PHRASES: Record<string, string[]> = {
  hi: [
    'हाँ (Yes)',
    'नहीं (No)',
    'सामान्य (Normal)',
    'उच्च जोखिम (High Risk)',
    'टीकाकरण पूर्ण हुआ (Vaccinated)',
    'रक्तचाप 120/80 (BP 120/80)',
    'आयरन गोलियां दी गईं (IFA Given)',
    'गर्भवती महिला (ANC Patient)',
    'शिशु स्वस्थ है (Healthy Baby)',
  ],
  en: [
    'Yes',
    'No',
    'Normal',
    'High Risk',
    'Vaccination Done',
    'BP 120/80',
    'IFA Tablets Given',
    'ANC Checkup Done',
    'Healthy Child',
  ],
  mr: [
    'होय (Yes)',
    'नाही (No)',
    'सामान्य (Normal)',
    'लसीकरण पूर्ण (Vaccinated)',
    'रक्तदाब 120/80',
    'औषध दिले',
  ],
};

export const OfflineVoiceModal: React.FC<VoiceModalProps> = ({
  visible,
  lang = 'hi-IN',
  onResult,
  onClose,
}) => {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [inputText, setInputText] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const webRecognizerRef = useRef<any>(null);

  const langKey = lang.toLowerCase().startsWith('mr')
    ? 'mr'
    : lang.toLowerCase().startsWith('en')
    ? 'en'
    : 'hi';

  const phrases = COMMON_OFFLINE_PHRASES[langKey] || COMMON_OFFLINE_PHRASES.hi;

  useEffect(() => {
    if (visible) {
      setInputText('');
      // Pulse animation to simulate microphone listening
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Audio feedback when mic opens
      SpeechEngine.speak('कृपया बोलें या चुनें', lang).catch(() => {});

      // Auto-focus input after brief delay so keyboard mic icon is immediately available
      setTimeout(() => {
        inputRef.current?.focus();
      }, 350);

      // On Web platform: use browser Web Speech API
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recognizer = new SpeechRecognition();
            recognizer.lang = lang;
            recognizer.continuous = true;
            recognizer.interimResults = true;
            recognizer.onresult = (event: any) => {
              const current = event.results[event.results.length - 1][0].transcript;
              if (current) {
                setInputText(current);
              }
            };
            recognizer.start();
            webRecognizerRef.current = recognizer;
          } catch (e) {
            // Browser speech recognition not allowed or unavailable
          }
        }
      }
    } else {
      pulseAnim.setValue(1);
      if (webRecognizerRef.current) {
        try {
          webRecognizerRef.current.stop();
        } catch (e) {}
        webRecognizerRef.current = null;
      }
    }

    return () => {
      if (webRecognizerRef.current) {
        try {
          webRecognizerRef.current.stop();
        } catch (e) {}
      }
    };
  }, [visible]);

  const handleSelectPhrase = (phrase: string) => {
    const clean = phrase.split(' (')[0].trim();
    setInputText((prev) => (prev ? `${prev} ${clean}` : clean));
  };

  const handleConfirm = () => {
    const finalVal = inputText.trim() || 'सामान्य';
    onResult(finalVal);
    onClose();
  };

  const openOfflineSpeechSettings = async () => {
    if (Platform.OS === 'android') {
      try {
        // Direct intent to Android Voice Input / Speech Recognition Settings
        await Linking.sendIntent('android.settings.VOICE_INPUT_SETTINGS');
      } catch (e1) {
        try {
          await Linking.sendIntent('android.settings.INPUT_METHOD_SETTINGS');
        } catch (e2) {
          await Linking.openSettings();
        }
      }
    } else {
      await Linking.openSettings();
    }
  };

  const handleMicTap = () => {
    inputRef.current?.focus();
    SpeechEngine.speak('बोलना शुरू करें', lang).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Volume2 size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.title}>ऑफ़लाइन आवाज़ इनपुट (Voice Input)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
            {/* Animated Mic Visualizer */}
            <View style={styles.micContainer}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <TouchableOpacity
                onPress={handleMicTap}
                activeOpacity={0.8}
                style={styles.micCircle}
              >
                <Mic size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.listeningText}>
                आवाज़ से बोलें या नीचे चुनें
              </Text>
              <Text style={styles.hintSub}>
                माइक्रोफ़ोन दबाकर बोलें या कीबोर्ड का 🎙️ माइक प्रयोग करें
              </Text>
            </View>

            {/* Offline Speech Model Setup Banner */}
            <View style={styles.offlineSetupBanner}>
              <View style={styles.setupBannerHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Download size={16} color="#B45309" style={{ marginRight: 6 }} />
                  <Text style={styles.setupBannerTitle}>
                    100% ऑफ़लाइन वॉइस सेटअप (Offline STT Model)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSetupGuide(!showSetupGuide)}
                  style={styles.infoToggleBtn}
                >
                  {showSetupGuide ? (
                    <ChevronUp size={16} color="#B45309" />
                  ) : (
                    <ChevronDown size={16} color="#B45309" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.setupBannerSub}>
                बिना इंटरनेट आवाज़ से लिखने के लिए फोन में हिन्दी वॉइस पैक इंस्टॉल करें:
              </Text>

              <TouchableOpacity
                style={styles.openSettingsBtn}
                onPress={openOfflineSpeechSettings}
                activeOpacity={0.8}
              >
                <Settings size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.openSettingsText}>
                  फोन वॉइस सेटिंग्स खोलें (Open Voice Settings)
                </Text>
              </TouchableOpacity>

              {showSetupGuide && (
                <View style={styles.setupGuideBox}>
                  <Text style={styles.stepText}>
                    1. ऊपर बटन दबाकर <Text style={styles.boldText}>Google Voice Typing</Text> में जाएं।
                  </Text>
                  <Text style={styles.stepText}>
                    2. <Text style={styles.boldText}>Offline speech recognition</Text> (ऑफ़लाइन बोली पहचान) पर टैप करें।
                  </Text>
                  <Text style={styles.stepText}>
                    3. <Text style={styles.boldText}>हिन्दी (भारत)</Text> डाउनलोड करें (~20 MB)।
                  </Text>
                  <Text style={[styles.stepText, { color: Colors.visitedGreen, marginTop: 4 }]}>
                    ✓ इसके बाद इंटरनेट के बिना भी कीबोर्ड का माइक सीधे लिखेगा!
                  </Text>
                </View>
              )}
            </View>

            {/* Quick Speech Phrases Chips */}
            <View style={styles.chipsSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Sparkles size={14} color={Colors.primary} style={{ marginRight: 5 }} />
                <Text style={styles.chipsLabel}>त्वरित विकल्प (1-Tap Quick Options):</Text>
              </View>
              <View style={styles.chipsRow}>
                {phrases.map((phrase, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.chip}
                    onPress={() => handleSelectPhrase(phrase)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipText}>{phrase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Transcription Input Box */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputHeaderRow}>
                <Text style={styles.inputLabel}>बोला गया विवरण (Voice Notes):</Text>
                <TouchableOpacity onPress={handleMicTap} style={styles.openKeyboardBtn}>
                  <Mic size={13} color={Colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.openKeyboardText}>कीबोर्ड माइक</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="यहाँ बोलें या लिखें (e.g. सामान्य स्थिति, बीपी 120/80)..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>रद्द करें (Cancel)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitText}>स्वीकार करें (Accept)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  pulseRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(30, 64, 175, 0.15)',
  },
  micCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  listeningText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 10,
  },
  hintSub: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 3,
    paddingHorizontal: 12,
  },
  offlineSetupBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  setupBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setupBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  infoToggleBtn: {
    padding: 4,
  },
  setupBannerSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 4,
    lineHeight: 15,
  },
  openSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  openSettingsText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  setupGuideBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  stepText: {
    fontSize: 11,
    color: Colors.textPrimary,
    marginVertical: 2,
    lineHeight: 15,
  },
  boldText: {
    fontWeight: '700',
    color: '#92400E',
  },
  chipsSection: {
    marginTop: 6,
  },
  chipsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inputWrapper: {
    marginTop: 12,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  openKeyboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  openKeyboardText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 13.5,
    color: Colors.textPrimary,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  submitButton: {
    flex: 1.3,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
