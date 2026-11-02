/**
 * Role-based bottom navigation — icon + one word, 48 dp+ targets, active = tinted pill.
 *   ASHA: आज · परिवार · ＋ · सिंक · मैं
 *   ANM : आज · आशा · सत्र · मैं
 *   CHO : रेफरल · आशा · मैं
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  CalendarCheck,
  Users,
  Plus,
  RefreshCw,
  UserRound,
  ClipboardList,
  QrCode,
  Route,
  type LucideIcon,
} from 'lucide-react-native';
import { UserRole } from '../context/AuthContext';
import { color, radius, icon as iconSize, useTr } from '../ui';

export type TabKey =
  | 'today'
  | 'families'
  | 'sync'
  | 'me'
  | 'anmQueue'
  | 'anmWorkers'
  | 'anmSession'
  | 'choReferrals'
  | 'choWorkers';

export function homeTabFor(role: UserRole): TabKey {
  return role === 'CHO' ? 'choReferrals' : role === 'ANM' ? 'anmQueue' : 'today';
}

interface BottomNavProps {
  role: UserRole;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onAddPress?: () => void;
  badges?: Partial<Record<TabKey, number>>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ role, activeTab, onTabChange, onAddPress, badges = {} }) => {
  const tr = useTr();

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] =
    role === 'CHO'
      ? [
          { key: 'choReferrals', label: tr('रेफरल', 'संदर्भ'), icon: Route },
          { key: 'choWorkers', label: tr('आशा', 'आशा'), icon: Users },
          { key: 'me', label: tr('मैं', 'मी'), icon: UserRound },
        ]
      : role === 'ANM'
      ? [
          { key: 'anmQueue', label: tr('आज', 'आज'), icon: ClipboardList },
          { key: 'anmWorkers', label: tr('आशा', 'आशा'), icon: Users },
          { key: 'anmSession', label: tr('सत्र', 'सत्र'), icon: QrCode },
          { key: 'me', label: tr('मैं', 'मी'), icon: UserRound },
        ]
      : [
          { key: 'today', label: tr('आज', 'आज'), icon: CalendarCheck },
          { key: 'families', label: tr('परिवार', 'कुटुंब'), icon: Users },
          { key: 'sync', label: tr('सिंक', 'सिंक'), icon: RefreshCw },
          { key: 'me', label: tr('मैं', 'मी'), icon: UserRound },
        ];

  const renderTab = (t: { key: TabKey; label: string; icon: LucideIcon }) => {
    const active = t.key === activeTab;
    const Icon = t.icon;
    const badge = badges[t.key];
    return (
      <Pressable
        key={t.key}
        onPress={() => onTabChange(t.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t.label}
        style={styles.tab}
      >
        <View style={[styles.iconPill, active && styles.iconPillActive]}>
          <Icon size={iconSize.lg} color={active ? color.accent : color.muted} strokeWidth={active ? 2.4 : iconSize.stroke} />
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
          {t.label}
        </Text>
      </Pressable>
    );
  };

  // ASHA: big centre ＋ between परिवार and सिंक
  const showAdd = role === 'ASHA' && !!onAddPress;
  const left = showAdd ? tabs.slice(0, 2) : tabs;
  const right = showAdd ? tabs.slice(2) : [];

  return (
    <View style={styles.bar}>
      {left.map(renderTab)}
      {showAdd ? (
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel={tr('नया जोड़ें', 'नवीन जोडा')}
          style={({ pressed }) => [styles.addWrap, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <View style={styles.addButton}>
            <Plus size={30} color={color.white} strokeWidth={2.6} />
          </View>
        </Pressable>
      ) : null}
      {right.map(renderTab)}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2 },
  iconPill: {
    width: 56,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: { backgroundColor: color.accentSoft },
  label: { fontSize: 12, fontWeight: '700', color: color.muted, lineHeight: 17 },
  labelActive: { color: color.accent },
  badge: {
    position: 'absolute',
    top: -4,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: color.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.surface,
  },
  badgeText: { color: color.white, fontSize: 10, fontWeight: '800' },
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 4,
    borderColor: color.surface,
    shadowColor: color.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
