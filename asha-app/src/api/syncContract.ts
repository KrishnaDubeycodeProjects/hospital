/**
 * Sync contract v2 — pure payload building and acknowledgement handling.
 *
 * Every record sent to POST /api/sync/upload carries:
 *   - outboxId   : the local outbox item id (echoed back by the server)
 *   - clientUuid : the entity's local UUID (bound server-side to client_uuid / offline_id)
 *   - references by client UUID (familyClientUuid / memberClientUuid) plus legacy hints
 *     (familySequentialNumber, memberName) so pre-v2 server rows can be adopted.
 * The server answers with one { outboxId, clientUuid, entity, serverId, status, reason,
 * retryable } result per record. No local id is ever coerced to a number or defaulted to 1.
 */
import {
  FamilyUnit,
  FamilyMember,
  FollowUpTask,
  ChildVaccinationRecord,
  OutboxItem,
} from '../types/storage';
import { parseAffirmative, toIsoDate } from '../services/maternalMath';

export const MAX_RETRYABLE_ATTEMPTS = 5;

export interface UploadBody {
  contractVersion: 2;
  families: Record<string, any>[];
  members: Record<string, any>[];
  surveys: Record<string, any>[];
  followUps: Record<string, any>[];
  meetings: Record<string, any>[];
  deletedFamilies: Record<string, any>[];
  deletedMembers: Record<string, any>[];
}

export interface BuiltUpload {
  body: UploadBody;
  /** Outbox ids included in `body` (expect one server result each). */
  uploadedIds: string[];
  /** SEND_TO_ANM items, dispatched through their own endpoint. */
  anmSends: OutboxItem[];
  /** CHO sector approvals, sent to POST /api/asha/referrals/{id}/approve. */
  choApprovals: OutboxItem[];
  /** Obsolete/unknown actions that can never be uploaded. */
  unsupportedIds: string[];
}

export interface LocalLedger {
  families: FamilyUnit[];
  members: FamilyMember[];
  followUps: FollowUpTask[];
  vaccinations: ChildVaccinationRecord[];
}

export interface SyncRecordResult {
  outboxId: string | null;
  clientUuid: string | null;
  entity: string;
  serverId: number | null;
  status: 'ACCEPTED' | 'REJECTED';
  reason: string | null;
  retryable: boolean;
}

export type OutboxOutcome =
  | { id: string; outcome: 'SYNCED' }
  | { id: string; outcome: 'RETRY'; error?: string }
  | { id: string; outcome: 'FAILED'; error: string };

const today = () => new Date().toISOString().split('T')[0];

/** Normalizes the survey's pregnancy answer to a boolean (हाँ / होय / true → true). */
function normalizeAnswers(answers: Record<string, any> | undefined): Record<string, any> {
  const out = { ...(answers || {}) };
  if ('isPregnant' in out) {
    const v = parseAffirmative(out.isPregnant);
    if (v !== null) out.isPregnant = v;
  }
  return out;
}

