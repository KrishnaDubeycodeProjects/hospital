/**
 * Slim status strip for the speech-to-text pack of the worker's selected language.
 *   missing / failed → "आवाज़ पैक नहीं" + डाउनलोड करें
 *   downloading      → spinner, stays until the model is confirmed installed
 *   scheduled        → waiting for Wi-Fi
 *   just became ready → green "आवाज़ तैयार" for a few seconds, then hides
 * Hidden when the pack is ready or the phone has no on-device model API.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Mic, Download, CircleCheck, Wifi, X } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { speechLocale } from '../voice/dictation';
import { downloadVoicePack, getVoicePackState, refreshVoicePack, subscribeVoicePacks, VoicePackState } from '../voice/languagePack';
import { voiceLanguageName } from '../voice/voicePackPrompt';
import { color, radius, space, touch } from '../ui';

const READY_NOTICE_MS = 4000;

export const VoicePackBanner: React.FC = () => {
  const { language } = useLanguage();
  const locale = speechLocale(language);
  const L = (hi: string, mr: string, en: string) => (language === 'mr' ? mr : language === 'en' ? en : hi);

  const [state, setState] = useState<VoicePackState>(() => getVoicePackState(locale));
  const [justReady, setJustReady] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const prev = useRef<VoicePackState>(state);

  useEffect(() => {
    const sync = () => setState(getVoicePackState(locale));
    sync();
    refreshVoicePack(locale).catch(() => {});
    return subscribeVoicePacks(sync);
  }, [locale]);

  // Announce completion only when we watched a download finish.
  useEffect(() => {
    const was = prev.current;
    prev.current = state;
    if (state === 'ready' && (was === 'downloading' || was === 'scheduled')) {
      setJustReady(true);
      const t = setTimeout(() => setJustReady(false), READY_NOTICE_MS);
      return () => clearTimeout(t);
    }
  }, [state]);

  const name = voiceLanguageName(locale);

  if (state === 'ready') {
    if (!justReady) return null;
    return (
      <View style={[styles.bar, styles.green]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <CircleCheck size={18} color={color.green} strokeWidth={2.2} />
        <Text style={[styles.text, { color: color.greenText }]} numberOfLines={2}>
          {L(`${name} आवाज़ तैयार — माइक दबाएँ`, `${name} आवाज तयार — माइक दाबा`, `${name} voice ready — tap the mic`)}
        </Text>
      </View>
    );
  }

  if (state === 'downloading') {
    return (
      <View style={[styles.bar, styles.accent]} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={color.accent} />
        <Text style={[styles.text, { color: color.accentPressed }]} numberOfLines={2}>
          {L(`${name} आवाज़ डाउनलोड हो रही है…`, `${name} आवाज डाउनलोड होत आहे…`, `Downloading ${name} voice…`)}
        </Text>
      </View>
    );
  }

  if (dismissed[locale]) return null;

  if (state === 'scheduled') {
    return (
      <View style={[styles.bar, styles.amber]}>
        <Wifi size={18} color={color.amber} strokeWidth={2.2} />
        <Text style={[styles.text, { color: color.amberText }]} numberOfLines={2}>
          {L('Wi-Fi मिलने पर डाउनलोड होगा', 'Wi-Fi मिळाल्यावर डाउनलोड होईल', 'Will download on Wi-Fi')}
        </Text>
        <Pressable onPress={() => void downloadVoicePack(locale)} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>{L('फिर कोशिश', 'पुन्हा प्रयत्न', 'Try again')}</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'missing' || state === 'failed') {
    return (
      <View style={[styles.bar, styles.amber]}>
        <Mic size={18} color={color.amber} strokeWidth={2.2} />
        <Text style={[styles.text, { color: color.amberText }]} numberOfLines={2}>
          {state === 'failed'
            ? L('डाउनलोड अधूरा रहा', 'डाउनलोड अपूर्ण राहिले', 'Download did not finish')
            : L(`${name} आवाज़ पैक नहीं`, `${name} आवाज पॅक नाही`, `No ${name} voice pack`)}
        </Text>
        <Pressable
          onPress={() => void downloadVoicePack(locale)}
          accessibilityRole="button"
          accessibilityLabel={L('डाउनलोड करें', 'डाउनलोड करा', 'Download')}
          style={styles.action}
        >
          <Download size={16} color={color.white} strokeWidth={2.4} />
          <Text style={styles.actionText}>{L('डाउनलोड करें', 'डाउनलोड करा', 'Download')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setDismissed((d) => ({ ...d, [locale]: true }))}
          accessibilityRole="button"
          accessibilityLabel={L('बंद करें', 'बंद करा', 'Close')}
          hitSlop={8}
          style={styles.close}
        >
          <X size={18} color={color.muted} strokeWidth={2.2} />
        </Pressable>
      </View>
    );
  }

  return null; // checking / unsupported
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    minHeight: 52,
    borderBottomWidth: 1,
  },
  accent: { backgroundColor: color.accentSoft, borderBottomColor: color.accentLine },
  green: { backgroundColor: color.greenSoft, borderBottomColor: color.greenLine },
  amber: { backgroundColor: color.amberSoft, borderBottomColor: color.amberLine },
  text: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.control,
    backgroundColor: color.accent,
  },
  actionText: { color: color.white, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  close: { width: touch - 8, height: touch - 8, alignItems: 'center', justifyContent: 'center' },
});
