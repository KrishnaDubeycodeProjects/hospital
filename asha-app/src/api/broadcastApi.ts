/**
 * NHM broadcasts (CHO / NHM → ASHA & ANM).
 * The inbox is cached per worker so messages can be read (and listened to) with no signal;
 * "read" / "done" marks made offline are queued and replayed on the next successful refresh.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authHeader } from './authSession';
import { BACKEND_BASE_URL } from './syncApi';
import { getStorageWorkerPhone } from '../storage/OfflineStorageService';

export type BroadcastPriority = 'NORMAL' | 'URGENT';
export type BroadcastAudience = 'ALL' | 'ASHA' | 'ANM';

export interface Broadcast {
  id: number;
  title: string;
  message: string;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  dueDate?: string | null;
  createdAt: string;
  senderRole: 'CHO' | 'ADMIN';
  senderName?: string | null;
  readAt?: string | null;
  doneAt?: string | null;
}

export interface SentBroadcast {
  id: number;
  title: string;
  message: string;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  dueDate?: string | null;
  createdAt: string;
  readCount: number;
  doneCount: number;
}

const HEADERS = { 'ngrok-skip-browser-warning': '1' };
const phoneKey = () => (getStorageWorkerPhone() || 'general').replace(/[^0-9]/g, '').slice(-10) || 'general';
const inboxKey = () => `@nhm_broadcast_inbox_${phoneKey()}_v1`;
const pendingKey = () => `@nhm_broadcast_pending_acks_${phoneKey()}_v1`;

type PendingAck = { id: number; done: boolean };

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Apply queued local marks on top of server rows (so a mark made offline never "un-does" itself). */
function withPending(rows: Broadcast[], pending: PendingAck[]): Broadcast[] {
  if (pending.length === 0) return rows;
  const now = new Date().toISOString();
  return rows.map((b) => {
    const marks = pending.filter((p) => p.id === b.id);
    if (marks.length === 0) return b;
    const done = marks.some((m) => m.done);
    return { ...b, readAt: b.readAt || now, doneAt: done ? b.doneAt || now : b.doneAt };
  });
}

async function postAck(id: number, done: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/asha/broadcasts/${id}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS, ...authHeader() },
      body: JSON.stringify({ done }),
    });
    // 404: withdrawn / not for me any more — drop the queued mark.
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function flushPending(): Promise<void> {
  const pending = await readJson<PendingAck[]>(pendingKey(), []);
  if (pending.length === 0) return;
  const left: PendingAck[] = [];
  for (const p of pending) if (!(await postAck(p.id, p.done))) left.push(p);
  await AsyncStorage.setItem(pendingKey(), JSON.stringify(left));
}

export const BroadcastApi = {
  /** Cached inbox (instant, works offline). */
  async cachedInbox(): Promise<Broadcast[]> {
    const rows = await readJson<Broadcast[]>(inboxKey(), []);
    return withPending(rows, await readJson<PendingAck[]>(pendingKey(), []));
  },

  /** Replays offline marks, then fetches the inbox. Falls back to the cache when offline. */
  async refreshInbox(): Promise<{ rows: Broadcast[]; online: boolean }> {
    try {
      await flushPending();
      const res = await fetch(`${BACKEND_BASE_URL}/api/asha/broadcasts/inbox`, { headers: { ...HEADERS, ...authHeader() } });
      if (!res.ok) throw new Error(`inbox ${res.status}`);
      const data = await res.json();
      const rows: Broadcast[] = Array.isArray(data) ? data : [];
      await AsyncStorage.setItem(inboxKey(), JSON.stringify(rows));
      return { rows: withPending(rows, await readJson<PendingAck[]>(pendingKey(), [])), online: true };
    } catch {
      return { rows: await BroadcastApi.cachedInbox(), online: false };
    }
  },

  /** Mark read / done: updates the cache immediately, sends now or queues for later. */
  async acknowledge(id: number, done: boolean): Promise<void> {
    const now = new Date().toISOString();
    const rows = await readJson<Broadcast[]>(inboxKey(), []);
    await AsyncStorage.setItem(
      inboxKey(),
      JSON.stringify(rows.map((b) => (b.id === id ? { ...b, readAt: b.readAt || now, doneAt: done ? b.doneAt || now : b.doneAt } : b)))
    );
    if (!(await postAck(id, done))) {
      const pending = await readJson<PendingAck[]>(pendingKey(), []);
      pending.push({ id, done });
      await AsyncStorage.setItem(pendingKey(), JSON.stringify(pending));
    }
  },

  // ---- CHO side (needs signal: broadcasts are delivered through the server) ----
  async send(input: {
    title: string;
    message: string;
    priority: BroadcastPriority;
    audience: BroadcastAudience;
    dueDate?: string | null; // YYYY-MM-DD
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/asha/cho/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...HEADERS, ...authHeader() },
        body: JSON.stringify(input),
      });
      if (res.ok) return { ok: true };
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error || `HTTP_${res.status}` };
    } catch {
      return { ok: false, error: 'OFFLINE' };
    }
  },

  async sent(): Promise<SentBroadcast[]> {
    const res = await fetch(`${BACKEND_BASE_URL}/api/asha/cho/broadcasts`, { headers: { ...HEADERS, ...authHeader() } });
    if (!res.ok) throw new Error(`sent ${res.status}`);
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((b: any) => ({ ...b, readCount: Number(b.readCount) || 0, doneCount: Number(b.doneCount) || 0 }))
      : [];
  },

  async withdraw(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/asha/cho/broadcasts/${id}/withdraw`, {
        method: 'POST',
        headers: { ...HEADERS, ...authHeader() },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
