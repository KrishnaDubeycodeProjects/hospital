import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { Phone, ShieldCheck, ArrowRight, MessageSquare, UserPlus, HelpCircle } from 'lucide-react-native';

export const LoginScreen: React.FC = () => {
  const { sendOtp, verifyOtp, setAuthScreen } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    setStatusMessage(null);
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      setStatusMessage({ type: 'error', text: 'कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें।' });
      return;
    }

    setLoadingSend(true);
    const result = await sendOtp(phone);
    setLoadingSend(false);

    if (result.success) {
      setOtpSent(true);
      setCountdown(60);
      setStatusMessage({ type: 'success', text: result.message });
    } else {
      setStatusMessage({ type: 'error', text: result.message });
    }
  };

  const handleVerifyOtp = async () => {
    setStatusMessage(null);
    if (!otp || otp.trim().length < 4) {
      setStatusMessage({ type: 'error', text: 'कृपया 6-अंकीय OTP कोड दर्ज करें।' });
      return;
    }

    setLoadingVerify(true);
    const result = await verifyOtp(phone, otp);
    setLoadingVerify(false);

    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.message });
    }
  };

  const logoSource = Platform.OS === 'web'
    ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
    : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* App Logo & Header */}
        <View style={styles.headerArea}>
          <View style={styles.logoCircle}>
            <Image source={logoSource} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>Aarogya Flow</Text>
          <Text style={styles.appHindi}>आरोग्य फ़्लो • स्वास्थ्य कार्यकर्ता पोर्टल</Text>
          <Text style={styles.appSubtitle}>आशा, एएनएम एवं सीएचओ डिजिटल कार्यप्रणाली</Text>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={22} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>लॉगइन करें (Sign In)</Text>
              <Text style={styles.cardSub}>सुरक्षित फ़ोन OTP सत्यापन</Text>
            </View>
          </View>

          {/* Status Alert Banner */}
          {statusMessage && (
            <View
              style={[
                styles.alertBanner,
                statusMessage.type === 'success' ? styles.alertSuccess : styles.alertError,
              ]}
            >
              <Text
                style={[
                  styles.alertText,
                  statusMessage.type === 'success' ? styles.alertTextSuccess : styles.alertTextError,
                ]}
              >
                {statusMessage.text}
              </Text>
            </View>
          )}

          {/* Phone Input */}
          <Text style={styles.fieldLabel}>मोबाइल नंबर (Phone Number)</Text>
          <View style={styles.phoneInputRow}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="98765 43210"
              placeholderTextColor="#9CA3AF"
              editable={!loadingSend && !loadingVerify}
            />
          </View>

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[styles.sendOtpBtn, (loadingSend || countdown > 0) && styles.btnDisabled]}
            onPress={handleSendOtp}
            disabled={loadingSend || countdown > 0}
            activeOpacity={0.8}
          >
            {loadingSend ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.btnRow}>
                <MessageSquare size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.sendOtpBtnText}>
                  {countdown > 0 ? `पुनः भेजें (${countdown}s)` : otpSent ? 'OTP पुनः भेजें (Resend OTP)' : 'OTP प्राप्त करें (Send OTP)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              📲 OTP कोड <Text style={{ fontWeight: '700' }}>Twilio SMS</Text> तथा{' '}
              <Text style={{ fontWeight: '700' }}>WhatsApp</Text> दोनों पर भेजा जाएगा।
            </Text>
          </View>

          {/* OTP Input Section (Visible once OTP is sent) */}
          {otpSent && (
            <View style={styles.otpSection}>
              <Text style={styles.fieldLabel}>6-अंकीय OTP कोड दर्ज करें (Enter OTP)</Text>
              <TextInput
                style={styles.otpInput}
                keyboardType="number-pad"
                value={otp}
                onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                placeholderTextColor="#9CA3AF"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.verifyBtn, loadingVerify && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loadingVerify}
                activeOpacity={0.85}
              >
                {loadingVerify ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.btnRow}>
                    <Text style={styles.verifyBtnText}>सत्यापित करें और लॉगइन करें (Verify & Login)</Text>
                    <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* Footer Navigation Links */}
          <View style={styles.footerLinks}>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => setAuthScreen('register')}
              activeOpacity={0.7}
            >
              <UserPlus size={15} color={Colors.primary} style={{ marginRight: 5 }} />
              <Text style={styles.linkText}>नया स्वास्थ्य कार्यकर्ता? <Text style={styles.linkTextBold}>पंजीकरण करें (Register)</Text></Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkRow, { marginTop: 10 }]}
              onPress={() => setAuthScreen('forgot')}
              activeOpacity={0.7}
            >
              <HelpCircle size={15} color="#6B7280" style={{ marginRight: 5 }} />
              <Text style={styles.linkTextSub}>खाता समस्या या रीसेट? <Text style={styles.linkTextBold}>मदद प्राप्त करें (Help)</Text></Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Security Badge */}
        <View style={styles.securityRow}>
          <ShieldCheck size={14} color="#059669" />
          <Text style={styles.securityText}>राष्ट्रीय स्वास्थ्य मिशन (NHM) • 100% सुरक्षित डेटा एन्क्रिप्शन</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 28,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  appHindi: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  alertBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  alertSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  alertError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertText: {
    fontSize: 11.5,
    textAlign: 'center',
    fontWeight: '600',
  },
  alertTextSuccess: {
    color: '#065F46',
  },
  alertTextError: {
    color: '#991B1B',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  countryCodeBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#CBD5E1',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  sendOtpBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOtpBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBox: {
    backgroundColor: '#F0FDFA',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  hintText: {
    fontSize: 10.5,
    color: '#0F766E',
    textAlign: 'center',
    lineHeight: 15,
  },
  otpSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 12,
  },
  verifyBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  demoFillBtn: {
    marginTop: 16,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoFillText: {
    fontSize: 10.5,
    color: '#0D9488',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 18,
  },
  footerLinks: {
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 12,
    color: '#475569',
  },
  linkTextSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  linkTextBold: {
    color: Colors.primary,
    fontWeight: '700',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  securityText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
});
