import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

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
  const { t } = useLanguage();

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

  return (
    <View style={styles.container}>
      {/* Clean Rural Village House Cards */}
      <View style={styles.heatmapCard}>
        <View style={styles.headerRow}>
          <Text style={styles.gridHeading}>{t('villageHousesTitle')}</Text>
          <Text style={styles.gridSubheading}>{t('villageHousesSubtitle')}</Text>
        </View>

        {/* 24 Village Household Indicator Tiles */}
        <View style={styles.matrixContainer}>
          {dots.map((dot) => {
            const isSelected = dot.id === selectedDotId;
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
  // 3 Rows x 8 Columns Grid = 24 Cells
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
    borderColor: Colors.primary,
    transform: [{ scale: 1.15 }],
    zIndex: 10,
  },
  matrixHouseText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // Clean Clinical Legend
  legendContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
