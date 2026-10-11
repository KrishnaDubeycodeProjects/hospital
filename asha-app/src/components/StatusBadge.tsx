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
          defaultLabel: 'गंभीर (Severe)',
        };
      case '15days':
        return {
          bg: Colors.mediumPinkBg,
          text: Colors.mediumPink,
          defaultLabel: 'मध्यम (Medium)',
        };
      case '30days':
        return {
          bg: Colors.dueYellowBg,
          text: '#B45309',
          defaultLabel: 'सामान्य (Normal)',
        };
      case 'visited':
        return {
          bg: Colors.visitedGreenBg,
          text: Colors.visitedGreen,
          defaultLabel: 'भेंट पूर्ण (Visited)',
        };
      case 'pregnant':
        return {
          bg: Colors.mediumPinkBg,
          text: Colors.mediumPink,
          defaultLabel: 'गर्भवती (Pregnant)',
        };
      case 'noData':
      default:
        return {
          bg: Colors.grayBg,
          text: Colors.grayNoData,
          defaultLabel: 'नई जानकारी (No data)',
        };
    }
  };

  const config = getBadgeConfig();

  // Sanitize label to eliminate any legacy mention of 7/15/30 days
  const cleanLabel = (() => {
    if (!label) return config.defaultLabel;
    const lower = label.toLowerCase();
    if (lower.includes('7') || lower.includes('urgent') || lower.includes('अति आवश्यक')) {
      return 'गंभीर (Severe)';
    }
    if (lower.includes('15') || lower.includes('शीघ्र') || lower.includes('review')) {
      return 'मध्यम (Medium)';
    }
    if (lower.includes('30') || lower.includes('नियमित') || lower.includes('routine')) {
      return 'सामान्य (Normal)';
    }
    return label;
  })();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.indicatorDot, { backgroundColor: config.text }]} />
      <Text style={[styles.text, { color: config.text }]}>
        {cleanLabel}
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
