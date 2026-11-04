/**
 * Dialogs shown when the worker taps a mic but the speech model for her language
 * is not usable yet. Language is taken from the speech locale, so it matches the mic.
 */
import { Alert } from 'react-native';
import { downloadVoicePack, VoicePackState } from './languagePack';

const pickFor = (locale: string) => {
  const l = locale.toLowerCase();
  const lang = l.startsWith('mr') ? 'mr' : l.startsWith('en') ? 'en' : 'hi';
  return (hi: string, mr: string, en: string) => (lang === 'mr' ? mr : lang === 'en' ? en : hi);
};

/** Name of the language as the worker reads it in her own UI language. */
export const voiceLanguageName = (locale: string) => pickFor(locale)('हिंदी', 'मराठी', 'English');

export function promptVoicePack(locale: string, state: VoicePackState): void {
  const L = pickFor(locale);
  const name = voiceLanguageName(locale);

  if (state === 'downloading') {
    Alert.alert(
      L('डाउनलोड चल रहा है', 'डाउनलोड सुरू आहे', 'Downloading'),
      L(
        `${name} आवाज़ पैक डाउनलोड हो रहा है। पूरा होने पर ऊपर संदेश दिखेगा, फिर माइक दबाएँ।`,
        `${name} आवाज पॅक डाउनलोड होत आहे. पूर्ण झाल्यावर वर संदेश दिसेल, मग माइक दाबा.`,
        `The ${name} voice pack is downloading. A message will show at the top when it is done — then tap the mic.`
      ),
      [{ text: L('ठीक है', 'ठीक आहे', 'OK') }]
    );
    return;
  }

  if (state === 'scheduled') {
    Alert.alert(
      L('Wi-Fi का इंतज़ार', 'Wi-Fi ची वाट', 'Waiting for Wi-Fi'),
      L(
        'फ़ोन Wi-Fi मिलने पर पैक डाउनलोड करेगा। अभी करना हो तो दोबारा कोशिश करें।',
        'फोन Wi-Fi मिळाल्यावर पॅक डाउनलोड करेल. आत्ता हवे असल्यास पुन्हा प्रयत्न करा.',
        'The phone will download the pack on Wi-Fi. Try again to start it now.'
      ),
      [
        { text: L('ठीक है', 'ठीक आहे', 'OK'), style: 'cancel' },
        { text: L('फिर कोशिश', 'पुन्हा प्रयत्न', 'Try again'), onPress: () => void downloadVoicePack(locale) },
      ]
    );
    return;
  }

  // missing / failed
  Alert.alert(
    L('भाषा डाउनलोड करें', 'भाषा डाउनलोड करा', 'Download language'),
    L(
      `बोलकर लिखने के लिए ${name} आवाज़ पैक एक बार डाउनलोड करें। इंटरनेट चालू रखें।${state === 'failed' ? ' पिछली बार डाउनलोड पूरा नहीं हुआ।' : ''}`,
      `बोलून लिहिण्यासाठी ${name} आवाज पॅक एकदा डाउनलोड करा. इंटरनेट चालू ठेवा.${state === 'failed' ? ' मागच्या वेळी डाउनलोड पूर्ण झाले नाही.' : ''}`,
      `To type by voice, download the ${name} voice pack once. Keep internet on.${state === 'failed' ? ' The last download did not finish.' : ''}`
    ),
    [
      { text: L('बाद में', 'नंतर', 'Later'), style: 'cancel' },
      { text: L('डाउनलोड करें', 'डाउनलोड करा', 'Download'), onPress: () => void downloadVoicePack(locale) },
    ]
  );
}
