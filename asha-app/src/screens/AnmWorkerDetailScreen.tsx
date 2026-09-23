import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Colors } from '../theme/colors';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { StatusBadge } from '../components/StatusBadge';

interface AnmWorkerDetailScreenProps {
  ashaName?: string;
  village?: string;
  onBack: () => void;
  onSelectForm: () => void;
}

const mockWorkerMembers = [
  { id: 1, initials: 'SV', name: 'Suman Verma', details: 'Female • 28 yrs', isPregnant: true },
  { id: 2, initials: 'RV', name: 'Rajesh Verma', details: 'Male • 35 yrs' },
  { id: 3, initials: 'AV', name: 'Aarti Verma', details: 'Female • 16 yrs' },
  { id: 4, initials: 'VV', name: 'Vivek Verma', details: 'Male • 10 yrs' },
];

export const AnmWorkerDetailScreen: React.FC<AnmWorkerDetailScreenProps> = ({
  ashaName = 'Sunita Devi',
  village = 'Chandpur Village',
  onBack,
  onSelectForm,
}) => {
  const [activeTab, setActiveTab] = useState<'Members' | 'Surveys' | 'History'>('Members');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{ashaName}</Text>
          <Text style={styles.headerSub}>{village}</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {/* Tabs matching Screen 10 */}
      <View style={styles.tabSection}>
        {(['Members', 'Surveys', 'History'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isActive && styles.activeTabBtn]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Member Cards List */}
      <FlatList
        data={mockWorkerMembers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={onSelectForm}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.initials}</Text>
            </View>

            <View style={styles.cardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.isPregnant && (
                  <View style={{ marginLeft: 8 }}>
                    <StatusBadge type="pregnant" />
                  </View>
                )}
              </View>
              <Text style={styles.details}>{item.details}</Text>
            </View>

            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      />
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabSection: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.grayBg,
    marginHorizontal: 4,
  },
  activeTabBtn: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#BE185D',
  },
  cardInfo: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  details: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
