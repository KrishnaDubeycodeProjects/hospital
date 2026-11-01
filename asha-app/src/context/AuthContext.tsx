import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStorageWorkerPhone } from '../storage/OfflineStorageService';

export type UserRole = 'ASHA' | 'ANM' | 'CHO';

export interface UserProfile {
  name: string;
  role: UserRole;
  roleTitle: string;
  village: string;
  phone: string;
  ashaId?: string;
  assignedAnm?: string;
  blockName?: string;
  districtName?: string;
}

export interface RegisterFormData {
  name: string;
  phone: string;
  role: UserRole;
  village: string;
  blockName?: string;
  districtName?: string;
  ashaId?: string;
}

export type AuthScreenType = 'login' | 'register' | 'forgot';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile;
  token: string | null;
  authScreen: AuthScreenType;
  setAuthScreen: (screen: AuthScreenType) => void;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; message: string }>;
  registerWorker: (data: RegisterFormData, code: string) => Promise<{ success: boolean; message: string }>;
  forgotPassword: (phone: string, code: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const BACKEND_BASE_URL = 'https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com';

const STORAGE_KEYS = {
  TOKEN: '@asha_auth_token_v6',
  USER: '@asha_auth_user_v6',
};

// Official Role-Based Profiles mapped directly to authoritative credentials
const PHONE_ROLES: Record<string, { role: UserRole; name: string; title: string; village: string; id: string; anm: string }> = {
  '9876543210': {
    role: 'ASHA',
    name: 'Sunita Devi',
    title: 'ASHA Worker (आशा कार्यकर्ता)',
    village: 'Chandpur Village',
    id: 'ASHA-UP-VNS-042',
    anm: 'Rekha Sharma (+91 98765 11111)',
  },
  '9876511111': {
    role: 'ANM',
    name: 'Rekha Sharma',
    title: 'Auxiliary Nurse Midwife (ANM)',
    village: 'Chandpur PHC Sector',
    id: 'ANM-CHANDPUR-01',
    anm: 'PHC Chandpur Medical Officer',
  },
  '9876522222': {
    role: 'CHO',
    name: 'Dr. Kavish Ahuja',
    title: 'Community Health Officer (CHO)',
    village: 'District Block Hospital',
    id: 'CHO-VNS-BLOCK-1',
    anm: 'District Health Administration',
  },
};

const defaultProfiles: Record<UserRole, UserProfile> = {
  ASHA: {
    name: 'Sunita Devi',
    role: 'ASHA',
    roleTitle: 'ASHA Worker (आशा कार्यकर्ता)',
    village: 'Chandpur Village',
    phone: '+91 98765 43210',
    ashaId: 'ASHA-UP-VNS-042',
    assignedAnm: 'Rekha Sharma (+91 98765 11111)',
    blockName: 'Rampur Block',
    districtName: 'Varanasi',
  },
  ANM: {
    name: 'Rekha Sharma',
    role: 'ANM',
    roleTitle: 'Auxiliary Nurse Midwife (ANM)',
    village: 'Chandpur PHC Sector',
    phone: '+91 98765 11111',
    ashaId: 'ANM-CHANDPUR-01',
    assignedAnm: 'PHC Chandpur Medical Officer',
    blockName: 'Rampur Block',
    districtName: 'Varanasi',
  },
  CHO: {
    name: 'Dr. Kavish Ahuja',
    role: 'CHO',
    roleTitle: 'Community Health Officer',
    village: 'District Block Hospital',
    phone: '+91 98765 22222',
    ashaId: 'CHO-VNS-BLOCK-1',
    assignedAnm: 'District Health Administration',
    blockName: 'Rampur Block',
    districtName: 'Varanasi',
  },
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: defaultProfiles.ASHA,
  token: null,
  authScreen: 'login',
  setAuthScreen: () => {},
  sendOtp: async () => ({ success: false, message: '' }),
  verifyOtp: async () => ({ success: false, message: '' }),
  registerWorker: async () => ({ success: false, message: '' }),
  forgotPassword: async () => ({ success: false, message: '' }),
  logout: async () => {},
  setRole: () => {},
  updateProfile: () => {},
});

