/**
 * आज (Today) — the ASHA's single prioritised work list.
 * Merges the old Home due-lists, follow-ups and the village house grid (सूची ↔ ग्रिड toggle).
 * Every row is computed from recorded data only; nothing is invented.
 */
import React, { useMemo, useState } from 'react';
import { BroadcastInbox } from '../components/BroadcastInbox';
import { View, Text, StyleSheet } from 'react-native';
import {
  AlertTriangle,
  Baby,
  HeartPulse,
  Home,
  LayoutGrid,
  List,
  Route,
  Syringe,
  CircleCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { FamilyMember, FamilyUnit } from '../types/storage';
import { DotGrid, HouseholdDot } from '../components/DotGrid';
import { parseClinicalDate } from '../services/maternalMath';
import {
  Screen,
  Card,
  Stat,
  ListRow,
  StatusPill,
  Segmented,
  Chips,
  SectionTitle,
  EmptyState,
  SkeletonRows,
  Tone,
  color,
  space,
  text,
  useTr,
} from '../ui';

interface TodayScreenProps {
  onOpenFamily: (houseNo: number, familyName: string) => void;
  onOpenMember: (member: FamilyMember, houseNo: number, familyName: string) => void;
  onOpenFollowUps: () => void;
}

type TaskKind = 'referral' | 'pregnancy' | 'vaccine' | 'visit';
interface Task {
  id: string;
  kind: TaskKind;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  pill: string;
  rank: number; // lower = more urgent
  onPress: () => void;
}

const DAY = 86400000;

export const TodayScreen: React.FC<TodayScreenProps> = ({ onOpenFamily, onOpenMember, onOpenFollowUps }) => {
  const tr = useTr();
  const { families, members, followUps, childVaccinations, isLoading, markFamilyVisited, lastSyncResult } = useOfflineData();
  const [mode, setMode] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<'all' | 'red' | 'amber'>('all');
  const [selectedDot, setSelectedDot] = useState<number | undefined>();

  const familyById = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);
  const houseOf = (f?: FamilyUnit) => (f ? Number(f.houseNumber) || f.sequentialNumber : 0);

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];
    const now = Date.now();

    // 1. Referrals & follow-ups
    for (const t of followUps) {
      if (t.isCompleted) continue;
      const missed = /missed/i.test(t.taskType) || t.sourceReferralId != null && !t.referredToCho;
      const validated = t.choStatus === 'APPROVED_CHO';
      const fam = familyById.get(t.familyUnitId);
      out.push({
        id: `fu-${t.id}`,
        kind: 'referral',
        tone: validated ? 'green' : missed ? 'red' : 'amber',
        icon: validated ? CircleCheck : Route,
        title: t.name || tr('लाभार्थी', 'लाभार्थी', 'Beneficiaries'),
        subtitle: [t.referralReason, fam ? `${tr('घर', 'घर', 'House')} ${houseOf(fam)}` : null].filter(Boolean).join(' • '),
        pill: validated ? tr('सत्यापित', 'पडताळले', 'Verified') : missed ? tr('छूटा रेफरल', 'चुकलेला संदर्भ', 'Missed referral') : tr('रेफरल', 'संदर्भ', 'Referrals'),
        rank: validated ? 40 : missed ? 0 : 20,
        onPress: onOpenFollowUps,
      });
    }

    // 2. Pregnancies (EDD from the recorded date only)
    for (const m of members) {
      if (!m.isPregnant) continue;
      const fam = familyById.get(m.familyUnitId);
      const edd = parseClinicalDate(m.expectedDeliveryDate);
      const daysToEdd = edd ? Math.ceil((edd.getTime() - now) / DAY) : null;
      const deliverySoon = daysToEdd != null && daysToEdd <= 30;
      const high = m.isHrp === true;
      out.push({
        id: `pw-${m.id}`,
        kind: 'pregnancy',
        tone: high || deliverySoon ? 'red' : 'amber',
        icon: high ? AlertTriangle : HeartPulse,
        title: m.name,
        subtitle: [
          fam ? `${tr('घर', 'घर', 'House')} ${houseOf(fam)}` : null,
          daysToEdd != null ? (daysToEdd >= 0 ? `${daysToEdd} ${tr('दिन में प्रसव', 'दिवसांत प्रसूती', 'days to delivery')}` : tr('प्रसव तिथि पार', 'प्रसूती तारीख उलटली', 'Delivery date passed')) : null,
        ]
          .filter(Boolean)
          .join(' • '),
        pill: high ? tr('उच्च जोखिम', 'उच्च जोखीम', 'High risk') : deliverySoon ? tr('प्रसव निकट', 'प्रसूती जवळ', 'Delivery near') : tr('ANC देय', 'ANC देय', 'ANC due'),
        rank: high ? 1 : deliverySoon ? 2 : 25,
        onPress: () => onOpenMember(m, houseOf(fam), fam?.headName || ''),
      });
    }

    // 3. Child vaccines due
    for (const v of childVaccinations) {
      const due = Object.values(v.vaccines || {}).filter((s) => s === 'Due').length;
      if (due === 0) continue;
      const fam = familyById.get(v.familyUnitId);
      const child = members.find((m) => m.id === v.childMemberId);
      out.push({
        id: `vx-${v.id}`,
        kind: 'vaccine',
        tone: 'amber',
        icon: Syringe,
        title: v.childName || child?.name || tr('शिशु', 'बाळ', 'Infant'),
        subtitle: [fam ? `${tr('घर', 'घर', 'House')} ${houseOf(fam)}` : null, `${due} ${tr('टीके देय', 'लसी देय', 'Vaccines due')}`].filter(Boolean).join(' • '),
        pill: tr('टीका देय', 'लस देय', 'Vaccine due'),
        rank: 30,
        onPress: () => (child ? onOpenMember(child, houseOf(fam), fam?.headName || '') : fam && onOpenFamily(houseOf(fam), fam.headName)),
      });
    }

    // 4. Household visits due (7-day = urgent, 15-day = due)
    for (const f of families) {
      if (f.status !== '7days' && f.status !== '15days') continue;
      const urgent = f.status === '7days';
      out.push({
        id: `hv-${f.id}`,
        kind: 'visit',
        tone: urgent ? 'red' : 'amber',
        icon: Home,
        title: `${tr('घर', 'घर', 'House')} ${houseOf(f)} • ${f.headName}`,
        subtitle: urgent ? tr('7 दिन भेंट', '7 दिवस भेट', '7-day visit') : tr('15 दिन भेंट', '15 दिवस भेट', '15-day visit'),
        pill: urgent ? tr('भेंट जरूरी', 'भेट आवश्यक', 'Visit needed') : tr('भेंट देय', 'भेट देय', 'Visit due'),
        rank: urgent ? 5 : 35,
        onPress: () => onOpenFamily(houseOf(f), f.headName),
      });
    }

    return out.sort((a, b) => a.rank - b.rank);
  }, [families, members, followUps, childVaccinations, familyById, tr, onOpenFamily, onOpenMember, onOpenFollowUps]);

  const redCount = tasks.filter((t) => t.tone === 'red').length;
  const amberCount = tasks.filter((t) => t.tone === 'amber').length;
  const doneCount = families.filter((f) => f.status === 'visited').length;
  const visible = tasks.filter((t) => filter === 'all' || t.tone === filter);

  const dots: HouseholdDot[] = useMemo(
    () =>
      families
        .map((f) => ({ f, house: houseOf(f) }))
        .filter(({ house }) => house >= 1)
        .sort((a, b) => a.house - b.house)
        .map(({ f, house }) => {
          const fm = members.filter((m) => m.familyUnitId === f.id);
          return {
            id: f.sequentialNumber,
            houseNo: house,
            familyName: f.headName,
            totalMembers: fm.length || f.totalMembers,
            lastVisited: f.lastVisitedAt || '—',
            nextVisit: f.nextVisitDate,
            status: f.status,
            sectionData: { pregnancy: f.hasPregnancy, disease: f.hasDisease, child: f.hasChild },
            familyUnitId: f.id,
            primaryPhone: f.primaryPhone || '',
            villageName: f.villageName || '',
            membersList: fm.map((m) => ({
              id: m.id,
              name: m.name,
              age: m.age,
              gender: m.gender,
              isPregnant: m.isPregnant,
              isChild: Boolean(m.isChild || (m.age != null && m.age <= 5)),
              hasDisease: m.hasChronicCondition || m.isNcdPatient,
              condition: m.isPregnant
                ? tr('गर्भवती', 'गरोदर', 'Pregnant')
                : m.isChild
                ? tr('शिशु', 'बाळ', 'Infant')
                : m.chronicConditionType || tr('सामान्य', 'सामान्य', 'Normal'),
            })),
          } as HouseholdDot;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [families, members, tr]
  );

  return (
    <Screen>
      {/* NHM / CHO work messages (hidden when there are none); refreshed after every sync */}
      <BroadcastInbox refreshKey={lastSyncResult} />

      {/* Summary: three numbers, colour = meaning */}
      <Card>
        <View style={styles.statsRow}>
          <Stat value={redCount} label={tr('उच्च जोखिम', 'उच्च जोखीम', 'High risk')} tone="red" onPress={() => { setMode('list'); setFilter('red'); }} />
          <View style={styles.vr} />
          <Stat value={amberCount} label={tr('देय काम', 'देय कामे', 'Tasks due')} tone="amber" onPress={() => { setMode('list'); setFilter('amber'); }} />
          <View style={styles.vr} />
          <Stat value={doneCount} label={tr('भेंट पूर्ण', 'भेट पूर्ण', 'Visit done')} tone="green" />
        </View>
      </Card>

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { key: 'list', label: tr('काम', 'कामे', 'Tasks'), icon: List },
          { key: 'grid', label: tr('घर', 'घरे', 'Houses'), icon: LayoutGrid },
        ]}
      />

      {mode === 'grid' ? (
        families.length === 0 && isLoading ? (
          <SkeletonRows count={3} />
        ) : (
          <DotGrid
            dots={dots}
            selectedDotId={selectedDot}
            onDotPress={(d) => setSelectedDot(d.id)}
            onViewFamilyDetail={(d) => onOpenFamily(d.houseNo, d.familyName)}
            onMarkVisited={(familyUnitId) => markFamilyVisited(familyUnitId, '30days')}
          />
        )
      ) : (
        <>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: tr('सभी', 'सर्व', 'All'), count: tasks.length, tone: 'accent' },
              { key: 'red', label: tr('उच्च जोखिम', 'उच्च जोखीम', 'High risk'), count: redCount, tone: 'red' },
              { key: 'amber', label: tr('देय', 'देय', 'Due'), count: amberCount, tone: 'amber' },
            ]}
          />

          <SectionTitle label={tr('आज के काम', 'आजची कामे', 'Today\'s tasks')} count={visible.length} />

          {isLoading && tasks.length === 0 ? (
            <SkeletonRows count={4} />
          ) : visible.length === 0 ? (
            <EmptyState icon={CircleCheck} title={tr('सब काम पूरे', 'सर्व कामे पूर्ण', 'All tasks done')} />
          ) : (
            <View style={styles.list}>
              {visible.map((t) => (
                <ListRow
                  key={t.id}
                  icon={t.icon}
                  tone={t.tone}
                  title={t.title}
                  subtitle={t.subtitle || undefined}
                  onPress={t.onPress}
                  right={<StatusPill tone={t.tone} label={t.pill} />}
                />
              ))}
            </View>
          )}
          {tasks.some((t) => t.kind === 'pregnancy') || tasks.some((t) => t.kind === 'vaccine') ? (
            <Text style={styles.legend}>
              <Baby size={13} color={color.faint} /> {tr('नाम दबाएँ → जांच शुरू', 'नाव दाबा → तपासणी सुरू', 'Tap name → start check')}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  vr: { width: 1, alignSelf: 'stretch', backgroundColor: color.line },
  list: { gap: space.sm },
  legend: { ...text.caption, textAlign: 'center' },
});
