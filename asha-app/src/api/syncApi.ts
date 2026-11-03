import { Platform } from 'react-native';
import { OfflineStorageService, getStorageWorkerPhone } from '../storage/OfflineStorageService';
import { OutboxItem } from '../types/storage';
import { parseQrIdentifier } from '../utils/qrScannerHelper';
import { authHeader } from './authSession';
import {
  buildUploadPayload,
  planOutcomes,
  collectServerIds,
  OutboxOutcome,
  SyncRecordResult,
} from './syncContract';

const CLOUD_API_URL = 'https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com';

const getBackendBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).location?.origin) {
    const origin = window.location.origin;
    const port = window.location.port;
    if (port === '8088' || port === '8080') {
      return origin;
    }
  }
  return CLOUD_API_URL;
};

export const BACKEND_BASE_URL = getBackendBaseUrl();

/** Row of GET /api/anm/ashas (AshaWorkerDto). */
export interface AnmAshaWorker {
  id?: number;
  phone: string;
  name: string;
  villageName?: string;
}

/** Row of GET /api/anm/data/{ashaPhone}/forms (SurveyResponseDto). */
export interface AnmSurveyForm {
  id: number;
  familyUnitId?: number;
  familyMemberId?: number;
  categoryCode: 'PREGNANCY' | 'DISEASE' | 'CHILD' | 'GENERAL' | string;
  ashaWorkerPhone: string;
  answers?: Record<string, any>;
  syncedAt?: string;
  offlineId?: string;
  createdAt?: string;
  memberName?: string;
  familyHeadName?: string;
}

/** Row of GET /api/asha/cho/workers (ChoReferralService.listSectorWorkers). */
export interface ChoSectorWorker {
  phone: string;
  name: string;
  villageName?: string | null;
  role: 'ASHA' | 'ANM' | string;
  familyCount: number;
  surveyCount: number;
  referralCount: number;
  pendingReferralCount: number;
}

// Required for ngrok free tier to skip the browser warning interstitial page
const NGROK_HEADERS: Record<string, string> = {
  'ngrok-skip-browser-warning': '1',
};

export interface SyncResult {
  success: boolean;
  mode: 'ONLINE_SYNCED' | 'OFFLINE_QUEUED' | 'QR_PREPARED';
  message: string;
  syncedCount: number;
  qrPayload?: string;
  downloadedTasksCount?: number;
}

type SyncLang = 'hi' | 'mr' | string;
const msg = (lang: SyncLang, hi: string, mr: string) => (lang === 'mr' ? mr : hi);

/**
 * Auto-sync coordination (shared by heartbeat, NetInfo, browser events and manual taps):
 * - single-flight: concurrent callers share one in-flight run, so the same outbox batch
 *   is never uploaded twice in parallel;
 * - exponential backoff after a failed upload (1s, 2s, 4s ... capped at 5 min) so a
 *   failing server is not hammered every 5 s by the heartbeat.
 */
let inFlightSync: Promise<SyncResult> | null = null;
let consecutiveFailures = 0;
let nextAttemptAt = 0;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function registerFailure(): void {
  consecutiveFailures += 1;
  const delay = Math.min(1000 * 2 ** (consecutiveFailures - 1), MAX_BACKOFF_MS);
  nextAttemptAt = Date.now() + delay;
}

function registerSuccess(): void {
  consecutiveFailures = 0;
  nextAttemptAt = 0;
}

