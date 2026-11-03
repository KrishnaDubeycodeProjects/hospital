/**
 * परिवार (Families) — searchable household list (big house number · members · R/A/G status).
 * From the ＋ sheet: `autoOpenCreate` opens the new-family form; `intent` shows members inline
 * so one tap reaches the member (to start a survey or a referral).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Search, Mic, X, Plus, Users, ClipboardPlus, Route, HousePlus, ChevronRight, UserRound } from 'lucide-react-native';
import { StatusBadge } from '../components/StatusBadge';
import { VoiceRecognition } from '../voice/speechEngine';
import { extractSearchQuery } from '../voice/smartExtract';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { FamilyMember, FamilyUnit } from '../types/storage';
import { fuzzySearchFamilies, SearchMatchResult } from '../services/fuzzySearch';
import { getStorageWorkerPhone } from '../storage/OfflineStorageService';
import {
  Button,
  Card,
  Chips,
  EmptyState,
  Field,
  IconButton,
  SkeletonRows,
  StatusPill,
  color,
  radius,
  space,
  text,
  tonePalette,
  touch,
  useTr,
  elevation,
} from '../ui';

interface FamiliesScreenProps {
  onSelectFamily: (houseNo: number, familyName: string) => void;
  onSelectMember?: (member: FamilyMember, houseNo: number, familyName: string) => void;
  /** From the ＋ sheet: highlight "choose a member" for a survey or a referral. */
  intent?: 'survey' | 'referral' | null;
  /** From the ＋ sheet: open the "new family" form immediately. */
  autoOpenCreate?: boolean;
}

type Filter = 'all' | 'due' | 'visited' | 'new';

const houseNoOf = (f: FamilyUnit) => Number(f.houseNumber) || f.sequentialNumber;

