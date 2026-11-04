import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredLanguage, pick } from '../utils/storedLanguage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStorageWorkerPhone } from '../storage/OfflineStorageService';
import { setAuthToken, authHeader } from '../api/authSession';

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
  preferredLanguage?: 'hi' | 'mr' | 'en';
  /** Server-assigned PHC / sub-centre id and household count (loaded at login). */
  phcId?: number;
  householdCount?: number;
}

/** Shown when an OTP-verified number is not a CHO-registered worker. */
export const NOT_REGISTERED_MESSAGE = 'यह नंबर पंजीकृत नहीं है। कृपया अपने सीएचओ से संपर्क करें।';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile;
  token: string | null;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addWorkerByCho: (worker: {
    name: string;
    phone: string;
    role: 'ASHA' | 'ANM';
    village: string;
    subcenter?: string;
    preferredLanguage?: 'hi' | 'mr' | 'en';
  }) => Promise<{ success: boolean; message: string }>;
}

const BACKEND_BASE_URL = 'https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com';

const STORAGE_KEYS = {
  TOKEN: '@asha_auth_token_v6',
  USER: '@asha_auth_user_v6',
};

/** Phones (last 10 digits) that completed an ONLINE OTP login on this device. */
const VERIFIED_PHONES_KEY = '@asha_online_verified_phones_v1';
const lastTokenKey = (digits: string) => `@asha_last_worker_token_${digits}_v1`;

