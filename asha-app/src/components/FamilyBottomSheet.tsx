import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { HouseholdDot } from './DotGrid';
import { Home, ChevronRight, X } from 'lucide-react-native';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from '../context/LanguageContext';

interface FamilyBottomSheetProps {
  dot: HouseholdDot | null;
  onClose: () => void;
  onViewMembers: (dot: HouseholdDot) => void;
}

export const FamilyBottomSheet: React.FC<FamilyBottomSheetProps> = ({
  dot,
  onClose,
  onViewMembers,
}) => {
  const { t } = useLanguage();
  if (!dot) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={styles.sheet}>
        <View style={styles.dragHandle} />

        {/* Tapping anywhere on the header or info card navigates directly into the family folder */}
        <TouchableOpacity
          style={styles.headerRow}
          onPress={() => onViewMembers(dot)}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Home size={22} color={Colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.houseTitle}>{t('houseNumberLabel')}: {dot.houseNo}</Text>
            <Text style={styles.familySubtitle}>{dot.familyName} {t('families')}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          onPress={() => onViewMembers(dot)}
          activeOpacity={0.8}
        >
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('membersCount')}</Text>
            <Text style={styles.infoValue}>{dot.totalMembers}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('lastVisited')}</Text>
            <Text style={styles.infoValue}>{dot.lastVisited}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('nextVisit')}</Text>
            <StatusBadge type={dot.status} label={dot.nextVisit} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => onViewMembers(dot)}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{t('viewMembers')}</Text>
          <ChevronRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  houseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  familySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 14,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
