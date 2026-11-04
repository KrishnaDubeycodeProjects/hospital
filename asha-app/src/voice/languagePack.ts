/**
 * Language-pack gate for voice features (Hindi `hi-IN`, Marathi `mr-IN`, English `en-IN`).
 *
 * Speech-to-text and text-to-speech must not fail in the field:
 *  - STT: on-device recognizer model (Android 13+, Google on-device speech service).
 *  - TTS: installed Hindi/Marathi voice in the system TTS engine.
 *
 * Provides startup verification, explicit download triggers, and non-blocking fallback.
 */
import { Linking, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export type PackStatus = 'ready' | 'missing' | 'downloading' | 'unknown';

const ON_DEVICE_SERVICE = 'com.google.android.as';

const norm = (l: string) => l.replace('_', '-').toLowerCase();
const baseOf = (l: string) => norm(l).split('-')[0];

const sttReady = new Set<string>();
const sttDownloading = new Map<string, Promise<PackStatus>>();
const ttsVoice = new Map<string, string | null>(); // locale -> voice identifier
let ttsInstallPrompted = false;

async function installedSttLocales(): Promise<{ installed: string[]; supported: string[] } | null> {
  try {
    const res = await ExpoSpeechRecognitionModule.getSupportedLocales({ androidRecognitionServicePackage: ON_DEVICE_SERVICE });
    return { installed: (res.installedLocales || []).map(norm), supported: (res.locales || []).map(norm) };
  } catch {
    return null;
  }
}

/** Current STT model state for a locale, without triggering a download. */
export async function sttStatus(locale: string): Promise<PackStatus> {
  if (Platform.OS !== 'android') return 'unknown';
  const key = norm(locale);
  if (sttReady.has(key)) return 'ready';
  if (sttDownloading.has(key)) return 'downloading';
  let onDevice = false;
  try {
    onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {}
  if (!onDevice) return 'unknown';
  const locales = await installedSttLocales();
  // Android ≤ 12 or web/simulators return empty lists: state unknown (non-blocking).
  if (!locales || (locales.installed.length === 0 && locales.supported.length === 0)) return 'unknown';
  if (locales.installed.includes(key)) {
    sttReady.add(key);
    return 'ready';
  }
  return 'missing';
}

/**
 * Makes sure the STT model is on the device, downloading it when missing.
 * Resolves `ready` only once the model is confirmed installed.
 */
export async function ensureSttModel(locale: string): Promise<PackStatus> {
  const key = norm(locale);
  const status = await sttStatus(key);
  if (status !== 'missing') return status;
  const inflight = sttDownloading.get(key);
  if (inflight) return inflight;

  const run = (async (): Promise<PackStatus> => {
    try {
      const res = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: key });
      if (res.status === 'download_success') {
        sttReady.add(key);
        return 'ready';
      }
      return res.status === 'opened_dialog' ? 'downloading' : 'missing';
    } catch {
      return 'missing';
    } finally {
      sttDownloading.delete(key);
    }
  })();
  sttDownloading.set(key, run);
  return run;
}

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

/** Startup check: verifies whether speech-to-text models need downloading */
export async function checkVoiceModelReadiness(): Promise<{
  needsDownload: boolean;
  hiStatus: PackStatus;
  mrStatus: PackStatus;
}> {
  if (Platform.OS !== 'android') {
    return { needsDownload: false, hiStatus: 'unknown', mrStatus: 'unknown' };
  }
  const hi = await sttStatus('hi-IN');
  const mr = await sttStatus('mr-IN');
  const needsDownload = hi === 'missing' || mr === 'missing';
  return { needsDownload, hiStatus: hi, mrStatus: mr };
}

/** Initiates explicit download of offline Hindi and Marathi voice packs */
export async function downloadAllVoiceModels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'hi-IN' }).catch(() => {});
    await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'mr-IN' }).catch(() => {});
    await ensureTtsVoice('hi-IN').catch(() => {});
  } catch (e) {
    console.warn('Voice model download error:', e);
  }
}

/** App start: fetch Hindi + Marathi + English STT models in the background. */
export async function prefetchLanguagePacks(): Promise<void> {
  for (const l of ['hi-IN', 'mr-IN', 'en-IN']) {
    await ensureSttModel(l).catch(() => 'missing');
    await findTtsVoice(l).catch(() => undefined);
  }
}
