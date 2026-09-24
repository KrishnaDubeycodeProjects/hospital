import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  Baby,
  Syringe,
  HeartPulse,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Clock,
  Sparkles,
  Users,
  LayoutGrid,
  ListFilter,
  Send,
  QrCode,
} from 'lucide-react-native';
import { DotGrid, HouseholdDot } from '../components/DotGrid';
import { FamilyBottomSheet } from '../components/FamilyBottomSheet';
import { useOfflineData } from '../context/OfflineDataContext';
import { useLanguage } from '../context/LanguageContext';
import { FamilyMember } from '../types/storage';

interface HomeScreenProps {
  onOpenPregnancyForm: (member: FamilyMember, familyId: string) => void;
  onOpenChildForm: (member: FamilyMember, familyId: string) => void;
  onOpenOtherServiceForm: (member: FamilyMember, familyId: string, serviceType: string) => void;
  onNavigateToSync: () => void;
  onNavigateToFamilyDetail?: (houseNo: number, familyName: string) => void;
}

export type MainSection = 'Pregnancy' | 'Child' | 'OtherServices' | 'All';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenPregnancyForm,
  onOpenChildForm,
  onOpenOtherServiceForm,
  onNavigateToSync,
  onNavigateToFamilyDetail,
}) => {
  const { families, members, surveys, updateChildVaccine, childVaccinations, outbox, pendingSyncCount } = useOfflineData();
  const { t } = useLanguage();

  const [activeSection, setActiveSection] = useState<MainSection>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'dueList'>('grid');
  const [selectedDot, setSelectedDot] = useState<HouseholdDot | null>(null);

  const [pregnancyFilter, setPregnancyFilter] = useState<'all' | 'due' | 'hrp' | 'vax'>('all');
  const [childFilter, setChildFilter] = useState<'all' | 'due' | 'growth'>('all');
  const [otherCategory, setOtherCategory] = useState<'fp' | 'pnc' | 'adolescent'>('fp');

  // Map local storage families to HouseholdDot items for the Suchi Grid
  const dots: HouseholdDot[] = families.map((fam) => {
    const famMembers = members.filter((m) => m.familyUnitId === fam.id);
    const hasPreg = famMembers.some((m) => m.isPregnant) || fam.hasPregnancy;
    const hasChild = famMembers.some((m) => m.isChild || m.age <= 5) || fam.hasChild;
    const hasDisease = famMembers.some((m) => m.hasChronicCondition) || fam.hasDisease;

    let status: HouseholdDot['status'] = (fam.status as HouseholdDot['status']) || 'noData';
    if (fam.visitIntervalDays === 7) status = '7days';
    else if (fam.visitIntervalDays === 15) status = '15days';
    else if (fam.visitIntervalDays === 30) status = '30days';
    else if (fam.status === '7days') status = '7days';
    else if (fam.status === '15days') status = '15days';
    else if (fam.status === '30days') status = '30days';
    else if (fam.status === 'visited') status = 'visited';
    else if (fam.status === 'noData') status = 'noData';

    // Check if family has beneficiaries matching active activity switch
    let matchesSection = true;
    if (activeSection === 'Pregnancy') matchesSection = Boolean(hasPreg);
    else if (activeSection === 'Child') matchesSection = Boolean(hasChild);
    else if (activeSection === 'OtherServices') matchesSection = Boolean(hasDisease || famMembers.length > 0);

    return {
      id: Number(fam.houseNumber) || fam.sequentialNumber || 1,
      houseNo: Number(fam.houseNumber) || fam.sequentialNumber || 1,
      familyName: fam.headName,
      totalMembers: famMembers.length || fam.totalMembers || 4,
      lastVisited: fam.lastVisitedAt || '5 दिन पूर्व',
      nextVisit: fam.nextVisitDate || '2 दिन शेष',
      status: matchesSection ? status : 'noData',
      sectionData: {
        pregnancy: Boolean(hasPreg),
        child: Boolean(hasChild),
        disease: Boolean(hasDisease),
      },
    };
  });

  // Filter pregnant women
  const pregnantWomen = members.filter((m) => {
    if (!m.isPregnant) return false;
    if (pregnancyFilter === 'hrp') return m.isHrp;
    return true;
  });

  // Filter children (age <= 5)
  const children = members.filter((m) => {
    const isChild = m.isChild || m.age <= 5;
    if (!isChild) return false;
    return true;
  });

  // Other beneficiaries
  const otherBeneficiaries = members.filter((m) => {
    if (otherCategory === 'fp') {
      return !m.isPregnant && m.gender === 'Female' && m.age >= 18 && m.age <= 45;
    }
    if (otherCategory === 'pnc') {
      return !m.isPregnant && m.gender === 'Female' && m.age >= 18 && m.age <= 35;
    }
    return m.age >= 10 && m.age <= 19;
  });

  const getDueVaccineForAge = (ageMonths: number): string => {
    if (ageMonths <= 1.5) return 'BCG, OPV-0, Hep-B (जन्म)';
    if (ageMonths <= 2.5) return 'OPV-1, Penta-1, Rota-1, fIPV-1 (6 सप्ताह)';
    if (ageMonths <= 3.5) return 'OPV-2, Penta-2, Rota-2 (10 सप्ताह)';
    if (ageMonths <= 9) return 'OPV-3, Penta-3, Rota-3, fIPV-2 (14 सप्ताह)';
    if (ageMonths <= 16) return 'MR-1, PCV Booster, Vit-A (9 माह)';
    if (ageMonths <= 24) return 'MR-2, DPT-1, OPV Booster (16-24 माह)';
    return 'DPT-2 (5 वर्ष)';
  };

  const getFamilyInfo = (familyUnitId: string) => {
    const fam = families.find((f) => f.id === familyUnitId);
    return {
      house: fam ? `मकान #${fam.houseNumber}` : 'मकान #1',
      head: fam?.headName || 'परिवार मुखिया',
    };
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP DIRECT ACTIVITY SWITCHER */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeSection === 'All' && styles.tabBtnActive]}
          onPress={() => setActiveSection('All')}
          activeOpacity={0.8}
        >
          <LayoutGrid size={17} color={activeSection === 'All' ? '#FFFFFF' : Colors.primary} />
          <Text style={[styles.tabText, activeSection === 'All' && styles.tabTextActive]}>
            सभी (24 घर)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeSection === 'Pregnancy' && styles.tabBtnActive]}
          onPress={() => setActiveSection('Pregnancy')}
          activeOpacity={0.8}
        >
          <Baby size={17} color={activeSection === 'Pregnancy' ? '#FFFFFF' : '#B91C1C'} />
          <Text style={[styles.tabText, activeSection === 'Pregnancy' && styles.tabTextActive]}>
            गर्भवती
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeSection === 'Child' && styles.tabBtnActive]}
          onPress={() => setActiveSection('Child')}
          activeOpacity={0.8}
        >
          <Syringe size={17} color={activeSection === 'Child' ? '#FFFFFF' : '#0284C7'} />
          <Text style={[styles.tabText, activeSection === 'Child' && styles.tabTextActive]}>
            बाल स्वास्थ्य
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeSection === 'OtherServices' && styles.tabBtnActive]}
          onPress={() => setActiveSection('OtherServices')}
          activeOpacity={0.8}
        >
          <HeartPulse size={17} color={activeSection === 'OtherServices' ? '#FFFFFF' : '#059669'} />
          <Text style={[styles.tabText, activeSection === 'OtherServices' && styles.tabTextActive]}>
            अन्य सेवाएँ
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. SUCHI VIEW MODE SWITCHER */}
      <View style={styles.viewModeToggleRow}>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('grid')}
          activeOpacity={0.8}
        >
          <LayoutGrid size={15} color={viewMode === 'grid' ? '#FFFFFF' : Colors.primary} />
          <Text style={[styles.viewModeBtnText, viewMode === 'grid' && styles.viewModeBtnTextActive]}>
            घर सूची
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'dueList' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('dueList')}
          activeOpacity={0.8}
        >
          <ListFilter size={15} color={viewMode === 'dueList' ? '#FFFFFF' : Colors.primary} />
          <Text style={[styles.viewModeBtnText, viewMode === 'dueList' && styles.viewModeBtnTextActive]}>
            रजिस्टर सूची
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
        {/* ============================================================== */}
        {/* VIEW MODE 1: VISUAL HOUSEHOLD SUCHI GRID                       */}
        {/* ============================================================== */}
        {viewMode === 'grid' && (
          <View>
            <DotGrid
              dots={dots}
              onDotPress={(dot) => setSelectedDot(dot)}
              selectedDotId={selectedDot?.id}
            />

            {/* SENDER DATA MODULE (एएनएम को डेटा भेजें) */}
            <View style={styles.senderDataCard}>
              <View style={styles.senderDataHeader}>
                <View style={styles.senderDataIconWrap}>
                  <Send size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.senderDataTitle}>📤 डेटा प्रेषक (Sender Data)</Text>
                  <Text style={styles.senderDataSubtitle}>
                    एएनएम को ऑफ़लाइन सर्वेक्षण व रिकॉर्ड भेजें
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {(pendingSyncCount || (outbox && outbox.length) || 3)} लंबित
                  </Text>
                </View>
              </View>

              {/* Data Category Metrics Pills */}
              <View style={styles.senderMetricsRow}>
                <View style={styles.senderMetricItem}>
                  <Syringe size={14} color={Colors.primary} />
                  <Text style={styles.senderMetricVal}>{childVaccinations?.length || 4}</Text>
                  <Text style={styles.senderMetricLabel}>टीकाकरण</Text>
                </View>
                <View style={styles.senderMetricItem}>
                  <Baby size={14} color="#D97706" />
                  <Text style={styles.senderMetricVal}>
                    {surveys.filter((s) => s.categoryCode === 'PREGNANCY').length || 2}
                  </Text>
                  <Text style={styles.senderMetricLabel}>गर्भावस्था</Text>
                </View>
                <View style={styles.senderMetricItem}>
                  <HeartPulse size={14} color="#DC2626" />
                  <Text style={styles.senderMetricVal}>
                    {surveys.filter((s) => s.categoryCode === 'DISEASE').length || 3}
                  </Text>
                  <Text style={styles.senderMetricLabel}>एनसीडी रोग</Text>
                </View>
              </View>

              {/* Action Button to Open Sync */}
              <TouchableOpacity
                style={styles.senderActionBtn}
                onPress={onNavigateToSync}
                activeOpacity={0.85}
              >
                <QrCode size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.senderActionBtnText}>
                  एएनएम को भेजें (Send Data to ANM)
                </Text>
                <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============================================================== */}
        {/* VIEW MODE 2: OFFICIAL REGISTER BENEFICIARY DUE LISTS           */}
        {/* ============================================================== */}
        {viewMode === 'dueList' && activeSection === 'Pregnancy' && (
          <View>
            {/* Filter Pills */}
            <View style={styles.filterPillsRow}>
              {[
                { key: 'all', label: 'सभी गर्भवती' },
                { key: 'due', label: 'जाँच देय (ANC)' },
                { key: 'hrp', label: 'उच्च जोखिम (HRP)' },
                { key: 'vax', label: 'टीकाकरण देय' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.pillBtn,
                    pregnancyFilter === p.key && styles.pillBtnActive,
                  ]}
                  onPress={() => setPregnancyFilter(p.key as any)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      pregnancyFilter === p.key && styles.pillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* List Counter */}
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>
                गर्भवती अपेक्षित सूची ({pregnantWomen.length})
              </Text>
              <Text style={styles.listHeaderBadge}>रजिस्टर 18 ब</Text>
            </View>

            {/* Beneficiary Cards */}
            {pregnantWomen.map((woman, idx) => {
              const fam = getFamilyInfo(woman.familyUnitId);
              const husbandName = woman.fatherOrHusbandName || fam.head;
              const survey = surveys.find((s) => s.familyMemberId === woman.id);
              const answers = survey?.answers || {};

              return (
                <View key={woman.id} style={styles.cleanCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.cleanCardTitle}>{woman.name}</Text>
                        <Text style={styles.cleanCardAge}>, {woman.age} वर्ष</Text>
                      </View>
                      <Text style={styles.cleanCardSub}>
                        पति: {husbandName} • {fam.house}
                      </Text>
                    </View>

                    {woman.isHrp ? (
                      <View style={styles.hrpBadge}>
                        <ShieldAlert size={12} color="#DC2626" style={{ marginRight: 3 }} />
                        <Text style={styles.hrpBadgeText}>HRP</Text>
                      </View>
                    ) : (
                      <View style={styles.dueBadge}>
                        <Text style={styles.dueBadgeText}>
                          {answers.ancVisitNumber || 'ANC 2 देय'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.chipsRow}>
                    <View style={styles.infoChip}>
                      <Text style={styles.infoChipText}>
                        टीका: {answers.ttGiven ? '✓ लगा' : 'देय'}
                      </Text>
                    </View>
                    <View style={styles.infoChip}>
                      <Text style={styles.infoChipText}>
                        BP: {answers.bp || '120/80'}
                      </Text>
                    </View>
                    <View style={styles.infoChip}>
                      <Text style={styles.infoChipText}>
                        Hb: {answers.hemoglobin || '10.4'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.openFormBtn}
                    onPress={() => onOpenPregnancyForm(woman, woman.familyUnitId)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.openFormBtnText}>फॉर्म भरें</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {viewMode === 'dueList' && activeSection === 'Child' && (
          <View>
            <View style={styles.filterPillsRow}>
              {[
                { key: 'all', label: 'सभी बच्चे' },
                { key: 'due', label: 'टीकाकरण देय' },
                { key: 'growth', label: 'वजन एवं वृद्धि' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.pillBtn,
                    childFilter === p.key && styles.pillBtnActive,
                  ]}
                  onPress={() => setChildFilter(p.key as any)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      childFilter === p.key && styles.pillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>
                बाल टीकाकरण ड्यू लिस्ट ({children.length})
              </Text>
              <Text style={styles.listHeaderBadge}>रजिस्टर 18 अ</Text>
            </View>

            {children.map((child, idx) => {
              const fam = getFamilyInfo(child.familyUnitId);
              const fatherName = child.fatherOrHusbandName || fam.head;
              const ageMonths = child.age <= 1 ? 3 : child.age * 12;
              const dueVaccine = getDueVaccineForAge(ageMonths);

              return (
                <View key={child.id} style={styles.cleanCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.avatarText, { color: '#0369A1' }]}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.cleanCardTitle}>{child.name}</Text>
                        <Text style={styles.cleanCardAge}> ({ageMonths} माह)</Text>
                      </View>
                      <Text style={styles.cleanCardSub}>
                        पिता: {fatherName} • {fam.house}
                      </Text>
                    </View>
                    <View style={styles.childAgeBadge}>
                      <Text style={styles.childAgeBadgeText}>{child.age || 1} वर्ष</Text>
                    </View>
                  </View>

                  <View style={styles.vaccineDueNotice}>
                    <Syringe size={14} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={styles.vaccineDueText} numberOfLines={1}>
                      देय: {dueVaccine}
                    </Text>
                  </View>

                  <View style={styles.cardButtonRow}>
                    <TouchableOpacity
                      style={styles.quickVaxBtn}
                      onPress={async () => {
                        await updateChildVaccine(child.id, 'Penta-1', 'Given');
                        alert(`✓ ${child.name} का टीका दर्ज किया गया!`);
                      }}
                      activeOpacity={0.8}
                    >
                      <CheckCircle size={15} color="#059669" style={{ marginRight: 5 }} />
                      <Text style={styles.quickVaxText}>टीका लगाया</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.openFormBtnSmall}
                      onPress={() => onOpenChildForm(child, child.familyUnitId)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.openFormBtnText}>फॉर्म भरें</Text>
                      <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {viewMode === 'dueList' && activeSection === 'OtherServices' && (
          <View>
            <View style={styles.filterPillsRow}>
              {[
                { key: 'fp', label: 'परिवार नियोजन' },
                { key: 'pnc', label: 'धात्री माता (PNC)' },
                { key: 'adolescent', label: 'किशोरी स्वास्थ्य' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.pillBtn,
                    otherCategory === p.key && styles.pillBtnActive,
                  ]}
                  onPress={() => setOtherCategory(p.key as any)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      otherCategory === p.key && styles.pillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderTitle}>
                अन्य सेवा लाभार्थी ({otherBeneficiaries.length})
              </Text>
              <Text style={styles.listHeaderBadge}>रजिस्टर 18 स</Text>
            </View>

            {otherBeneficiaries.map((member, idx) => {
              const fam = getFamilyInfo(member.familyUnitId);

              return (
                <View key={member.id} style={styles.cleanCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[styles.avatarText, { color: '#047857' }]}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cleanCardTitle}>{member.name}</Text>
                      <Text style={styles.cleanCardSub}>
                        {member.gender === 'Female' ? 'महिला' : 'पुरुष'}, {member.age} वर्ष • {fam.house}
                      </Text>
                    </View>
                    <View style={styles.otherServiceBadge}>
                      <Text style={styles.otherServiceBadgeText}>
                        {otherCategory === 'fp'
                          ? 'परिवार नियोजन'
                          : otherCategory === 'pnc'
                          ? 'धात्री'
                          : 'किशोरी'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.openFormBtn}
                    onPress={() =>
                      onOpenOtherServiceForm(member, member.familyUnitId, otherCategory)
                    }
                    activeOpacity={0.85}
                  >
                    <Text style={styles.openFormBtnText}>पंजीकरण फॉर्म भरें</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAMILY BOTTOM SHEET MODAL */}
      <FamilyBottomSheet
        dot={selectedDot}
        onClose={() => setSelectedDot(null)}
        onViewMembers={(dot) => {
          setSelectedDot(null);
          if (onNavigateToFamilyDetail) {
            onNavigateToFamilyDetail(dot.houseNo, dot.familyName);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  viewModeBtnTextActive: {
    color: '#FFFFFF',
  },
  suchiSummaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suchiSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  suchiSummaryHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  scrollList: {
    padding: 16,
    paddingBottom: 40,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  pillBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  listHeaderBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cleanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  cleanCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cleanCardAge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  cleanCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  hrpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hrpBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  dueBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  childAgeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  childAgeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  otherServiceBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  otherServiceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  infoChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  vaccineDueNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  vaccineDueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
    flex: 1,
  },
  openFormBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  openFormBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickVaxBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 9,
  },
  quickVaxText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  openFormBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
  },
  senderDataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  senderDataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  senderDataIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderDataTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  senderDataSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  senderMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  senderMetricItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 2,
  },
  senderMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  senderActionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  senderActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
