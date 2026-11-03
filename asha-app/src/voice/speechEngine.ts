import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Dictation } from './dictation';

// Zero-cost, 100% offline speech synthesis using Expo Speech (Native OS TTS) & Web Speech API
export class SpeechEngine {
  private static isSpeakingNow = false;
  private static currentUtterance: any = null;

  /**
   * Silently trigger background download of offline language models (Hindi, Marathi, English)
   * Designed specifically for rural field workers so they never have to manually configure settings.
   */
  static async initializeOfflineSpeech(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'hi-IN' }).catch(() => {});
        await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'mr-IN' }).catch(() => {});
      } catch (e) {
        // Safe fallback on unsupported Android versions
      }
    }
  }

  static async speak(
    text: string,
    lang = 'hi-IN',
    rate = 0.9,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (!text || text.trim().length === 0) return;
    this.isSpeakingNow = true;
    if (onStart) onStart();

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof (window as any).SpeechSynthesisUtterance !== 'undefined'
      ) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;

        try {
          const voices = window.speechSynthesis.getVoices();
          const baseLang = lang.split('-')[0].toLowerCase();
          const matchingVoice = voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith(baseLang) ||
              v.lang.toLowerCase() === lang.toLowerCase()
          );
          if (matchingVoice) {
            utterance.voice = matchingVoice;
          }
        } catch (e) {
          // Continue with default OS voice
        }

        this.currentUtterance = utterance;

        utterance.onstart = () => {
          this.isSpeakingNow = true;
          if (onStart) onStart();
        };

        utterance.onend = () => {
          this.isSpeakingNow = false;
          this.currentUtterance = null;
          if (onEnd) onEnd();
        };

        utterance.onerror = () => {
          this.isSpeakingNow = false;
          this.currentUtterance = null;
          if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);
        return;
      }
    } else {
      // Native Android & iOS via expo-speech (100% offline TextToSpeech engine)
      try {
        await Speech.stop();
        Speech.speak(text, {
          language: lang,
          pitch: 1.0,
          rate: rate,
          onStart: () => {
            this.isSpeakingNow = true;
            if (onStart) onStart();
          },
          onDone: () => {
            this.isSpeakingNow = false;
            if (onEnd) onEnd();
          },
          onError: () => {
            this.isSpeakingNow = false;
            if (onEnd) onEnd();
          },
        });
        return;
      } catch (err) {
        console.warn('Expo speech invocation note:', err);
      }
    }

    // Fallback timer if platform TTS is unavailable
    setTimeout(() => {
      this.isSpeakingNow = false;
      if (onEnd) onEnd();
    }, 2500);
  }

  static stop(): void {
    this.isSpeakingNow = false;
    this.currentUtterance = null;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      try {
        Speech.stop();
      } catch (e) {}
    }
  }

  static isSpeaking(): boolean {
    return this.isSpeakingNow;
  }
}

/**
 * Speech-to-text for older call sites: starts listening immediately (no popup / phrase list).
 * Exactly one of onResult / onError is called per start. New fields should use <Field voice=…/>.
 */
export class VoiceRecognition {
  static start(lang = 'hi-IN', onResult: (text: string) => void, onError: (err: string) => void): void {
    let settled = false;
    Dictation.start(lang, {
      onFinal: (t) => {
        if (settled) return;
        settled = true;
        onResult(t);
      },
      onError: (code) => {
        if (settled) return;
        settled = true;
        onError(code);
      },
      onEnd: () => {
        if (settled) return;
        settled = true;
        onError('no-speech');
      },
    });
  }

  static stop(): void {
    Dictation.stop();
  }
}