export function buildUploadPayload(pending: OutboxItem[], ledger: LocalLedger): BuiltUpload {
  const famById = new Map(ledger.families.map((f) => [f.id, f]));
  const memById = new Map(ledger.members.map((m) => [m.id, m]));
  const taskById = new Map(ledger.followUps.map((t) => [t.id, t]));
  const vaxByChild = new Map(ledger.vaccinations.map((v) => [v.childMemberId, v]));
  const famSeq = (familyId?: string) =>
    familyId && famById.get(familyId)?.sequentialNumber != null ? famById.get(familyId)!.sequentialNumber : undefined;

  const body: UploadBody = {
    contractVersion: 2,
    families: [],
    members: [],
    surveys: [],
    followUps: [],
    meetings: [],
    deletedFamilies: [],
    deletedMembers: [],
  };
  const uploadedIds: string[] = [];
  const anmSends: OutboxItem[] = [];
  const choApprovals: OutboxItem[] = [];
  const unsupportedIds: string[] = [];

  for (const item of pending) {
    const p = item.payload || {};
    const base = { outboxId: item.id };

    switch (item.action) {
      case 'CREATE_FAMILY':
      case 'UPDATE_FAMILY': {
        const days = p.visitIntervalDays || (p.status === '7days' ? 7 : p.status === '15days' ? 15 : p.status === '30days' ? 30 : null);
        body.families.push({
          ...base,
          clientUuid: p.id,
          serverId: p.serverId ?? famById.get(p.id)?.serverId ?? null,
          primaryPhone: p.primaryPhone || null,
          headName: p.headName || null,
          villageName: p.villageName || null,
          houseNumber: p.houseNumber != null ? String(p.houseNumber) : null,
          sequentialNumber: p.sequentialNumber ?? null,
          visitIntervalDays: days,
          nextVisitDate:
            toIsoDate(p.nextVisitDate) ||
            (days ? new Date(Date.now() + days * 86400000).toISOString().split('T')[0] : null),
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'ADD_MEMBER': {
        body.members.push({
          ...base,
          clientUuid: p.id,
          familyClientUuid: p.familyUnitId,
          familySequentialNumber: famSeq(p.familyUnitId) ?? null,
          name: p.name || null,
          relationship: p.relationship || null,
          dob: toIsoDate(p.dob),
          age: typeof p.age === 'number' ? p.age : p.age != null && p.age !== '' ? Number(p.age) : null,
          gender: p.gender || null,
          phone: p.phone || null,
          isPregnant: parseAffirmative(p.isPregnant),
          expectedDeliveryDate: toIsoDate(p.expectedDeliveryDate),
          hasChronicCondition: parseAffirmative(p.hasChronicCondition),
          chronicConditionType: p.chronicConditionType || null,
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'DELETE_FAMILY': {
        body.deletedFamilies.push({
          ...base,
          clientUuid: p.id,
          serverId: p.serverId ?? null,
          sequentialNumber: p.sequentialNumber ?? null,
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'DELETE_MEMBER': {
        body.deletedMembers.push({ ...base, clientUuid: p.id, serverId: p.serverId ?? null });
        uploadedIds.push(item.id);
        break;
      }
      case 'SUBMIT_SURVEY': {
        const member = memById.get(p.familyMemberId);
        body.surveys.push({
          ...base,
          offlineId: p.id || item.id,
          familyClientUuid: p.familyUnitId,
          familySequentialNumber: famSeq(p.familyUnitId) ?? null,
          memberClientUuid: p.familyMemberId,
          memberName: member?.name || p.answers?.memberName || null,
          categoryCode: p.categoryCode || 'GENERAL',
          answers: normalizeAnswers(p.answers),
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'UPDATE_CHILD_VACCINE': {
        const child = memById.get(p.childMemberId);
        const familyId = child?.familyUnitId || vaxByChild.get(p.childMemberId)?.familyUnitId;
        body.surveys.push({
          ...base,
          offlineId: item.id,
          familyClientUuid: familyId || null,
          familySequentialNumber: famSeq(familyId) ?? null,
          memberClientUuid: p.childMemberId,
          memberName: child?.name || vaxByChild.get(p.childMemberId)?.childName || null,
          categoryCode: 'CHILD',
          answers: {
            recordType: 'VACCINE_UPDATE',
            vaccineName: p.vaccineName,
            status: p.status,
            updatedAt: item.createdAt,
          },
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'COMPLETE_FOLLOWUP': {
        const taskId = p.offlineId || p.taskId;
        const task = taskById.get(taskId);
        const familyId = p.familyUnitId || task?.familyUnitId;
        body.followUps.push({
          ...base,
          offlineId: taskId,
          status: p.isCompleted ? 'COMPLETED' : 'PENDING',
          familyClientUuid: familyId || null,
          familySequentialNumber: famSeq(familyId) ?? null,
          memberClientUuid: p.familyMemberId || task?.familyMemberId || null,
          memberName: task?.name || null,
          taskType: p.taskType || task?.taskType || null,
          title: p.title || task?.taskType || null,
          dueDate: today(),
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'CREATE_REFERRAL': {
        body.followUps.push({
          ...base,
          offlineId: p.id || item.id,
          status: 'PENDING',
          familyClientUuid: p.familyUnitId || null,
          familySequentialNumber: famSeq(p.familyUnitId) ?? null,
          memberClientUuid: p.familyMemberId || null,
          memberName: p.name || null,
          taskType: 'ASHA_TO_CHO_REFERRAL',
          title: p.referralReason || p.taskType || null,
          description: [p.referralReason, p.vitals].filter(Boolean).join(' • ') || null,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'APPROVE_REFERRAL': {
        const task = taskById.get(p.taskId);
        body.followUps.push({
          ...base,
          offlineId: p.taskId,
          status: 'COMPLETED',
          note: p.advice ? `CHO: ${p.advice}` : null,
          familyClientUuid: task?.familyUnitId || null,
          familySequentialNumber: famSeq(task?.familyUnitId) ?? null,
          memberClientUuid: task?.familyMemberId || null,
          memberName: task?.name || null,
          taskType: 'ASHA_TO_CHO_REFERRAL',
          title: task?.referralReason || task?.taskType || null,
          dueDate: today(),
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'SAVE_MEETING': {
        const { workerPhone, ...meeting } = p;
        body.meetings.push({
          ...base,
          clientUuid: p.id || item.id,
          meetingDate: toIsoDate(p.meetingDate),
          payload: meeting,
        });
        uploadedIds.push(item.id);
        break;
      }
      case 'SEND_TO_ANM':
        anmSends.push(item);
        break;
      case 'CHO_APPROVE_REFERRAL':
        if (Number.isInteger(p.serverTaskId) && p.serverTaskId > 0) choApprovals.push(item);
        else unsupportedIds.push(item.id);
        break;
      default:
        // e.g. legacy RECORD_TELECONSULT items (teleconsultation is out of scope)
        unsupportedIds.push(item.id);
    }
  }

  return { body, uploadedIds, anmSends, choApprovals, unsupportedIds };
}

/**
 * Turns the server response into per-item outbox outcomes.
 * - v2 server: ACCEPTED → SYNCED; retryable REJECTED → RETRY (FAILED after
 *   MAX_RETRYABLE_ATTEMPTS); non-retryable REJECTED → FAILED; missing result → RETRY.
 * - v1 server (no `results`): all SYNCED when nothing rejected, otherwise all RETRY.
 */
export function planOutcomes(
  pending: OutboxItem[],
  uploadedIds: string[],
  response: { results?: SyncRecordResult[]; rejected?: number } | null
): OutboxOutcome[] {
  const byId = new Map(pending.map((i) => [i.id, i]));
  const outcomes: OutboxOutcome[] = [];

  if (!response || !Array.isArray(response.results)) {
    const allOk = response != null && !(Number(response.rejected) > 0);
    for (const id of uploadedIds) outcomes.push(allOk ? { id, outcome: 'SYNCED' } : { id, outcome: 'RETRY' });
    return outcomes;
  }

  const resultsByOutbox = new Map<string, SyncRecordResult>();
  for (const r of response.results) {
    if (r && r.outboxId) resultsByOutbox.set(r.outboxId, r);
  }

  for (const id of uploadedIds) {
    const r = resultsByOutbox.get(id);
    if (!r) {
      outcomes.push({ id, outcome: 'RETRY', error: 'NO_ACK' });
    } else if (r.status === 'ACCEPTED') {
      outcomes.push({ id, outcome: 'SYNCED' });
    } else if (r.retryable) {
      const attempts = (byId.get(id)?.retryCount || 0) + 1;
      outcomes.push(
        attempts >= MAX_RETRYABLE_ATTEMPTS
          ? { id, outcome: 'FAILED', error: r.reason || 'REJECTED' }
          : { id, outcome: 'RETRY', error: r.reason || undefined }
      );
    } else {
      outcomes.push({ id, outcome: 'FAILED', error: r.reason || 'REJECTED' });
    }
  }
  return outcomes;
}

/** Server ids learned from accepted FAMILY / MEMBER results, keyed by client UUID. */
export function collectServerIds(results: SyncRecordResult[] | undefined): {
  families: Record<string, number>;
  members: Record<string, number>;
} {
  const families: Record<string, number> = {};
  const members: Record<string, number> = {};
  for (const r of results || []) {
    if (r.status !== 'ACCEPTED' || r.serverId == null || !r.clientUuid) continue;
    if (r.entity === 'FAMILY') families[r.clientUuid] = r.serverId;
    else if (r.entity === 'MEMBER') members[r.clientUuid] = r.serverId;
  }
  return { families, members };
}
