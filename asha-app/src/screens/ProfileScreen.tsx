/**
 * मैं (Me) hub — server-loaded profile (read-only) + settings rows:
 * भाषा · आवाज़ · बैठकें · प्रशिक्षण · लॉगआउट.
 *
 * Preserved brand treatment: white squircle logo (borderRadius 24, #FFFFFF) with the entry
 * spring zoom, ambient breathing pulse and tap-zoom spring.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, Animated, Easing, Switch } from 'react-native';
import {
  Languages,
  Volume2,
  VolumeX,
  Users,
  GraduationCap,
  LogOut,
  MapPin,
  Phone,
  House,
  ShieldCheck,
  UserRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { NhmCoursesCard } from '../components/NhmCoursesCard';
import { Screen, Card, ListRow, SectionTitle, Button, StatusPill, color, space, text, useTr } from '../ui';

export const ProfileScreen: React.FC<{ onOpenMeetings?: () => void }> = ({ onOpenMeetings }) => {
  const { user, logout } = useAuth();
  const { families } = useOfflineData();
  // ASHA: live count of her registered households on this device (includes families added since
  // login and everything merged from the server); other cadres use the server-reported figure.
  const householdCount = user.role === 'ASHA' ? families.length : user.householdCount;
  const { language, setLanguage, ttsEnabled, setTtsEnabled } = useLanguage();
  const tr = useTr();
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Squircle logo animations (preserved)
  const zoomScale = useRef(new Animated.Value(0.3)).current;
  const zoomOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Initial spring zoom-in on screen open
    Animated.parallel([
      Animated.spring(zoomScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      Animated.timing(zoomOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      // 2. Continuous subtle breathing zoom loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1.0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    });
  }, [zoomScale, zoomOpacity, pulseScale]);

  // Interactive tap zoom effect (preserved)
  const handleAvatarZoomPress = () => {
    Animated.sequence([
      Animated.timing(zoomScale, { toValue: 0.9, duration: 90, useNativeDriver: true }),
      Animated.spring(zoomScale, { toValue: 1.12, friction: 3, tension: 50, useNativeDriver: true }),
      Animated.spring(zoomScale, { toValue: 1.0, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const logoSource =
    Platform.OS === 'web'
      ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
      : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  const cadre =
    user.role === 'CHO'
      ? tr('सामुदायिक स्वास्थ्य अधिकारी', 'समुदाय आरोग्य अधिकारी')
      : user.role === 'ANM'
      ? tr('एएनएम', 'एएनएम')
      : tr('आशा कार्यकर्ता', 'आशा कार्यकर्ती');

  const area = [user.blockName, user.districtName].filter(Boolean).join(' • ');

  return (
    <Screen>
      {/* Profile header */}
      <Card style={styles.headerCard}>
        <Pressable onPress={handleAvatarZoomPress} accessibilityRole="imagebutton" accessibilityLabel={user.name} style={styles.avatarTouch}>
          <Animated.View
            style={[
              styles.avatarSquircle,
              { opacity: zoomOpacity, transform: [{ scale: Animated.multiply(zoomScale, pulseScale) }] },
            ]}
          >
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </Pressable>
        <Text style={[text.title, styles.center]} numberOfLines={2}>
          {user.name || '—'}
        </Text>
        <StatusPill tone="accent" icon={ShieldCheck} label={cadre} />
      </Card>

      {/* Server-assigned details (read-only) */}
      <View style={styles.list}>
        <ListRow icon={MapPin} title={user.village || '—'} subtitle={area || undefined} />
        <ListRow icon={Phone} tone="neutral" title={user.phone || '—'} />
        {householdCount != null ? (
          <ListRow
            icon={House}
            title={`${householdCount} ${tr('परिवार', 'कुटुंबे')}`}
            subtitle={tr('आवंटित घर', 'नेमून दिलेली घरे')}
          />
        ) : null}
        {user.assignedAnm ? (
          <ListRow icon={UserRound} tone="neutral" title={user.assignedAnm} subtitle={tr('पर्यवेक्षक', 'पर्यवेक्षक')} />
        ) : null}
      </View>

      <SectionTitle label={tr('सेटिंग्स', 'सेटिंग्ज')} />
      <View style={styles.list}>
        <ListRow
          icon={Languages}
          title={tr('भाषा', 'भाषा')}
          subtitle={language === 'mr' ? 'मराठी' : 'हिंदी'}
          onPress={() => setLanguage(language === 'hi' ? 'mr' : 'hi')}
          right={<StatusPill tone="accent" label={language === 'hi' ? 'मराठी' : 'हिंदी'} />}
        />
        <ListRow
          icon={ttsEnabled ? Volume2 : VolumeX}
          tone={ttsEnabled ? 'accent' : 'neutral'}
          title={tr('आवाज़', 'आवाज')}
          subtitle={ttsEnabled ? tr('चालू', 'चालू') : tr('बंद', 'बंद')}
          onPress={() => setTtsEnabled(!ttsEnabled)}
          right={
            <Switch
              value={ttsEnabled}
              onValueChange={setTtsEnabled}
              trackColor={{ true: color.accentLine, false: color.line }}
              thumbColor={ttsEnabled ? color.accent : color.faint}
              accessibilityLabel={tr('आवाज़', 'आवाज')}
            />
          }
        />
        {user.role === 'ASHA' && onOpenMeetings ? (
          <ListRow icon={Users} title={tr('बैठकें', 'बैठका')} subtitle={tr('ग्राम सभा, VHSNC', 'ग्रामसभा, VHSNC')} onPress={onOpenMeetings} />
        ) : null}
        <ListRow
          icon={GraduationCap}
          title={tr('प्रशिक्षण', 'प्रशिक्षण')}
          subtitle={tr('NHM पाठ्यक्रम', 'NHM अभ्यासक्रम')}
          onPress={() => setCoursesOpen((o) => !o)}
          right={coursesOpen ? <ChevronUp size={20} color={color.faint} strokeWidth={2} /> : <ChevronDown size={20} color={color.faint} strokeWidth={2} />}
        />
      </View>
      {coursesOpen ? <NhmCoursesCard /> : null}

      {confirmLogout ? (
        <Card tone="red">
          <Text style={[text.heading, styles.center]}>{tr('लॉगआउट करें?', 'लॉगआउट करायचे?')}</Text>
          <Text style={[text.caption, styles.center]}>{tr('बिना सिंक डेटा फोन में रहेगा', 'सिंक न झालेला डेटा फोनमध्ये राहील')}</Text>
          <View style={styles.confirmRow}>
            <View style={styles.flex}>
              <Button label={tr('रद्द करें', 'रद्द करा')} variant="secondary" onPress={() => setConfirmLogout(false)} />
            </View>
            <View style={styles.flex}>
              <Button label={tr('लॉगआउट', 'लॉगआउट')} icon={LogOut} variant="danger" onPress={() => logout()} />
            </View>
          </View>
        </Card>
      ) : (
        <Button label={tr('लॉगआउट', 'लॉगआउट')} icon={LogOut} variant="secondary" onPress={() => setConfirmLogout(true)} />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  list: { gap: space.sm },
  headerCard: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  avatarTouch: { alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  // Clear avatar logo
  avatarSquircle: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 88, height: 88 },
  confirmRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
});
