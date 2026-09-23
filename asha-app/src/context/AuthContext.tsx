import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'ASHA' | 'ANM' | 'CHO';

export interface UserProfile {
  name: string;
  role: UserRole;
  roleTitle: string;
  village: string;
  phone: string;
  ashaId?: string;
  assignedAnm?: string;
}

interface AuthContextType {
  user: UserProfile;
  setRole: (role: UserRole) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const defaultProfiles: Record<UserRole, UserProfile> = {
  ASHA: {
    name: 'Sunita Devi',
    role: 'ASHA',
    roleTitle: 'ASHA Worker',
    village: 'Chandpur Village',
    phone: '+91 98765 43210',
    ashaId: 'ASHA-UP-VNS-042',
    assignedAnm: 'Rekha Sharma (+91 98765 11111)',
  },
  ANM: {
    name: 'Rekha Sharma',
    role: 'ANM',
    roleTitle: 'Auxiliary Nurse Midwife (ANM)',
    village: 'Chandpur PHC Sector',
    phone: '+91 98765 11111',
    ashaId: 'ANM-CHANDPUR-01',
    assignedAnm: 'PHC Chandpur Medical Officer',
  },
  CHO: {
    name: 'Dr. Kavish Ahuja',
    role: 'CHO',
    roleTitle: 'Community Health Officer',
    village: 'District Block Hospital',
    phone: '+91 98765 22222',
    ashaId: 'CHO-VNS-BLOCK-1',
    assignedAnm: 'District Health Administration',
  },
};

const AuthContext = createContext<AuthContextType>({
  user: defaultProfiles.ASHA,
  setRole: () => {},
  updateProfile: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<UserRole>('ASHA');
  const [profiles, setProfiles] = useState<Record<UserRole, UserProfile>>(defaultProfiles);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfiles((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        ...updates,
      },
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        user: profiles[role],
        setRole,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
