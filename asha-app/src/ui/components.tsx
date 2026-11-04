/**
 * AarogyaFlow UI kit — the only building blocks screens should use.
 * Visual-abstract rules: icon + ≤3-word label, 48 dp targets, semantic tone colours, no emoji.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  ViewStyle,
  StyleProp,
  KeyboardTypeOptions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { color, radius, space, touch, icon as iconSize, text, tonePalette, Tone, elevation } from './theme';
import { useTr } from './useTr';
import { VoiceMic, VoiceState } from './VoiceMic';
import type { VoiceKind } from '../voice/smartExtract';

// ---------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------

export const Screen: React.FC<{
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: React.ReactNode;
}> = ({ children, scroll = true, padded = true, footer }) => {
  const body = padded ? styles.screenPad : undefined;
  return (
    <View style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={[body, styles.screenScroll]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, body]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
};

/** Sub-screen top bar: back · title · optional right action. */
export const AppBar: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}> = ({ title, subtitle, onBack, backLabel, right }) => (
  <View style={styles.appBar}>
    {onBack ? (
      <IconButton icon={ChevronLeft} onPress={onBack} label={backLabel || title} />
    ) : (
      <View style={styles.appBarSpacer} />
    )}
    <View style={styles.appBarTitles}>
      <Text style={text.heading} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={text.caption} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    <View style={styles.appBarRight}>{right}</View>
  </View>
);

export const SectionTitle: React.FC<{ label: string; count?: number; action?: React.ReactNode }> = ({
  label,
  count,
  action,
}) => (
  <View style={styles.sectionTitle}>
    <Text style={text.label}>
      {label}
      {count != null ? <Text style={styles.sectionCount}>  {count}</Text> : null}
    </Text>
    {action}
  </View>
);

// ---------------------------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------------------------

export const Card: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}> = ({ children, tone, onPress, style, accessibilityLabel }) => {
  const p = tone ? tonePalette(tone) : null;
  const base = [styles.card, p && tone !== 'neutral' ? { borderColor: p.line } : null, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
};

/** Round tinted icon badge. */
export const IconBadge: React.FC<{ icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg' }> = ({
  icon: Icon,
  tone = 'accent',
  size = 'md',
}) => {
  const p = tonePalette(tone);
  const box = size === 'lg' ? 56 : size === 'sm' ? 32 : 44;
  const glyph = size === 'lg' ? iconSize.xl - 4 : size === 'sm' ? iconSize.sm : iconSize.md;
  return (
    <View style={[styles.iconBadge, { width: box, height: box, borderRadius: box / 2, backgroundColor: p.bg }]}>
      <Icon size={glyph} color={p.fg} strokeWidth={iconSize.stroke} />
    </View>
  );
};

/** Big square action tile: icon + ≤3-word label. */
export const Tile: React.FC<{
  icon: LucideIcon;
  label: string;
  tone?: Tone;
  onPress: () => void;
  badge?: number;
}> = ({ icon, label, tone = 'accent', onPress, badge }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
  >
    <IconBadge icon={icon} tone={tone} size="lg" />
    <Text style={styles.tileLabel} numberOfLines={2}>
      {label}
    </Text>
    {badge ? (
      <View style={styles.tileBadge}>
        <Text style={styles.tileBadgeText}>{badge > 99 ? '99+' : badge}</Text>
      </View>
    ) : null}
  </Pressable>
);

