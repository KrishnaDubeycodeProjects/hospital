import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  Mic,
  MicOff,
  X,
  Check,
  Volume2,
  Sparkles,
} from 'lucide-react-native';
import { SpeechEngine } from '../voice/speechEngine';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

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
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState('सुन रहे हैं... (Listening)');

  const langKey = lang.toLowerCase().startsWith('mr')
    ? 'mr'
    : lang.toLowerCase().startsWith('en')
    ? 'en'
    : 'hi';

  const phrases = COMMON_OFFLINE_PHRASES[langKey] || COMMON_OFFLINE_PHRASES.hi;

  // Real-time Native Speech Recognition Event Listeners
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setStatusText('बोलिए, सुन रहे हैं... (Speak now)');
  });

  useSpeechRecognitionEvent('speechend', () => {
    setStatusText('आवाज़ प्रोसेस हो रही है... (Processing)');
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setStatusText('आवाज़ रिकॉर्ड हुई (Tap mic to speak again)');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setInputText(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('Speech recognition notice:', event.error);
    setIsListening(false);
    setStatusText('टैप करके दोबारा बोलें या नीचे चुनें');
  });

  // Start native speech recognition automatically when modal opens
  const startSpeechRecognition = async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setStatusText('माइक्रोफ़ोन अनुमति दें');
        return;
      }

      await ExpoSpeechRecognitionModule.stop();
      ExpoSpeechRecognitionModule.start({
        lang: lang || 'hi-IN',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
      setIsListening(true);
      setStatusText('बोलिए, सुन रहे हैं... (Speak now)');
    } catch (e) {
      console.warn('Speech recognition start note:', e);
      setIsListening(false);
      setStatusText('नीचे दिए गए विकल्पों पर टैप करें');
    }
  };

  const stopSpeechRecognition = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (e) {}
    setIsListening(false);
  };

  useEffect(() => {
    if (visible) {
      setInputText('');
      setStatusText('तैयार हो रहा है... (Starting)');

      // Pulse animation
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

      // Audio greeting
      SpeechEngine.speak('कृपया बोलें या चुनें', lang).catch(() => {});

      // Automatically start speech recognition without requiring user to touch anything
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 400);

      return () => clearTimeout(timer);
    } else {
      pulseAnim.setValue(1);
      stopSpeechRecognition();
    }
  }, [visible]);

  const toggleListening = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const handleSelectPhrase = (phrase: string) => {
    const clean = phrase.split(' (')[0].trim();
    setInputText((prev) => (prev ? `${prev} ${clean}` : clean));
  };

  const handleConfirm = () => {
    stopSpeechRecognition();
    const finalVal = inputText.trim() || 'सामान्य';
    onResult(finalVal);
    onClose();
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
              <Text style={styles.title}>ऑफ़लाइन वॉइस इनपुट (Automatic Voice)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {/* Animated Mic Visualizer */}
            <View style={styles.micContainer}>
              {isListening && (
                <Animated.View
                  style={[
                    styles.pulseRing,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
              )}
              <TouchableOpacity
                onPress={toggleListening}
                activeOpacity={0.8}
                style={[
                  styles.micCircle,
                  !isListening && { backgroundColor: Colors.textSecondary },
                ]}
              >
                {isListening ? (
                  <Mic size={32} color="#FFFFFF" />
                ) : (
                  <MicOff size={30} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <Text style={styles.listeningText}>
                {statusText}
              </Text>
              <Text style={styles.hintSub}>
                {isListening
                  ? 'हिंदी या अंग्रेजी में बोलें — अपने आप लिखा जाएगा'
                  : 'माइक्रोफोन पर टैप करके फिर से बोलें'}
              </Text>
            </View>

            {/* Live Transcription Box */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>बोला गया विवरण (Recognized Text):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="यहाँ आपका बोला गया वाक्य अपने आप लिखा जाएगा..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
            </View>

            {/* 1-Tap Quick Options */}
            <View style={styles.chipsSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Sparkles size={14} color={Colors.primary} style={{ marginRight: 5 }} />
                <Text style={styles.chipsLabel}>त्वरित विकल्प (1-Tap Clinical Options):</Text>
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
              <Text style={styles.submitText}>स्वीकार करें (Save)</Text>
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
    paddingVertical: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(30, 64, 175, 0.18)',
  },
  micCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
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
  inputWrapper: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  chipsSection: {
    marginTop: 14,
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
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
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
    paddingVertical: 12,
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
