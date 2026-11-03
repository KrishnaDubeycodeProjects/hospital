/**
 * Mic button for a form field. One tap → listening starts immediately (no popup).
 * The spoken answer is cleaned for the field (phone digits, name without "मेरा नाम…", numbers, BP…):
 * short fields are replaced on each new attempt, comment fields (`long`) keep appending.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Animated } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { Dictation, speechLocale } from '../voice/dictation';
import { VoiceKind, applySpokenValue } from '../voice/smartExtract';
import { color, radius, touch } from './theme';

export interface VoiceState {
  listening: boolean;
  partial: string | null;
  /** Something was heard but nothing usable could be extracted for this field. */
  notUnderstood: boolean;
}

export const VoiceMic: React.FC<{
  kind: VoiceKind;
  value: string;
  onChangeText: (v: string) => void;
  label: string; // a11y
  onStateChange?: (s: VoiceState) => void;
}> = ({ kind, value, onChangeText, label, onStateChange }) => {
  const { language } = useLanguage();
  const [listening, setListening] = useState(false);
  const sessionRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChangeText);
  onChangeRef.current = onChangeText;
  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!listening) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  // Field unmounted (sheet closed) while listening → cancel quietly.
  useEffect(() => () => {
    if (sessionRef.current !== null) Dictation.cancel(sessionRef.current);
  }, []);

  const onPress = () => {
    if (listening) {
      Dictation.stop();
      return;
    }
    // Comment fields append to what is there when the mic was tapped; other fields are replaced.
    const base = valueRef.current;
    let notUnderstood = false;
    setListening(true);
    stateRef.current?.({ listening: true, partial: null, notUnderstood: false });
    sessionRef.current = Dictation.start(speechLocale(language), {
      onPartial: (t) => stateRef.current?.({ listening: true, partial: t, notUnderstood: false }),
      onFinal: (t) => {
        const next = applySpokenValue(kind, base, t);
        if (next !== null) onChangeRef.current(next);
        notUnderstood = next === null;
      },
      onEnd: () => {
        sessionRef.current = null;
        setListening(false);
        stateRef.current?.({ listening: false, partial: null, notUnderstood });
      },
    });
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: listening }}
        hitSlop={4}
        style={({ pressed }) => [styles.mic, listening && styles.micActive, pressed && styles.pressed]}
      >
        {listening ? (
          <Square size={18} color={color.white} fill={color.white} strokeWidth={2} />
        ) : (
          <Mic size={22} color={color.accent} strokeWidth={2} />
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  mic: {
    width: touch,
    height: touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentSoft,
  },
  micActive: { backgroundColor: color.red },
  pressed: { transform: [{ scale: 0.94 }] },
});
