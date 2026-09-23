import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  FamilyUnit,
  FamilyMember,
  SurveyResponse,
  FollowUpTask,
  ChildVaccinationRecord,
  AshaMeetingRecord,
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
  toggleFollowUp: (id: string) => Promise<void>;
  triggerSync: () => Promise<SyncResult>;
  simulateMissedReferral: (
    daysOverdue?: number,
    houseNumber?: number | string,
    reason?: string,
    memberName?: string
  ) => Promise<{ task: any; family: any; syncedOnline: boolean }>;
  sendToAnm: (sectionFilter?: string, anmCode?: string) => Promise<SyncResult>;
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
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const prevOnlineRef = useRef(false);

  const refreshData = useCallback(async () => {
    try {
      await OfflineStorageService.initialize();
      const [fams, mems, flws, srvs, vaxs, mtgs, obox] = await Promise.all([
        OfflineStorageService.getFamilies(),
        OfflineStorageService.getMembers(),
        OfflineStorageService.getFollowUps(),
        OfflineStorageService.getSurveys(),
        OfflineStorageService.getChildVaccinations(),
        OfflineStorageService.getMeetings(),
        OfflineStorageService.getOutbox(),
      ]);
      setFamilies(fams);
      setMembers(mems);
      setFollowUps(flws);
      setSurveys(srvs);
      setChildVaccinations(vaxs);
      setMeetings(mtgs);
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

  // Periodic network check: when internet connects, automatically synchronize with hospital
  useEffect(() => {
    refreshData();

    const checkConnectivity = async () => {
      const online = await SyncApi.pingServer();
      setIsOnline(online);

      // Transition from offline -> online: auto-sync missed referrals from hospital!
      if (online && !prevOnlineRef.current) {
        console.log('🌐 Internet connection detected! Auto-synchronizing hospital referrals...');
        await triggerSync();
      }
      prevOnlineRef.current = online;
    };

    checkConnectivity();
    const interval = setInterval(checkConnectivity, 12000);
    return () => clearInterval(interval);
  }, [refreshData, triggerSync]);

  const addFamily = async (
    family: Omit<FamilyUnit, 'id' | 'updatedAt'>
  ): Promise<FamilyUnit> => {
    const created = await OfflineStorageService.saveFamily(family);
    await refreshData();
    return created;
  };

  const addMember = async (
    member: Omit<FamilyMember, 'id' | 'updatedAt'>
  ): Promise<FamilyMember> => {
    const created = await OfflineStorageService.saveMember(member);
    await refreshData();
    return created;
  };

  const submitSurvey = async (
    survey: Omit<SurveyResponse, 'id' | 'createdAt' | 'syncedToAnm'>
  ): Promise<SurveyResponse> => {
    const created = await OfflineStorageService.saveSurveyResponse(survey);
    await refreshData();
    return created;
  };

  const toggleFollowUp = async (id: string) => {
    await OfflineStorageService.toggleFollowUp(id);
    await refreshData();
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
  };

  const saveMeeting = async (
    meeting: Omit<AshaMeetingRecord, 'id' | 'createdAt'>
  ): Promise<AshaMeetingRecord> => {
    const created = await OfflineStorageService.saveMeeting(meeting);
    await refreshData();
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
        toggleFollowUp,
        triggerSync,
        simulateMissedReferral,
        sendToAnm,
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