export const StatusPill: React.FC<{ tone: Tone; label: string; icon?: LucideIcon }> = ({ tone, label, icon: Icon }) => {
  const p = tonePalette(tone);
  return (
    <View style={[styles.pill, { backgroundColor: p.bg, borderColor: p.line }]}>
      {Icon ? <Icon size={13} color={p.fg} strokeWidth={iconSize.stroke} /> : <View style={[styles.dot, { backgroundColor: p.fg }]} />}
      <Text style={[styles.pillText, { color: p.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

/** Big number + caption. */
export const Stat: React.FC<{ value: number | string; label: string; tone?: Tone; onPress?: () => void }> = ({
  value,
  label,
  tone = 'neutral',
  onPress,
}) => {
  const p = tonePalette(tone);
  const inner = (
    <>
      <Text style={[text.display, { color: tone === 'neutral' ? color.ink : p.fg }]}>{value}</Text>
      <Text style={text.caption} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={styles.stat}>{inner}</View>
  );
};

// ---------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------

export const Button: React.FC<{
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
}> = ({ label, onPress, icon: Icon, variant = 'primary', loading, disabled, full = true }) => {
  const v = buttonVariant(variant);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.line },
        full && styles.buttonFull,
        pressed && !isDisabled && { backgroundColor: v.pressed, transform: [{ scale: 0.98 }] },
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : Icon ? (
        <Icon size={iconSize.md} color={v.fg} strokeWidth={iconSize.stroke} />
      ) : null}
      <Text style={[styles.buttonText, { color: v.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

function buttonVariant(variant: 'primary' | 'secondary' | 'danger' | 'ghost') {
  switch (variant) {
    case 'secondary':
      return { bg: color.surface, fg: color.accent, line: color.accentLine, pressed: color.accentSoft };
    case 'danger':
      return { bg: color.red, fg: color.white, line: color.red, pressed: '#B91C1C' };
    case 'ghost':
      return { bg: 'transparent', fg: color.text, line: 'transparent', pressed: color.lineSoft };
    default:
      return { bg: color.accent, fg: color.white, line: color.accent, pressed: color.accentPressed };
  }
}

export const IconButton: React.FC<{
  icon: LucideIcon;
  onPress: () => void;
  label: string; // a11y only (not rendered)
  tone?: Tone;
  filled?: boolean;
}> = ({ icon: Icon, onPress, label, tone = 'neutral', filled }) => {
  const p = tonePalette(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        filled && { backgroundColor: p.bg },
        pressed && { backgroundColor: p.bg, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Icon size={iconSize.lg} color={tone === 'neutral' ? color.ink : p.fg} strokeWidth={iconSize.stroke} />
    </Pressable>
  );
};

/** List row: icon badge · title/subtitle · right slot (pill or chevron). */
export const ListRow: React.FC<{
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  leading?: React.ReactNode;
}> = ({ icon, tone = 'accent', title, subtitle, right, onPress, leading }) => {
  const content = (
    <>
      {leading ?? (icon ? <IconBadge icon={icon} tone={tone} /> : null)}
      <View style={styles.rowTexts}>
        <Text style={text.heading} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={text.caption} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={iconSize.md} color={color.faint} strokeWidth={iconSize.stroke} /> : null)}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
};

/** Two- or three-way toggle (e.g. सूची ↔ ग्रिड). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; icon?: LucideIcon }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {Icon ? <Icon size={iconSize.sm + 2} color={active ? color.accent : color.muted} strokeWidth={active ? 2.4 : iconSize.stroke} /> : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal filter chips. */
export function Chips<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; count?: number; tone?: Tone }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const active = o.key === value;
        const p = tonePalette(o.tone || 'accent');
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && { backgroundColor: p.bg, borderColor: p.fg }]}
          >
            <Text style={[styles.chipText, active && { color: p.text }]} numberOfLines={1}>
              {o.label}
              {o.count != null ? `  ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Labelled input: label above, error below (no placeholder-as-label). */
export const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  error?: string | null;
  helper?: string;
  maxLength?: number;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  right?: React.ReactNode;
  /** Adds a mic: speak to fill. The answer is cleaned for this kind (phone, name, age, bp…). */
  voice?: VoiceKind;
}> = ({ label, value, onChangeText, keyboardType, error, helper, maxLength, placeholder, multiline, autoFocus, right, voice }) => {
  const tr = useTr();
  const [vs, setVs] = useState<VoiceState>({ listening: false, partial: null, notUnderstood: false });
  const voiceLine = vs.listening
    ? vs.partial
      ? `${tr('सुन रहे हैं', 'ऐकत आहे', 'Listening')}: ${vs.partial}`
      : tr('बोलिए…', 'बोला…', 'Speak…')
    : vs.notUnderstood
    ? tr('समझ नहीं आया, फिर से बोलें', 'समजले नाही, पुन्हा बोला', 'Didn\'t catch that, please speak again')
    : null;
  return (
    <View style={styles.field}>
      <Text style={text.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null, vs.listening ? styles.inputListening : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={color.faint}
          multiline={multiline}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {right}
        {voice ? (
          <VoiceMic
            kind={voice}
            value={value}
            onChangeText={(v) => onChangeText(maxLength ? v.slice(0, maxLength) : v)}
            label={`${label} — ${tr('बोलकर भरें', 'बोलून भरा', 'Fill by voice')}`}
            onStateChange={setVs}
          />
        ) : null}
      </View>
      {voiceLine ? (
        <Text style={[text.caption, vs.notUnderstood && !vs.listening ? styles.errorText : null]} accessibilityLiveRegion="polite">
          {voiceLine}
        </Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={text.caption}>{helper}</Text>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------------------------

export const EmptyState: React.FC<{ icon: LucideIcon; title: string; tone?: Tone; action?: React.ReactNode }> = ({
  icon,
  title,
  tone = 'green',
  action,
}) => (
  <View style={styles.empty}>
    <IconBadge icon={icon} tone={tone} size="lg" />
    <Text style={[text.heading, styles.center]}>{title}</Text>
    {action}
  </View>
);

/** Skeleton block with a gentle pulse (respects layout of the final content). */
export const Skeleton: React.FC<{ height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }> = ({
  height = 16,
  width = '100%',
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { height, width, opacity }, style]} />;
};

export const SkeletonRows: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <View style={{ gap: space.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={[styles.card, styles.skeletonRow]}>
        <Skeleton height={44} width={44} style={{ borderRadius: 22 }} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton height={16} width="70%" />
          <Skeleton height={12} width="45%" />
        </View>
      </View>
    ))}
  </View>
);

// ---------------------------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------------------------

export const Sheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel: string;
  children: React.ReactNode;
}> = ({ visible, onClose, title, closeLabel, children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={closeLabel} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={text.title}>{title}</Text>
          <IconButton icon={X} onPress={onClose} label={closeLabel} />
        </View>
        {children}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

// ---------------------------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: color.canvas },
  screenPad: { padding: space.lg },
  screenScroll: { paddingBottom: space.xxl * 2, gap: space.lg },
  footer: {
    padding: space.lg,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  appBar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  appBarSpacer: { width: touch },
  appBarTitles: { flex: 1, paddingHorizontal: space.xs },
  appBarRight: { minWidth: touch, alignItems: 'flex-end' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  sectionCount: { color: color.muted, fontWeight: '700' },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    ...elevation.card,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  iconBadge: { alignItems: 'center', justifyContent: 'center' },
  tile: {
    flex: 1,
    minHeight: 132,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
    gap: space.sm,
    ...elevation.card,
  },
  tileLabel: { ...text.label, textAlign: 'center' },
  tileBadge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: color.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadgeText: { color: color.white, fontSize: 12, fontWeight: '800' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    minHeight: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  stat: { flex: 1, minHeight: touch, paddingVertical: space.xs },
  button: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonFull: { alignSelf: 'stretch' },
  buttonText: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  disabled: { opacity: 0.5 },
  iconButton: {
    width: touch,
    height: touch,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
  },
  rowTexts: { flex: 1, gap: 2 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: color.lineSoft,
    borderRadius: radius.control,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentActive: { backgroundColor: color.surface, ...elevation.card },
  segmentText: { fontSize: 14, fontWeight: '700', color: color.muted, lineHeight: 19 },
  segmentTextActive: { color: color.accent },
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '700', color: color.text, lineHeight: 19 },
  field: { gap: space.sm },
  inputWrap: {
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  inputListening: { borderColor: color.red },
  inputError: { borderColor: color.red, backgroundColor: color.redSoft },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: color.ink, paddingVertical: space.md },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  errorText: { ...text.caption, color: color.redText, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
  },
  skeleton: { backgroundColor: color.line, borderRadius: 8 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scrim: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
    maxHeight: 640,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.line,
    marginTop: space.sm,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
