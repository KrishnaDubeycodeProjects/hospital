/**
 * Language-pack gate for voice features (Hindi `hi-IN`, Marathi `mr-IN`, English `en-IN`).
 *
 * Speech-to-text and text-to-speech must not fail in the field:
 *  - STT: on-device recognizer model (Android 13+, Google on-device speech service).
 *  - TTS: installed Hindi/Marathi voice in the system TTS engine.
 *
 * STT model state is kept in a small observable store so the UI can:
 *  - ask the worker to download the pack for *their selected language* (never silently),
 *  - show live download status (banner) until the model is confirmed installed,
 *  - keep the mic blocked while the download is still running.
 */
import { Linking, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/** Legacy coarse status (kept for older call sites). */
export type PackStatus = 'ready' | 'missing' | 'downloading' | 'unknown';

/**
 * - checking:    not probed yet
 * - ready:       model installed, on-device dictation works offline
 * - missing:     model can be downloaded but is not on the phone
 * - downloading: download started (system dialog on Android 13, background on 14+)
 * - scheduled:   Android queued the download for later (usually waits for Wi-Fi)
 * - failed:      the download reported an error
 * - unsupported: no on-device model API (Android ≤ 12, web, no Google speech service) →
 *                dictation keeps using the normal (online) recognizer, nothing to download
 */
export type VoicePackState = 'checking' | 'ready' | 'missing' | 'downloading' | 'scheduled' | 'failed' | 'unsupported';

const norm = (l: string) => l.replace('_', '-').toLowerCase();
const baseOf = (l: string) => norm(l).split('-')[0];

// ---------------------------------------------------------------------------
// STT model store
// ---------------------------------------------------------------------------

const states = new Map<string, VoicePackState>();
const listeners = new Set<() => void>();
const pollers = new Map<string, { timer: ReturnType<typeof setInterval>; startedAt: number }>();

const POLL_MS = 3000;
/** Give up watching an unfinished download after this long (state falls back to `missing`). */
const POLL_LIMIT_MS = 20 * 60 * 1000;

/**
 * Recognition services to ask for installed models. Devices differ: Pixels expose
 * "Android System Intelligence", many others only "Speech Services by Google".
 * `undefined` = the platform's default on-device recognizer.
 */
const SERVICE_CANDIDATES: (string | undefined)[] = [undefined, 'com.google.android.as', 'com.google.android.tts'];

function setState(key: string, next: VoicePackState) {
  if (states.get(key) === next) return;
  states.set(key, next);
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/** Current state for a locale (synchronous; `checking` until first probed). */
export function getVoicePackState(locale: string): VoicePackState {
  return states.get(norm(locale)) ?? 'checking';
}

/** Re-render hook point: called whenever any locale's state changes. */
export function subscribeVoicePacks(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function queryLocales(): Promise<{ installed: string[]; supported: string[] } | null> {
  for (const pkg of SERVICE_CANDIDATES) {
    try {
      const res = await ExpoSpeechRecognitionModule.getSupportedLocales(
        pkg ? { androidRecognitionServicePackage: pkg } : {}
      );
      const installed = (res.installedLocales || []).map(norm);
      const supported = (res.locales || []).map(norm);
      if (installed.length > 0 || supported.length > 0) return { installed, supported };
    } catch {
      // package not on this phone / service error → try the next one
    }
  }
  return null;
}

const listHas = (list: string[], key: string) => list.includes(key) || list.includes(baseOf(key));

async function probe(key: string): Promise<VoicePackState> {
  if (Platform.OS !== 'android') return 'unsupported';
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return 'unsupported';
  let onDevice = false;
  try {
    onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {}
  if (!onDevice) return 'unsupported';
  const locales = await queryLocales();
  if (!locales) return 'unsupported';
  if (listHas(locales.installed, key)) return 'ready';
  return 'missing';
}

function stopPoll(key: string) {
  const p = pollers.get(key);
  if (p) clearInterval(p.timer);
  pollers.delete(key);
}

/** While a download runs, re-check the installed list until the model shows up. */
function startPoll(key: string) {
  if (pollers.has(key)) return;
  const startedAt = Date.now();
  const timer = setInterval(async () => {
    const next = await probe(key).catch(() => 'missing' as VoicePackState);
    if (next === 'ready') {
      stopPoll(key);
      setState(key, 'ready');
      return;
    }
    if (Date.now() - startedAt > POLL_LIMIT_MS) {
      stopPoll(key);
      // Dialog dismissed / download never finished: let the worker try again.
      setState(key, 'missing');
    }
  }, POLL_MS);
  pollers.set(key, { timer, startedAt });
}

/** Probe the device and update the store. Never triggers a download. */
export async function refreshVoicePack(locale: string): Promise<VoicePackState> {
  const key = norm(locale);
  const before = states.get(key);
  const next = await probe(key).catch(() => 'unsupported' as VoicePackState);
  // A running download is only overridden by a confirmed install.
  if ((before === 'downloading' || before === 'scheduled') && next !== 'ready') return before;
  if (next === 'ready') stopPoll(key);
  setState(key, next);
  return next;
}

/**
 * Start downloading the STT model for one locale (call only after the worker agreed).
 * Resolves quickly with the new state; progress continues in the store.
 */
export async function downloadVoicePack(locale: string): Promise<VoicePackState> {
  const key = norm(locale);
  const now = await refreshVoicePack(key);
  if (now === 'ready' || now === 'unsupported' || now === 'downloading' || now === 'scheduled') return now;

  setState(key, 'downloading');
  startPoll(key);

  // Android 14+ resolves only when the download finishes; don't hold callers on it.
  ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: key })
    .then((res) => {
      if (res.status === 'download_success') {
        stopPoll(key);
        setState(key, 'ready');
      } else if (res.status === 'download_canceled') {
        // Native maps Android's "onScheduled" to this: it will download later (e.g. on Wi-Fi).
        setState(key, 'scheduled');
      }
      // 'opened_dialog' (Android 13): the poll confirms when the model is installed.
    })
    .catch((e: any) => {
      const code = String(e?.code || e?.message || '');
      if (/download_in_progress/i.test(code)) return; // a download is already running; keep polling
      stopPoll(key);
      setState(key, /not_supported/i.test(code) ? 'unsupported' : 'failed');
    });

  return 'downloading';
}

// ---- legacy wrappers ------------------------------------------------------

/** Current STT model state for a locale, without triggering a download. */
export async function sttStatus(locale: string): Promise<PackStatus> {
  const s = await refreshVoicePack(locale);
  return s === 'ready' ? 'ready' : s === 'downloading' || s === 'scheduled' ? 'downloading' : s === 'missing' || s === 'failed' ? 'missing' : 'unknown';
}

/** Kept for compatibility: no longer downloads silently — use downloadVoicePack after asking. */
export async function ensureSttModel(locale: string): Promise<PackStatus> {
  return sttStatus(locale);
}

// ---------------------------------------------------------------------------
// TTS voices
// ---------------------------------------------------------------------------

const ttsVoice = new Map<string, string | null>(); // locale -> voice identifier
let ttsInstallPrompted = false;

/** Best installed TTS voice for the locale (offline `-local` voices first), or null. */
async function findTtsVoice(locale: string): Promise<string | null | undefined> {
  const key = norm(locale);
  if (ttsVoice.has(key) && ttsVoice.get(key)) return ttsVoice.get(key);
  let voices: Speech.Voice[] = [];
  try {
    voices = await Speech.getAvailableVoicesAsync();
  } catch {
    return undefined;
  }
  if (!voices || voices.length === 0) return undefined;
  const base = baseOf(key);
  const matches = voices.filter((v) => v.language && (norm(v.language) === key || baseOf(v.language) === base));
  const local = matches.find((v) => /local/i.test(v.identifier || '')) || matches.find((v) => !/network/i.test(v.identifier || ''));
  const chosen = (local || matches[0])?.identifier ?? null;
  ttsVoice.set(key, chosen);
  return chosen;
}

/**
 * Makes sure a TTS voice for the locale is installed. When none is, opens the system
 * "install voice data" screen.
 */
export async function ensureTtsVoice(locale: string): Promise<{ status: PackStatus; voice?: string }> {
  if (Platform.OS === 'web') return { status: 'unknown' };
  const voice = await findTtsVoice(locale);
  if (voice === undefined) return { status: 'unknown' };
  if (voice) return { status: 'ready', voice };
  if (Platform.OS === 'android' && !ttsInstallPrompted) {
    ttsInstallPrompted = true;
    try {
      await Linking.sendIntent('android.speech.tts.engine.INSTALL_TTS_DATA');
    } catch {
      try {
        await Linking.sendIntent('com.android.settings.TTS_SETTINGS');
      } catch {}
    }
  }
  return { status: 'missing' };
}

/** Clears cached TTS results (e.g. after the worker returns from the voice installer). */
export function refreshVoiceCache(): void {
  ttsVoice.clear();
}

// ---------------------------------------------------------------------------
// Startup helpers
// ---------------------------------------------------------------------------

/** Startup check for the worker's selected language only. */
export async function checkVoiceModelReadiness(locale: string = 'hi-IN'): Promise<{
  needsDownload: boolean;
  state: VoicePackState;
}> {
  const state = await refreshVoicePack(locale);
  return { needsDownload: state === 'missing' || state === 'failed', state };
}

/** Download the selected language's STT model (after the worker agreed). */
export async function downloadAllVoiceModels(locale: string = 'hi-IN'): Promise<void> {
  if (Platform.OS !== 'android') return;
  await downloadVoicePack(locale).catch(() => {});
}

/** App start: probe all three languages so the UI knows their state. Never downloads. */
export async function prefetchLanguagePacks(): Promise<void> {
  for (const l of ['hi-IN', 'mr-IN', 'en-IN']) {
    await refreshVoicePack(l).catch(() => 'unsupported');
    await findTtsVoice(l).catch(() => undefined);
  }
}
