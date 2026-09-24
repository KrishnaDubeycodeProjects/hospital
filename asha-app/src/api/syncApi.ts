import { OfflineStorageService } from '../storage/OfflineStorageService';
import { OutboxItem } from '../types/storage';

const isRunningOnFrontendDevServer =
  typeof window !== 'undefined' &&
  (window.location?.port === '8081' || window.location?.port === '19006');

const BACKEND_BASE_URL =
  typeof window !== 'undefined' &&
  window.location?.origin &&
  window.location.origin.startsWith('http') &&
  !isRunningOnFrontendDevServer
    ? window.location.origin
    : 'https://decency-immovable-synopsis.ngrok-free.dev';

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

export class SyncApi {
  /**
   * Check if backend server on port 8089 is reachable (internet connectivity check)
   */
  static async pingServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BACKEND_BASE_URL}/api/asha/me`, {
        method: 'GET',
        headers: { 'X-ASHA-Phone': '9876543210', ...NGROK_HEADERS },
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
  static async syncOutbox(ashaPhone: string = '9876543210'): Promise<SyncResult> {
    const isOnline = await this.pingServer();

    if (!isOnline) {
      const pendingItems = await OfflineStorageService.getPendingOutbox();
      const qrPayload = await OfflineStorageService.exportLocalDataJson();
      return {
        success: true,
        mode: 'OFFLINE_QUEUED',
        message: `Offline mode: ${pendingItems.length} records safely stored locally. Ready for QR transmission or auto-sync when online.`,
        syncedCount: pendingItems.length,
        qrPayload,
      };
    }

    try {
      const pendingItems = await OfflineStorageService.getPendingOutbox();

      // 1. UPLOAD PENDING LOCAL CHANGES
      if (pendingItems.length > 0) {
        const families: any[] = [];
        const members: any[] = [];
        const surveys: any[] = [];
        const followUps: any[] = [];

        for (const item of pendingItems) {
          if (item.action === 'CREATE_FAMILY' || item.action === 'UPDATE_FAMILY') {
            families.push(item.payload);
          } else if (item.action === 'ADD_MEMBER') {
            members.push(item.payload);
          } else if (item.action === 'SUBMIT_SURVEY') {
            surveys.push(item.payload);
          } else if (item.action === 'COMPLETE_FOLLOWUP') {
            followUps.push(item.payload);
          }
        }

        const uploadRes = await fetch(`${BACKEND_BASE_URL}/api/sync/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-ASHA-Phone': ashaPhone,
            ...NGROK_HEADERS,
          },
          body: JSON.stringify({
            families,
            members,
            surveys,
            followUps,
          }),
        });

        if (uploadRes.ok) {
          const itemIds = pendingItems.map((i) => i.id);
          await OfflineStorageService.markOutboxSynced(itemIds);
        }
      }

      // 2. DOWNLOAD REMOTE REFERRAL & PATIENT UPDATES
      let newReferralsCount = 0;
      try {
        const downloadRes = await fetch(
          `${BACKEND_BASE_URL}/api/sync/download?since=1970-01-01T00:00:00Z`,
          {
            headers: { 'X-ASHA-Phone': ashaPhone, ...NGROK_HEADERS },
          }
        );

        if (downloadRes.ok) {
          const remoteData = await downloadRes.json();
          if (remoteData.followUps && Array.isArray(remoteData.followUps)) {
            for (const remTask of remoteData.followUps) {
              if (remTask.taskType === 'REFERRAL_MISSED' && remTask.status === 'PENDING') {
                const days = remTask.title?.includes('15')
                  ? 15
                  : remTask.title?.includes('30')
                  ? 30
                  : 7;

                await OfflineStorageService.ingestMissedReferral({
                  memberName: remTask.memberName || 'Beneficiary',
                  houseNumber: remTask.houseNumber || 12,
                  daysOverdue: days,
                  referralReason: remTask.title || 'Hospital Referral Follow-up',
                });
                newReferralsCount++;
              }
            }
          }
        }
      } catch (dlErr) {
        console.warn('Could not complete download sync:', dlErr);
      }

      return {
        success: true,
        mode: 'ONLINE_SYNCED',
        message: `Online Sync Complete! Uploaded ${pendingItems.length} changes. ${
          newReferralsCount > 0
            ? `Received ${newReferralsCount} missed referral patients from hospital.`
            : 'All patient records up-to-date.'
        }`,
        syncedCount: pendingItems.length,
        downloadedTasksCount: newReferralsCount,
      };
    } catch (err: any) {
      return {
        success: false,
        mode: 'OFFLINE_QUEUED',
        message: `Sync interrupted: ${err.message}. Data preserved locally.`,
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
            headers: { 'X-ASHA-Phone': '9876543210', ...NGROK_HEADERS },
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
    anmPhoneOrCode: string = 'ANM-CHANDPUR-01'
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
              'X-ASHA-Phone': '9876543210',
              ...NGROK_HEADERS,
            },
            body: JSON.stringify({
              section: sectionFilter,
              anmIdentifier: anmPhoneOrCode,
            }),
          }
        );
        if (res.ok) {
          const sentCount = await OfflineStorageService.markSurveysSyncedToAnm(anmPhoneOrCode);
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
    const count = await OfflineStorageService.markSurveysSyncedToAnm(anmPhoneOrCode);
    await OfflineStorageService.addToOutbox('SEND_TO_ANM', {
      sectionFilter,
      anmPhoneOrCode,
      timestamp: new Date().toISOString(),
    });

    const qrPayload = await OfflineStorageService.exportLocalDataJson();

    return {
      success: true,
      mode: 'QR_PREPARED',
      message: `Offline Sync: ${count} survey forms marked sent to ANM ${anmPhoneOrCode}.`,
      syncedCount: count,
      qrPayload,
    };
  }
}
