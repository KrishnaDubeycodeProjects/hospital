import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import {
  FamilyUnit,
  FamilyMember,
  SurveyResponse,
  FollowUpTask,
  ChildVaccinationRecord,
  AshaMeetingRecord,
  AnmSessionFolder,
  OutboxItem,
} from '../types/storage';
import { OfflineStorageService, setStorageWorkerPhone } from '../storage/OfflineStorageService';
import { SyncApi, SyncResult } from '../api/syncApi';

interface OfflineDataContextType {
  families: FamilyUnit[];
  members: FamilyMember[];
  followUps: FollowUpTask[];
  surveys: SurveyResponse[];
  childVaccinations: ChildVaccinationRecord[];
  meetings: AshaMeetingRecord[];
  anmSessions: AnmSessionFolder[];
  outbox: OutboxItem[];
  pendingSyncCount: number;
  /** Outbox records the server rejected (kept locally, never deleted). */
  failedSyncCount: number;
  /** Re-queue every failed record and sync immediately. */
  retryFailedRecords: () => Promise<SyncResult | null>;
  isLoading: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncResult: SyncResult | null;
  refreshData: () => Promise<void>;
  addFamily: (family: Omit<FamilyUnit, 'id' | 'updatedAt'>) => Promise<FamilyUnit>;
  deleteFamily: (id: string) => Promise<void>;
  addMember: (member: Omit<FamilyMember, 'id' | 'updatedAt'>) => Promise<FamilyMember>;
  deleteMember: (memberId: string) => Promise<void>;
  submitSurvey: (
    survey: Omit<SurveyResponse, 'id' | 'createdAt' | 'syncedToAnm'>
  ) => Promise<SurveyResponse>;
  updateChildVaccine: (
    childMemberId: string,
    vaccineName: string,
    status: 'Given' | 'Due' | 'Not Given'
  ) => Promise<void>;
  saveMeeting: (
    meeting: Omit<AshaMeetingRecord, 'id' | 'createdAt'>
  ) => Promise<AshaMeetingRecord>;
  createAnmSession: (data: {
    title: string;
    category: 'CHILD_VAX' | 'ANC' | 'NCD';
    notes?: string;
    studyType?: string;
    location?: string;
    date?: string;
    qrCodeValue?: string;
  }) => Promise<AnmSessionFolder>;
  receiveRecordsInAnmSession: (sessionIdentifier: string, count: number) => Promise<void>;
  deleteAnmSession: (id: string) => Promise<void>;
  toggleFollowUp: (id: string) => Promise<void>;
  triggerSync: () => Promise<SyncResult>;
  simulateMissedReferral: (
    daysOverdue?: number,
    houseNumber?: number | string,
    reason?: string,
    memberName?: string
  ) => Promise<{ task: any; family: any; syncedOnline: boolean }>;
  markFamilyVisited: (familyId: string, priority: '7days' | '15days' | '30days') => Promise<void>;
  sendToAnm: (sectionFilter: string, anmCode: string) => Promise<SyncResult>;
  createReferralToCho: (params: {
    familyUnitId: string;
    familyMemberId: string;
    name: string;
    phone?: string;
    abhaNumber?: string;
    houseNumber?: number | string;
    villageName?: string;
    reason: string;
    vitals?: string;
    urgencyDays?: string;
    prescriptionDetails?: string;
    prescriptionDeadline?: string;
  }) => Promise<FollowUpTask>;
  approveReferralByCho: (taskId: string, advice?: string) => Promise<FollowUpTask | null>;
  resetToDefaults: () => Promise<void>;
}

const OfflineDataContext = createContext<OfflineDataContextType | undefined>(undefined);

