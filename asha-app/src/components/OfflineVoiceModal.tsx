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
} from 'react-native';
import { Colors } from '../theme/colors';
import { Mic, X, Check, Volume2 } from 'lucide-react-native';
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
    } else {
      pulseAnim.setValue(1);
    }
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
              <Text style={styles.title}>ऑफ़लाइन वॉइस इनपुट (Voice Input)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Animated Mic Visualizer */}
          <View style={styles.micContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.micCircle}>
              <Mic size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.listeningText}>
              सुन रहे हैं... (Listening Offline)
            </Text>
            <Text style={styles.hintSub}>
              कीबोर्ड माइक से बोलें या नीचे दिए गए विकल्पों पर टैप करें
            </Text>
          </View>

          {/* Quick Speech Phrases Chips */}
          <View style={styles.chipsSection}>
            <Text style={styles.chipsLabel}>त्वरित विकल्प (Quick Speech Options):</Text>
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
            <TextInput
              style={styles.textInput}
              placeholder="बोला गया वाक्य यहाँ दिखेगा..."
              placeholderTextColor={Colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
          </View>

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
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 16,
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
    paddingVertical: 18,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(30, 64, 175, 0.15)',
  },
  micCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 12,
  },
  hintSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  chipsSection: {
    marginTop: 10,
  },
  chipsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  inputWrapper: {
    marginTop: 14,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 56,
    textAlignVertical: 'top',
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