export class SyncApi {
  /**
   * Register a newly created ANM QR session with the backend so ASHA workers can transfer records live
   */
  static async registerAnmSession(
    title: string,
    category: string,
    qrCode: string,
    anmPhone: string = '9876543211'
  ): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/anm/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ANM-Phone': anmPhone,
          ...NGROK_HEADERS, ...authHeader(),
        },
        body: JSON.stringify({ title, category, qrCode }),
      });
      return res.ok;
    } catch (e) {
      console.warn('Could not register ANM session with backend:', e);
      return false;
    }
  }

  static async getAnmIncomingData(anmPhone: string = '9876543211'): Promise<any[]> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/anm/data?section=ALL`, {
        headers: { 'X-ANM-Phone': anmPhone, ...NGROK_HEADERS, ...authHeader() },
      });
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  }

  /** ASHAs assigned to the signed-in ANM. Throws on network/HTTP failure so callers can show a retry state. */
  static async getAnmAshas(): Promise<AnmAshaWorker[]> {
    const res = await fetch(`${BACKEND_BASE_URL}/api/anm/ashas`, { headers: { ...NGROK_HEADERS, ...authHeader() } });
    if (!res.ok) throw new Error(`ashas ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  /** All forms an ASHA has sent to ANM (newest first). Throws on failure. */
  static async getAnmAshaForms(ashaPhone: string): Promise<AnmSurveyForm[]> {
    const res = await fetch(`${BACKEND_BASE_URL}/api/anm/data/${encodeURIComponent(ashaPhone)}/forms`, {
      headers: { ...NGROK_HEADERS, ...authHeader() },
    });
    if (!res.ok) throw new Error(`forms ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Workers in the signed-in CHO's sector with live activity counts.
   * A CHO with no registered workers yet gets 403 NO_SECTOR, which is returned as an empty list.
   * Throws on network/other HTTP failure so callers can show a retry state.
   */
  static async getChoSectorWorkers(): Promise<ChoSectorWorker[]> {
    const res = await fetch(`${BACKEND_BASE_URL}/api/asha/cho/workers`, { headers: { ...NGROK_HEADERS, ...authHeader() } });
    if (res.status === 403) {
      const body = await res.json().catch(() => null);
      if (body && body.error === 'NO_SECTOR') return [];
      throw new Error('cho workers 403');
    }
    if (!res.ok) throw new Error(`cho workers ${res.status}`);
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((w: any) => ({
          ...w,
          familyCount: Number(w.familyCount) || 0,
          surveyCount: Number(w.surveyCount) || 0,
          referralCount: Number(w.referralCount) || 0,
          pendingReferralCount: Number(w.pendingReferralCount) || 0,
        }))
      : [];
  }

  /**
   * Check if backend cloud server is reachable (internet connectivity check)
   */
  static async pingServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${BACKEND_BASE_URL}/actuator/health`, {
        method: 'GET',
        headers: { 'X-ASHA-Phone': getStorageWorkerPhone(), ...NGROK_HEADERS, ...authHeader() },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.status >= 200 && res.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Uploads all pending local outbox records to backend, and downloads remote referral updates.
   * If offline or unreachable, ensures data remains safely persisted in outbox.
   */
  static async syncOutbox(
    ashaPhone: string = getStorageWorkerPhone(),
    sectionFilter: string = 'CHILD_VAX',
    options: { lang?: SyncLang; force?: boolean; role?: string } = {}
  ): Promise<SyncResult> {
    const lang = options.lang || 'hi';
    const role = options.role || 'ASHA';
    if (inFlightSync) return inFlightSync;

    if (!options.force && Date.now() < nextAttemptAt) {
      const pending = await OfflineStorageService.getPendingOutbox();
      return {
        success: false,
        mode: 'OFFLINE_QUEUED',
        message: msg(lang, `${pending.length} रिकॉर्ड सुरक्षित, पुनः प्रयास शीघ्र`, `${pending.length} नोंदी सुरक्षित, लवकरच पुन्हा प्रयत्न`),
        syncedCount: 0,
      };
    }

    inFlightSync = this.runSyncOutbox(ashaPhone, sectionFilter, lang, role).finally(() => {
      inFlightSync = null;
    });
    return inFlightSync;
  }

  /** True while an outbox sync is running (lets callers skip redundant triggers). */
  static isSyncInFlight(): boolean {
    return inFlightSync !== null;
  }

  private static async runSyncOutbox(
    ashaPhone: string,
    sectionFilter: string,
    lang: SyncLang,
    role: string
  ): Promise<SyncResult> {
    const isOnline = await this.pingServer();

    if (!isOnline) {
      const pendingItems = await OfflineStorageService.getPendingOutbox();
      const qrPayload = await OfflineStorageService.exportClusterDataJson(sectionFilter);
      return {
        success: true,
        mode: 'OFFLINE_QUEUED',
        message: msg(
          lang,
          `ऑफलाइन: ${pendingItems.length} रिकॉर्ड सुरक्षित। नेटवर्क मिलते ही अपने आप सिंक होंगे।`,
          `ऑफलाइन: ${pendingItems.length} नोंदी सुरक्षित. नेटवर्क मिळताच आपोआप सिंक होतील.`
        ),
        syncedCount: pendingItems.length,
        qrPayload,
      };
    }

    try {
      const pendingItems = await OfflineStorageService.getPendingOutbox();

      // 1. UPLOAD ALL PENDING LOCAL CHANGES TO CLOUD (sync contract v2, per-record acks)
      let uploadedOk = 0;
      let failedCount = 0;
      let retryCount = 0;
      let authRejected = false;
      if (pendingItems.length > 0) {
        const [famList, memList, taskList, vaxList] = await Promise.all([
          OfflineStorageService.getFamilies(),
          OfflineStorageService.getMembers(),
          OfflineStorageService.getFollowUps(),
          OfflineStorageService.getChildVaccinations(),
        ]);
        const built = buildUploadPayload(pendingItems, {
          families: famList,
          members: memList,
          followUps: taskList,
          vaccinations: vaxList,
        });

        const outcomes: OutboxOutcome[] = built.unsupportedIds.map((id) => ({
          id,
          outcome: 'FAILED' as const,
          error: 'UNSUPPORTED_ACTION',
        }));

        if (built.uploadedIds.length > 0) {
          const uploadRes = await fetch(`${BACKEND_BASE_URL}/api/sync/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-ASHA-Phone': ashaPhone,
              ...NGROK_HEADERS, ...authHeader(),
            },
            body: JSON.stringify(built.body),
          });

          let ack: { results?: SyncRecordResult[]; rejected?: number } | null = null;
          if (uploadRes.ok) {
            try {
              ack = await uploadRes.json();
            } catch {
              ack = { rejected: 0 }; // Empty 2xx body from a v1 server: treat as fully accepted.
            }
          }
          if (uploadRes.status === 401 || uploadRes.status === 403) authRejected = true;
          // Non-2xx → ack stays null → every uploaded item is retried (server upserts are idempotent).
          outcomes.push(...planOutcomes(pendingItems, built.uploadedIds, ack));
          if (ack?.results) {
            await OfflineStorageService.applyServerIds(collectServerIds(ack.results));
          }
        }

        // ANM dispatch has its own endpoint; only retire the item when the server confirms it.
        for (const anmItem of built.anmSends) {
          let ok = false;
          try {
            const res = await fetch(`${BACKEND_BASE_URL}/api/sync/send-to-anm`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-ASHA-Phone': ashaPhone,
                ...NGROK_HEADERS, ...authHeader(),
              },
              body: JSON.stringify({
                section: anmItem.payload?.sectionFilter || 'ALL',
                anmIdentifier: parseQrIdentifier(anmItem.payload?.anmPhoneOrCode || 'ANM-CHANDPUR-01') || 'ANM-CHANDPUR-01',
              }),
            });
            ok = res.ok;
          } catch (anmErr) {
            console.warn('ANM remote sync note:', anmErr);
          }
          outcomes.push(ok ? { id: anmItem.id, outcome: 'SYNCED' } : { id: anmItem.id, outcome: 'RETRY', error: 'ANM_SEND_FAILED' });
        }

        // CHO sector validations (physical referral triage / transport sign-off).
        for (const approval of built.choApprovals) {
          let outcome: OutboxOutcome;
          try {
            const res = await fetch(`${BACKEND_BASE_URL}/api/asha/referrals/${approval.payload.serverTaskId}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-ASHA-Phone': ashaPhone, ...NGROK_HEADERS, ...authHeader() },
              body: JSON.stringify({ note: approval.payload.note || null }),
            });
            outcome = res.ok
              ? { id: approval.id, outcome: 'SYNCED' }
              : res.status === 404 || res.status === 403
              ? { id: approval.id, outcome: 'FAILED', error: res.status === 404 ? 'NOT_IN_SECTOR' : 'NO_SECTOR' }
              : { id: approval.id, outcome: 'RETRY', error: 'HTTP_' + res.status };
          } catch {
            outcome = { id: approval.id, outcome: 'RETRY', error: 'NETWORK' };
          }
          outcomes.push(outcome);
        }

        await OfflineStorageService.applyOutboxOutcomes(outcomes);
        uploadedOk = outcomes.filter((o) => o.outcome === 'SYNCED').length;
        failedCount = outcomes.filter((o) => o.outcome === 'FAILED').length;
        retryCount = outcomes.filter((o) => o.outcome === 'RETRY').length;

        if (authRejected) {
          registerFailure();
          return {
            success: false,
            mode: 'OFFLINE_QUEUED',
            message: msg(
              lang,
              `सत्र समाप्त — पुनः लॉगिन करें। ${retryCount} रिकॉर्ड फोन में सुरक्षित हैं।`,
              `सत्र संपले — पुन्हा लॉगिन करा. ${retryCount} नोंदी फोनमध्ये सुरक्षित आहेत.`
            ),
            syncedCount: 0,
          };
        }

        if (retryCount > 0 && uploadedOk === 0) {
          registerFailure();
          return {
            success: false,
            mode: 'OFFLINE_QUEUED',
            message: msg(
              lang,
              `सर्वर ने अपलोड स्वीकार नहीं किया। ${retryCount} रिकॉर्ड सुरक्षित हैं, पुनः प्रयास होगा।`,
              `सर्व्हरने अपलोड स्वीकारला नाही. ${retryCount} नोंदी सुरक्षित आहेत, पुन्हा प्रयत्न होईल.`
            ),
            syncedCount: 0,
          };
        }
      }

      // 2. DOWNLOAD REMOTE REFERRAL & PATIENT UPDATES
      let newReferralsCount = 0;
      try {
        const downloadRes = await fetch(
          `${BACKEND_BASE_URL}/api/sync/download?since=1970-01-01T00:00:00Z`,
          {
            headers: { 'X-ASHA-Phone': ashaPhone, ...NGROK_HEADERS, ...authHeader() },
          }
        );

        if (downloadRes.ok) {
          const remoteData = await downloadRes.json();

          // 🌟 Rehydrate & merge remote families, members, and tombstones into local storage
          if ((remoteData.families && Array.isArray(remoteData.families)) || (remoteData.members && Array.isArray(remoteData.members))) {
            await OfflineStorageService.mergeRemoteLedger(
              remoteData.families || [],
              remoteData.members || [],
              [...(remoteData.deletedFamilyIds || []), ...(remoteData.deletedFamilyClientUuids || [])],
              [...(remoteData.deletedMemberIds || []), ...(remoteData.deletedMemberClientUuids || [])]
            );
          }

          if (remoteData.followUps && Array.isArray(remoteData.followUps)) {
            await OfflineStorageService.applyRemoteFollowUpStatus(remoteData.followUps);
            for (const remTask of remoteData.followUps) {
              if (remTask.taskType === 'REFERRAL_MISSED' && remTask.status === 'PENDING') {
                const days = remTask.title?.includes('15')
                  ? 15
                  : remTask.title?.includes('30')
                  ? 30
                  : 7;

                if (remTask.id == null || remTask.houseNumber == null) continue;
                const sourceReferralId = `remote-${remTask.id}`;
                const existingTasks = await OfflineStorageService.getFollowUps();
                if (existingTasks.some((t) => String(t.sourceReferralId) === sourceReferralId)) continue;

                await OfflineStorageService.ingestMissedReferral({
                  memberName: remTask.memberName || msg(lang, 'लाभार्थी', 'लाभार्थी'),
                  houseNumber: remTask.houseNumber,
                  daysOverdue: days,
                  referralReason: remTask.title || msg(lang, 'अस्पताल रेफरल फॉलो-अप', 'रुग्णालय संदर्भ पाठपुरावा'),
                  sourceReferralId,
                });
                newReferralsCount++;
              }
            }
          }
        }
      } catch (dlErr) {
        console.warn('Could not complete download sync:', dlErr);
      }

      // CHO: refresh sector referrals from every ASHA in the sector.
      if (role === 'CHO') {
        try {
          const res = await fetch(`${BACKEND_BASE_URL}/api/asha/cho/referrals?scope=all`, {
            headers: { 'X-ASHA-Phone': ashaPhone, ...NGROK_HEADERS, ...authHeader() },
          });
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows)) await OfflineStorageService.mergeChoSectorReferrals(rows);
          }
        } catch (choErr) {
          console.warn('CHO sector referrals not refreshed:', choErr);
        }
      }

      if (retryCount > 0) registerFailure();
      else registerSuccess();
      const partsHi = [`सिंक सफल: ${uploadedOk} बदलाव भेजे।`];
      const partsMr = [`सिंक यशस्वी: ${uploadedOk} बदल पाठवले.`];
      if (retryCount > 0) {
        partsHi.push(`${retryCount} पुनः प्रयास में।`);
        partsMr.push(`${retryCount} पुन्हा प्रयत्नात.`);
      }
      if (failedCount > 0) {
        partsHi.push(`${failedCount} अस्वीकृत — जाँच आवश्यक।`);
        partsMr.push(`${failedCount} नाकारल्या — तपासणी आवश्यक.`);
      }
      if (newReferralsCount > 0) {
        partsHi.push(`${newReferralsCount} नए रेफरल मिले।`);
        partsMr.push(`${newReferralsCount} नवीन संदर्भ मिळाले.`);
      }
      return {
        success: failedCount === 0 && retryCount === 0,
        mode: 'ONLINE_SYNCED',
        message: msg(lang, partsHi.join(' '), partsMr.join(' ')),
        syncedCount: uploadedOk,
        downloadedTasksCount: newReferralsCount,
      };
    } catch (err: any) {
      console.warn('Sync interrupted:', err?.message);
      registerFailure();
      return {
        success: false,
        mode: 'OFFLINE_QUEUED',
        message: msg(lang, 'सिंक बाधित। डेटा फोन में सुरक्षित है।', 'सिंक खंडित. डेटा फोनमध्ये सुरक्षित आहे.'),
        syncedCount: 0,
      };
    }
  }

  /**
   * Simulates an incoming missed referral from the hospital system (e.g. 7 days or 15 days missed)
   * Connects to backend if online, or immediately updates local storage and family matrix dots!
   */
  static async simulateMissedReferral(params: {
    daysOverdue: number; // 7, 15, or 30
    houseNumber: number | string;
    referralReason: string;
    memberName: string;
  }): Promise<{ task: any; family: any; syncedOnline: boolean }> {
    let syncedOnline = false;
    const isOnline = await this.pingServer();

    if (isOnline) {
      try {
        const res = await fetch(
          `${BACKEND_BASE_URL}/api/followups/simulate-missed-referral?daysOverdue=${params.daysOverdue}&houseNumber=${params.houseNumber}&referralReason=${encodeURIComponent(
            params.referralReason
          )}`,
          {
            method: 'POST',
            headers: { 'X-ASHA-Phone': getStorageWorkerPhone(), ...NGROK_HEADERS, ...authHeader() },
          }
        );
        if (res.ok) {
          syncedOnline = true;
        }
      } catch (e) {
        console.warn('Backend call failed, applying locally:', e);
      }
    }

    // Always update local storage so changes immediately reflect on mobile UI
    const localResult = await OfflineStorageService.ingestMissedReferral({
      memberName: params.memberName,
      houseNumber: params.houseNumber,
      daysOverdue: params.daysOverdue,
      referralReason: params.referralReason,
    });

    return {
      ...localResult,
      syncedOnline,
    };
  }

  /**
   * Sends designated category surveys to ANM (either via backend or locally marks them)
   */
  static async sendDataToAnm(
    sectionFilter: string = 'ALL',
    anmPhoneOrCode: string,
    ashaPhone: string = getStorageWorkerPhone()
  ): Promise<SyncResult> {
    const isOnline = await this.pingServer();

    if (isOnline) {
      try {
        const res = await fetch(
          `${BACKEND_BASE_URL}/api/sync/send-to-anm`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-ASHA-Phone': ashaPhone,
              ...NGROK_HEADERS, ...authHeader(),
            },
            body: JSON.stringify({
              section: sectionFilter,
              anmIdentifier: parseQrIdentifier(anmPhoneOrCode) || anmPhoneOrCode,
            }),
          }
        );
        if (res.status === 422) {
          // Server could not match the code to an ANM and this ASHA has no assigned ANM: nothing is sent.
          return {
            success: false,
            mode: 'ONLINE_SYNCED',
            message: 'ANM_NOT_FOUND',
            syncedCount: 0,
          };
        }
        if (res.ok) {
          const sentCount = await OfflineStorageService.markSurveysSyncedToAnm(anmPhoneOrCode, sectionFilter);
          return {
            success: true,
            mode: 'ONLINE_SYNCED',
            message: `Sent to ANM ${anmPhoneOrCode} via server.`,
            syncedCount: sentCount,
          };
        }
      } catch {
        // Fall back to local queue
      }
    }

    // Offline direct send (marks local surveys synced)
    const count = await OfflineStorageService.markSurveysSyncedToAnm(anmPhoneOrCode, sectionFilter);
    await OfflineStorageService.addToOutbox('SEND_TO_ANM', {
      sectionFilter,
      anmPhoneOrCode,
      timestamp: new Date().toISOString(),
    });

    const qrPayload = await OfflineStorageService.exportClusterDataJson(sectionFilter);

    return {
      success: true,
      mode: 'QR_PREPARED',
      message: `Offline Sync: ${count} survey forms marked sent to ANM ${anmPhoneOrCode}.`,
      syncedCount: count,
      qrPayload,
    };
  }
}
