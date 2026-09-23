import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { SpeechEngine } from '../voice/speechEngine';

export interface VoiceGuideBannerProps {
  sectionTitle?: string;
  sectionName?: string;
  guideTextHi?: string;
  explanationHi?: string;
  guideTextEn?: string;
  explanationEn?: string;
  guideTextMr?: string;
  explanationMr?: string;
}

export const VoiceGuideBanner: React.FC<VoiceGuideBannerProps> = ({
  sectionTitle,
  sectionName,
  guideTextHi,
  explanationHi,
  guideTextEn,
  explanationEn,
  guideTextMr,
  explanationMr,
}) => {
  const { language, localeCode, ttsEnabled } = useLanguage();
  const [isSpeaking, setIsSpeaking] = useState(false);

  const title = sectionTitle || sectionName || 'आवाज़ मार्गदर्शन';
  const hiText = guideTextHi || explanationHi || '';
  const enText = guideTextEn || explanationEn || '';
  const mrText = guideTextMr || explanationMr || '';

  const spokenText =
    language === 'hi'
      ? hiText
      : language === 'mr'
      ? mrText
      : enText;

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      SpeechEngine.stop();
      setIsSpeaking(false);
      return;
    }
    if (!ttsEnabled || !spokenText) return;
    SpeechEngine.speak(
      spokenText,
      localeCode,
      0.9,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  return (
    <View style={[styles.container, isSpeaking && styles.containerSpeaking]}>
      <Text style={styles.titleText}>{title}</Text>
      <TouchableOpacity
        style={[styles.speakerBtn, isSpeaking && styles.speakerBtnSpeaking]}
        onPress={handleToggleSpeak}
        activeOpacity={0.8}
      >
        {isSpeaking ? (
          <VolumeX size={16} color="#FFFFFF" />
        ) : (
          <Volume2 size={16} color={Colors.primary} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  containerSpeaking: {
    backgroundColor: '#DCFCE7',
    borderColor: '#4ADE80',
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    flex: 1,
  },
  speakerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  speakerBtnSpeaking: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
});
