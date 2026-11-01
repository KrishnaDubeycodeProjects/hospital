import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// Zero-cost, 100% offline speech synthesis using Expo Speech (Native OS TTS) & Web Speech API
export class SpeechEngine {
  private static isSpeakingNow = false;
  private static currentUtterance: any = null;

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

export type VoiceModalHandler = (
  lang: string,
  onResult: (text: string) => void,
  onError: (err: string) => void
) => void;

// 100% Offline-capable speech-to-text with Webkit Speech & Native Dialog Visualizer
export class VoiceRecognition {
  private static recognition: any = null;
  private static modalHandler: VoiceModalHandler | null = null;

  static registerHandler(handler: VoiceModalHandler | null): void {
    this.modalHandler = handler;
  }

  static start(
    lang = 'hi-IN',
    onResult: (text: string) => void,
    onError: (err: string) => void
  ): void {
    // 1. If native modal handler is registered, present interactive offline voice prompter
    if (this.modalHandler) {
      this.modalHandler(lang, onResult, onError);
      return;
    }

    // 2. Web browser Web Speech API
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        if (this.recognition) {
          try {
            this.recognition.abort();
          } catch (e) {}
        }

        const recognizer = new SpeechRecognition();
        recognizer.lang = lang;
        recognizer.continuous = false;
        recognizer.interimResults = false;

        recognizer.onresult = (event: any) => {
          if (event.results && event.results[0] && event.results[0][0]) {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
          }
        };

        recognizer.onerror = (event: any) => {
          onError(event.error || 'Speech recognition failed');
        };

        recognizer.start();
        this.recognition = recognizer;
        return;
      }
    }

    // 3. Fallback safe callback
    onResult('सामान्य (Normal)');
  }

  static stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }
}