export const OfflineDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [families, setFamilies] = useState<FamilyUnit[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [childVaccinations, setChildVaccinations] = useState<ChildVaccinationRecord[]>([]);
  const [meetings, setMeetings] = useState<AshaMeetingRecord[]>([]);
  const [anmSessions, setAnmSessions] = useState<AnmSessionFolder[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const prevOnlineRef = useRef(false);
  const netInfoConnectedRef = useRef<boolean | null>(null);
  const { language } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;

  // Synchronize storage partition whenever active user/phone switches
  useEffect(() => {
    if (user?.phone) {
      setStorageWorkerPhone(user.phone);
    }
  }, [user?.phone]);

  const refreshData = useCallback(async () => {
    try {
      if (user?.phone) {
        setStorageWorkerPhone(user.phone);
      }
      await OfflineStorageService.initialize();
      const [fams, mems, flws, srvs, vaxs, mtgs, anmSess, obox] = await Promise.all([
        OfflineStorageService.getFamilies(),
        OfflineStorageService.getMembers(),
        OfflineStorageService.getFollowUps(),
        OfflineStorageService.getSurveys(),
        OfflineStorageService.getChildVaccinations(),
        OfflineStorageService.getMeetings(),
        OfflineStorageService.getAnmSessions(),
        OfflineStorageService.getOutbox(),
      ]);
      setFamilies(fams);
      setMembers(mems);
      setFollowUps(flws);
      setSurveys(srvs);
      setChildVaccinations(vaxs);
      setMeetings(mtgs);
      setAnmSessions(anmSess);
      setOutbox(obox);
    } catch (e) {
      console.error('Error refreshing offline data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.phone]);

  /**
   * Core sync runner. `force` bypasses the failure backoff (used for manual taps);
   * automatic triggers respect it. Never syncs before a worker is logged in, so records
   * are never uploaded/downloaded under a placeholder phone.
   */
  const runSync = useCallback(
    async (force: boolean): Promise<SyncResult> => {
      const cleanPhone = user?.phone ? user.phone.replace(/[^0-9]/g, '').slice(-10) : '';
      if (cleanPhone.length !== 10) {
        return {
          success: false,
          mode: 'OFFLINE_QUEUED',
          message: languageRef.current === 'mr' ? 'लॉगिननंतर सिंक होईल' : languageRef.current === 'en' ? 'Will sync after login' : 'लॉगिन के बाद सिंक होगा',
          syncedCount: 0,
        };
      }
      setIsSyncing(true);
      try {
        const result = await SyncApi.syncOutbox(cleanPhone, 'CHILD_VAX', {
          lang: languageRef.current,
          force,
          role: user?.role,
        });
        setLastSyncResult(result);
        await refreshData();
        return result;
      } finally {
        setIsSyncing(SyncApi.isSyncInFlight());
      }
    },
    [user?.phone, user?.role, refreshData]
  );

  // Manual sync (header button, Send Data screen) — always attempts immediately.
  const triggerSync = useCallback(() => runSync(true), [runSync]);
  // Automatic sync (heartbeat, reconnect, after local writes) — respects backoff.
  const autoSync = useCallback(() => runSync(false), [runSync]);

  // Helper to immediately push changes to the cloud if internet connectivity is available
  const syncIfOnline = useCallback(async () => {
    try {
      // Every caller just wrote a new record: retry now rather than after an old backoff.
      SyncApi.resetBackoff();
      const online = await SyncApi.pingServer();
      setIsOnline(online);
      if (online) {
        await autoSync();
      }
    } catch (e) {
      console.warn('Sync check failed:', e);
    }
  }, [autoSync]);

  // Network connectivity listener and auto-synchronization:
  // Immediately synchronizes queued operations as soon as the device/browser reconnects to the internet!
  useEffect(() => {
    refreshData();

    let isChecking = false;

    const performConnectivityCheck = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const online = await SyncApi.pingServer();
        setIsOnline(online);

        // When transition from offline -> online OR when online with pending outbox records
        const pendingItems = await OfflineStorageService.getPendingOutbox();
        const hasPending = pendingItems.length > 0;

        if (online && (!prevOnlineRef.current || hasPending) && !SyncApi.isSyncInFlight()) {
          console.log(`🌐 Online connection active (${pendingItems.length} pending records). Auto-synchronizing with cloud...`);
          await autoSync();
        }
        prevOnlineRef.current = online;
      } catch (err) {
        setIsOnline(false);
      } finally {
        isChecking = false;
      }
    };

    performConnectivityCheck();

    // Fast instantaneous detection on modern browsers / webview
    const handleOnlineEvent = () => {
      console.log('⚡ Browser network ONLINE event! Triggering immediate cloud sync...');
      setIsOnline(true);
      performConnectivityCheck();
    };

    const handleOfflineEvent = () => {
      console.log('📴 Browser network OFFLINE event. Safe local storage active.');
      setIsOnline(false);
      prevOnlineRef.current = false;
    };

    // 1. Native mobile connectivity listener via NetInfo (instantaneous connection change detection)
    // Only an offline -> online transition triggers a sync; NetInfo also fires on
    // subscribe and on every reachability/wifi-detail change, which previously caused
    // a burst of overlapping syncs.
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasConnected = netInfoConnectedRef.current;
      netInfoConnectedRef.current = isConnected;
      setIsOnline(isConnected);
      if (isConnected && wasConnected !== true) {
        console.log('⚡ [NetInfo] Mobile network ONLINE! Triggering immediate cloud sync...');
        performConnectivityCheck();
      } else if (!isConnected) {
        prevOnlineRef.current = false;
        console.log('📴 [NetInfo] Mobile network OFFLINE. Local storage active.');
      }
    });

    // 2. Web browser fallback event listener
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', handleOnlineEvent);
      window.addEventListener('offline', handleOfflineEvent);
    }

    // 3. Active heartbeat check every 5 seconds to ensure pending records auto-sync
    const interval = setInterval(performConnectivityCheck, 5000);

    return () => {
      unsubscribeNetInfo();
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('online', handleOnlineEvent);
        window.removeEventListener('offline', handleOfflineEvent);
      }
    };
  }, [refreshData, autoSync]);

  const addFamily = async (
    family: Omit<FamilyUnit, 'id' | 'updatedAt'>
  ): Promise<FamilyUnit> => {
    const created = await OfflineStorageService.saveFamily(family);
    await refreshData();
    syncIfOnline().catch(() => {});
    return created;
  };

  const deleteFamily = async (id: string): Promise<void> => {
    await OfflineStorageService.deleteFamily(id);
    await refreshData();
    syncIfOnline().catch(() => {});
  };

  const addMember = async (
    member: Omit<FamilyMember, 'id' | 'updatedAt'>
  ): Promise<FamilyMember> => {
    const created = await OfflineStorageService.saveMember(member);
    await refreshData();
    syncIfOnline().catch(() => {});
    return created;
  };

  const deleteMember = async (memberId: string): Promise<void> => {
    await OfflineStorageService.deleteMember(memberId);
    await refreshData();
    syncIfOnline().catch(() => {});
  };

  const submitSurvey = async (
    survey: Omit<SurveyResponse, 'id' | 'createdAt' | 'syncedToAnm'>
  ): Promise<SurveyResponse> => {
    const created = await OfflineStorageService.saveSurveyResponse(survey);
    await refreshData();
    syncIfOnline().catch(() => {});
    return created;
  };

  const toggleFollowUp = async (id: string) => {
    await OfflineStorageService.toggleFollowUp(id);
    await refreshData();
    syncIfOnline().catch(() => {});
  };

  const simulateMissedReferral = async (
    daysOverdue: number = 7,
    houseNumber: number | string = 12,
    reason: string = 'High-Risk ANC Checkup',
    memberName: string = 'Suman Verma'
  ) => {
    setIsSyncing(true);
    try {
      const res = await SyncApi.simulateMissedReferral({
        daysOverdue,
        houseNumber,
        referralReason: reason,
        memberName,
      });
      await refreshData();
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  const updateChildVaccine = async (
    childMemberId: string,
    vaccineName: string,
    status: 'Given' | 'Due' | 'Not Given'
  ) => {
    await OfflineStorageService.updateVaccineStatus(childMemberId, vaccineName, status);
    await refreshData();
    syncIfOnline().catch(() => {});
  };

  const saveMeeting = async (
    meeting: Omit<AshaMeetingRecord, 'id' | 'createdAt'>
  ): Promise<AshaMeetingRecord> => {
    const created = await OfflineStorageService.saveMeeting(meeting);
    await refreshData();
    syncIfOnline().catch(() => {});
    return created;
  };

  const sendToAnm = async (
    sectionFilter: string = 'ALL',
    anmCode: string
  ): Promise<SyncResult> => {
    setIsSyncing(true);
    try {
      const result = await SyncApi.sendDataToAnm(sectionFilter, anmCode);
      setLastSyncResult(result);
      await refreshData();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  const markFamilyVisited = async (
    familyId: string,
    priority: '7days' | '15days' | '30days'
  ) => {
    const existingFamily = families.find((f) => f.id === familyId);
    if (!existingFamily) return;

    const intervalDays = priority === '7days' ? 7 : priority === '15days' ? 15 : 30;
    const priorityLabel = priority === '7days' ? 'गंभीर (Severe)' : priority === '15days' ? 'मध्यम (Medium)' : 'सामान्य (Normal)';
    const nextDateFormatted = new Date(Date.now() + intervalDays * 86400000).toISOString().split('T')[0];

    const updated: FamilyUnit = {
      ...existingFamily,
      status: 'visited',
      visitIntervalDays: intervalDays,
      nextVisitDate: nextDateFormatted,
      lastVisitedAt: 'आज (Today)',
      updatedAt: new Date().toISOString(),
    };

    await OfflineStorageService.saveFamily(updated);
    await refreshData();
    syncIfOnline().catch(() => {});
  };

  const createReferralToCho = async (params: {
    familyUnitId: string;
    familyMemberId: string;
    name: string;
    phone?: string;
    abhaNumber?: string;
    houseNumber?: number | string;
    villageName?: string;
    reason: string;
    vitals?: string;
    urgencyDays?: string;
    prescriptionDetails?: string;
    prescriptionDeadline?: string;
  }) => {
    const task = await OfflineStorageService.createReferralToCho(params);
    await refreshData();
    syncIfOnline().catch(() => {});
    return task;
  };

  const approveReferralByCho = async (taskId: string, advice?: string) => {
    const updated = await OfflineStorageService.approveReferralByCho(taskId, advice);
    await refreshData();
    syncIfOnline().catch(() => {});
    return updated;
  };

  const createAnmSession = async (data: {
    title: string;
    category: 'CHILD_VAX' | 'ANC' | 'NCD';
    notes?: string;
    studyType?: string;
    location?: string;
    date?: string;
    qrCodeValue?: string;
  }): Promise<AnmSessionFolder> => {
    const codeSuffix =
      data.category === 'CHILD_VAX' ? 'VAX' : data.category === 'ANC' ? 'ANC' : 'NCD';
    const newSession: AnmSessionFolder = {
      id: `sess-${Date.now()}`,
      title: data.title.trim(),
      category: data.category,
      date: data.date || new Date().toLocaleDateString('en-GB'),
      qrCodeValue:
        data.qrCodeValue || `ANM-QR-${codeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`,
      recordsCount: 0,
      studyType: data.studyType || `${data.category} Field Study`,
      notes: data.notes || '',
      location: data.location || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await OfflineStorageService.saveAnmSession(newSession);
    // Asynchronously register QR session with backend cloud API so ASHA can transfer records live
    SyncApi.registerAnmSession(newSession.title, newSession.category, newSession.qrCodeValue, '9876543211').catch(e => {
      console.warn('Backend session registration note:', e);
    });
    await refreshData();
    return saved;
  };

  const receiveRecordsInAnmSession = async (sessionIdentifier: string, count: number) => {
    await OfflineStorageService.updateAnmSessionRecords(sessionIdentifier, count);
    await refreshData();
  };

  const deleteAnmSession = async (id: string) => {
    await OfflineStorageService.deleteAnmSession(id);
    await refreshData();
  };

  const resetToDefaults = async () => {
    setIsLoading(true);
    await OfflineStorageService.clearAllData();
    await refreshData();
  };

  const pendingSyncCount = outbox.filter((i) => i.status === 'PENDING').length;
  const failedSyncCount = outbox.filter((i) => i.status === 'FAILED').length;

  const retryFailedRecords = async (): Promise<SyncResult | null> => {
    const requeued = await OfflineStorageService.requeueFailedOutbox();
    await refreshData();
    if (requeued === 0) return null;
    return triggerSync();
  };

  return (
    <OfflineDataContext.Provider
      value={{
        families,
        members,
        followUps,
        surveys,
        childVaccinations,
        meetings,
        anmSessions,
        outbox,
        pendingSyncCount,
        failedSyncCount,
        retryFailedRecords,
        isLoading,
        isSyncing,
        isOnline,
        lastSyncResult,
        refreshData,
        addFamily,
        deleteFamily,
        addMember,
        deleteMember,
        submitSurvey,
        updateChildVaccine,
        saveMeeting,
        createAnmSession,
        receiveRecordsInAnmSession,
        deleteAnmSession,
        toggleFollowUp,
        triggerSync,
        simulateMissedReferral,
        markFamilyVisited,
        sendToAnm,
        createReferralToCho,
        approveReferralByCho,
        resetToDefaults,
      }}
    >
      {children}
    </OfflineDataContext.Provider>
  );
};

export const useOfflineData = () => {
  const context = useContext(OfflineDataContext);
  if (!context) {
    throw new Error('useOfflineData must be used within an OfflineDataProvider');
  }
  return context;
};