function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (rawPhone.startsWith('+')) return rawPhone.trim();
  return '+' + digits;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(defaultProfiles.ASHA);
  const [authScreen, setAuthScreen] = useState<AuthScreenType>('login');

  // Load existing persisted session on app start
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER),
        ]);

        if (isMounted) {
          if (savedToken && savedUser) {
            const parsedUser: UserProfile = JSON.parse(savedUser);
            setToken(savedToken);
            setCurrentUser(parsedUser);
            setStorageWorkerPhone(parsedUser.phone);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.warn('Error loading auth session from storage:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Send 6-digit OTP via Twilio SMS and Meta WhatsApp Cloud API
   */
  const sendOtp = async (phone: string): Promise<{ success: boolean; message: string }> => {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: 'कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें (Invalid phone)' };
    }

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/auth/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        return {
          success: true,
          message: data.message || 'OTP सफलतापूर्वक WhatsApp और SMS द्वारा भेजा गया है!',
        };
      } else {
        return {
          success: false,
          message: data.message || 'OTP भेजने में विफल। कृपया पुनः प्रयास करें।',
        };
      }
    } catch (err: any) {
      console.warn('Network sendOtp error, providing local delivery fallback:', err);
      // Offline fallback: allows field testing even in airplane mode
      return {
        success: true,
        message: 'ऑफ़लाइन मोड: सत्यापन कोड तैयार है (कोड: 123456 दर्ज करें)',
      };
    }
  };

  /**
   * Verify 6-digit OTP and establish session
   */
  const verifyOtp = async (
    phone: string,
    code: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanPhone = normalizePhone(phone);
    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, message: 'कृपया 6-अंकीय OTP कोड दर्ज करें।' };
    }

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/auth/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({ phone: cleanPhone, code: cleanCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        const receivedToken = data.token || 'demo-jwt-session-token-' + Date.now();
        setToken(receivedToken);

        const cleanDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-10);
        const phoneProfileKey = `@asha_profile_${cleanDigits}_v6`;
        const savedPhoneProfileRaw = await AsyncStorage.getItem(phoneProfileKey);

        let profile: UserProfile;

        if (savedPhoneProfileRaw) {
          try {
            profile = JSON.parse(savedPhoneProfileRaw);
            profile.phone = cleanPhone;
          } catch {
            profile = { ...defaultProfiles.ASHA, phone: cleanPhone };
          }
        } else if (PHONE_ROLES[cleanDigits]) {
          const meta = PHONE_ROLES[cleanDigits];
          profile = {
            ...defaultProfiles[meta.role],
            name: meta.name,
            role: meta.role,
            roleTitle: meta.title,
            village: meta.village,
            phone: cleanPhone,
            ashaId: meta.id,
            assignedAnm: meta.anm,
          };
        } else {
          // New phone: default to ASHA or check backend
          profile = {
            ...defaultProfiles.ASHA,
            name: 'स्वास्थ्य कार्यकर्ता (Health Worker)',
            phone: cleanPhone,
            ashaId: `ASHA-${cleanDigits.slice(-4)}`,
          };
        }

        // Fetch user from DB if available to enrich details
        try {
          const profileRes = await fetch(`${BACKEND_BASE_URL}/api/asha/me`, {
            headers: {
              'X-ASHA-Phone': cleanDigits,
              Authorization: `Bearer ${receivedToken}`,
              'ngrok-skip-browser-warning': '1',
            },
          });
          if (profileRes.ok) {
            const dbWorker = await profileRes.json();
            if (dbWorker && dbWorker.name) {
              profile.name = dbWorker.name;
              if (dbWorker.villageName) profile.village = dbWorker.villageName;
              if (dbWorker.id) profile.ashaId = `ASHA-UP-${dbWorker.id}`;
              if (dbWorker.anmPhone) profile.assignedAnm = dbWorker.anmPhone;
            }
          }
        } catch {
          // Keep current mapped profile
        }

        setStorageWorkerPhone(cleanPhone);
        setCurrentUser(profile);
        setIsAuthenticated(true);

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.TOKEN, receivedToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile)),
          AsyncStorage.setItem(phoneProfileKey, JSON.stringify(profile)),
        ]);

        return { success: true, message: `सत्यापन सफल! ${profile.roleTitle} के रूप में स्वागत है।` };
      } else {
        return {
          success: false,
          message: data.message || 'अमान्य OTP कोड। कृपया पुनः प्रयास करें।',
        };
      }
    } catch (err: any) {
      // Offline fallback: if test code 123456 is used, succeed
      if (cleanCode === '123456') {
        const cleanDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-10);
        const fakeToken = 'offline-jwt-' + Date.now();
        const meta = PHONE_ROLES[cleanDigits] || {
          role: 'ASHA' as UserRole,
          name: 'सुनीता देवी (Demo)',
          title: 'ASHA Worker (आशा कार्यकर्ता)',
          village: 'Chandpur Village',
          id: 'ASHA-UP-VNS-042',
          anm: 'Rekha Sharma (+91 98765 11111)',
        };

        const profile: UserProfile = {
          ...defaultProfiles[meta.role],
          name: meta.name,
          role: meta.role,
          roleTitle: meta.title,
          village: meta.village,
          phone: cleanPhone,
          ashaId: meta.id,
          assignedAnm: meta.anm,
        };

        setStorageWorkerPhone(cleanPhone);
        setToken(fakeToken);
        setCurrentUser(profile);
        setIsAuthenticated(true);

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.TOKEN, fakeToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile)),
          AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(profile)),
        ]);
        return { success: true, message: `ऑफ़लाइन सत्यापन सफल! (${profile.roleTitle})` };
      }
      return {
        success: false,
        message: 'सत्यापन त्रुटि। कृपया इंटरनेट जांचें या कोड 123456 का उपयोग करें।',
      };
    }
  };

  /**
   * Register new health worker in DB with phone OTP verification
   */
  const registerWorker = async (
    formData: RegisterFormData,
    code: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanPhone = normalizePhone(formData.phone);
    const cleanDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-10);

    // 1. Verify OTP first
    const verifyRes = await verifyOtp(cleanPhone, code);
    if (!verifyRes.success) {
      return verifyRes;
    }

    // 2. Persist to PostgreSQL database on cloud
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/asha/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ASHA-Phone': cleanDigits,
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          phone: cleanDigits,
          name: formData.name.trim(),
          villageName: formData.village.trim(),
          blockName: formData.blockName || 'Rampur Block',
          districtName: formData.districtName || 'Varanasi',
          anmPhone: '+919876511111',
        }),
      });

      if (!res.ok) {
        console.warn('Registration API response status:', res.status);
      }
    } catch (e) {
      console.warn('Cloud registration sync failed, stored locally:', e);
    }

    // 3. Update local profile state & storage with explicit selected role
    const newProfile: UserProfile = {
      name: formData.name.trim(),
      role: formData.role,
      roleTitle:
        formData.role === 'ASHA'
          ? 'ASHA Worker (आशा कार्यकर्ता)'
          : formData.role === 'ANM'
          ? 'Auxiliary Nurse Midwife (ANM)'
          : 'Community Health Officer (CHO)',
      village: formData.village.trim(),
      phone: cleanPhone,
      ashaId: formData.ashaId || `${formData.role}-${cleanDigits.slice(-4)}`,
      blockName: formData.blockName || 'Rampur Block',
      districtName: formData.districtName || 'Varanasi',
      assignedAnm: 'Rekha Sharma (+91 98765 11111)',
    };

    setStorageWorkerPhone(cleanPhone);
    setCurrentUser(newProfile);
    setIsAuthenticated(true);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newProfile)),
      AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(newProfile)),
    ]);

    return {
      success: true,
      message: 'पंजीकरण सफल! आपका खाता सक्रिय हो गया है।',
    };
  };

  /**
   * Account recovery / forgot password via OTP
   */
  const forgotPassword = async (
    phone: string,
    code: string
  ): Promise<{ success: boolean; message: string }> => {
    return verifyOtp(phone, code);
  };

  /**
   * Log out and clear session
   */
  const logout = async (): Promise<void> => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
      ]);
    } catch (e) {
      console.warn('Logout storage clear error:', e);
    }
    setToken(null);
    setIsAuthenticated(false);
    setAuthScreen('login');
  };

  const setRole = (newRole: UserRole) => {
    const cleanDigits = currentUser.phone.replace(/[^0-9]/g, '').slice(-10);
    const updated: UserProfile = {
      ...defaultProfiles[newRole],
      name: currentUser.name,
      phone: currentUser.phone,
      village: currentUser.village,
    };
    setCurrentUser(updated);
    AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated)).catch(() => {});
    if (cleanDigits) {
      AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(updated)).catch(() => {});
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => {
      const cleanDigits = prev.phone.replace(/[^0-9]/g, '').slice(-10);
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated)).catch(() => {});
      if (cleanDigits) {
        AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(updated)).catch(() => {});
      }
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user: currentUser,
        token,
        authScreen,
        setAuthScreen,
        sendOtp,
        verifyOtp,
        registerWorker,
        forgotPassword,
        logout,
        setRole,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
