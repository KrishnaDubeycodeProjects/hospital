import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking } from 'react-native';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import {
  Phone,
  Users,
  ChevronRight,
  Baby,
  Syringe,
  HeartPulse,
  Clock,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react-native';

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

export const DotGrid: React.FC<DotGridProps> = ({
  dots,
  onDotPress,
  selectedDotId,
  onViewFamilyDetail,
  onMarkVisited,
}) => {
  const { t } = useLanguage();

  // Strictly enforce the official 24-house matrix (House 01 to House 24)
  const villageDots = dots
    .filter((d) => d.houseNo >= 1 && d.houseNo <= 24)
    .sort((a, b) => a.houseNo - b.houseNo);

  const getStatusColor = (status: HouseholdDot['status']) => {
    switch (status) {
      case '7days':
        return Colors.urgentRed; // Clean Medical Red
      case '15days':
        return Colors.mediumPink; // Soft Rose Pink
      case '30days':
        return Colors.dueYellow; // Warm Amber Yellow
      case 'visited':
        return Colors.visitedGreen; // Fresh Emerald
      case 'noData':
      default:
        return Colors.grayNoData; // Clean Slate Grey
    }
  };

  const getStatusLabel = (status: HouseholdDot['status']) => {
    switch (status) {
      case '7days':
        return 'गंभीर (7 दिन)';
      case '15days':
        return 'मध्यम (15 दिन)';
      case '30days':
        return 'सामान्य (30 दिन)';
      case 'visited':
        return 'भेंट पूर्ण';
      case 'noData':
      default:
        return 'नई जानकारी बाकी';
    }
  };

  // Active family dot (defaults to first dot if none explicitly selected)
  const activeDot =
    villageDots.find((d) => d.id === selectedDotId || d.houseNo === selectedDotId) ||
    (villageDots.length > 0 ? villageDots[0] : null);

  const activeColor = activeDot ? getStatusColor(activeDot.status) : Colors.primary;
  const activeTextColor = activeDot?.status === '30days' ? '#78350F' : '#FFFFFF';

  return (
    <View style={styles.container}>
      {/* Clean Rural Village House Cards */}
      <View style={styles.heatmapCard}>
        <View style={styles.headerRow}>
          <Text style={styles.gridHeading}>{t('villageHousesTitle')}</Text>
          <Text style={styles.gridSubheading}>{t('villageHousesSubtitle')}</Text>
        </View>

        {/* Strictly 24 Village Household Indicator Tiles (3 Rows x 8 Columns) */}
        <View style={styles.matrixContainer}>
          {villageDots.map((dot) => {
            const isSelected = activeDot?.id === dot.id || activeDot?.houseNo === dot.houseNo;
            const color = getStatusColor(dot.status);
            const textColor = dot.status === '30days' ? '#78350F' : '#FFFFFF';

            return (
              <TouchableOpacity
                key={dot.id}
                style={[
                  styles.matrixBox,
                  { backgroundColor: color },
                  isSelected && styles.matrixBoxSelected,
                ]}
                onPress={() => onDotPress(dot)}
                activeOpacity={0.75}
              >
                <Text style={[styles.matrixHouseText, { color: textColor }]}>
                  {dot.houseNo < 10 ? `0${dot.houseNo}` : dot.houseNo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Clean, Simple Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.urgentRed }]} />
              <Text style={styles.legendText}>{t('legend7Days')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.mediumPink }]} />
              <Text style={styles.legendText}>{t('legend15Days')}</Text>
            </View>
          </View>
          <View style={[styles.legendRow, { marginTop: 8 }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.dueYellow }]} />
              <Text style={styles.legendText}>{t('legend30Days')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.visitedGreen }]} />
              <Text style={styles.legendText}>{t('legendVisited')}</Text>
            </View>
          </View>
          <View style={[styles.legendRow, { marginTop: 8 }]}>
            <View style={[styles.legendItem, { width: '100%' }]}>
              <View style={[styles.legendDot, { backgroundColor: Colors.grayNoData }]} />
              <Text style={styles.legendText}>{t('legendNoData')}</Text>
            </View>
          </View>
        </View>

        {/* ============================================================== */}
        {/* EMBEDDED FAMILY DATA CARD (परिवार का विवरण सीधे स्क्रीन पर)     */}
        {/* ============================================================== */}
        {activeDot && (
          <View style={styles.familyDataCard}>
            <View style={styles.familyDataCardHeader}>
              <View style={styles.familyHeaderLeft}>
                <View style={[styles.houseNumBadge, { backgroundColor: activeColor }]}>
                  <Text style={[styles.houseNumBadgeText, { color: activeTextColor }]}>
                    {activeDot.houseNo < 10 ? `0${activeDot.houseNo}` : activeDot.houseNo}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={styles.familyHeadName}>{activeDot.familyName} का परिवार</Text>
                    <View style={[styles.statusBadgePill, { backgroundColor: activeColor + '20', borderColor: activeColor }]}>
                      <View style={[styles.statusDotSmall, { backgroundColor: activeColor }]} />
                      <Text style={[styles.statusBadgePillText, { color: activeColor === '#FBBF24' ? '#92400E' : activeColor }]}>
                        {getStatusLabel(activeDot.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.familyLocationText}>
                    {activeDot.villageName || 'चाँदपुर गाँव'} • {activeDot.totalMembers} सदस्य • {activeDot.nextVisit}
                  </Text>
                </View>
              </View>

              {/* Call Phone Button */}
              {activeDot.primaryPhone && (
                <TouchableOpacity
                  style={styles.callPhoneBtn}
                  onPress={() => Linking.openURL(`tel:${activeDot.primaryPhone}`)}
                  activeOpacity={0.8}
                >
                  <Phone size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.callPhoneBtnText}>कॉल करें</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Health Indicators Row */}
            <View style={styles.healthIndicatorsRow}>
              <View style={[styles.healthIndicatorItem, activeDot.sectionData?.pregnancy && styles.healthIndicatorActivePreg]}>
                <Baby size={13} color={activeDot.sectionData?.pregnancy ? '#BE185D' : '#94A3B8'} style={{ marginRight: 4 }} />
                <Text style={[styles.healthIndicatorText, activeDot.sectionData?.pregnancy && styles.healthIndicatorTextActivePreg]}>
                  {activeDot.sectionData?.pregnancy ? 'गर्भावस्था: सक्रिय' : 'गर्भावस्था: नहीं'}
                </Text>
              </View>

              <View style={[styles.healthIndicatorItem, activeDot.sectionData?.child && styles.healthIndicatorActiveChild]}>
                <Syringe size={13} color={activeDot.sectionData?.child ? '#0369A1' : '#94A3B8'} style={{ marginRight: 4 }} />
                <Text style={[styles.healthIndicatorText, activeDot.sectionData?.child && styles.healthIndicatorTextActiveChild]}>
                  {activeDot.sectionData?.child ? 'बाल टीका: देय' : 'बाल टीका: पूर्ण'}
                </Text>
              </View>

              <View style={[styles.healthIndicatorItem, activeDot.sectionData?.disease && styles.healthIndicatorActiveDisease]}>
                <HeartPulse size={13} color={activeDot.sectionData?.disease ? '#B91C1C' : '#94A3B8'} style={{ marginRight: 4 }} />
                <Text style={[styles.healthIndicatorText, activeDot.sectionData?.disease && styles.healthIndicatorTextActiveDisease]}>
                  {activeDot.sectionData?.disease ? 'एनसीडी: निगरानी' : 'एनसीडी: सामान्य'}
                </Text>
              </View>
            </View>

            {/* Visit Details Timing Box */}
            <View style={styles.visitTimingRow}>
              <View style={styles.timingCol}>
                <Clock size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.timingLabel}>अंतिम भेंट: </Text>
                <Text style={styles.timingVal}>{activeDot.lastVisited}</Text>
              </View>
              <View style={styles.timingCol}>
                <Calendar size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.timingLabel}>अगली भेंट: </Text>
                <Text style={[styles.timingVal, { color: activeColor === '#FBBF24' ? '#92400E' : activeColor, fontWeight: '700' }]}>
                  {activeDot.nextVisit}
                </Text>
              </View>
            </View>

            {/* Family Members Preview */}
            {activeDot.membersList && activeDot.membersList.length > 0 && (
              <View style={styles.membersPreviewContainer}>
                <View style={styles.membersPreviewHeader}>
                  <Users size={13} color="#475569" style={{ marginRight: 5 }} />
                  <Text style={styles.membersPreviewTitle}>परिवार के सदस्य ({activeDot.membersList.length}):</Text>
                </View>
                <View style={styles.membersListStack}>
                  {activeDot.membersList.slice(0, 3).map((member) => (
                    <View key={member.id} style={styles.memberPreviewItem}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberMeta}>
                          {member.age ? `${member.age} वर्ष` : ''} {member.gender ? `• ${member.gender}` : ''}
                        </Text>
                      </View>
                      <View style={[
                        styles.memberConditionBadge,
                        member.isPregnant && { backgroundColor: '#FCE7F3' },
                        member.isChild && { backgroundColor: '#E0F2FE' },
                        member.hasDisease && { backgroundColor: '#FEE2E2' },
                      ]}>
                        <Text style={[
                          styles.memberConditionText,
                          member.isPregnant && { color: '#BE185D' },
                          member.isChild && { color: '#0369A1' },
                          member.hasDisease && { color: '#DC2626' },
                        ]}>
                          {member.condition || 'सामान्य'}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {activeDot.membersList.length > 3 && (
                    <Text style={styles.moreMembersText}>
                      + {activeDot.membersList.length - 3} और सदस्य (विस्तृत विवरण देखें)
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Direct Action Buttons */}
            <View style={styles.familyActionButtonsRow}>
              <TouchableOpacity
                style={styles.openFamilyFolderBtn}
                onPress={() => {
                  if (onViewFamilyDetail) onViewFamilyDetail(activeDot);
                  else onDotPress(activeDot);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.openFamilyFolderBtnText}>
                  📁 परिवार फोल्डर खोलें एवं फॉर्म भरें (मकान #{activeDot.houseNo})
                </Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  heatmapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    marginBottom: 12,
  },
  gridHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  gridSubheading: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Strictly 3 Rows x 8 Columns Grid = 24 Cells
  matrixContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  matrixBox: {
    width: '11.5%',
    aspectRatio: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  matrixBoxSelected: {
    borderWidth: 2.5,
    borderColor: '#0284C7',
    transform: [{ scale: 1.15 }],
    zIndex: 10,
    shadowOpacity: 0.3,
  },
  matrixHouseText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // Clean Clinical Legend
  legendContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 6,
    flexShrink: 0,
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  // Embedded Family Data Card Styles
  familyDataCard: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  familyDataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  familyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  houseNumBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  houseNumBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  familyHeadName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  statusBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  familyLocationText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  callPhoneBtn: {
    backgroundColor: '#15803D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 6,
  },
  callPhoneBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  healthIndicatorsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  healthIndicatorItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  healthIndicatorActivePreg: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  healthIndicatorActiveChild: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  healthIndicatorActiveDisease: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  healthIndicatorText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
    flexShrink: 1,
  },
  healthIndicatorTextActivePreg: {
    color: '#BE185D',
    fontWeight: '700',
  },
  healthIndicatorTextActiveChild: {
    color: '#0369A1',
    fontWeight: '700',
  },
  healthIndicatorTextActiveDisease: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  visitTimingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  timingCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timingLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  timingVal: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  membersPreviewContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  membersPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  membersPreviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  membersListStack: {
    gap: 5,
  },
  memberPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  memberAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F46E5',
  },
  memberName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  memberMeta: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  memberConditionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberConditionText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#475569',
  },
  moreMembersText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  familyActionButtonsRow: {
    marginTop: 10,
  },
  openFamilyFolderBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  openFamilyFolderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
});
