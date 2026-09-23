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
  ArrowLeft,
  Droplet,
  Wind,
  Smile,
  Activity,
  CheckCircle,
  Stethoscope,
} from 'lucide-react-native';

interface SectionFilterScreenProps {
  initialCategory?: 'Pregnancy' | 'Disease' | 'Child';
  onBack: () => void;
  onApply: (selectedSubFilter: string) => void;
}

export const SectionFilterScreen: React.FC<SectionFilterScreenProps> = ({
  initialCategory = 'Pregnancy',
  onBack,
  onApply,
}) => {
  const [category, setCategory] = useState<'Pregnancy' | 'Disease'>(
    initialCategory === 'Disease' ? 'Disease' : 'Pregnancy'
  );

  const [selectedPregnancyOption, setSelectedPregnancyOption] =
    useState('All Pregnancy');
  const [selectedDiseaseOption, setSelectedDiseaseOption] =
    useState('All Diseases');

  const pregnancyOptions = [
    'All Pregnancy',
    'First Trimester',
    'Second Trimester',
    'Third Trimester',
    'High Risk Pregnancy',
    'Antenatal Care (ANC)',
    'Postnatal Care (PNC)',
    'Immunization (TT)',
    'Nutrition & Supplements',
    'Complications',
  ];

  const diseaseOptions = [
    { title: 'All Diseases', icon: Stethoscope },
    { title: 'Hypertension', icon: Activity },
    { title: 'Diabetes', icon: Droplet },
    { title: 'TB', icon: Wind },
    { title: 'Asthma', icon: Wind },
    { title: 'Mental Health', icon: Smile },
  ];

  const handleApply = () => {
    onApply(
      category === 'Pregnancy'
        ? selectedPregnancyOption
        : selectedDiseaseOption
    );
  };

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {category === 'Pregnancy' ? 'Pregnancy' : 'Select Disease Type'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {category === 'Pregnancy' ? (
          <View style={styles.listCard}>
            {pregnancyOptions.map((opt) => {
              const isSelected = selectedPregnancyOption === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={styles.radioRow}
                  onPress={() => setSelectedPregnancyOption(opt)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text
                    style={[
                      styles.radioLabel,
                      isSelected && styles.radioLabelSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.listCard}>
            {diseaseOptions.map((item) => {
              const IconComp = item.icon;
              const isSelected = selectedDiseaseOption === item.title;
              return (
                <TouchableOpacity
                  key={item.title}
                  style={styles.diseaseRow}
                  onPress={() => setSelectedDiseaseOption(item.title)}
                  activeOpacity={0.7}
                >
                  <View style={styles.diseaseIconWrap}>
                    <IconComp size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.diseaseLabel}>{item.title}</Text>
                  {isSelected && (
                    <CheckCircle size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Apply Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleApply}
          activeOpacity={0.85}
        >
          <Text style={styles.applyText}>
            {category === 'Pregnancy' ? 'Apply' : 'Show Grid'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 90,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  radioLabelSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  diseaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  diseaseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  diseaseLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
