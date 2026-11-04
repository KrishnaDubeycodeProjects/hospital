/**
 * Login — phone + OTP only. Workers are registered by their CHO; the profile loads from the
 * server after verification. Unregistered numbers get AuthContext's NOT_REGISTERED_MESSAGE.
 *
 * Rendered before LanguageProvider mounts, so the hi/mr/en choice is kept locally here and saved
 * to the same storage key the LanguageProvider reads after login.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, ShieldCheck, ArrowRight, MessageSquare, RotateCcw, Pencil, AlertTriangle, CircleCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, IconBadge, color, radius, space, text } from '../ui';

const LANGUAGE_STORAGE_KEY = '@asha_selected_language';

export const LoginScreen: React.FC = () => {
  const { sendOtp, verifyOtp } = useAuth();
  const [lang, setLang] = useState<'hi' | 'mr' | 'en'>('hi');
  const tr = (hi: string, mr: string, en?: string) => (lang === 'mr' ? mr : lang === 'en' ? (en || hi) : hi);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((v) => {
        if (v === 'hi' || v === 'mr' || v === 'en') setLang(v as any);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const switchLang = (next: 'hi' | 'mr' | 'en') => {
    setLang(next);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => {});
  };

  const digits = phone.replace(/[^0-9]/g, '');

  const handleSendOtp = async () => {
    setStatus(null);
    if (digits.length !== 10) {
      setStatus({ type: 'error', text: tr('10 अंकों का मोबाइल नंबर डालें', '10 अंकी मोबाइल नंबर टाका', 'Enter 10-digit mobile number') });
      return;
    }
    setLoadingSend(true);
    const result = await sendOtp(digits);
    setLoadingSend(false);
    if (result.success) {
      setOtpSent(true);
      setOtp('');
      setCountdown(60);
      setStatus({ type: 'success', text: tr('OTP भेजा गया', 'OTP पाठवला', 'OTP Sent successfully') });
    } else {
      setStatus({ type: 'error', text: result.message });
    }
  };

  const handleVerifyOtp = async (code: string = otp) => {
    if (loadingVerify) return;
    setStatus(null);
    if (code.replace(/[^0-9]/g, '').length < 6) {
      setStatus({ type: 'error', text: tr('6 अंकों का OTP डालें', '6 अंकी OTP टाका', 'Enter 6-digit OTP') });
      return;
    }
    setLoadingVerify(true);
    const result = await verifyOtp(digits, code.trim());
    setLoadingVerify(false);
    if (!result.success) setStatus({ type: 'error', text: result.message });
  };

  const logoSource =
    Platform.OS === 'web'
      ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
      : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Language Selection */}
        <View style={styles.langRow} accessibilityRole="tablist">
          {(['hi', 'mr', 'en'] as const).map((l) => (
            <Pressable
              key={l}
              onPress={() => switchLang(l)}
              accessibilityRole="tab"
              accessibilityState={{ selected: lang === l }}
              style={[styles.langChip, lang === l && styles.langChipActive]}
            >
              <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                {l === 'hi' ? 'हिंदी' : l === 'mr' ? 'मराठी' : 'English'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Brand: clean emblem */}
        <View style={styles.brand}>
          <View style={styles.logoSquircle}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={text.title}>{tr('आरोग्य फ्लो', 'आरोग्य फ्लो', 'Aarogya Flow')}</Text>
          <Text style={text.caption}>{tr('आशा • एएनएम • सीएचओ', 'आशा • एएनएम • सीएचओ', 'ASHA • ANM • CHO')}</Text>
        </View>

        <Card>
          <View style={styles.cardHead}>
            <IconBadge icon={otpSent ? MessageSquare : ShieldCheck} tone="accent" />
            <Text style={text.heading}>{otpSent ? tr('OTP डालें', 'OTP टाका', 'Enter OTP') : tr('लॉगिन करें', 'लॉगिन करा', 'Worker Login')}</Text>
          </View>

          {status ? (
            <View style={[styles.status, status.type === 'error' ? styles.statusError : styles.statusOk]} accessibilityLiveRegion="polite">
              {status.type === 'error' ? (
                <AlertTriangle size={18} color={color.red} strokeWidth={2} />
              ) : (
                <CircleCheck size={18} color={color.green} strokeWidth={2} />
              )}
              <Text style={[text.body, styles.flex, { color: status.type === 'error' ? color.redText : color.greenText }]}>
                {status.text}
              </Text>
            </View>
          ) : null}

          {!otpSent ? (
            <View style={styles.gap}>
              <Field
                label={tr('मोबाइल नंबर', 'मोबाइल नंबर', 'Mobile Number')}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="98765 43210"
                right={<Phone size={20} color={color.faint} strokeWidth={2} />}
              />
              <Button
                label={tr('OTP भेजें', 'OTP पाठवा', 'Send OTP')}
                icon={ArrowRight}
                loading={loadingSend}
                disabled={digits.length !== 10}
                onPress={handleSendOtp}
              />
            </View>
          ) : (
            <View style={styles.gap}>
              <Pressable onPress={() => setOtpSent(false)} accessibilityRole="button" style={styles.phoneChip}>
                <Phone size={16} color={color.accent} strokeWidth={2} />
                <Text style={[text.label, styles.flex]}>+91 {digits}</Text>
                <Pencil size={16} color={color.muted} strokeWidth={2} />
              </Pressable>
              <Field
                label={tr('6 अंकों का OTP', '6 अंकी OTP', '6-Digit OTP')}
                value={otp}
                onChangeText={(v) => {
                  const next = v.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtp(next);
                  if (next.length === 6 && otp.length < 6) handleVerifyOtp(next);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                placeholder="• • • • • •"
              />
              <Button
                label={tr('सत्यापित करें', 'पडताळा', 'Verify & Login')}
                icon={ShieldCheck}
                loading={loadingVerify}
                disabled={otp.length < 6}
                onPress={() => handleVerifyOtp()}
              />
              <Button
                label={
                  countdown > 0
                    ? `${tr('पुनः भेजें', 'पुन्हा पाठवा', 'Resend')} (${countdown}s)`
                    : tr('पुनः भेजें', 'पुन्हा पाठवा', 'Resend OTP')
                }
                icon={RotateCcw}
                variant="secondary"
                disabled={countdown > 0 || loadingSend}
                loading={loadingSend}
                onPress={handleSendOtp}
              />
            </View>
          )}
        </Card>

        <Text style={styles.footnote}>
          {tr(
            'नंबर सीएचओ द्वारा पंजीकृत होता है (Universal Test OTP: 123456)',
            'नंबर सीएचओ नोंदवतात (Universal Test OTP: 123456)',
            'Field workers registered via CHO (Universal Test OTP: 123456)'
          )}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: space.lg, gap: space.xl, backgroundColor: color.canvas, justifyContent: 'center' },
  langRow: { flexDirection: 'row', alignSelf: 'flex-end', gap: space.sm },
  langChip: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipActive: { borderColor: color.accent, backgroundColor: color.accentSoft },
  langText: { fontSize: 14, fontWeight: '700', color: color.muted, lineHeight: 19 },
  langTextActive: { color: color.accentPressed },
  brand: { alignItems: 'center', gap: space.sm },
  logoSquircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  gap: { gap: space.lg },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    marginBottom: space.lg,
  },
  statusError: { backgroundColor: color.redSoft, borderColor: color.redLine },
  statusOk: { backgroundColor: color.greenSoft, borderColor: color.greenLine },
  phoneChip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    backgroundColor: color.accentSoft,
  },
  footnote: { ...text.caption, textAlign: 'center' },
});
