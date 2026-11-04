/**
 * Slim top bar: white squircle logo · app name · connectivity pill · cadre badge.
 * Language and settings live in the मैं tab; sync detail lives in the सिंक tab.
 */
import React from 'react';
import { View, Text, StyleSheet, Image, Platform, Pressable } from 'react-native';
import { Wifi, CloudOff, RefreshCw, Shield } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { StatusPill, color, space, text, useTr } from '../ui';

interface HeaderProps {
  onRolePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRolePress }) => {
  const { user } = useAuth();
  const { isSyncing, isOnline } = useOfflineData();
  const tr = useTr();

  const logoSource =
    Platform.OS === 'web'
      ? { uri: '/aarogya_flow_icon_transparent_hd.png' }
      : require('../../assets/aarogya_flow_icon_transparent_hd.png');

  const cadre = user.role === 'CHO' ? tr('सीएचओ', 'सीएचओ', 'CHO') : user.role === 'ANM' ? tr('एएनएम', 'एएनएम', 'ANM') : tr('आशा', 'आशा', 'ASHA');

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoSquircle}>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={text.heading} numberOfLines={1}>
          {tr('आरोग्य फ्लो', 'आरोग्य फ्लो', 'Aarogya Flow')}
        </Text>
      </View>

      <View style={styles.right}>
        {isSyncing ? (
          <StatusPill tone="accent" icon={RefreshCw} label={tr('सिंक', 'सिंक', 'Sync')} />
        ) : (
          <StatusPill tone={isOnline ? 'green' : 'amber'} icon={isOnline ? Wifi : CloudOff} label={isOnline ? tr('ऑनलाइन', 'ऑनलाइन', 'Online') : tr('ऑफलाइन', 'ऑफलाइन', 'Offline')} />
        )}
        <Pressable onPress={onRolePress} accessibilityRole="button" accessibilityLabel={cadre} style={styles.cadre} hitSlop={6}>
          <Shield size={13} color={color.accent} strokeWidth={2.2} />
          <Text style={styles.cadreText}>{cadre}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  // Brand logo: clear emblem
  logoSquircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%' },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cadre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: color.accentSoft,
  },
  cadreText: { fontSize: 12, fontWeight: '800', color: color.accentPressed, lineHeight: 17 },
});
