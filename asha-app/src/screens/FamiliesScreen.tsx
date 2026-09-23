import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Search, Mic, Home, ChevronRight, Plus, X, User } from 'lucide-react-native';
import { StatusBadge } from '../components/StatusBadge';
import { VoiceRecognition } from '../voice/speechEngine';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { FamilyMember } from '../types/storage';
import { fuzzySearchFamilies, SearchMatchResult } from '../services/fuzzySearch';

interface FamiliesScreenProps {
  onSelectFamily: (houseNo: number, familyName: string) => void;
  onSelectMember?: (member: FamilyMember, houseNo: number, familyName: string) => void;
}

export const FamiliesScreen: React.FC<FamiliesScreenProps> = ({
  onSelectFamily,
  onSelectMember,
}) => {
  const { families, members, addFamily } = useOfflineData();
  const { t, localeCode } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    'All' | 'Due' | 'Visited' | 'Not Visited'
  >('All');
  const [isListening, setIsListening] = useState(false);

  // New Family Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');
  const [newHouseNo, setNewHouseNo] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const startVoiceSearch = () => {
    setIsListening(true);
    VoiceRecognition.start(
      localeCode,
      (text) => {
        setSearchQuery(text);
        setIsListening(false);
      },
      (err) => {
        console.warn('Voice error', err);
        setIsListening(false);
      }
    );
  };

  const handleCreateFamily = async () => {
    if (!newHeadName.trim() || !newHouseNo.trim()) return;

    await addFamily({
      sequentialNumber: families.length + 1,
      houseNumber: Number(newHouseNo) || newHouseNo,
      headName: newHeadName.trim(),
      primaryPhone: newPhone.trim() || '+91 98765 00000',
      villageName: 'Chandpur',
      visitIntervalDays: 15,
      nextVisitDate: '15 days',
      lastVisitedAt: null,
      ashaWorkerPhone: '9876543210',
      status: '15days',
      totalMembers: 1,
      hasPregnancy: false,
      hasDisease: false,
      hasChild: false,
      toiletType: 'Septic Tank',
      waterSource: 'Handpump',
      bplCard: true,
      casteCategory: 'OBC',
      religion: 'Hindu',
      markedForHomeVisit: true,
    });

    setNewHeadName('');
    setNewHouseNo('');
    setNewPhone('');
    setShowAddModal(false);
  };

  // Perform intelligent fuzzy search across family folders & members with ranking
  const searchResults: SearchMatchResult[] = fuzzySearchFamilies(
    searchQuery,
    families,
    members
  );

  // Apply quick filter on top of search ranking
  const filteredResults = searchResults.filter(({ family }) => {
    const isDue = family.status === '7days' || family.status === '15days' || family.status === '30days';
    const isVisited = family.status === 'visited';
    const isNotVisited = family.status === 'noData';

    if (activeFilter === 'Due') return isDue;
    if (activeFilter === 'Visited') return isVisited;
    if (activeFilter === 'Not Visited') return isNotVisited;
    return true;
  });

  const filterLabels: Record<string, string> = {
    All: t('allFilter'),
    Due: t('dueFilter'),
    Visited: t('visitedFilter'),
    'Not Visited': t('notVisitedFilter'),
  };

  return (
    <View style={styles.container}>
      {/* Top Search Bar with Mic button & Typo Tolerance */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={isListening ? 'बोलिए... सुन रहे हैं' : 'मुखिया या सदस्य के नाम से खोजें...'}
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micBtnActive]}
            onPress={startVoiceSearch}
            activeOpacity={0.7}
          >
            <Mic size={18} color={isListening ? '#FFFFFF' : Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Filter Chips + Add Household Button */}
      <View style={styles.filterRowContainer}>
        <View style={styles.filterChipsRow}>
          {(['All', 'Due', 'Visited', 'Not Visited'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.activeFilterChip]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.activeFilterChipText,
                  ]}
                >
                  {filterLabels[filter]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.addFamilyBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <Plus size={15} color="#FFFFFF" />
          <Text style={styles.addFamilyBtnText}>{t('add')}</Text>
        </TouchableOpacity>
      </View>

      {/* Household FlatList */}
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.family.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <VoiceGuideBanner
            sectionTitle="गाँव परिवार रजिस्टर"
            guideTextHi="यहाँ परिवार मुखिया और सदस्यों की सूची है। नाम में कुछ अक्षर गलत होने पर भी खोज सटीक परिणाम दिखाती है।"
            guideTextMr="येथे कुटुंब प्रमुख आणि सदस्यांची यादी आहे. स्पेलिंगमध्ये त्रुटी असली तरीही शोध अचूक काम करतो."
            guideTextEn="Master registry of village families. Typo-tolerant search automatically matches both heads and members."
          />
        }
        renderItem={({ item }) => {
          const { family, matchedMember } = item;
          return (
            <View style={styles.cardContainer}>
              {/* Main Family Card (Clean Minimalist Info) */}
              <TouchableOpacity
                style={styles.familyCard}
                onPress={() =>
                  onSelectFamily(Number(family.houseNumber), family.headName)
                }
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Home size={18} color={Colors.primary} />
                </View>

                <View style={styles.cardInfo}>
                  {/* Just Family Head Name */}
                  <Text style={styles.familyName}>{family.headName}</Text>
                  {/* General Info: House # and total members */}
                  <Text style={styles.generalInfo}>
                    मकान #{family.houseNumber} • {family.totalMembers} सदस्य
                  </Text>
                </View>

                <View style={styles.badgeWrapper}>
                  <StatusBadge type={family.status} label={family.nextVisitDate} />
                  <ChevronRight size={18} color={Colors.primary} style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>

              {/* Matched Member Pill (If a member was matched by search) */}
              {matchedMember && (
                <TouchableOpacity
                  style={styles.matchedMemberPill}
                  onPress={() => {
                    if (onSelectMember) {
                      onSelectMember(matchedMember, Number(family.houseNumber), family.headName);
                    } else {
                      onSelectFamily(Number(family.houseNumber), family.headName);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <User size={13} color="#0369A1" style={{ marginRight: 5 }} />
                  <Text style={styles.matchedMemberText}>
                    मिला सदस्य:{' '}
                    <Text style={{ fontWeight: '700' }}>{matchedMember.name}</Text> ({matchedMember.relationship}, {matchedMember.age} वर्ष)
                  </Text>
                  <ChevronRight size={14} color="#0369A1" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Add Household Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('addHouseholdTitle')}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.inputLabel}>{t('familyNameLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="उदा. राजेश वर्मा"
                placeholderTextColor={Colors.textMuted}
                value={newHeadName}
                onChangeText={setNewHeadName}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('houseNumberLabel')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="उदा. 25"
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                    value={newHouseNo}
                    onChangeText={setNewHouseNo}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('phoneLabel')}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.textMuted}
                    value={newPhone}
                    onChangeText={setNewPhone}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreateFamily}
                activeOpacity={0.85}
              >
                <Text style={styles.createBtnText}>{t('saveLocally')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  micBtn: {
    padding: 6,
    borderRadius: 16,
  },
  micBtnActive: {
    backgroundColor: Colors.primary,
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  addFamilyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 3,
  },
  addFamilyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    paddingBottom: 40,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  familyCard: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardInfo: {
    flex: 1,
  },
  familyName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  generalInfo: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgeWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  matchedMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderTopWidth: 1,
    borderTopColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  matchedMemberText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
