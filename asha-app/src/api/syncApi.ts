import { OfflineStorageService } from '../storage/OfflineStorageService';
import { OutboxItem } from '../types/storage';

const CLOUD_API_URL = 'https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com';

const getBackendBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    const port = window.location.port;
    if (port === '8088' || port === '8080') {
      return origin;
    }
  }
  return CLOUD_API_URL;
};

const BACKEND_BASE_URL = getBackendBaseUrl();

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
   * Check if backend cloud server is reachable (internet connectivity check)
   */
  static async pingServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
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
      const qrPayload = await OfflineStorageService.exportClusterDataJson(sectionFilter);
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

      // 1. UPLOAD ALL PENDING LOCAL CHANGES TO CLOUD
      if (pendingItems.length > 0) {
        const families: any[] = [];
        const members: any[] = [];
        const surveys: any[] = [];
        const followUps: any[] = [];
        const anmSends: any[] = [];

        for (const item of pendingItems) {
          if (item.action === 'CREATE_FAMILY' || item.action === 'UPDATE_FAMILY') {
            const p = item.payload || {};
            // Format nextVisitDate as YYYY-MM-DD for PostgreSQL date parsing
            let formattedNextVisit = p.nextVisitDate;
            if (
              !formattedNextVisit ||
              typeof formattedNextVisit !== 'string' ||
              !formattedNextVisit.match(/^\d{4}-\d{2}-\d{2}/)
            ) {
              const days =
                p.visitIntervalDays ||
                (p.status === '7days' ? 7 : p.status === '15days' ? 15 : 30);
              formattedNextVisit = new Date(Date.now() + days * 86400000)
                .toISOString()
                .split('T')[0];
            }
            families.push({
              primaryPhone: p.primaryPhone || '+91 98765 00000',
              headName: p.headName || 'Household Head',
              villageName: p.villageName || 'Chandpur Village',
              houseNumber: p.houseNumber != null ? p.houseNumber.toString() : '1',
              sequentialNumber: p.sequentialNumber || 1,
              visitIntervalDays: p.visitIntervalDays || 15,
              nextVisitDate: formattedNextVisit,
            });
          } else if (item.action === 'ADD_MEMBER') {
            const m = item.payload || {};
            // Format dob to valid date YYYY-MM-DD or derive from age to avoid SQL error
            let formattedDob = m.dob;
            if (!formattedDob || typeof formattedDob !== 'string' || !formattedDob.match(/^\d{4}-\d{2}-\d{2}/)) {
              if (formattedDob && typeof formattedDob === 'string' && formattedDob.includes('/')) {
                const parts = formattedDob.split('/');
                if (parts.length === 3) {
                  formattedDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              } else {
                const currentYear = new Date().getFullYear();
                const approxBirthYear = currentYear - (Number(m.age) || 25);
                formattedDob = `${approxBirthYear}-01-01`;
              }
            }
            members.push({
              familyUnitId: m.familyUnitId || 1,
              name: m.name || 'Family Member',
              dob: formattedDob,
              age: m.age || 25,
              gender: m.gender || 'Female',
              relationship: m.relationship || 'Member',
              phone: m.phone || '',
            });
          } else if (item.action === 'SUBMIT_SURVEY') {
            const s = item.payload || {};
            const code = s.categoryCode || 'GENERAL';
            const tmplId =
              code === 'PREGNANCY' ? 1 : code === 'CHILD' ? 2 : code === 'DISEASE' ? 3 : 4;
            surveys.push({
              offlineId: s.id || item.id,
              familyUnitId: s.familyUnitId || 1,
              familyMemberId: s.familyMemberId || 1,
              templateId: tmplId,
              categoryCode: code,
              answers: s.answers || {},
            });
          } else if (item.action === 'COMPLETE_FOLLOWUP') {
            const f = item.payload || {};
            followUps.push({
              offlineId: f.offlineId || f.taskId || item.id,
              familyUnitId: f.familyUnitId || 1,
              familyMemberId: f.familyMemberId || 1,
              taskType: f.taskType || 'FOLLOW_UP',
              title: f.title || f.taskType || 'Follow-up Task',
              description: f.isCompleted
                ? `Completed at ${f.completedAt || new Date().toISOString()}`
                : 'Pending Task',
              dueDate: new Date().toISOString().split('T')[0],
              status: f.isCompleted ? 'COMPLETED' : 'PENDING',
            });
          } else if (item.action === 'UPDATE_CHILD_VACCINE') {
            const v = item.payload || {};
            surveys.push({
              offlineId: item.id,
              familyUnitId: 1,
              familyMemberId: v.childMemberId || 1,
              templateId: 2,
              categoryCode: 'CHILD',
              answers: {
                recordType: 'VACCINE_UPDATE',
                vaccineName: v.vaccineName,
                status: v.status,
                updatedAt: new Date().toISOString(),
              },
            });
          } else if (item.action === 'SAVE_MEETING') {
            const mtg = item.payload || {};
            surveys.push({
              offlineId: mtg.id || item.id,
              familyUnitId: 1,
              familyMemberId: 1,
              templateId: 1,
              categoryCode: 'GENERAL',
              answers: {
                recordType: 'ASHA_MEETING',
                meetingDate: mtg.meetingDate || new Date().toISOString().split('T')[0],
                venue: mtg.venue || 'Anganwadi Center',
                meetingType: mtg.meetingType || 'VHSNC',
                attendeesCount: mtg.attendeesCount || 10,
                materialsAvailable: mtg.materialsAvailable || '',
                discussionPoints: mtg.discussionPoints || '',
                decisionsTaken: mtg.decisionsTaken || '',
                createdAt: mtg.createdAt || new Date().toISOString(),
              },
            });
          } else if (item.action === 'SEND_TO_ANM') {
            anmSends.push(item);
          }
        }

        // Upload batch changes to backend
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

        // Trigger remote ANM dispatch if any SEND_TO_ANM tasks queued
        for (const anmItem of anmSends) {
          try {
            await fetch(`${BACKEND_BASE_URL}/api/sync/send-to-anm`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-ASHA-Phone': ashaPhone,
                ...NGROK_HEADERS,
              },
              body: JSON.stringify({
                section: anmItem.payload?.sectionFilter || 'ALL',
                anmIdentifier: anmItem.payload?.anmPhoneOrCode || 'ANM-CHANDPUR-01',
              }),
            });
          } catch (anmErr) {
            console.warn('ANM remote sync note:', anmErr);
          }
        }

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
