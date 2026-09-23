import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { User, RefreshCw, CloudOff, CheckCircle, Wifi } from 'lucide-react-native';

interface HeaderProps {
  onRolePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRolePress }) => {
  const { user, setRole } = useAuth();
  const { pendingSyncCount, isSyncing, isOnline, triggerSync } = useOfflineData();

  const cycleRole = () => {
    if (user.role === 'ASHA') setRole('ANM');
    else if (user.role === 'ANM') setRole('CHO');
    else setRole('ASHA');
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandingRow}>
        <Image
          source={require('../../assets/aarogya_flow_logo_hd.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titleCol}>
          <Text style={styles.appTitle}>Aarogya Flow</Text>
          <Text style={styles.appSubtitle}>Care Closer. Healthier Tomorrow.</Text>
        </View>
      </View>

      <View style={styles.rightActions}>
        {/* Internet Connection / Local Storage Status Indicator */}
        <TouchableOpacity
          style={styles.storageBadge}
          onPress={() => triggerSync()}
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <>
              <RefreshCw size={12} color={Colors.primary} />
              <Text style={[styles.storageText, { color: Colors.primary }]}>Syncing...</Text>
            </>
          ) : isOnline ? (
            <>
              <Wifi size={12} color={Colors.visitedGreen} />
              <Text style={[styles.storageText, { color: Colors.visitedGreen }]}>Online</Text>
            </>
          ) : pendingSyncCount > 0 ? (
            <>
              <CloudOff size={12} color="#D97706" />
              <Text style={styles.storageText}>{pendingSyncCount} local</Text>
            </>
          ) : (
            <>
              <CheckCircle size={12} color={Colors.visitedGreen} />
              <Text style={[styles.storageText, { color: Colors.visitedGreen }]}>Saved</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Role Switcher */}
        <TouchableOpacity
          style={styles.roleBadge}
          onPress={onRolePress || cycleRole}
          activeOpacity={0.8}
        >
          <User size={14} color={Colors.primary} />
          <Text style={styles.roleText}>{user.role}</Text>
          <RefreshCw size={10} color={Colors.textMuted} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  titleCol: {
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  appSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  storageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 3,
  },
});
