import { useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Bilingual copy helper: `tr('हिंदी', 'मराठी')`. Hindi and Marathi only — never English.
 * Keep button / chip labels to 3 words or fewer.
 */
export function useTr() {
  const { language } = useLanguage();
  return useCallback((hi: string, mr: string) => (language === 'mr' ? mr : hi), [language]);
}
