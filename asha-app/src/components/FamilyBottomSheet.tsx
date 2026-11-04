/** Household quick-view sheet (opened from a grid dot). Same props as before. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Home, Users, CalendarClock, CalendarCheck, ChevronRight } from 'lucide-react-native';
import { HouseholdDot } from './DotGrid';
import { StatusBadge } from './StatusBadge';
import { Sheet, ListRow, Button, IconBadge, color, space, text, useTr } from '../ui';

interface FamilyBottomSheetProps {
  dot: HouseholdDot | null;
  onClose: () => void;
  onViewMembers: (dot: HouseholdDot) => void;
}

export const FamilyBottomSheet: React.FC<FamilyBottomSheetProps> = ({ dot, onClose, onViewMembers }) => {
  const tr = useTr();
  if (!dot) return null;

  return (
    <Sheet visible={!!dot} onClose={onClose} closeLabel={tr('बंद करें', 'बंद करा')} title={`${tr('घर', 'घर')} ${dot.houseNo}`}>
      <View style={styles.head}>
        <IconBadge icon={Home} tone="accent" size="lg" />
        <View style={styles.headText}>
          <Text style={text.title} numberOfLines={1}>
            {dot.familyName}
          </Text>
          <StatusBadge type={dot.status} />
        </View>
      </View>

      <View style={styles.rows}>
        <ListRow icon={Users} tone="neutral" title={tr('सदस्य', 'सदस्य')} right={<Text style={text.heading}>{dot.totalMembers}</Text>} />
        <ListRow icon={CalendarCheck} tone="neutral" title={tr('पिछली भेंट', 'मागील भेट')} right={<Text style={styles.value}>{dot.lastVisited || '—'}</Text>} />
        <ListRow icon={CalendarClock} tone="neutral" title={tr('अगली भेंट', 'पुढील भेट')} right={<Text style={styles.value}>{dot.nextVisit || '—'}</Text>} />
      </View>

      <Button label={tr('सदस्य देखें', 'सदस्य पहा')} icon={ChevronRight} onPress={() => onViewMembers(dot)} />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1, gap: space.sm },
  rows: { gap: space.sm },
  value: { ...text.label, color: color.text, maxWidth: 140, textAlign: 'right' },
});
