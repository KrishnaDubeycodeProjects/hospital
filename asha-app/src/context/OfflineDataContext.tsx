import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { OfflineStorageService } from '../storage/OfflineStorageService';
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
  isLoading: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncResult: SyncResult | null;
  refreshData: () => Promise<void>;
  addFamily: (family: Omit<FamilyUnit, 'id' | 'updatedAt'>) => Promise<FamilyUnit>;
  addMember: (member: Omit<FamilyMember, 'id' | 'updatedAt'>) => Promise<FamilyMember>;
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
  sendToAnm: (sectionFilter?: string, anmCode?: string) => Promise<SyncResult>;
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

  const refreshData = useCallback(async () => {
    try {
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
  }, []);

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);
    try {
      const result = await SyncApi.syncOutbox();
      setLastSyncResult(result);
      await refreshData();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [refreshData]);

  // Helper to immediately push changes to the cloud if internet connectivity is available
  const syncIfOnline = useCallback(async () => {
    try {
      const online = await SyncApi.pingServer();
      setIsOnline(online);
      if (online) {
        await triggerSync();
      }
    } catch (e) {
      console.warn('Sync check failed:', e);
    }
  }, [triggerSync]);

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

        if (online && (!prevOnlineRef.current || hasPending)) {
          console.log(`🌐 Online connection active (${pendingItems.length} pending records). Auto-synchronizing with cloud...`);
          await triggerSync();
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

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnlineEvent);
      window.addEventListener('offline', handleOfflineEvent);
    }

    // Active heartbeat check every 5 seconds to ensure changes sync quickly even without window events
    const interval = setInterval(performConnectivityCheck, 5000);

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnlineEvent);
        window.removeEventListener('offline', handleOfflineEvent);
      }
    };
  }, [refreshData, triggerSync]);

  const addFamily = async (
    family: Omit<FamilyUnit, 'id' | 'updatedAt'>
  ): Promise<FamilyUnit> => {
    const created = await OfflineStorageService.saveFamily(family);
    await refreshData();
    syncIfOnline().catch(() => {});
    return created;
  };

  const addMember = async (
    member: Omit<FamilyMember, 'id' | 'updatedAt'>
  ): Promise<FamilyMember> => {
    const created = await OfflineStorageService.saveMember(member);
    await refreshData();
    syncIfOnline().catch(() => {});
    return created;
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
    anmCode: string = 'ANM-CHANDPUR-01'
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
      location: data.location || 'Chandpur Health Centre',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await OfflineStorageService.saveAnmSession(newSession);
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
        isLoading,
        isSyncing,
        isOnline,
        lastSyncResult,
        refreshData,
        addFamily,
        addMember,
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
