import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Colors } from '../theme/colors';

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
  const getStatusColor = (status: HouseholdDot['status']) => {
    switch (status) {
      case '7days':
        return Colors.urgentRed; // #E53935 (Vivid Red)
      case '15days':
        return Colors.mediumPink; // #EC4899 (Vivid Pink)
      case '30days':
        return Colors.dueYellow; // #FBBF24 (Vivid Yellow)
      case 'visited':
        return Colors.visitedGreen; // #43A047 (Vivid Green)
      case 'noData':
      default:
        return Colors.grayNoData; // #9E9E9E (Grey of Absence)
    }
  };

  return (
    <View style={styles.container}>
      {/* Clean 3x8 Visual Heatmap Matrix */}
      <View style={styles.heatmapCard}>
        <View style={styles.headerRow}>
          <Text style={styles.gridHeading}>3×8 परिवार ग्रिड हीटमैप</Text>
          <Text style={styles.gridSubheading}>
            {dots.length} घर • किसी भी घर पर टैप करें
          </Text>
        </View>

        {/* 24 Heatmap Matrix Tiles (3 rows x 8 columns) */}
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

        {/* Clean 5-Color Clinical Status Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.urgentRed }]} />
              <Text style={styles.legendText}>7 दिन (अति आवश्यक - Red)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.mediumPink }]} />
              <Text style={styles.legendText}>15 दिन (शीघ्र - Pink)</Text>
            </View>
          </View>
          <View style={[styles.legendRow, { marginTop: 6 }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.dueYellow }]} />
              <Text style={styles.legendText}>30 दिन (नियमित - Yellow)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.visitedGreen }]} />
              <Text style={styles.legendText}>भेंट पूर्ण (Visited - Green)</Text>
            </View>
          </View>
          <View style={[styles.legendRow, { marginTop: 6 }]}>
            <View style={[styles.legendItem, { width: '100%' }]}>
              <View style={[styles.legendDot, { backgroundColor: Colors.grayNoData }]} />
              <Text style={styles.legendText}>अनुपस्थिति / डेटा नहीं (Grey of Absence)</Text>
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
    borderWidth: 3,
    borderColor: '#000000',
    transform: [{ scale: 1.18 }],
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
