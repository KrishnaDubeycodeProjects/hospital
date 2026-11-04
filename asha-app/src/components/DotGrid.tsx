/**
 * Village house grid (all houses, in house-number order) + selected-house card.
 * Cells are ≥ 64 dp tactile tiles; colour = visit urgency (red 7 days · amber 15 days ·
 * neutral 30 days / no data · green visited). Same props / exports as before.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Phone, Baby, Syringe, HeartPulse, FolderOpen, CircleCheck } from 'lucide-react-native';
import { Card, Button, StatusPill, IconButton, Tone, tonePalette, color, radius, space, text, useTr } from '../ui';

export interface HouseholdMemberPreview {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  condition?: string;
  isPregnant?: boolean;
  isChild?: boolean;
  hasDisease?: boolean;
}

export interface HouseholdDot {
  id: number;
  houseNo: number;
  familyName: string;
  totalMembers: number;
  lastVisited: string;
  nextVisit: string;
  status: '7days' | '15days' | '30days' | 'visited' | 'noData';
  sectionData?: {
    pregnancy?: boolean;
    disease?: boolean;
    child?: boolean;
  };
  familyUnitId?: string;
  primaryPhone?: string;
  villageName?: string;
  membersList?: HouseholdMemberPreview[];
}

interface DotGridProps {
  dots: HouseholdDot[];
  onDotPress: (dot: HouseholdDot) => void;
  selectedDotId?: number;
  onViewFamilyDetail?: (dot: HouseholdDot) => void;
  onMarkVisited?: (familyUnitId: string) => void;
}

const toneFor = (status: HouseholdDot['status']): Tone =>
  status === '7days' ? 'red' : status === '15days' ? 'amber' : status === 'visited' ? 'green' : 'neutral';

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export const DotGrid: React.FC<DotGridProps> = ({ dots, onDotPress, selectedDotId, onViewFamilyDetail, onMarkVisited }) => {
  const tr = useTr();

  // Every registered house, in house-number order (no fixed 24-house cap: newly added families must appear)
  const villageDots = dots.filter((d) => d.houseNo >= 1).sort((a, b) => a.houseNo - b.houseNo);
  const activeDot =
    villageDots.find((d) => d.id === selectedDotId || d.houseNo === selectedDotId) || (villageDots.length > 0 ? villageDots[0] : null);

  const statusLabel = (s: HouseholdDot['status']) =>
    s === '7days'
      ? tr('7 दिन', '7 दिवस', '7 days')
      : s === '15days'
      ? tr('15 दिन', '15 दिवस', '15 days')
      : s === '30days'
      ? tr('30 दिन', '30 दिवस', '30 days')
      : s === 'visited'
      ? tr('भेंट पूर्ण', 'भेट पूर्ण', 'Visit done')
      : tr('जानकारी नहीं', 'माहिती नाही', 'No data');

  const legend: { tone: Tone; label: string }[] = [
    { tone: 'red', label: tr('7 दिन', '7 दिवस', '7 days') },
    { tone: 'amber', label: tr('15 दिन', '15 दिवस', '15 days') },
    { tone: 'neutral', label: tr('30 दिन', '30 दिवस', '30 days') },
    { tone: 'green', label: tr('भेंट पूर्ण', 'भेट पूर्ण', 'Visit done') },
  ];

  if (villageDots.length === 0) {
    return (
      <Card>
        <Text style={[text.body, styles.center]}>{tr('अभी कोई घर नहीं', 'अद्याप घर नाही', 'No houses yet')}</Text>
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.grid} accessibilityRole="list">
          {villageDots.map((dot) => {
            const tone = toneFor(dot.status);
            const p = tonePalette(tone);
            const selected = activeDot?.id === dot.id;
            const filled = tone === 'red' || tone === 'amber' || tone === 'green';
            return (
              <Pressable
                key={dot.id}
                onPress={() => onDotPress(dot)}
                accessibilityRole="button"
                accessibilityLabel={`${tr('घर', 'घर', 'House')} ${dot.houseNo}, ${statusLabel(dot.status)}`}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: filled ? p.fg : color.lineSoft, borderColor: filled ? p.fg : color.line },
                  selected && styles.cellSelected,
                  pressed && styles.cellPressed,
                ]}
              >
                <Text style={[styles.cellNo, { color: filled ? color.white : color.text }]}>{pad(dot.houseNo)}</Text>
                <View style={styles.cellIcons}>
                  {dot.sectionData?.pregnancy ? <Baby size={12} color={filled ? color.white : color.muted} strokeWidth={2} /> : null}
                  {dot.sectionData?.child ? <Syringe size={12} color={filled ? color.white : color.muted} strokeWidth={2} /> : null}
                  {dot.sectionData?.disease ? <HeartPulse size={12} color={filled ? color.white : color.muted} strokeWidth={2} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend}>
          {legend.map((l) => (
            <View key={l.tone} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.tone === 'neutral' ? color.line : tonePalette(l.tone).fg }]} />
              <Text style={text.micro}>{l.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {activeDot ? (
        <Card tone={toneFor(activeDot.status)}>
          <View style={styles.headRow}>
            <View style={[styles.houseBadge, { backgroundColor: tonePalette(toneFor(activeDot.status)).bg }]}>
              <Text style={[text.display, { color: tonePalette(toneFor(activeDot.status)).text }]}>{pad(activeDot.houseNo)}</Text>
            </View>
            <View style={styles.headText}>
              <Text style={text.heading} numberOfLines={1}>
                {activeDot.familyName}
              </Text>
              <Text style={text.caption} numberOfLines={1}>
                {[activeDot.villageName, `${activeDot.totalMembers} ${tr('सदस्य', 'सदस्य', 'Members')}`].filter(Boolean).join(' • ')}
              </Text>
              <StatusPill tone={toneFor(activeDot.status)} label={statusLabel(activeDot.status)} />
            </View>
            {activeDot.primaryPhone ? (
              <IconButton
                icon={Phone}
                tone="accent"
                filled
                label={tr('कॉल करें', 'कॉल करा', 'Call')}
                onPress={() => Linking.openURL(`tel:${activeDot.primaryPhone}`)}
              />
            ) : null}
          </View>

          <View style={styles.flags}>
            {activeDot.sectionData?.pregnancy ? <StatusPill tone="accent" icon={Baby} label={tr('गर्भवती', 'गरोदर', 'Pregnant')} /> : null}
            {activeDot.sectionData?.child ? <StatusPill tone="amber" icon={Syringe} label={tr('शिशु', 'बाळ', 'Infant')} /> : null}
            {activeDot.sectionData?.disease ? <StatusPill tone="red" icon={HeartPulse} label={tr('NCD', 'NCD', 'NCD')} /> : null}
          </View>

          <View style={styles.actions}>
            <Button
              label={tr('परिवार खोलें', 'कुटुंब उघडा', 'Open family')}
              icon={FolderOpen}
              onPress={() => (onViewFamilyDetail ? onViewFamilyDetail(activeDot) : onDotPress(activeDot))}
            />
            {onMarkVisited && activeDot.familyUnitId && activeDot.status !== 'visited' ? (
              <Button
                label={tr('भेंट पूर्ण', 'भेट पूर्ण', 'Visit done')}
                icon={CircleCheck}
                variant="secondary"
                onPress={() => onMarkVisited(activeDot.familyUnitId as string)}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  center: { textAlign: 'center' },
  // 4 columns × 6 rows keeps every house ≥ 64 dp while keeping house-number order
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  cell: {
    width: '23%',
    minHeight: 64,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellSelected: { borderWidth: 3, borderColor: color.ink },
  cellPressed: { transform: [{ scale: 0.96 }] },
  cellNo: { fontSize: 20, fontWeight: '800', lineHeight: 27 },
  cellIcons: { flexDirection: 'row', gap: 2, minHeight: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  houseBadge: { width: 64, height: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 4 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  actions: { gap: space.sm, marginTop: space.md },
});
