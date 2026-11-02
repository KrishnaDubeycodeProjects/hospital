import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FamilyUnit,
  FamilyMember,
  SurveyResponse,
  FollowUpTask,
  ChildVaccinationRecord,
  AshaMeetingRecord,
  AnmSessionFolder,
  OutboxItem,
  OutboxAction,
} from '../types/storage';
import {
  SEED_FAMILIES,
  SEED_MEMBERS,
  SEED_FOLLOWUPS,
  SEED_SURVEYS,
  SEED_CHILD_VACCINATIONS,
  SEED_MEETINGS,
  SEED_ANM_SESSIONS,
} from './seedData';
import { generateUUID } from './uuid';
import { calculateEdd, formatClinicalDate, parseAffirmative, parseClinicalDate } from '../services/maternalMath';

let currentWorkerPhone = '9876543210';

/** Local id prefix for CHO sector referrals downloaded from /api/asha/cho/referrals. */
export const CHO_SECTOR_PREFIX = 'cho:';

export function setStorageWorkerPhone(phone: string): void {
  if (!phone) return;
  const clean = phone.replace(/[^0-9]/g, '').slice(-10);
  if (clean && clean.length >= 10 && currentWorkerPhone !== clean) {
    currentWorkerPhone = clean;
    if (typeof OfflineStorageService !== 'undefined' && OfflineStorageService) {
      OfflineStorageService.resetInitializationFlag();
    }
  }
}

export function getStorageWorkerPhone(): string {
  return currentWorkerPhone;
}

/**
 * Serializes every read-modify-write of the outbox key. Without this, an item enqueued
 * while a sync is marking items SYNCED can be overwritten by the stale array and lost.
 */
let outboxLock: Promise<unknown> = Promise.resolve();
function withOutboxLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = outboxLock.then(fn, fn);
  outboxLock = run.catch(() => undefined);
  return run;
}

const STORAGE_KEYS = {
  get FAMILIES() { return `@asha_${currentWorkerPhone}_families_v6`; },
  get MEMBERS() { return `@asha_${currentWorkerPhone}_members_v6`; },
  get SURVEYS() { return `@asha_${currentWorkerPhone}_surveys_v6`; },
  get FOLLOWUPS() { return `@asha_${currentWorkerPhone}_followups_v6`; },
  get VACCINATIONS() { return `@asha_${currentWorkerPhone}_vaccinations_v6`; },
  get MEETINGS() { return `@asha_${currentWorkerPhone}_meetings_v6`; },
  get ANM_SESSIONS() { return `@asha_${currentWorkerPhone}_anm_sessions_v6`; },
  get OUTBOX() { return `@asha_${currentWorkerPhone}_outbox_v6`; },
  get INITIALIZED() { return `@asha_${currentWorkerPhone}_initialized_v6`; },
};

class OfflineStorageServiceImpl {
  private isInitialized = false;

  resetInitializationFlag(): void {
    this.isInitialized = false;
  }

