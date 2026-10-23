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

const STORAGE_KEYS = {
  FAMILIES: '@asha_families_v5',
  MEMBERS: '@asha_members_v5',
  SURVEYS: '@asha_surveys_v5',
  FOLLOWUPS: '@asha_followups_v5',
  VACCINATIONS: '@asha_vaccinations_v5',
  MEETINGS: '@asha_meetings_v5',
  ANM_SESSIONS: '@asha_anm_sessions_v5',
  OUTBOX: '@asha_outbox_v5',
  INITIALIZED: '@asha_initialized_v5',
};

class OfflineStorageServiceImpl {
  private isInitialized = false;

  /**
   * Initializes local storage with complete 24-household grid and official registers.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const initialized = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(SEED_FAMILIES)),
          AsyncStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(SEED_MEMBERS)),
          AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(SEED_SURVEYS)),
          AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(SEED_FOLLOWUPS)),
          AsyncStorage.setItem(STORAGE_KEYS.VACCINATIONS, JSON.stringify(SEED_CHILD_VACCINATIONS)),
          AsyncStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(SEED_MEETINGS)),
          AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(SEED_ANM_SESSIONS)),
          AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify([])),
          AsyncStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true'),
        ]);
      } else {
        // Ensure ANM sessions are initialized even if other keys exist
        const existingSessions = await AsyncStorage.getItem(STORAGE_KEYS.ANM_SESSIONS);
        if (!existingSessions) {
          await AsyncStorage.setItem(STORAGE_KEYS.ANM_SESSIONS, JSON.stringify(SEED_ANM_SESSIONS));
        }
      }
      this.isInitialized = true;
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
      return parsed;
    } catch (e) {
      console.error('Error reading families from storage:', e);
      return SEED_FAMILIES;
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

  // ----------------------------------------------------
  // MEMBERS CRUD
  // ----------------------------------------------------

  async getMembers(familyUnitId?: string): Promise<FamilyMember[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEMBERS);
      let members: FamilyMember[] = raw ? JSON.parse(raw) : [];

      // Auto-heal / self-heal: guarantee all 24 houses have their complete members
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

      if (familyUnitId) {
        return members.filter((m) => m.familyUnitId === familyUnitId);
      }
      return members;
    } catch (e) {
      console.error('Error reading members from storage:', e);
      return SEED_MEMBERS;
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

  // ----------------------------------------------------
  // SURVEY RESPONSES
  // ----------------------------------------------------

  async getSurveys(): Promise<SurveyResponse[]> {
    await this.initialize();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SURVEYS);
      const parsed = raw ? JSON.parse(raw) : [];
      if (parsed.length === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(SEED_SURVEYS));
        return SEED_SURVEYS;
      }
      return parsed;
    } catch (e) {
      console.error('Error reading surveys from storage:', e);
      return SEED_SURVEYS;
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
      members[mIndex].lastSurveyDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
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
  }): Promise<{ task: FollowUpTask; family: FamilyUnit | null }> {
    await this.initialize();
    const families = await this.getFamilies();
    const members = await this.getMembers();
    const tasks = await this.getFollowUps();

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
      ashaWorkerPhone: '9876543210',
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
      villageName: params.villageName || 'Chandpur',
      taskType: `[ASHA to CHO Referral] ${params.reason}`,
      referralReason: params.reason,
      vitals: params.vitals,
      dueDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      urgencyDays: params.urgencyDays || 'गंभीर (Severe)',
      prescriptionDetails: params.prescriptionDetails,
      prescriptionDeadline: params.prescriptionDeadline || '7 days',
      isCompleted: false,
      ashaWorkerPhone: params.ashaWorkerPhone || '9876543210',
      referredToCho: true,
      choStatus: 'PENDING_CHO',
    };

    tasks.unshift(newReferralTask);
    await AsyncStorage.setItem(STORAGE_KEYS.FOLLOWUPS, JSON.stringify(tasks));
    await this.addToOutbox('CREATE_REFERRAL', newReferralTask);
    return newReferralTask;
  }

  /**
   * CHO Admin approves referral or provides teleconsultation advice
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
      await this.addToOutbox('APPROVE_REFERRAL', { taskId, advice });
      return tasks[taskIndex];
    }
    return null;
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
    const outbox = await this.getOutbox();
    const newItem: OutboxItem = {
      id: generateUUID(),
      action,
      payload,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    outbox.push(newItem);
    await AsyncStorage.setItem(STORAGE_KEYS.OUTBOX, JSON.stringify(outbox));
    return newItem;
  }

  async markOutboxSynced(itemIds: string[]): Promise<void> {
    await this.initialize();
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
      if (parsed.length === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.VACCINATIONS, JSON.stringify(SEED_CHILD_VACCINATIONS));
        return SEED_CHILD_VACCINATIONS;
      }
      return parsed;
    } catch (e) {
      console.error('Error reading vaccinations:', e);
      return SEED_CHILD_VACCINATIONS;
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
      if (parsed.length === 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(SEED_MEETINGS));
        return SEED_MEETINGS;
      }
      return parsed;
    } catch (e) {
      console.error('Error reading meetings:', e);
      return SEED_MEETINGS;
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
        p: '9876543210',
        n: 'Sunita Devi',
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
        p: '9876543210',
        n: 'Sunita Devi',
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
      p: '9876543210',
      n: 'Sunita Devi',
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
      return SEED_ANM_SESSIONS;
    } catch (e) {
      console.error('Error reading ANM sessions from storage:', e);
      return SEED_ANM_SESSIONS;
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
}

export const OfflineStorageService = new OfflineStorageServiceImpl();
