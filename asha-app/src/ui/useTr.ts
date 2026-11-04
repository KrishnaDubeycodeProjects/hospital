import { useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { TR_ENGLISH_DICT } from './trDictionary';

/**
 * Trilingual copy helper: `tr('हिंदी', 'मराठी', 'English')`.
 * - 'mr' -> Marathi
 * - 'en' -> English (uses explicit `en`, or automatically translates via TR_ENGLISH_DICT)
 * - 'hi' -> Hindi
 */
export function useTr() {
  const { language } = useLanguage();
  return useCallback(
    (hi: string, mr: string, en?: string) => {
      if (language === 'mr') return mr;
      if (language === 'en') {
        if (en && en.trim().length > 0) return en;
        return TR_ENGLISH_DICT[hi] || TR_ENGLISH_DICT[mr] || hi;
      }
      return hi;
    },
    [language]
  );
}