  /**
   * Initializes local storage scoped to the active worker phone with complete 24-household grid and official registers.
   */
  async initialize(): Promise<void> {
    try {
      const initialized = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED);
      this.isInitialized = true;
      if (!initialized) {
        const isDemoWorker = currentWorkerPhone === '9876543210';
        let initialFamilies = isDemoWorker ? SEED_FAMILIES : [];
        let initialMembers = isDemoWorker ? SEED_MEMBERS : [];
        let initialFollowups = isDemoWorker ? SEED_FOLLOWUPS : [];
        let initialSurveys = isDemoWorker ? SEED_SURVEYS : [];
        let initialVaccinations = isDemoWorker ? SEED_CHILD_VACCINATIONS : [];
        let initialMeetings = isDemoWorker ? SEED_MEETINGS : [];
        let initialAnmSessions = isDemoWorker ? SEED_ANM_SESSIONS : [];

        // Graceful migration from legacy v5 for default demo worker
        if (isDemoWorker) {
          try {
            const legacyFamilies = await AsyncStorage.getItem('@asha_families_v5');
            if (legacyFamilies) initialFamilies = JSON.parse(legacyFamilies);
            const legacyMembers = await AsyncStorage.getItem('@asha_members_v5');
            if (legacyMembers) initialMembers = JSON.parse(legacyMembers);
            const legacyFollowups = await AsyncStorage.getItem('@asha_followups_v5');
            if (legacyFollowups) initialFollowups = JSON.parse(legacyFollowups);
            const legacySurveys = await AsyncStorage.getItem('@asha_surveys_v5');
            if (legacySurveys) initialSurveys = JSON.parse(legacySurveys);
          } catch {}
        }

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(initialFamilies)),
          AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(initialMembers)),
          AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(initialSurveys)),
          AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(initialFollowups)),
          AsyncStorage.setItem(STORAGE_KEYS.VACCINATIONS, JSON.stringify(initialVaccinations)),
          AsyncStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(initialMeetings)),
          AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(initialAnmSessions)),
          AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify([])),
          AsyncStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true'),
        ]);
      } else {
        if (currentWorkerPhone === '9876543210') {
          // Ensure ANM sessions are initialized even if other keys exist
          const existingSessions = await AsyncStorage.getItem(STORAGE_KEYS.ANM_SESSIONS);
          if (!existingSessions) {
            await AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(SEED_ANM_SESSIONS));
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize local offline storage:', error);
    }
  }

  // ----------------------------------------------------
  // FAMILIES CRUD (Complete 24-Household 3x8 Grid)
  // ----------------------------------------------------

  async getFamilies(): Promise<FamilyUnit[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAMILIES);
      let parsed: FamilyUnit[] = raw ? JSON.parse(raw) : [];
      if (currentWorkerPhone === '9876543210') {
        if (parsed.length < 24) {
          await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(SEED_FAMILIES));
          return SEED_FAMILIES;
        }
        // Ensure only valid village houses 1 to 24 are included; remove any rogue/orphaned house numbers (e.g. 29)
        if (parsed.some((f) => Number(f.houseNumber) > 24 || f.sequentialNumber > 24 || Number(f.houseNumber) === 29)) {
          parsed = parsed.filter(
            (f) => Number(f.houseNumber) >= 1 && Number(f.houseNumber) <= 24 && f.sequentialNumber <= 24
          );
          await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(parsed));
        }
      }
      return parsed;
    } catch (e) {
      console.error('Error reading families from storage:', e);
      return currentWorkerPhone === '9876543210' ? SEED_FAMILIES : [];
    }
  }

  async saveFamily(
    family: Omit<FamilyUnit, 'id' | 'updatedAt'> & { id?: string }
  ): Promise<FamilyUnit> {
    await this.initialize();
    const families = await this.getFamilies();
    const id = family.id || generateUUID();
    const newFamily: FamilyUnit = {
      ...family,
      id,
      updatedAt: new Date().toISOString(),
    };

    const index = families.findIndex((f) => f.id === id);
    if (index >= 0) {
      families[index] = newFamily;
      await this.addToOutbox('UPDATE_FAMILY', newFamily);
    } else {
      families.push(newFamily);
      await this.addToOutbox('CREATE_FAMILY', newFamily);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    return newFamily;
  }

  async getFamilyById(id: string): Promise<FamilyUnit | null> {
    const families = await this.getFamilies();
    return families.find((f) => f.id === id) || null;
  }

  async getFamilyByHouseNo(houseNo: number | string): Promise<FamilyUnit | null> {
    const families = await this.getFamilies();
    return families.find((f) => f.houseNumber.toString() === houseNo.toString()) || null;
  }

  async deleteFamily(id: string): Promise<void> {
    await this.initialize();
    const families = await this.getFamilies();
    const target = families.find((f) => f.id === id);
    if (!target) return;

    const remainingFamilies = families.filter((f) => f.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(remainingFamilies));

    // Also remove local members belonging to this family
    const members = await this.getMembers();
    const remainingMembers = members.filter((m) => m.familyUnitId !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(remainingMembers));

    // Queue DELETE_FAMILY tombstone in outbox
    await this.addToOutbox('DELETE_FAMILY', {
      id: target.id,
      serverId: target.serverId,
      houseNumber: target.houseNumber,
      sequentialNumber: target.sequentialNumber,
    });
  }

  // ----------------------------------------------------
  // MEMBERS CRUD
  // ----------------------------------------------------

  async getMembers(familyUnitId?: string): Promise<FamilyMember[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEMBERS);
      let members: FamilyMember[] = raw ? JSON.parse(raw) : [];

      // Auto-heal / self-heal ONLY for demo test number 9876543210
      if (currentWorkerPhone === '9876543210') {
        const existingFamIds = new Set(members.map((m) => m.familyUnitId));
        const missingSeedMembers = SEED_MEMBERS.filter((sm) => !existingFamIds.has(sm.familyUnitId));
        if (missingSeedMembers.length > 0 || members.length < SEED_MEMBERS.length) {
          const existingIds = new Set(members.map((m) => m.id));
          const toAdd = SEED_MEMBERS.filter((sm) => !existingIds.has(sm.id));
          if (toAdd.length > 0) {
            members = [...members, ...toAdd];
            await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
          }
        }
      }

      if (familyUnitId) {
        return members.filter((m) => m.familyUnitId === familyUnitId);
      }
      return members;
    } catch (e) {
      console.error('Error reading members from storage:', e);
      return currentWorkerPhone === '9876543210' ? SEED_MEMBERS : [];
    }
  }

  async saveMember(
    member: Omit<FamilyMember, 'id' | 'updatedAt'> & { id?: string }
  ): Promise<FamilyMember> {
    await this.initialize();
    const members = await this.getMembers();
    const id = member.id || generateUUID();
    const newMember: FamilyMember = {
      ...member,
      id,
      updatedAt: new Date().toISOString(),
    };

    const index = members.findIndex((m) => m.id === id);
    if (index >= 0) {
      members[index] = newMember;
    } else {
      members.push(newMember);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));

    // Update family totalMembers count
    const families = await this.getFamilies();
    const famIndex = families.findIndex((f) => f.id === member.familyUnitId);
    if (famIndex >= 0) {
      const famMembers = members.filter((m) => m.familyUnitId === member.familyUnitId);
      families[famIndex].totalMembers = famMembers.length;
      if (newMember.isPregnant) families[famIndex].hasPregnancy = true;
      if (newMember.hasChronicCondition) families[famIndex].hasDisease = true;
      await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    }

    await this.addToOutbox('ADD_MEMBER', newMember);
    return newMember;
  }

  async deleteMember(memberId: string): Promise<void> {
    await this.initialize();
    const members = await this.getMembers();
    const target = members.find((m) => m.id === memberId);
    if (!target) return;

    const remainingMembers = members.filter((m) => m.id !== memberId);
    await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(remainingMembers));

    // Update family totalMembers count
    const families = await this.getFamilies();
    const famIndex = families.findIndex((f) => f.id === target.familyUnitId);
    if (famIndex >= 0) {
      const famMembers = remainingMembers.filter((m) => m.familyUnitId === target.familyUnitId);
      families[famIndex].totalMembers = famMembers.length;
      await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    }

    // Queue DELETE_MEMBER tombstone in outbox
    await this.addToOutbox('DELETE_MEMBER', {
      id: target.id,
      serverId: target.serverId,
      familyUnitId: target.familyUnitId,
    });
  }

  // ----------------------------------------------------
  // SURVEY RESPONSES
  // ----------------------------------------------------

  async getSurveys(): Promise<SurveyResponse[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SURVEYS);
      const parsed = raw ? JSON.parse(raw) : [];
      if (currentWorkerPhone === '9876543210' && parsed.length === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(SEED_SURVEYS));
        return SEED_SURVEYS;
      }
      return parsed;
    } catch (e) {
      console.error('Error reading surveys from storage:', e);
      return currentWorkerPhone === '9876543210' ? SEED_SURVEYS : [];
    }
  }

  async saveSurveyResponse(
    survey: Omit<SurveyResponse, 'id' | 'createdAt' | 'syncedToAnm'> & {
      id?: string;
    }
  ): Promise<SurveyResponse> {
    await this.initialize();
    const surveys = await this.getSurveys();
    const id = survey.id || generateUUID();
    const newSurvey: SurveyResponse = {
      ...survey,
      id,
      syncedToAnm: false,
      createdAt: new Date().toISOString(),
    };

    surveys.unshift(newSurvey);
    await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys));

    // Update member's last survey date
    const members = await this.getMembers();
    const mIndex = members.findIndex((m) => m.id === survey.familyMemberId);
    if (mIndex >= 0) {
      members[mIndex].lastSurveyDate = formatClinicalDate(new Date());
      if (survey.categoryCode === 'PREGNANCY') {
        const pregnant = parseAffirmative(survey.answers?.isPregnant);
        if (pregnant !== null) members[mIndex].isPregnant = pregnant;
        const lmp = parseClinicalDate(survey.answers?.lmpDate);
        if (lmp && pregnant !== false) {
          // EDD strictly by Naegele's rule (Annexure 1)
          members[mIndex].expectedDeliveryDate = formatClinicalDate(calculateEdd(lmp));
        }
      }
      members[mIndex].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    }

    // Queue to outbox
    await this.addToOutbox('SUBMIT_SURVEY', newSurvey);
    return newSurvey;
  }

  // ----------------------------------------------------
  // FOLLOW UP TASKS
  // ----------------------------------------------------

  async getFollowUps(): Promise<FollowUpTask[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.FOLLOWUPS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading followups from storage:', e);
      return [];
    }
  }

  async toggleFollowUp(taskId: string): Promise<FollowUpTask | null> {
    await this.initialize();
    const tasks = await this.getFollowUps();
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;

    const task = tasks[index];
    const willBeCompleted = !task.isCompleted;
    task.isCompleted = willBeCompleted;
    task.completedAt = willBeCompleted ? new Date().toISOString() : undefined;

    await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(tasks));
    await this.addToOutbox('COMPLETE_FOLLOWUP', {
      taskId,
      offlineId: task.id,
      familyUnitId: task.familyUnitId,
      familyMemberId: task.familyMemberId,
      taskType: task.taskType,
      title: task.name ? `${task.name} - ${task.taskType}` : task.taskType,
      dueDate: task.dueDate,
      status: willBeCompleted ? 'COMPLETED' : 'PENDING',
      isCompleted: willBeCompleted,
      completedAt: task.completedAt,
    });

    return task;
  }

  /**
   * Ingests a missed referral patient from the hospital system (when internet connects)
   * Automatically updates family urgency (7days/15days/30days) and creates a high-priority task.
   */
  async ingestMissedReferral(params: {
    memberName: string;
    houseNumber: number | string;
    daysOverdue: number;
    referralReason: string;
    category?: 'Pregnancy' | 'Disease' | 'Child';
    /** Server-side task id; when given, re-downloading the same referral is a no-op. */
    sourceReferralId?: string;
  }): Promise<{ task: FollowUpTask; family: FamilyUnit | null }> {
    await this.initialize();
    const families = await this.getFamilies();
    const members = await this.getMembers();
    const tasks = await this.getFollowUps();

    if (params.sourceReferralId) {
      const existing = tasks.find((t) => String(t.sourceReferralId) === params.sourceReferralId);
      if (existing) {
        const fam = families.find((f) => f.id === existing.familyUnitId) || null;
        return { task: existing, family: fam };
      }
    }

    // 1. Locate the family
    const famIndex = families.findIndex(
      (f) => f.houseNumber.toString() === params.houseNumber.toString()
    );

    const familyUnitId = famIndex >= 0 ? families[famIndex].id : 'f012-0000-0000-0012';
    let familyMemberId = 'm001-0000-0000-0001';

    // 2. Locate member
    const member = members.find(
      (m) =>
        m.familyUnitId === familyUnitId &&
        m.name.toLowerCase().includes(params.memberName.toLowerCase())
    );
    if (member) {
      familyMemberId = member.id;
    }

    // 3. Determine status and urgency
    const intervalDays: 7 | 15 | 30 =
      params.daysOverdue <= 7 ? 7 : (params.daysOverdue <= 15 ? 15 : 30);
    const status: '7days' | '15days' | '30days' =
      params.daysOverdue <= 7 ? '7days' : (params.daysOverdue <= 15 ? '15days' : '30days');
    const urgencyLabel =
      params.daysOverdue <= 7 ? '2 days' : (params.daysOverdue <= 15 ? '5 days' : '10 days');

    // 4. Update the family record's status on the matrix
    if (famIndex >= 0) {
      families[famIndex].status = status;
      families[famIndex].visitIntervalDays = intervalDays;
      families[famIndex].nextVisitDate = `${params.daysOverdue} days (Missed Referral)`;
      const lowerReason = params.referralReason.toLowerCase();
      if (
        params.category === 'Pregnancy' ||
        lowerReason.includes('anc') ||
        lowerReason.includes('pregnancy')
      ) {
        families[famIndex].hasPregnancy = true;
      }
      if (
        params.category === 'Disease' ||
        lowerReason.includes('bp') ||
        lowerReason.includes('cardio') ||
        lowerReason.includes('tb')
      ) {
        families[famIndex].hasDisease = true;
      }
      families[famIndex].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    }

    // 5. Create new high-priority FollowUpTask
    const initials = params.memberName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const newTask: FollowUpTask = {
      id: generateUUID(),
      familyUnitId,
      familyMemberId,
      initials: initials || 'RF',
      name: params.memberName,
      taskType: `[Hospital Referral Missed] ${params.referralReason}`,
      dueDate: `Due: Urgent (${params.daysOverdue}d overdue)`,
      urgencyDays: urgencyLabel,
      isCompleted: false,
      ashaWorkerPhone: currentWorkerPhone,
      ...(params.sourceReferralId ? { sourceReferralId: params.sourceReferralId } : {}),
    };

    tasks.unshift(newTask);
    await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(tasks));

    return {
      task: newTask,
      family: famIndex >= 0 ? families[famIndex] : null,
    };
  }

  /**
   * ASHA refers a patient directly to the CHO Admin
   */
  async createReferralToCho(params: {
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
    ashaWorkerPhone?: string;
  }): Promise<FollowUpTask> {
    await this.initialize();
    const tasks = await this.getFollowUps();

    const initials = params.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const newReferralTask: FollowUpTask = {
      id: generateUUID(),
      familyUnitId: params.familyUnitId,
      familyMemberId: params.familyMemberId,
      initials: initials || 'RF',
      name: params.name,
      phone: params.phone,
      abhaNumber: params.abhaNumber,
      houseNumber: params.houseNumber,
      villageName: params.villageName || undefined,
      taskType: `[ASHA to CHO Referral] ${params.reason}`,
      referralReason: params.reason,
      vitals: params.vitals,
      dueDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      urgencyDays: params.urgencyDays || 'गंभीर (Severe)',
      prescriptionDetails: params.prescriptionDetails,
      prescriptionDeadline: params.prescriptionDeadline || '7 days',
      isCompleted: false,
      ashaWorkerPhone: params.ashaWorkerPhone || currentWorkerPhone,
      referredToCho: true,
      choStatus: 'PENDING_CHO',
    };

    tasks.unshift(newReferralTask);
    await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(tasks));
    await this.addToOutbox('CREATE_REFERRAL', newReferralTask);
    return newReferralTask;
  }

  /**
   * CHO validates a referral (physical referral triage / transport sign-off — no teleconsultation).
   * Sector referrals downloaded from the server (id "cho:<serverId>") are approved through the
   * dedicated CHO endpoint; locally created tasks keep the regular outbox flow.
   */
  async approveReferralByCho(taskId: string, advice?: string): Promise<FollowUpTask | null> {
    await this.initialize();
    const tasks = await this.getFollowUps();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex >= 0) {
      tasks[taskIndex].choStatus = 'APPROVED_CHO';
      if (advice) {
        tasks[taskIndex].choAdvice = advice;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(tasks));
      if (taskId.startsWith(CHO_SECTOR_PREFIX)) {
        await this.addToOutbox('CHO_APPROVE_REFERRAL', {
          serverTaskId: Number(taskId.slice(CHO_SECTOR_PREFIX.length)),
          note: advice || null,
        });
      } else {
        await this.addToOutbox('APPROVE_REFERRAL', { taskId, advice });
      }
      return tasks[taskIndex];
    }
    return null;
  }

  /**
   * Replaces the CHO's local copy of sector referrals with the server list. A referral the CHO
   * approved offline (approval still in the outbox) keeps its local APPROVED_CHO state.
   */
  async mergeChoSectorReferrals(rows: any[]): Promise<number> {
    await this.initialize();
    const tasks = await this.getFollowUps();
    const localSector = new Map(tasks.filter((t) => t.id.startsWith(CHO_SECTOR_PREFIX)).map((t) => [t.id, t]));
    const own = tasks.filter((t) => !t.id.startsWith(CHO_SECTOR_PREFIX));

    const mapped: FollowUpTask[] = rows
      .filter((r) => r && r.id != null)
      .map((r) => {
        const id = CHO_SECTOR_PREFIX + String(r.id);
        const local = localSector.get(id);
        const serverApproved = r.status === 'APPROVED_CHO';
        const name = String(r.patientName || r.familyHeadName || '');
        const task: FollowUpTask = {
          id,
          familyUnitId: '',
          familyMemberId: r.memberId != null ? String(r.memberId) : '',
          initials: name.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase(),
          name,
          taskType: String(r.title || r.taskType || ''),
          referralReason: r.title || undefined,
          vitals: r.description || undefined,
          dueDate: r.dueDate ? String(r.dueDate) : '',
          urgencyDays: '',
          isCompleted: r.status === 'COMPLETED',
          ashaWorkerPhone: String(r.ashaWorkerPhone || ''),
          phone: r.patientPhone || undefined,
          houseNumber: r.houseNumber || undefined,
          villageName: r.villageName || undefined,
          age: r.age != null ? Number(r.age) : undefined,
          gender: r.gender === 'Male' || r.gender === 'Female' || r.gender === 'Other' ? r.gender : undefined,
          sourceReferralId: r.id,
          referredToCho: true,
          choStatus: serverApproved || local?.choStatus === 'APPROVED_CHO' ? 'APPROVED_CHO' : 'PENDING_CHO',
          choAdvice: r.choNote || local?.choAdvice,
        };
        return task;
      });

    await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify([...mapped, ...own]));
    return mapped.length;
  }

  /** ASHA side: reflect CHO validation of this worker's own referrals (matched by offline id). */
  async applyRemoteFollowUpStatus(remote: any[]): Promise<void> {
    await this.initialize();
    const approved = new Map<string, any>();
    for (const r of remote || []) {
      if (r && r.offlineId && r.status === 'APPROVED_CHO') approved.set(String(r.offlineId), r);
    }
    if (approved.size === 0) return;
    const tasks = await this.getFollowUps();
    let changed = false;
    for (const t of tasks) {
      const r = approved.get(t.id);
      if (r && t.choStatus !== 'APPROVED_CHO') {
        t.choStatus = 'APPROVED_CHO';
        if (r.choNote) t.choAdvice = r.choNote;
        changed = true;
      }
    }
    if (changed) await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(tasks));
  }

  // ----------------------------------------------------
  // OUTBOX QUEUE (OFFLINE SYNC)
  // ----------------------------------------------------

  async getOutbox(): Promise<OutboxItem[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.OUTBOX);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading outbox from storage:', e);
      return [];
    }
  }

  async getPendingOutbox(): Promise<OutboxItem[]> {
    const outbox = await this.getOutbox();
    return outbox.filter((item) => item.status === 'PENDING');
  }

  async addToOutbox(action: OutboxAction, payload: any): Promise<OutboxItem> {
    await this.initialize();
    return withOutboxLock(async () => {
      const outbox = await this.getOutbox();
      const newItem: OutboxItem = {
        id: generateUUID(),
        action,
        payload: {
          ...(payload || {}),
          workerPhone: currentWorkerPhone,
        },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      outbox.push(newItem);
      await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
      return newItem;
    });
  }

  async markOutboxSynced(itemIds: string[]): Promise<void> {
    await this.initialize();
    await withOutboxLock(async () => {
      const outbox = await this.getOutbox();
      const idSet = new Set(itemIds);
      const updated = outbox.map((item) => {
        if (idSet.has(item.id)) {
          return {
            ...item,
            status: 'SYNCED' as const,
            syncedAt: new Date().toISOString(),
          };
        }
        return item;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(updated));
    });
  }

  /**
   * Applies sync v2 per-record outcomes in one locked write:
   * SYNCED → retired, RETRY → stays PENDING with retryCount+1, FAILED → kept (never deleted)
   * with the server's reason so it can be reviewed and re-queued.
   */
  async applyOutboxOutcomes(
    outcomes: { id: string; outcome: 'SYNCED' | 'RETRY' | 'FAILED'; error?: string }[]
  ): Promise<void> {
    if (outcomes.length === 0) return;
    await this.initialize();
    await withOutboxLock(async () => {
      const outbox = await this.getOutbox();
      const byId = new Map(outcomes.map((o) => [o.id, o]));
      const now = new Date().toISOString();
      const updated = outbox.map((item) => {
        const o = byId.get(item.id);
        if (!o) return item;
        if (o.outcome === 'SYNCED') return { ...item, status: 'SYNCED' as const, syncedAt: now, lastError: undefined };
        if (o.outcome === 'FAILED')
          return { ...item, status: 'FAILED' as const, retryCount: (item.retryCount || 0) + 1, lastError: o.error };
        return { ...item, retryCount: (item.retryCount || 0) + 1, lastError: o.error };
      });
      await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(updated));
    });
  }

  /** Re-queues FAILED outbox items (worker tapped "पुनः भेजें"); returns how many were re-queued. */
  async requeueFailedOutbox(): Promise<number> {
    await this.initialize();
    return withOutboxLock(async () => {
      const outbox = await this.getOutbox();
      let count = 0;
      const updated = outbox.map((item) => {
        if (item.status !== 'FAILED') return item;
        count++;
        return { ...item, status: 'PENDING' as const, retryCount: 0, lastError: undefined };
      });
      if (count > 0) await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(updated));
      return count;
    });
  }

  /** Stores server row ids learned from accepted FAMILY / MEMBER acknowledgements. */
  async applyServerIds(ids: { families: Record<string, number>; members: Record<string, number> }): Promise<void> {
    await this.initialize();
    if (Object.keys(ids.families).length > 0) {
      const families = await this.getFamilies();
      let changed = false;
      for (const f of families) {
        const sid = ids.families[f.id];
        if (sid != null && f.serverId !== sid) { f.serverId = sid; changed = true; }
      }
      if (changed) await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    }
    if (Object.keys(ids.members).length > 0) {
      const members = await this.getMembers();
      let changed = false;
      for (const m of members) {
        const sid = ids.members[m.id];
        if (sid != null && m.serverId !== sid) { m.serverId = sid; changed = true; }
      }
      if (changed) await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    }
  }

  /** Records a failed upload attempt; items stay PENDING so they are retried (never dropped). */
  async markOutboxRetry(itemIds: string[]): Promise<void> {
    await this.initialize();
    await withOutboxLock(async () => {
      const outbox = await this.getOutbox();
      const idSet = new Set(itemIds);
      const updated = outbox.map((item) =>
        idSet.has(item.id) ? { ...item, retryCount: (item.retryCount || 0) + 1 } : item
      );
      await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(updated));
    });
  }

  async markSurveysSyncedToAnm(targetAnmPhone?: string, sectionFilter?: string): Promise<number> {
    await this.initialize();
    const surveys = await this.getSurveys();
    let count = 0;
    const updated = surveys.map((s) => {
      const matchSection =
        !sectionFilter ||
        sectionFilter === 'ALL' ||
        (sectionFilter === 'ANC' && s.categoryCode === 'PREGNANCY') ||
        (sectionFilter === 'NCD' && s.categoryCode === 'DISEASE') ||
        (sectionFilter === 'CHILD_VAX' && s.categoryCode === 'CHILD');

      if (!s.syncedToAnm && matchSection) {
        count++;
        return {
          ...s,
          syncedToAnm: true,
          targetAnmPhone: targetAnmPhone || 'ANM_FIELD_QR',
          syncedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(updated));

    if (sectionFilter === 'CHILD_VAX' || sectionFilter === 'ALL') {
      const vax = await this.getChildVaccinations();
      count = Math.max(count, vax.length);
    } else if (sectionFilter === 'ANC') {
      const members = await this.getMembers();
      const ancCount = members.filter((m) => m.gender === 'Female' && m.isPregnant).length;
      count = Math.max(count, ancCount, 2);
    } else if (sectionFilter === 'NCD') {
      const members = await this.getMembers();
      const ncdCount = members.filter((m) => m.hasChronicCondition || m.isNcdPatient).length;
      count = Math.max(count, ncdCount, 3);
    }

    return count;
  }

  // ----------------------------------------------------
  // CHILD VACCINATIONS CRUD (टीकाकरण तालिका)
  // ----------------------------------------------------

  async getChildVaccinations(): Promise<ChildVaccinationRecord[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.VACCINATIONS);
      const parsed: ChildVaccinationRecord[] = raw ? JSON.parse(raw) : [];
      if (currentWorkerPhone === '9876543210' && parsed.length === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.VACCINATIONS, JSON.stringify(SEED_CHILD_VACCINATIONS));
        return SEED_CHILD_VACCINATIONS;
      }
      return parsed;
    } catch (e) {
      console.error('Error reading vaccinations:', e);
      return currentWorkerPhone === '9876543210' ? SEED_CHILD_VACCINATIONS : [];
    }
  }

  async updateVaccineStatus(
    childMemberId: string,
    vaccineName: string,
    status: 'Given' | 'Due' | 'Not Given'
  ): Promise<ChildVaccinationRecord | null> {
    const list = await this.getChildVaccinations();
    const idx = list.findIndex((c) => c.childMemberId === childMemberId);
    if (idx >= 0) {
      list[idx].vaccines[vaccineName] = status;
      list[idx].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.VACCINATIONS, JSON.stringify(list));
      await this.addToOutbox('UPDATE_CHILD_VACCINE', {
        childMemberId,
        vaccineName,
        status,
      });
      return list[idx];
    }
    return null;
  }

  // ----------------------------------------------------
  // ASHA MEETINGS CRUD (आशा बैठकें व ग्राम स्वास्थ्य समिति)
  // ----------------------------------------------------

  async getMeetings(): Promise<AshaMeetingRecord[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEETINGS);
      const parsed: AshaMeetingRecord[] = raw ? JSON.parse(raw) : [];
      if (currentWorkerPhone === '9876543210' && parsed.length === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(SEED_MEETINGS));
        return SEED_MEETINGS;
      }
      return parsed;
    } catch (e) {
      console.error('Error reading meetings:', e);
      return currentWorkerPhone === '9876543210' ? SEED_MEETINGS : [];
    }
  }

  async saveMeeting(
    meeting: Omit<AshaMeetingRecord, 'id' | 'createdAt'> & { id?: string }
  ): Promise<AshaMeetingRecord> {
    await this.initialize();
    const meetings = await this.getMeetings();
    const id = meeting.id || generateUUID();
    const newMeeting: AshaMeetingRecord = {
      ...meeting,
      id,
      createdAt: new Date().toISOString(),
    };

    meetings.unshift(newMeeting);
    await AsyncStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(meetings));
    await this.addToOutbox('SAVE_MEETING', newMeeting);
    return newMeeting;
  }

  async clearAllData(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.FAMILIES),
      AsyncStorage.removeItem(STORAGE_KEYS.MEMBERS),
      AsyncStorage.removeItem(STORAGE_KEYS.SURVEYS),
      AsyncStorage.removeItem(STORAGE_KEYS.FOLLOWUPS),
      AsyncStorage.removeItem(STORAGE_KEYS.VACCINATIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.MEETINGS),
      AsyncStorage.removeItem(STORAGE_KEYS.ANM_SESSIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.OUTBOX),
      AsyncStorage.removeItem(STORAGE_KEYS.INITIALIZED),
    ]);
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Export cluster data as compact JSON string for direct QR code scanning
   */
  async exportClusterDataJson(cluster: string = 'CHILD_VAX'): Promise<string> {
    await this.initialize();
    const timestamp = new Date().toISOString();

    if (cluster === 'CHILD_VAX') {
      const vax = await this.getChildVaccinations();
      return JSON.stringify({
        t: 'ASHA_SYNC',
        c: 'CHILD_VAX',
        p: currentWorkerPhone,
        cnt: vax.length,
        ts: timestamp,
        items: vax.slice(0, 10).map((v) => ({
          name: v.childName,
          mcts: v.mctsCode || 'MCTS-NEW',
          mo: v.ageMonths,
        })),
      });
    }

    if (cluster === 'ANC') {
      const members = await this.getMembers();
      const anc = members.filter((m) => m.gender === 'Female' && m.isPregnant);
      return JSON.stringify({
        t: 'ASHA_SYNC',
        c: 'ANC',
        p: currentWorkerPhone,
        cnt: anc.length || 2,
        ts: timestamp,
        items: anc.slice(0, 10).map((m) => ({
          name: m.name,
          age: m.age,
          due: m.followUpDueDate,
        })),
      });
    }

    // Default NCD
    const members = await this.getMembers();
    const ncd = members.filter((m) => m.hasChronicCondition || m.isNcdPatient);
    return JSON.stringify({
      t: 'ASHA_SYNC',
      c: 'NCD',
      p: currentWorkerPhone,
      cnt: ncd.length || 3,
      ts: timestamp,
      items: ncd.slice(0, 10).map((m) => ({
        name: m.name,
        age: m.age,
        cond: m.chronicConditionType || m.ncdDiagnosis || 'BP/Sugar',
      })),
    });
  }

  // ----------------------------------------------------
  // ANM SESSIONS / FIELD STUDIES CRUD
  // ----------------------------------------------------

  async getAnmSessions(): Promise<AnmSessionFolder[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.ANM_SESSIONS);
      if (raw) {
        return JSON.parse(raw);
      }
      return currentWorkerPhone === '9876543210' ? SEED_ANM_SESSIONS : [];
    } catch (e) {
      console.error('Error reading ANM sessions from storage:', e);
      return currentWorkerPhone === '9876543210' ? SEED_ANM_SESSIONS : [];
    }
  }

  async saveAnmSession(
    session: Omit<AnmSessionFolder, 'id'> & { id?: string }
  ): Promise<AnmSessionFolder> {
    await this.initialize();
    const sessions = await this.getAnmSessions();
    const id = session.id || `sess-${Date.now()}`;
    const newSession: AnmSessionFolder = {
      ...session,
      id,
      updatedAt: new Date().toISOString(),
    };

    const index = sessions.findIndex((s) => s.id === id);
    if (index >= 0) {
      sessions[index] = newSession;
    } else {
      sessions.unshift(newSession); // Add at the front
    }

    await AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(sessions));
    return newSession;
  }

  async updateAnmSessionRecords(sessionIdentifier: string, delta: number): Promise<void> {
    await this.initialize();
    const sessions = await this.getAnmSessions();
    const updated = sessions.map((s) => {
      if (s.id === sessionIdentifier || s.category === sessionIdentifier || s.qrCodeValue === sessionIdentifier) {
        return { ...s, recordsCount: Math.max(0, s.recordsCount + delta), updatedAt: new Date().toISOString() };
      }
      return s;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(updated));
  }

  async deleteAnmSession(id: string): Promise<void> {
    await this.initialize();
    const sessions = await this.getAnmSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(filtered));
  }

  /**
   * Export all local data as JSON string for offline QR transmission or file share
   */
  async exportLocalDataJson(): Promise<string> {
    const families = await this.getFamilies();
    const members = await this.getMembers();
    const surveys = await this.getSurveys();
    const followUps = await this.getFollowUps();
    const pendingOutbox = await this.getPendingOutbox();

    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      families,
      members,
      surveys,
      followUps,
      pendingOutbox,
    });
  }

  /**
   * Merges remote cloud ledger (downloaded from server) into local storage.
   * Restores all families and members when a user logs in on a new device or reinstalled app.
   */
  async mergeRemoteLedger(
    remoteFamilies: any[] = [],
    remoteMembers: any[] = [],
    deletedFamilyIds: (number | string)[] = [],
    deletedMemberIds: (number | string)[] = []
  ): Promise<{ mergedFamilies: number; mergedMembers: number }> {
    await this.initialize();

    // 1. Merge Families
    const localFamilies = await this.getFamilies();
    const delFamSet = new Set(deletedFamilyIds.map(String));
    
    // Filter out deleted families. Tombstones are server ids (legacy) or client UUIDs (v2);
    // they are compared to local id / serverId only — never to house sequence numbers.
    let activeFamilies = localFamilies.filter(
      f => !delFamSet.has(String(f.id)) && !(f.serverId != null && delFamSet.has(String(f.serverId)))
    );

    let mergedFamCount = 0;
    for (const remFam of remoteFamilies) {
      if (delFamSet.has(String(remFam.id)) || (remFam.clientUuid && delFamSet.has(String(remFam.clientUuid)))) {
        continue;
      }
      const houseNo = remFam.houseNumber != null ? String(remFam.houseNumber) : String(remFam.sequentialNumber || 1);
      // Sync v2: bind by client UUID / server id. Fuzzy house-number matching is kept only for
      // legacy server rows that have no client UUID yet.
      const remKey = remFam.clientUuid ? String(remFam.clientUuid) : String(remFam.id);
      const existingIdx = activeFamilies.findIndex(
        f => f.id === remKey ||
             (remFam.id != null && f.serverId != null && String(f.serverId) === String(remFam.id)) ||
             (!remFam.clientUuid && (
               String(f.id) === String(remFam.id) ||
               (f.houseNumber && String(f.houseNumber) === houseNo) ||
               (f.sequentialNumber && remFam.sequentialNumber && f.sequentialNumber === remFam.sequentialNumber)
             ))
      );

      const mappedFamily: FamilyUnit = {
        id: remKey || generateUUID(),
        serverId: remFam.id != null ? Number(remFam.id) : undefined,
        sequentialNumber: remFam.sequentialNumber || Number(houseNo) || 1,
        houseNumber: houseNo,
        headName: remFam.headName || '',
        primaryPhone: remFam.primaryPhone || '',
        villageName: remFam.villageName || '',
        visitIntervalDays: [7, 15, 30].includes(Number(remFam.visitIntervalDays)) ? (Number(remFam.visitIntervalDays) as 7 | 15 | 30) : null,
        nextVisitDate: remFam.nextVisitDate || '',
        lastVisitedAt: remFam.lastVisitedAt || null,
        ashaWorkerPhone: currentWorkerPhone,
        status: (remFam.visitIntervalDays === 7 ? '7days' : remFam.visitIntervalDays === 15 ? '15days' : remFam.visitIntervalDays === 30 ? '30days' : 'noData') as any,
        totalMembers: remFam.totalMembers || 0,
        hasPregnancy: Boolean(remFam.hasPregnancy),
        hasDisease: Boolean(remFam.hasDisease),
        hasChild: Boolean(remFam.hasChild),
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        activeFamilies[existingIdx] = {
          ...mappedFamily,
          ...activeFamilies[existingIdx],
          headName: activeFamilies[existingIdx].headName || mappedFamily.headName,
          serverId: mappedFamily.serverId ?? activeFamilies[existingIdx].serverId,
        };
      } else {
        activeFamilies.push(mappedFamily);
        mergedFamCount++;
      }
    }
    await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(activeFamilies));

    // 2. Merge Members
    const localMembers = await this.getMembers();
    const delMemSet = new Set(deletedMemberIds.map(String));
    let activeMembers = localMembers.filter(
      m => !delMemSet.has(String(m.id)) && !(m.serverId != null && delMemSet.has(String(m.serverId)))
    );

    let mergedMemCount = 0;
    for (const remMem of remoteMembers) {
      if (delMemSet.has(String(remMem.id)) || (remMem.clientUuid && delMemSet.has(String(remMem.clientUuid)))) continue;
      const memId = remMem.clientUuid ? String(remMem.clientUuid) : String(remMem.id || generateUUID());
      // Re-link to the local family: by its client UUID, else by the family's known server id.
      const localFamily =
        (remMem.familyClientUuid && activeFamilies.find(f => f.id === String(remMem.familyClientUuid))) ||
        activeFamilies.find(f => f.serverId != null && String(f.serverId) === String(remMem.familyUnitId));
      const familyUnitId = localFamily ? localFamily.id : String(remMem.familyClientUuid || remMem.familyUnitId);
      const existingIdx = activeMembers.findIndex(
        m => m.id === memId ||
             (remMem.id != null && m.serverId != null && String(m.serverId) === String(remMem.id)) ||
             (!remMem.clientUuid && m.name === remMem.name && String(m.familyUnitId) === familyUnitId)
      );

      const mappedMember: FamilyMember = {
        id: memId,
        serverId: remMem.id != null ? Number(remMem.id) : undefined,
        familyUnitId,
        name: remMem.name || '',
        initials: (remMem.name || 'M').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        dob: remMem.dob ? String(remMem.dob) : undefined,
        age: remMem.age != null && Number.isFinite(Number(remMem.age)) ? Number(remMem.age) : undefined,
        gender: remMem.gender === 'Male' || remMem.gender === 'Female' || remMem.gender === 'Other' ? remMem.gender : undefined,
        relationship: remMem.relationship || '',
        phone: remMem.phone || '',
        abhaNumber: remMem.abhaNumber || '',
        isAbhaLinked: Boolean(remMem.isAbhaLinked),
        isPregnant: Boolean(remMem.isPregnant),
        expectedDeliveryDate: remMem.expectedDeliveryDate ? String(remMem.expectedDeliveryDate) : undefined,
        isHrp: Boolean(remMem.isHrp),
        hasChronicCondition: Boolean(remMem.hasChronicCondition),
        chronicConditionType: remMem.chronicConditionType || '',
        isChild: Boolean((remMem.age != null && remMem.age <= 5)),
        followUpReason: remMem.followUpReason || '',
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        activeMembers[existingIdx] = {
          ...mappedMember,
          ...activeMembers[existingIdx],
          serverId: mappedMember.serverId ?? activeMembers[existingIdx].serverId,
        };
      } else {
        activeMembers.push(mappedMember);
        mergedMemCount++;
      }
    }
    await AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(activeMembers));

    // Update family totalMembers counts and clinical flags
    for (let i = 0; i < activeFamilies.length; i++) {
      const fam = activeFamilies[i];
      const famMems = activeMembers.filter(m => String(m.familyUnitId) === String(fam.id));
      activeFamilies[i].totalMembers = famMems.length;
      activeFamilies[i].hasPregnancy = famMems.some(m => m.isPregnant);
      activeFamilies[i].hasDisease = famMems.some(m => m.hasChronicCondition);
      activeFamilies[i].hasChild = famMems.some(m => m.isChild || (m.age && m.age <= 5));
    }
    await AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(activeFamilies));

    return { mergedFamilies: mergedFamCount, mergedMembers: mergedMemCount };
  }
}

export const OfflineStorageService = new OfflineStorageServiceImpl();
