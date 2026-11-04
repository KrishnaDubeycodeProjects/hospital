/**
 * Language lookup for code that runs outside <LanguageProvider> (splash, login, auth context).
 * Reads the same key LanguageContext / LoginScreen persist.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'hi' | 'mr' | 'en';

export const LANGUAGE_STORAGE_KEY = '@asha_selected_language';

let cached: AppLanguage = 'hi';

export async function getStoredLanguage(): Promise<AppLanguage> {
  try {
    const v = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (v === 'hi' || v === 'mr' || v === 'en') cached = v;
  } catch {
    // keep last known value
  }
  return cached;
}

/** Last language read by getStoredLanguage (synchronous; 'hi' until the first read). */
export const cachedLanguage = (): AppLanguage => cached;

export const pick = (lang: AppLanguage, hi: string, mr: string, en: string) =>
  lang === 'mr' ? mr : lang === 'en' ? en : hi;
