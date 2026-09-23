import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export type StatusType =
  | '7days'
  | '15days'
  | '30days'
  | 'visited'
  | 'noData'
  | 'pregnant'
  | 'dueSoon';

interface StatusBadgeProps {
  type: StatusType;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, label }) => {
  const getBadgeConfig = () => {
    switch (type) {
      case '7days':
        return {
          bg: Colors.urgentRedBg,
          text: Colors.urgentRed,
          defaultLabel: '7 days',
        };
      case '15days':
        return {
          bg: Colors.mediumPinkBg,
          text: Colors.mediumPink,
          defaultLabel: '15 days',
        };
      case '30days':
        return {
          bg: Colors.dueYellowBg,
          text: '#B45309',
          defaultLabel: '30 days',
        };
      case 'visited':
        return {
          bg: Colors.visitedGreenBg,
          text: Colors.visitedGreen,
          defaultLabel: 'Visited',
        };
      case 'pregnant':
        return {
          bg: Colors.mediumPinkBg,
          text: Colors.mediumPink,
          defaultLabel: 'Pregnant',
        };
      case 'noData':
      default:
        return {
          bg: Colors.grayBg,
          text: Colors.grayNoData,
          defaultLabel: 'No data',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.indicatorDot, { backgroundColor: config.text }]} />
      <Text style={[styles.text, { color: config.text }]}>
        {label || config.defaultLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
