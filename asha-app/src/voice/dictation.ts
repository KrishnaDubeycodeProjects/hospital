/**
 * Direct dictation: tap the mic → the device starts listening immediately (no popup, no phrase list).
 * One session at a time; starting a new field's mic ends the previous one.
 *
 * Native events arrive through <DictationEventBridge/> (mounted once in App.tsx) and are routed
 * to the active session only, so every mic button can share a single recognizer.
 */
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export interface DictationHandlers {
  /** Live (interim) transcript while the worker is speaking. */
  onPartial?: (transcript: string) => void;
  /** Final transcript; called at most once per session. */
  onFinal: (transcript: string) => void;
  /** Session finished (after onFinal, after an error, or when nothing was heard). */
  onEnd?: (heardSomething: boolean) => void;
  onError?: (code: string) => void;
}

interface Session extends DictationHandlers {
  id: number;
  latest: string;
  finalSent: boolean;
  ended: boolean;
}

let current: Session | null = null;
let seq = 0;
/** Native 'end' events still owed by sessions we replaced; they must not end the new session. */
let staleEnds = 0;
const subscribers = new Set<(activeId: number | null) => void>();

const notify = () => subscribers.forEach((fn) => fn(current ? current.id : null));

function finish(session: Session) {
  if (session.ended) return;
  session.ended = true;
  if (!session.finalSent && session.latest.trim()) {
    session.finalSent = true;
    session.onFinal(session.latest.trim());
  }
  session.onEnd?.(session.finalSent);
  if (current === session) current = null;
  notify();
}

export const speechLocale = (language: string) => (language === 'mr' ? 'mr-IN' : 'hi-IN');

export const Dictation = {
  /** Start listening for a field. Returns the session id. */
  start(lang: string, handlers: DictationHandlers): number {
    if (current) {
      const prev = current;
      current = null;
      staleEnds++;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        staleEnds = Math.max(0, staleEnds - 1);
      }
      finish(prev);
    }
    const session: Session = { ...handlers, id: ++seq, latest: '', finalSent: false, ended: false };
    current = session;
    notify();

    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((perm) => {
        if (current !== session) return;
        if (!perm.granted) {
          session.onError?.('not-allowed');
          finish(session);
          return;
        }
        const base = {
          lang,
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
          androidIntentOptions: { EXTRA_PREFER_OFFLINE: true },
        };
        try {
          ExpoSpeechRecognitionModule.start({ ...base, requiresOnDeviceRecognition: true });
        } catch {
          ExpoSpeechRecognitionModule.start(base);
        }
      })
      .catch((err) => {
        if (current !== session) return;
        session.onError?.(err?.message || 'start-failed');
        finish(session);
      });
    return session.id;
  },

  /** Stop listening; the final transcript (if any) is still delivered. */
  stop() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      if (current) finish(current);
    }
  },

  /** Cancel without delivering a result (e.g. the field unmounted). */
  cancel(id?: number) {
    if (!current || (id !== undefined && current.id !== id)) return;
    const s = current;
    s.finalSent = true; // suppress delivery
    s.ended = true;
    current = null;
    staleEnds++;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      staleEnds = Math.max(0, staleEnds - 1);
    }
    s.onEnd?.(false);
    notify();
  },

  activeId(): number | null {
    return current ? current.id : null;
  },

  subscribe(fn: (activeId: number | null) => void): () => void {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  },

  // ---- event routing (called by DictationEventBridge) ----
  _result(transcript: string, isFinal: boolean) {
    const s = current;
    if (!s || !transcript) return;
    s.latest = transcript;
    s.onPartial?.(transcript);
    if (isFinal && !s.finalSent) {
      s.finalSent = true;
      s.onFinal(transcript.trim());
    }
  },
  _end() {
    if (staleEnds > 0) {
      staleEnds--;
      return;
    }
    if (current) finish(current);
  },
  _error(code: string) {
    const s = current;
    if (!s) return;
    if (code !== 'no-speech' && code !== 'aborted') s.onError?.(code);
    // The recognizer always emits 'end' after 'error'; _end() closes the session.
  },
};

/** Mount once near the root: forwards native recognizer events to the active dictation session. */
export function DictationEventBridge(): null {
  useSpeechRecognitionEvent('result', (event) => {
    Dictation._result(event.results?.[0]?.transcript || '', !!event.isFinal);
  });
  useSpeechRecognitionEvent('end', () => Dictation._end());
  useSpeechRecognitionEvent('error', (event) => Dictation._error(String(event.error || 'error')));
  return null;
}