async function getDeviceVerifiedPhones(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(VERIFIED_PHONES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function rememberOnlineVerification(digits: string, token: string | null): Promise<void> {
  const list = await getDeviceVerifiedPhones();
  if (!list.includes(digits)) list.push(digits);
  await AsyncStorage.setItem(VERIFIED_PHONES_KEY, JSON.stringify(list));
  if (token) await AsyncStorage.setItem(lastTokenKey(digits), token);
}

// Offline test account. Matches the OTP-seeded test phone in the backend (DemoDataSeeder).
// Only the name and role are known; village / ANM / block come from the server profile at login.
const PHONE_ROLES: Record<string, { role: UserRole; name: string }> = {
  '9876543210': { role: 'ASHA', name: 'Sunita Devi' },
};

const ROLE_TITLES: Record<UserRole, string> = {
  ASHA: 'ASHA Worker (आशा कार्यकर्ता)',
  ANM: 'Auxiliary Nurse Midwife (ANM)',
  CHO: 'Community Health Officer',
};

/** Empty, role-only profiles: no invented names, villages, phones or IDs. */
const defaultProfiles: Record<UserRole, UserProfile> = {
  ASHA: { name: '', role: 'ASHA', roleTitle: ROLE_TITLES.ASHA, village: '', phone: '' },
  ANM: { name: '', role: 'ANM', roleTitle: ROLE_TITLES.ANM, village: '', phone: '' },
  CHO: { name: '', role: 'CHO', roleTitle: ROLE_TITLES.CHO, village: '', phone: '' },
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: defaultProfiles.ASHA,
  token: null,
  sendOtp: async () => ({ success: false, message: '' }),
  verifyOtp: async () => ({ success: false, message: '' }),
  logout: async () => {},
  setRole: () => {},
  updateProfile: () => {},
  addWorkerByCho: async () => ({ success: false, message: '' }),
});

async function resolveProfileForPhone(cleanPhone: string): Promise<UserProfile> {
  const cleanDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-10);

  // 1. Direct saved profile key
  try {
    const raw = await AsyncStorage.getItem(`@asha_profile_${cleanDigits}_v6`);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.name && p.role) {
        return {
          ...p,
          phone: '+91' + cleanDigits,
        };
      }
    }
  } catch {}

  // 2. CHO authorized workers list
  try {
    const rawList = await AsyncStorage.getItem('@cho_authorized_workers_v6');
    if (rawList) {
      const list = JSON.parse(rawList);
      const match = list.find((w: any) => (w.phone || '').replace(/[^0-9]/g, '').slice(-10) === cleanDigits);
      if (match) {
        const role: UserRole = match.role || 'ASHA';
        return {
          ...defaultProfiles[role],
          name: match.name,
          role,
          roleTitle: ROLE_TITLES[role] || ROLE_TITLES.ASHA,
          village: match.village || '',
          phone: '+91' + cleanDigits,
          ashaId: `${role}-${cleanDigits.slice(-4)}`,
          preferredLanguage: match.preferredLanguage || 'hi',
        };
      }
    }
  } catch {}

  // 3. Registered users registry
  try {
    const regRaw = await AsyncStorage.getItem('@asha_registered_users_registry_v6');
    if (regRaw) {
      const reg = JSON.parse(regRaw);
      if (reg[cleanDigits]) {
        return {
          ...reg[cleanDigits],
          phone: '+91' + cleanDigits,
        };
      }
    }
  } catch {}

  // 4. Hardcoded demo profiles
  if (PHONE_ROLES[cleanDigits]) {
    const meta = PHONE_ROLES[cleanDigits];
    return {
      ...defaultProfiles[meta.role],
      name: meta.name,
      role: meta.role,
      roleTitle: ROLE_TITLES[meta.role],
      phone: '+91' + cleanDigits,
      ashaId: `${meta.role}-${cleanDigits.slice(-4)}`,
    };
  }

  // 5. Default profile for new unassigned phone
  return {
    ...defaultProfiles.ASHA,
    name: `स्वास्थ्य कार्यकर्ता`,
    role: 'ASHA',
    roleTitle: 'ASHA Worker (आशा कार्यकर्ता)',
    village: '',
    phone: '+91' + cleanDigits,
    ashaId: `ASHA-${cleanDigits.slice(-4)}`,
  };
}

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

  // API calls authenticate with the OTP-issued worker JWT held here.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

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
    const lang = await getStoredLanguage();
    const L = (hi: string, mr: string, en: string) => pick(lang, hi, mr, en);
    // Server messages are Hindi; in English / Marathi mode show the local copy instead.
    const srv = (m: unknown) => (lang === 'hi' && typeof m === 'string' && m ? m : null);
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: L('कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें', 'कृपया वैध 10-अंकी मोबाइल नंबर टाका', 'Please enter a valid 10-digit mobile number') };
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
          message: srv(data.message) || L('OTP सफलतापूर्वक WhatsApp और SMS द्वारा भेजा गया है!', 'OTP WhatsApp आणि SMS द्वारे पाठवला आहे!', 'OTP sent via WhatsApp and SMS!'),
        };
      } else {
        return {
          success: false,
          message: srv(data.message) || L('OTP भेजने में विफल। कृपया पुनः प्रयास करें।', 'OTP पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा.', 'Could not send OTP. Please try again.'),
        };
      }
    } catch (err: any) {
      console.warn('Network sendOtp error, providing local delivery fallback:', err);
      // Offline fallback: allows field testing even in airplane mode
      return {
        success: true,
        message: L('ऑफ़लाइन मोड: सत्यापन कोड तैयार है (कोड: 123456 दर्ज करें)', 'ऑफलाइन मोड: सत्यापन कोड तयार आहे (कोड: 123456 टाका)', 'Offline mode: verification code ready (enter 123456)'),
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
    const lang = await getStoredLanguage();
    const L = (hi: string, mr: string, en: string) => pick(lang, hi, mr, en);
    const srv = (m: unknown) => (lang === 'hi' && typeof m === 'string' && m ? m : null);
    const cleanPhone = normalizePhone(phone);
    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, message: L('कृपया 6-अंकीय OTP कोड दर्ज करें।', 'कृपया 6-अंकी OTP कोड टाका.', 'Please enter the 6-digit OTP.') };
    }

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/auth/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        // purpose WORKER: a registered ASHA / ANM / CHO receives a role-bearing worker token
        body: JSON.stringify({ phone: cleanPhone, code: cleanCode, purpose: 'WORKER' }),
      });

      const data = await res.json().catch(() => ({}));

      // Workers are registered by their CHO: an OTP-verified number without a worker cadre
      // (server answers role PATIENT) is not allowed into the field app.
      if (res.ok && data.success !== false && data.role && !['ASHA', 'ANM', 'CHO'].includes(data.role)) {
        return {
          success: false,
          message: pick(
            await getStoredLanguage(),
            NOT_REGISTERED_MESSAGE,
            'हा नंबर नोंदणीकृत नाही. कृपया आपल्या सीएचओशी संपर्क साधा.',
            'This number is not registered. Please contact your CHO.',
          ),
        };
      }

      if (res.ok && data.success !== false) {
        const receivedToken = data.token || 'jwt-session-token-' + Date.now();
        setToken(receivedToken);
        setAuthToken(receivedToken);

        const cleanDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-10);
        let profile = await resolveProfileForPhone(cleanPhone);
        // The server's verified cadre is authoritative (roles are immutable post-registration).
        const serverRole = data.role;
        if (serverRole === 'ASHA' || serverRole === 'ANM' || serverRole === 'CHO') {
          profile = { ...profile, role: serverRole, roleTitle: defaultProfiles[serverRole as UserRole].roleTitle };
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
            // Complete profile auto-loads from the CHO-registered server record.
            const dbWorker = await profileRes.json();
            if (dbWorker) {
              if (dbWorker.name) profile.name = dbWorker.name;
              if (dbWorker.villageName) profile.village = dbWorker.villageName;
              if (dbWorker.blockName) profile.blockName = dbWorker.blockName;
              if (dbWorker.districtName) profile.districtName = dbWorker.districtName;
              if (dbWorker.phcId != null) profile.phcId = dbWorker.phcId;
              if (dbWorker.householdCount != null) profile.householdCount = dbWorker.householdCount;
              if (dbWorker.id) profile.ashaId = `${profile.role}-${dbWorker.id}`;
              if (dbWorker.anmPhone) profile.assignedAnm = dbWorker.anmPhone;
              if (dbWorker.preferredLanguage === 'hi' || dbWorker.preferredLanguage === 'mr' || dbWorker.preferredLanguage === 'en') {
                profile.preferredLanguage = dbWorker.preferredLanguage;
              }
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
          AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(profile)),
          AsyncStorage.setItem('@asha_selected_language', profile.preferredLanguage || 'hi'),
          rememberOnlineVerification(cleanDigits, data.token || null),
        ]);

        return { success: true, message: L(`सत्यापन सफल! ${profile.roleTitle} के रूप में स्वागत है।`, `सत्यापन यशस्वी! ${profile.roleTitle} म्हणून स्वागत आहे.`, `Verified! Welcome, ${profile.roleTitle}.`) };
      } else {
        return {
          success: false,
          message: srv(data.message) || L('अमान्य OTP कोड। कृपया पुनः प्रयास करें।', 'अवैध OTP कोड. कृपया पुन्हा प्रयत्न करा.', 'Invalid OTP. Please try again.'),
        };
      }
    } catch (err: any) {
      // Offline fallback (zero-network villages): allowed ONLY for a phone that has completed an
      // online OTP login on this device before. Its last real worker token is restored so sync
      // resumes automatically when the network returns (until that token expires).
      if (cleanCode === '123456') {
        const cleanDigits = cleanPhone.replace(/[^0-9]/g, '').slice(-10);
        const verifiedPhones = await getDeviceVerifiedPhones();
        if (!verifiedPhones.includes(cleanDigits)) {
          return {
            success: false,
            message: L('ऑफ़लाइन लॉगिन केवल पहले से सत्यापित फोन पर। कृपया इंटरनेट से OTP सत्यापन करें।', 'ऑफलाइन लॉगिन फक्त आधी सत्यापित फोनवर. कृपया इंटरनेटसह OTP सत्यापन करा.', 'Offline login works only on a previously verified phone. Please verify the OTP with internet.'),
          };
        }
        const fakeToken = (await AsyncStorage.getItem(lastTokenKey(cleanDigits))) || 'offline-jwt-' + Date.now();
        const profile = await resolveProfileForPhone(cleanPhone);

        setStorageWorkerPhone(cleanPhone);
        setToken(fakeToken);
        setCurrentUser(profile);
        setIsAuthenticated(true);

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.TOKEN, fakeToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile)),
          AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(profile)),
        ]);
        return { success: true, message: L(`ऑफ़लाइन सत्यापन सफल! (${profile.roleTitle})`, `ऑफलाइन सत्यापन यशस्वी! (${profile.roleTitle})`, `Offline verification successful! (${profile.roleTitle})`) };
      }
      return {
        success: false,
        message: L('सत्यापन त्रुटि। कृपया इंटरनेट जांचें और पुनः प्रयास करें।', 'सत्यापन त्रुटी. कृपया इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.', 'Verification error. Please check the internet and try again.'),
      };
    }
  };

  /**
   * CHO adds authorized ASHA or ANM worker to the portal
   */
  const addWorkerByCho = async (worker: {
    name: string;
    phone: string;
    role: 'ASHA' | 'ANM';
    village: string;
    subcenter?: string;
    preferredLanguage?: 'hi' | 'mr' | 'en';
  }): Promise<{ success: boolean; message: string }> => {
    const lang = await getStoredLanguage();
    const L = (hi: string, mr: string, en: string) => pick(lang, hi, mr, en);
    const cleanDigits = worker.phone.replace(/[^0-9]/g, '').slice(-10);
    if (!cleanDigits || cleanDigits.length < 10) {
      return { success: false, message: L('कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें।', 'कृपया वैध 10-अंकी मोबाइल नंबर टाका.', 'Please enter a valid 10-digit mobile number.') };
    }
    if (!worker.name.trim()) {
      return { success: false, message: L('कृपया कार्यकर्ता का नाम दर्ज करें।', 'कृपया कार्यकर्त्याचे नाव टाका.', "Please enter the worker's name.") };
    }

    const fullPhone = '+91' + cleanDigits;
    const prefLang: 'hi' | 'mr' | 'en' = worker.preferredLanguage || 'hi';
    const workerProfile: UserProfile = {
      name: worker.name.trim(),
      role: worker.role,
      roleTitle: worker.role === 'ASHA' ? 'ASHA Worker (आशा कार्यकर्ता)' : 'Auxiliary Nurse Midwife (ANM)',
      village: worker.village.trim(),
      phone: fullPhone,
      ashaId: `${worker.role}-${cleanDigits.slice(-4)}`,
      assignedAnm: worker.role === 'ASHA' && currentUser.name ? `${currentUser.name} (${currentUser.phone})` : undefined,
      blockName: currentUser.blockName || undefined,
      districtName: currentUser.districtName || undefined,
      preferredLanguage: prefLang,
    };

    try {
      // 1. Save to CHO authorized workers list in local AsyncStorage
      const rawList = await AsyncStorage.getItem('@cho_authorized_workers_v6');
      let list = rawList ? JSON.parse(rawList) : [];
      list = list.filter((w: any) => (w.phone || '').replace(/[^0-9]/g, '').slice(-10) !== cleanDigits);
      list.unshift({
        id: `w-${cleanDigits}`,
        name: workerProfile.name,
        phone: fullPhone,
        role: workerProfile.role,
        village: workerProfile.village,
        subcenter: worker.subcenter || undefined,
        preferredLanguage: prefLang,
        addedAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem('@cho_authorized_workers_v6', JSON.stringify(list));

      // 2. Persist direct profile key so worker can log in seamlessly
      await AsyncStorage.setItem(`@asha_profile_${cleanDigits}_v6`, JSON.stringify(workerProfile));

      // 3. Sync to PostgreSQL backend if online
      try {
        await fetch(`${BACKEND_BASE_URL}/api/asha/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
            ...authHeader(),
          },
          body: JSON.stringify({
            phone: cleanDigits,
            name: workerProfile.name,
            villageName: workerProfile.village,
            blockName: workerProfile.blockName,
            districtName: workerProfile.districtName,
            anmPhone: currentUser.phone,
            preferredLanguage: prefLang,
            role: worker.role === 'ANM' ? 'ANM' : 'ASHA',
          }),
        });
      } catch (e) {
        console.warn('Backend sync for CHO worker registration:', e);
      }

      return {
        success: true,
        message: L(
          `${workerProfile.roleTitle} ${workerProfile.name} सफलतापूर्वक जोड़ा गया! अब वे अपने मोबाइल नंबर (${fullPhone}) से लॉगिन कर सकते हैं।`,
          `${workerProfile.roleTitle} ${workerProfile.name} यशस्वीरित्या जोडले! आता ते आपल्या मोबाइल नंबरने (${fullPhone}) लॉगिन करू शकतात.`,
          `${workerProfile.roleTitle} ${workerProfile.name} added! They can now log in with their mobile number (${fullPhone}).`,
        ),
      };
    } catch (err: any) {
      return { success: false, message: L('कार्यकर्ता जोड़ने में त्रुटि: ', 'कार्यकर्ता जोडताना त्रुटी: ', 'Error adding worker: ') + (err?.message || err) };
    }
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
  };

  const setRole = (newRole: UserRole) => {
    // In production, user roles are strictly locked upon official registration/verification.
    // Switching roles arbitrarily is forbidden to enforce data isolation and clinical accountability.
    console.warn(`Role change to ${newRole} rejected: Official cadre is permanently locked to ${currentUser.role}.`);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => {
      const cleanDigits = prev.phone.replace(/[^0-9]/g, '').slice(-10);
      const safeUpdates = { ...updates };
      delete (safeUpdates as any).role; // Role cannot be modified via profile update
      const updated = { ...prev, ...safeUpdates };
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
        sendOtp,
        verifyOtp,
        logout,
        setRole,
        updateProfile,
        addWorkerByCho,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
