import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { DotGrid, HouseholdDot } from '../components/DotGrid';
import { FamilyBottomSheet } from '../components/FamilyBottomSheet';
import { QrCode, X, Filter } from 'lucide-react-native';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { VoiceGuideBanner } from '../components/VoiceGuideBanner';

interface GridScreenProps {
  onNavigateToFamilyDetail: (houseNo: number, familyName: string) => void;
  onNavigateToSync: () => void;
}

type MainCategory = 'All' | 'Pregnancy' | 'Disease' | 'Child';

export const GridScreen: React.FC<GridScreenProps> = ({
  onNavigateToFamilyDetail,
  onNavigateToSync,
}) => {
  const { families, members, surveys } = useOfflineData();
  const { t } = useLanguage();

  const [activeCategory, setActiveCategory] = useState<MainCategory>('All');
  const [selectedSubFilter, setSelectedSubFilter] = useState<string | null>(null);
  const [selectedDot, setSelectedDot] = useState<HouseholdDot | null>(null);

  // Sub-filter options per category
  const subFilterOptions: Record<MainCategory, { key: string; labelHi: string; labelEn: string }[]> = {
    All: [
      { key: 'all', labelHi: 'सभी 24 परिवार', labelEn: 'All 24 Families' },
      { key: 'due7', labelHi: '7 दिन (अति आवश्यक)', labelEn: '7 Days Urgent' },
      { key: 'due15', labelHi: '15 दिन (शीघ्र देय)', labelEn: '15 Days Review' },
      { key: 'due30', labelHi: '30 दिन (नियमित)', labelEn: '30 Days Routine' },
    ],
    Pregnancy: [
      { key: 'all_preg', labelHi: 'सभी गर्भवती', labelEn: 'All Pregnant' },
      { key: 'anc1', labelHi: 'प्रथम त्रैमासिक (ANC 1)', labelEn: '1st Trimester (ANC 1)' },
      { key: 'anc2', labelHi: 'द्वितीय त्रैमासिक (ANC 2)', labelEn: '2nd Trimester (ANC 2)' },
      { key: 'hrp', labelHi: 'उच्च जोखिम (HRP)', labelEn: 'High Risk (HRP)' },
      { key: 'due_delivery', labelHi: 'प्रसव देय (Due Delivery)', labelEn: 'Delivery Due Soon' },
    ],
    Disease: [
      { key: 'all_ncd', labelHi: 'सभी रोग', labelEn: 'All NCD' },
      { key: 'htn', labelHi: 'उच्च रक्तचाप (BP)', labelEn: 'Hypertension' },
      { key: 'diabetes', labelHi: 'मधुमेह (Sugar)', labelEn: 'Diabetes' },
      { key: 'oral_cancer', labelHi: 'मुख कैंसर', labelEn: 'Oral Cancer' },
      { key: 'breast_cancer', labelHi: 'स्तन कैंसर', labelEn: 'Breast Cancer' },
      { key: 'cervical_cancer', labelHi: 'गर्भाशय ग्रीवा', labelEn: 'Cervical Cancer' },
    ],
    Child: [
      { key: 'all_child', labelHi: 'सभी बच्चे', labelEn: 'All Children' },
      { key: 'infants', labelHi: '0-1 वर्ष शिशु', labelEn: '0-1 Year Infants' },
      { key: 'vax_due', labelHi: 'टीकाकरण देय', labelEn: 'Vaccine Due' },
      { key: 'vax_done', labelHi: 'पूर्ण प्रतिरक्षित', labelEn: 'Fully Immunized' },
    ],
  };

  const handleMainTabPress = (tab: MainCategory) => {
    setActiveCategory(tab);
    setSelectedSubFilter(null); // Reset sub-filter when switching tabs
  };

  const handleSelectSubFilter = (key: string) => {
    if (selectedSubFilter === key) {
      setSelectedSubFilter(null);
    } else {
      setSelectedSubFilter(key);
    }
  };

  // Check if a family matches the active category & sub-filter
  const checkFamilyMatch = (fam: any): boolean => {
    if (activeCategory === 'All') {
      if (!selectedSubFilter || selectedSubFilter === 'all') return true;
      if (selectedSubFilter === 'due7') return fam.status === '7days';
      if (selectedSubFilter === 'due15') return fam.status === '15days';
      if (selectedSubFilter === 'due30') return fam.status === '30days';
      return true;
    }

    if (activeCategory === 'Pregnancy') {
      if (!fam.hasPregnancy) return false;
      if (!selectedSubFilter || selectedSubFilter === 'all_preg') return true;

      const famMembers = members.filter((m) => m.familyUnitId === fam.id);
      if (selectedSubFilter === 'hrp') {
        return famMembers.some((m) => m.isPregnant && m.isHrp);
      }
      if (selectedSubFilter === 'anc1') {
        const famSurveys = surveys.filter((s) => s.familyUnitId === fam.id && s.categoryCode === 'PREGNANCY');
        return famSurveys.some((s) => s.answers?.ancVisitNumber === 'ANC 1' || s.answers?.trimester === '1st Trimester');
      }
      if (selectedSubFilter === 'anc2') {
        const famSurveys = surveys.filter((s) => s.familyUnitId === fam.id && s.categoryCode === 'PREGNANCY');
        return famSurveys.some((s) => s.answers?.ancVisitNumber === 'ANC 2' || s.answers?.trimester === '2nd Trimester');
      }
      if (selectedSubFilter === 'due_delivery') {
        return fam.status === '7days' || fam.status === '15days';
      }
      return true;
    }

    if (activeCategory === 'Disease') {
      if (!fam.hasDisease) return false;
      if (!selectedSubFilter || selectedSubFilter === 'all_ncd') return true;

      const famMembers = members.filter((m) => m.familyUnitId === fam.id);
      if (selectedSubFilter === 'htn') {
        return famMembers.some((m) => m.hasChronicCondition && (m.chronicConditionType?.toLowerCase().includes('hyper') || m.ncdDiagnosis === 'Hypertension'));
      }
      if (selectedSubFilter === 'diabetes') {
        return famMembers.some((m) => m.hasChronicCondition && (m.chronicConditionType?.toLowerCase().includes('diabet') || m.ncdDiagnosis === 'Diabetes'));
      }
      if (selectedSubFilter === 'oral_cancer') {
        return famMembers.some((m) => m.ncdDiagnosis === 'Oral Cancer' || m.chronicConditionType?.toLowerCase().includes('oral'));
      }
      if (selectedSubFilter === 'breast_cancer') {
        return famMembers.some((m) => m.ncdDiagnosis === 'Breast Cancer' || m.chronicConditionType?.toLowerCase().includes('breast'));
      }
      if (selectedSubFilter === 'cervical_cancer') {
        return famMembers.some((m) => m.ncdDiagnosis === 'Cervical Cancer' || m.chronicConditionType?.toLowerCase().includes('cervic'));
      }
      return true;
    }

    if (activeCategory === 'Child') {
      if (!fam.hasChild) return false;
      if (!selectedSubFilter || selectedSubFilter === 'all_child') return true;

      const famMembers = members.filter((m) => m.familyUnitId === fam.id);
      if (selectedSubFilter === 'infants') {
        return famMembers.some((m) => m.isChild && m.age <= 1);
      }
      if (selectedSubFilter === 'vax_due') {
        return fam.status === '7days' || fam.status === '15days';
      }
      if (selectedSubFilter === 'vax_done') {
        return fam.status === 'visited';
      }
      return true;
    }

    return true;
  };

  // Map 24 households to interactive grid dots
  const gridDots: HouseholdDot[] = families.map((fam) => {
    const isMatch = checkFamilyMatch(fam);
    const dotStatus = isMatch ? fam.status : 'noData';

    return {
      id: fam.sequentialNumber,
      houseNo: Number(fam.houseNumber),
      familyName: fam.headName,
      totalMembers: fam.totalMembers,
      lastVisited: fam.lastVisitedAt || t('noData'),
      nextVisit: fam.nextVisitDate,
      status: dotStatus,
      sectionData: {
        pregnancy: fam.hasPregnancy,
        disease: fam.hasDisease,
        child: fam.hasChild,
      },
    };
  });

  const matchingCount = gridDots.filter((d) => d.status !== 'noData').length;
  const currentSubOptions = subFilterOptions[activeCategory] || [];
  const activeSubOption = currentSubOptions.find((o) => o.key === selectedSubFilter);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Offline Audio Guidance Banner */}
        <VoiceGuideBanner
          sectionTitle="आशा 3x8 परिवार ग्रिड (24 घर)"
          guideTextHi="यहाँ आपके क्षेत्र के 24 घरों का 3x8 ग्रिड है। ऊपर श्रेणी चुनें और नीचे दिए गए विकल्पों से तुरंत फ़िल्टर करें।"
          guideTextMr="येथे तुमच्या क्षेत्रातील २४ घरांचा ३x८ ग्रिड आहे. वरील श्रेणी निवडा आणि लगेच फिल्टर करा."
          guideTextEn="Here is the 3x8 grid of 24 village households. Tap categories above and choose sub-filters to filter directly."
        />

        {/* 1. Top Primary Category Tabs (All / Pregnancy / Disease / Child) */}
        <View style={styles.mainTabRow}>
          {(['All', 'Pregnancy', 'Disease', 'Child'] as const).map((tab) => {
            const isActive = activeCategory === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.mainTabBtn, isActive && styles.mainTabBtnActive]}
                onPress={() => handleMainTabPress(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.mainTabText, isActive && styles.mainTabTextActive]}>
                  {tab === 'All'
                    ? 'सभी (All)'
                    : tab === 'Pregnancy'
                    ? 'गर्भावस्था (ANC)'
                    : tab === 'Disease'
                    ? 'रोग जांच (NCD)'
                    : 'बाल स्वास्थ्य'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 2. Sub-Filter Bar directly below categories (In-Place UX, No page jump) */}
        <View style={styles.subFilterSection}>
          <View style={styles.subFilterHeader}>
            <Filter size={13} color={Colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.subFilterTitle}>
              {activeCategory === 'All'
                ? 'प्राथमिकता फ़िल्टर:'
                : activeCategory === 'Pregnancy'
                ? 'मातृ स्वास्थ्य उप-फ़िल्टर:'
                : activeCategory === 'Disease'
                ? 'रोग प्रकार उप-फ़िल्टर:'
                : 'बाल स्वास्थ्य उप-फ़िल्टर:'}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subScrollRow}>
            {currentSubOptions.map((opt) => {
              const isSelected = selectedSubFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.subPill, isSelected && styles.subPillSelected]}
                  onPress={() => handleSelectSubFilter(opt.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.subPillText, isSelected && styles.subPillTextSelected]}>
                    {opt.labelHi}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Filter Dismissible Badge */}
          {selectedSubFilter && activeSubOption && (
            <View style={styles.activeFilterChipRow}>
              <View style={styles.activeFilterBadge}>
                <Text style={styles.activeFilterText}>
                  सक्रिय: {activeSubOption.labelHi}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedSubFilter(null)}
                  style={styles.clearFilterBtn}
                  activeOpacity={0.7}
                >
                  <X size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.matchCountText}>
                {matchingCount} घर मेल खा रहे हैं
              </Text>
            </View>
          )}
        </View>

        {/* 3. 3x8 Household Matrix Grid */}
        <View style={styles.cardWrapper}>
          <DotGrid
            dots={gridDots}
            onDotPress={(dot) => setSelectedDot(dot)}
            selectedDotId={selectedDot?.id}
          />
        </View>

        {/* 4. Professional Clinical Status Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>प्राथमिकता रंग संकेतक:</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: Colors.urgentRed }]} />
              <Text style={styles.legendText}>7 दिन (अति आवश्यक / HRP)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: Colors.mediumPink }]} />
              <Text style={styles.legendText}>15 दिन (शीघ्र समीक्षा)</Text>
            </View>
          </View>
          <View style={[styles.legendRow, { marginTop: 8 }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: Colors.dueYellow }]} />
              <Text style={styles.legendText}>30 दिन (नियमित जांच)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: Colors.visitedGreen }]} />
              <Text style={styles.legendText}>भेंट पूर्ण (Visited)</Text>
            </View>
          </View>
        </View>

        {/* 5. Direct QR Scanning / ANM Sync CTA */}
        <TouchableOpacity
          style={styles.sendDataButton}
          onPress={onNavigateToSync}
          activeOpacity={0.85}
        >
          <QrCode size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.sendDataText}>डायरेक्ट QR स्कैन / एएनएम को डेटा भेजें</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Slide-Up Bottom Sheet on Dot Tap */}
      <FamilyBottomSheet
        dot={selectedDot}
        onClose={() => setSelectedDot(null)}
        onViewMembers={(dot) => {
          setSelectedDot(null);
          onNavigateToFamilyDetail(dot.houseNo, dot.familyName);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  mainTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mainTabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 7,
  },
  mainTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  mainTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  mainTabTextActive: {
    color: '#FFFFFF',
  },
  // Sub-Filter Section (In-Place)
  subFilterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  subFilterTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  subScrollRow: {
    flexDirection: 'row',
  },
  subPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subPillSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: Colors.primary,
  },
  subPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  subPillTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  activeFilterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 6,
  },
  clearFilterBtn: {
    padding: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  matchCountText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  legendContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sendDataButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  sendDataText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
