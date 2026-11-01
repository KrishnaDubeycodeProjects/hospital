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
import { useAuth, UserRole } from '../context/AuthContext';
import { UserPlus, ShieldCheck, ArrowRight, MessageSquare, ArrowLeft, Check } from 'lucide-react-native';

export const RegisterScreen: React.FC = () => {
  const { sendOtp, registerWorker, setAuthScreen } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('ASHA');
  const [village, setVillage] = useState('Chandpur Village');
  const [blockName, setBlockName] = useState('Rampur Block');
  const [districtName, setDistrictName] = useState('Varanasi');
  const [ashaId, setAshaId] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
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
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'कृपया अपना पूरा नाम दर्ज करें।' });
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

  const handleRegister = async () => {
    setStatusMessage(null);
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'कृपया पूरा नाम दर्ज करें।' });
      return;
    }
    if (!otp || otp.trim().length < 4) {
      setStatusMessage({ type: 'error', text: 'कृपया सत्यापन हेतु OTP कोड दर्ज करें।' });
      return;
    }

    setLoadingRegister(true);
    const result = await registerWorker(
      {
        name: name.trim(),
        phone: phone.trim(),
        role,
        village: village.trim(),
        blockName: blockName.trim(),
        districtName: districtName.trim(),
        ashaId: ashaId.trim() || `${role}-${Date.now().toString().slice(-4)}`,
      },
      otp
    );
    setLoadingRegister(false);

    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.message });
    }
  };

  const rolesList: { key: UserRole; title: string; icon: string; sub: string }[] = [
    { key: 'ASHA', title: 'आशा कार्यकर्ता', icon: '🌸', sub: 'ASHA Worker' },
    { key: 'ANM', title: 'एएनएम मिडवाइफ', icon: '🩺', sub: 'ANM Midwife' },
    { key: 'CHO', title: 'सीएचओ डॉक्टर', icon: '🏥', sub: 'CHO Officer' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back to Login Header */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setAuthScreen('login')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={16} color={Colors.primary} />
          <Text style={styles.backBtnText}>लॉगइन पर वापस जाएं (Back to Login)</Text>
        </TouchableOpacity>

        {/* Main Registration Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <UserPlus size={22} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>नया कार्यकर्ता पंजीकरण</Text>
              <Text style={styles.cardSub}>Official Health Worker Registration (DB)</Text>
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

          {/* Role Selection Tabs */}
          <Text style={styles.fieldLabel}>पद / रोल चुनें (Select Role)</Text>
          <View style={styles.rolesRow}>
            {rolesList.map((item) => {
              const isSelected = role === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.roleTab, isSelected && styles.roleTabActive]}
                  onPress={() => setRole(item.key)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  <Text style={[styles.roleTabTitle, isSelected && styles.roleTabTitleActive]}>
                    {item.title}
                  </Text>
                  <Text style={styles.roleTabSub}>{item.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Full Name */}
          <Text style={styles.fieldLabel}>पूरा नाम (Full Name) *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="उदा. सुनीता देवी (Sunita Devi)"
            placeholderTextColor="#9CA3AF"
          />

          {/* Mobile Phone */}
          <Text style={styles.fieldLabel}>मोबाइल नंबर (Phone Number) *</Text>
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
            />
          </View>

          {/* Village & Block */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.fieldLabel}>गाँव / क्षेत्र (Village)</Text>
              <TextInput
                style={styles.input}
                value={village}
                onChangeText={setVillage}
                placeholder="Chandpur Village"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.fieldLabel}>ब्लॉक / जिला (Block)</Text>
              <TextInput
                style={styles.input}
                value={blockName}
                onChangeText={setBlockName}
                placeholder="Rampur Block"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Worker ID / Registration Number */}
          <Text style={styles.fieldLabel}>आईडी / पंजीकरण संख्या (Worker ID)</Text>
          <TextInput
            style={styles.input}
            value={ashaId}
            onChangeText={setAshaId}
            placeholder={`उदा. ${role}-UP-VNS-042 (वैकल्पिक)`}
            placeholderTextColor="#9CA3AF"
          />

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
                  {countdown > 0 ? `पुनः भेजें (${countdown}s)` : otpSent ? 'OTP पुनः भेजें (Resend OTP)' : 'सत्यापन OTP भेजें (Send OTP)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              📲 OTP कोड <Text style={{ fontWeight: '700' }}>Twilio SMS</Text> तथा{' '}
              <Text style={{ fontWeight: '700' }}>WhatsApp</Text> दोनों पर तुरंत भेजा जाएगा।
            </Text>
          </View>

          {/* OTP Input Section */}
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
                style={[styles.verifyBtn, loadingRegister && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={loadingRegister}
                activeOpacity={0.85}
              >
                {loadingRegister ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.btnRow}>
                    <Text style={styles.verifyBtnText}>पंजीकरण पूर्ण करें (Complete Registration)</Text>
                    <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* Footer Navigation */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => setAuthScreen('login')}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>पहले से पंजीकृत हैं? <Text style={styles.linkTextBold}>लॉगइन करें (Sign In)</Text></Text>
          </TouchableOpacity>
        </View>

        {/* Security badge */}
        <View style={styles.securityRow}>
          <ShieldCheck size={14} color="#059669" />
          <Text style={styles.securityText}>सरकारी स्वास्थ्य डेटाबेस में सुरक्षित पंजीकरण (PostgreSQL)</Text>
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
    paddingVertical: 24,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    alignSelf: 'flex-start',
    maxWidth: 420,
    width: '100%',
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 6,
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
    marginBottom: 16,
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
    fontSize: 11,
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
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  roleTab: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  roleTabActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDF4',
  },
  roleTabTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 3,
  },
  roleTabTitleActive: {
    color: Colors.primary,
  },
  roleTabSub: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    marginBottom: 12,
  },
  twoColRow: {
    flexDirection: 'row',
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
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 12.5,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
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
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  hintText: {
    fontSize: 10,
    color: '#0F766E',
    textAlign: 'center',
  },
  otpSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 12,
  },
  verifyBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  linkRow: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 12,
    color: '#475569',
  },
  linkTextBold: {
    color: Colors.primary,
    fontWeight: '700',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  securityText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
});