export const FamiliesScreen: React.FC<FamiliesScreenProps> = ({ onSelectFamily, onSelectMember, intent = null, autoOpenCreate = false }) => {
  const tr = useTr();
  const { families, members, addFamily, isLoading } = useOfflineData();
  const { localeCode } = useLanguage();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [isListening, setIsListening] = useState(false);

  // New family form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');
  const [newHouseNo, setNewHouseNo] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (autoOpenCreate) setShowAddModal(true);
  }, [autoOpenCreate]);

  const startVoiceSearch = () => {
    setIsListening(true);
    VoiceRecognition.start(
      localeCode,
      (spoken) => {
        setSearchQuery(extractSearchQuery(spoken));
        setIsListening(false);
      },
      () => setIsListening(false)
    );
  };

  const closeForm = () => {
    setShowAddModal(false);
    setFormError(null);
  };

  const handleCreateFamily = async () => {
    const head = newHeadName.trim();
    const house = newHouseNo.trim();
    if (!head || !house) {
      setFormError(tr('मुखिया नाम और घर नंबर भरें', 'प्रमुखाचे नाव व घर क्रमांक भरा'));
      return;
    }
    const phoneDigits = newPhone.replace(/[^0-9]/g, '');
    if (phoneDigits && phoneDigits.length !== 10) {
      setFormError(tr('मोबाइल 10 अंक का हो', 'मोबाईल 10 अंकी हवा'));
      return;
    }
    setSaving(true);
    try {
      await addFamily({
        // Next free number (families.length + 1 collided with existing numbers after a delete)
        sequentialNumber: families.reduce((max, f) => Math.max(max, Number(f.sequentialNumber) || 0), 0) + 1,
        houseNumber: Number(house) || house,
        headName: head,
        primaryPhone: phoneDigits, // optional — members share the head's phone
        villageName: user?.village || '',
        visitIntervalDays: 15,
        nextVisitDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        lastVisitedAt: null,
        ashaWorkerPhone: getStorageWorkerPhone(),
        status: '15days',
        totalMembers: 1,
        hasPregnancy: false,
        hasDisease: false,
        hasChild: false,
        markedForHomeVisit: true,
      });
      setNewHeadName('');
      setNewHouseNo('');
      setNewPhone('');
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const searchResults: SearchMatchResult[] = fuzzySearchFamilies(searchQuery, families, members);
  const filtered = searchResults.filter(({ family }) => {
    if (filter === 'due') return family.status === '7days' || family.status === '15days' || family.status === '30days';
    if (filter === 'visited') return family.status === 'visited';
    if (filter === 'new') return family.status === 'noData';
    return true;
  });

  const counts = useMemo(
    () => ({
      due: families.filter((f) => f.status === '7days' || f.status === '15days' || f.status === '30days').length,
      visited: families.filter((f) => f.status === 'visited').length,
      fresh: families.filter((f) => f.status === 'noData').length,
    }),
    [families]
  );

  const membersOf = (familyId: string) => members.filter((m) => m.familyUnitId === familyId);

  const pickMember = (m: FamilyMember, f: FamilyUnit) => {
    if (onSelectMember) onSelectMember(m, houseNoOf(f), f.headName);
    else onSelectFamily(houseNoOf(f), f.headName);
  };

  const intentTone = intent === 'referral' ? 'red' : 'green';
  const intentPalette = tonePalette(intentTone);

  const renderFamily = ({ item }: { item: SearchMatchResult }) => {
    const { family, matchedMember } = item;
    const house = houseNoOf(family);
    const fm = membersOf(family.id);
    const statusTone = tonePalette(family.status === '7days' ? 'red' : family.status === '15days' ? 'amber' : family.status === 'visited' ? 'green' : 'neutral');
    return (
      <View style={styles.cardWrap}>
        <Pressable
          onPress={() => onSelectFamily(house, family.headName)}
          accessibilityRole="button"
          accessibilityLabel={`${tr('घर', 'घर')} ${house}, ${family.headName}`}
          style={({ pressed }) => [styles.familyCard, pressed && styles.pressed]}
        >
          <View style={[styles.houseNo, { backgroundColor: statusTone.bg }]}>
            <Text style={[text.display, { color: statusTone.text }]}>{house < 10 ? `0${house}` : house}</Text>
          </View>
          <View style={styles.familyText}>
            <Text style={text.heading} numberOfLines={1}>
              {family.headName}
            </Text>
            <View style={styles.metaRow}>
              <Users size={14} color={color.muted} strokeWidth={2} />
              <Text style={text.caption}>
                {fm.length || family.totalMembers} {tr('सदस्य', 'सदस्य')}
              </Text>
            </View>
            <StatusBadge type={family.status} />
          </View>
          <ChevronRight size={20} color={color.faint} strokeWidth={2} />
        </Pressable>

        {/* Intent mode (＋ sheet): members inline, one tap to the member */}
        {intent && fm.length > 0 ? (
          <View style={styles.memberChips}>
            {fm.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => pickMember(m, family)}
                accessibilityRole="button"
                accessibilityLabel={m.name}
                style={({ pressed }) => [styles.memberChip, { borderColor: intentPalette.line }, pressed && styles.pressed]}
              >
                <UserRound size={16} color={intentPalette.fg} strokeWidth={2} />
                <Text style={styles.memberChipText} numberOfLines={1}>
                  {m.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!intent && matchedMember ? (
          <Pressable
            onPress={() => pickMember(matchedMember, family)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.matchRow, pressed && styles.pressed]}
          >
            <UserRound size={16} color={color.accent} strokeWidth={2} />
            <Text style={[text.label, styles.flex]} numberOfLines={1}>
              {matchedMember.name}
            </Text>
            {matchedMember.relationship ? <StatusPill tone="neutral" label={matchedMember.relationship} /> : null}
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        {intent ? (
          <View style={[styles.intentBanner, { backgroundColor: intentPalette.bg, borderColor: intentPalette.line }]}>
            {intent === 'referral' ? (
              <Route size={20} color={intentPalette.fg} strokeWidth={2} />
            ) : (
              <ClipboardPlus size={20} color={intentPalette.fg} strokeWidth={2} />
            )}
            <Text style={[text.label, { color: intentPalette.text }]}>
              {intent === 'referral' ? tr('सदस्य चुनें — रेफरल', 'सदस्य निवडा — संदर्भ') : tr('सदस्य चुनें — जांच', 'सदस्य निवडा — तपासणी')}
            </Text>
          </View>
        ) : null}

        <View style={styles.searchRow}>
          <Search size={20} color={color.muted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={isListening ? tr('सुन रहे हैं…', 'ऐकत आहे…') : tr('नाम या घर नंबर', 'नाव किंवा घर क्रमांक')}
            placeholderTextColor={color.faint}
            accessibilityLabel={tr('खोजें', 'शोधा')}
          />
          {searchQuery ? <IconButton icon={X} label={tr('साफ़ करें', 'साफ करा')} onPress={() => setSearchQuery('')} /> : null}
          <IconButton icon={Mic} tone="accent" filled={isListening} label={tr('बोलकर खोजें', 'बोलून शोधा')} onPress={startVoiceSearch} />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.flex}>
            <Chips
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: tr('सभी', 'सर्व'), count: families.length },
                { key: 'due', label: tr('देय', 'देय'), count: counts.due, tone: 'amber' },
                { key: 'visited', label: tr('पूर्ण', 'पूर्ण'), count: counts.visited, tone: 'green' },
                { key: 'new', label: tr('नए', 'नवीन'), count: counts.fresh, tone: 'neutral' },
              ]}
            />
          </View>
          <Pressable
            onPress={() => setShowAddModal(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('नया परिवार', 'नवीन कुटुंब')}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Plus size={24} color={color.white} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      {isLoading && families.length === 0 ? (
        <View style={styles.listPad}>
          <SkeletonRows count={5} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.family.id}
          renderItem={renderFamily}
          contentContainerStyle={styles.listPad}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={searchQuery ? Search : HousePlus}
              tone={searchQuery ? 'neutral' : 'accent'}
              title={searchQuery ? tr('कोई परिवार नहीं मिला', 'कुटुंब सापडले नाही') : tr('अभी कोई परिवार नहीं', 'अद्याप कुटुंब नाही')}
              action={
                searchQuery ? undefined : (
                  <Button label={tr('नया परिवार', 'नवीन कुटुंब')} icon={Plus} full={false} onPress={() => setShowAddModal(true)} />
                )
              }
            />
          }
        />
      )}

      {/* New family form */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={closeForm}>
        <Pressable style={styles.scrim} onPress={closeForm} accessibilityLabel={tr('बंद करें', 'बंद करा')} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={text.title}>{tr('नया परिवार', 'नवीन कुटुंब')}</Text>
              <IconButton icon={X} label={tr('बंद करें', 'बंद करा')} onPress={closeForm} />
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Field label={tr('मुखिया का नाम', 'कुटुंबप्रमुखाचे नाव')} voice="name" value={newHeadName} onChangeText={(v) => { setNewHeadName(v); setFormError(null); }} autoFocus />
              <Field label={tr('घर नंबर', 'घर क्रमांक')} voice="house" value={newHouseNo} onChangeText={(v) => { setNewHouseNo(v.replace(/[^0-9A-Za-z/-]/g, '')); setFormError(null); }} keyboardType="number-pad" maxLength={6} />
              <Field
                label={tr('मोबाइल (वैकल्पिक)', 'मोबाईल (ऐच्छिक)')} voice="phone"
                value={newPhone}
                onChangeText={(v) => { setNewPhone(v.replace(/[^0-9]/g, '')); setFormError(null); }}
                keyboardType="phone-pad"
                maxLength={10}
                helper={tr('सभी सदस्य यही नंबर उपयोग करेंगे', 'सर्व सदस्य हाच क्रमांक वापरतील')}
              />
              {formError ? (
                <Card tone="red">
                  <Text style={[text.label, { color: color.redText }]}>{formError}</Text>
                </Card>
              ) : null}
              <Button label={tr('सहेजें', 'जतन करा')} icon={HousePlus} loading={saving} onPress={handleCreateFamily} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.canvas },
  flex: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  intentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 56,
    paddingLeft: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: color.surface,
  },
  searchInput: { flex: 1, fontSize: 17, fontWeight: '600', color: color.ink, paddingVertical: space.sm, marginLeft: space.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addBtn: {
    width: touch,
    height: touch,
    borderRadius: radius.control,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listPad: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  cardWrap: { gap: space.sm },
  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    ...elevation.card,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  houseNo: { width: 64, height: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  familyText: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: space.sm },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touch,
    maxWidth: '100%',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: color.surface,
  },
  memberChipText: { ...text.label },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingHorizontal: space.lg,
    marginLeft: space.lg,
    borderRadius: radius.control,
    backgroundColor: color.accentSoft,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    maxHeight: 620,
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.line, marginTop: space.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  form: { gap: space.lg, paddingBottom: space.lg },
});
