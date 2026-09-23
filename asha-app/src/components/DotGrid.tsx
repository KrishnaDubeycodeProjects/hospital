import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { Users, LayoutGrid, Rows } from 'lucide-react-native';

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
}

interface DotGridProps {
  dots: HouseholdDot[];
  onDotPress: (dot: HouseholdDot) => void;
  selectedDotId?: number;
}

export const DotGrid: React.FC<DotGridProps> = ({
  dots,
  onDotPress,
  selectedDotId,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');

  const getStatusColor = (status: HouseholdDot['status']) => {
    switch (status) {
      case '7days':
        return Colors.urgentRed;
      case '15days':
        return Colors.mediumPink;
      case '30days':
        return Colors.dueYellow;
      case 'visited':
        return Colors.visitedGreen;
      case 'noData':
      default:
        return Colors.grayNoData;
    }
  };

  const getStatusBg = (status: HouseholdDot['status']) => {
    switch (status) {
      case '7days':
        return '#FEF2F2';
      case '15days':
        return '#FDF2F8';
      case '30days':
        return '#FFFBEB';
      case 'visited':
        return '#F0FDF4';
      case 'noData':
      default:
        return '#F9FAFB';
    }
  };

  const getStatusLabel = (status: HouseholdDot['status']) => {
    switch (status) {
      case '7days':
        return '7 दिन';
      case '15days':
        return '15 दिन';
      case '30days':
        return '30 दिन';
      case 'visited':
        return 'भेंट पूर्ण';
      case 'noData':
      default:
        return 'डेटा नहीं';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.gridHeading}>घर सूची</Text>
          <Text style={styles.gridSubheading}>
            {dots.length} परिवार पंजीकृत
          </Text>
        </View>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'cards' && styles.toggleBtnActive]}
            onPress={() => setViewMode('cards')}
            activeOpacity={0.7}
          >
            <Rows size={14} color={viewMode === 'cards' ? '#FFF' : Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'matrix' && styles.toggleBtnActive]}
            onPress={() => setViewMode('matrix')}
            activeOpacity={0.7}
          >
            <LayoutGrid size={14} color={viewMode === 'matrix' ? '#FFF' : Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'cards' ? (
        <View style={styles.grid3x8Cards}>
          {dots.map((dot) => {
            const isSelected = dot.id === selectedDotId;
            const color = getStatusColor(dot.status);
            const bgColor = getStatusBg(dot.status);

            return (
              <TouchableOpacity
                key={dot.id}
                style={[
                  styles.card3x8Cell,
                  { backgroundColor: bgColor, borderColor: color },
                  isSelected && styles.selectedCell,
                ]}
                onPress={() => onDotPress(dot)}
                activeOpacity={0.75}
              >
                {/* Top Badge: House # & Urgency Pill */}
                <View style={styles.cardCellTop}>
                  <View style={[styles.houseNumberBadge, { backgroundColor: color }]}>
                    <Text style={styles.houseNumberText}>
                      #{dot.houseNo < 10 ? `0${dot.houseNo}` : dot.houseNo}
                    </Text>
                  </View>
                  <View style={[styles.statusIndicatorCircle, { backgroundColor: color }]} />
                </View>

                {/* Family Head Name */}
                <Text style={styles.cardFamilyName} numberOfLines={1}>
                  {dot.familyName}
                </Text>

                {/* Clinical Section Badges (Pregnancy, Child, Disease) */}
                <View style={styles.clinicalBadgesRow}>
                  {dot.sectionData?.pregnancy && (
                    <Text style={styles.clinicalIcon}>🤰</Text>
                  )}
                  {dot.sectionData?.child && (
                    <Text style={styles.clinicalIcon}>👶</Text>
                  )}
                  {dot.sectionData?.disease && (
                    <Text style={styles.clinicalIcon}>🩺</Text>
                  )}
                </View>

                {/* Member Count & Status Label */}
                <View style={styles.cardCellBottom}>
                  <View style={styles.memberCountWrap}>
                    <Users size={10} color={Colors.textSecondary} style={{ marginRight: 2 }} />
                    <Text style={styles.memberCountText}>{dot.totalMembers}</Text>
                  </View>
                  <Text style={[styles.statusLabelText, { color }]}>
                    {getStatusLabel(dot.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        /* Compact 3x8 Matrix (8 Columns x 3 Rows or 3 Columns x 8 Rows) */
        <View style={styles.matrixContainer}>
          {dots.map((dot) => {
            const isSelected = dot.id === selectedDotId;
            const color = getStatusColor(dot.status);

            return (
              <TouchableOpacity
                key={dot.id}
                style={[
                  styles.matrixBox,
                  { backgroundColor: color },
                  isSelected && styles.matrixBoxSelected,
                ]}
                onPress={() => onDotPress(dot)}
                activeOpacity={0.7}
              >
                <Text style={styles.matrixHouseText}>
                  {dot.houseNo < 10 ? `0${dot.houseNo}` : dot.houseNo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flex: 1,
  },
  gridHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gridSubheading: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  // 3 x 8 Cards Layout
  grid3x8Cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card3x8Cell: {
    width: '31.5%',
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 8,
    marginBottom: 10,
    minHeight: 88,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedCell: {
    borderWidth: 2.5,
    borderColor: Colors.primaryDark,
    transform: [{ scale: 1.03 }],
  },
  cardCellTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  houseNumberBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  houseNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusIndicatorCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardFamilyName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  clinicalBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
    minHeight: 16,
  },
  clinicalIcon: {
    fontSize: 11,
  },
  cardCellBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 4,
  },
  memberCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  statusLabelText: {
    fontSize: 9,
    fontWeight: '700',
  },
  // Compact Matrix (8 per row x 3 rows = 24)
  matrixContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  matrixBox: {
    width: '11.5%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  matrixBoxSelected: {
    borderWidth: 2.5,
    borderColor: '#000000',
    transform: [{ scale: 1.15 }],
  },
  matrixHouseText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
