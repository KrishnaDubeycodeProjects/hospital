/**
 * Field constraints for ASHA forms. Each validator returns a Hindi/Marathi error message, or
 * null when the value is acceptable. Empty values are allowed unless `required` is set — the
 * caller decides which fields are mandatory.
 *
 * Ranges are physiological plausibility bounds (catch typos such as Hb 110 or BP 1208/0),
 * not clinical alert thresholds — those live in maternalMath.ts per the RCH/ANMOL spec.
 */
import { parseClinicalDate } from './maternalMath';

export type Tr = (hi: string, mr: string, en?: string) => string;

/** Strict decimal: "12", "12.5", "12,5" — no digit scraping from "12abc". */
export function strictNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}

const isBlank = (v: unknown) => v == null || String(v).trim() === '';

export const LIMITS = {
  nameMin: 2,
  nameMax: 60,
  ageMax: 120,
  pregnancyAgeMin: 15, // RCH eligible couple register: woman 15–49
  pregnancyAgeMax: 49,
  childAgeMax: 18,
  houseMax: 10,
  sysMin: 60,
  sysMax: 250,
  diaMin: 30,
  diaMax: 150,
  adultWeightMin: 20,
  adultWeightMax: 200,
  childWeightMin: 0.5,
  childWeightMax: 40,
  hbMin: 3,
  hbMax: 20,
  tabletsMax: 360,
} as const;

/** Person name: letters (Devanagari or Latin), spaces, dot, apostrophe, hyphen. No digits. */
export function validateName(value: string, tr: Tr, required = true): string | null {
  const v = (value || '').trim().replace(/\s+/g, ' ');
  if (!v) return required ? tr('नाम भरें', 'नाव भरा', 'Enter name') : null;
  if (/[0-9०-९]/.test(v)) return tr('नाम में अंक नहीं होने चाहिए', 'नावात अंक नसावेत', 'Name must not contain digits');
  if (!/^[A-Za-zÀ-ɏऀ-ॿ .'\-]+$/.test(v)) return tr('नाम में केवल अक्षर लिखें', 'नावात फक्त अक्षरे लिहा', 'Use only letters in the name');
  if ([...v].length < LIMITS.nameMin) return tr('नाम बहुत छोटा है', 'नाव खूप लहान आहे', 'Name is too short');
  if ([...v].length > LIMITS.nameMax) return tr(`नाम ${LIMITS.nameMax} अक्षर से कम हो`, `नाव ${LIMITS.nameMax} अक्षरांपेक्षा कमी असावे`, `Name must be under ${LIMITS.nameMax} characters`);
  return null;
}

/** Indian mobile: exactly 10 digits, starting 6–9 (optional +91 / 0 prefix stripped). */
export function normalizePhone(value: string): string {
  let d = (value || '').replace(/[^0-9]/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

export function validatePhone(value: string, tr: Tr, required = false): string | null {
  const d = normalizePhone(value);
  if (!d) return required ? tr('मोबाइल नंबर भरें', 'मोबाईल क्रमांक भरा', 'Enter mobile number') : null;
  if (d.length !== 10) return tr('मोबाइल 10 अंक का हो', 'मोबाईल 10 अंकी हवा', 'Mobile must be 10 digits');
  if (!/^[6-9]/.test(d)) return tr('मोबाइल 6, 7, 8 या 9 से शुरू हो', 'मोबाईल 6, 7, 8 किंवा 9 ने सुरू व्हावा', 'Mobile must start with 6, 7, 8 or 9');
  if (/^(\d)\1{9}$/.test(d)) return tr('सही मोबाइल नंबर लिखें', 'योग्य मोबाईल क्रमांक लिहा', 'Enter a valid mobile number');
  return null;
}

export function validateHouseNumber(value: string, tr: Tr): string | null {
  const v = (value || '').trim();
  if (!v) return tr('घर नंबर भरें', 'घर क्रमांक भरा', 'Enter house number');
  if (v.length > LIMITS.houseMax || !/^[A-Za-z0-9ऀ-ॿ\/\- ]+$/.test(v)) return tr('सही घर नंबर लिखें', 'योग्य घर क्रमांक लिहा', 'Enter a valid house number');
  if (/^0+$/.test(v)) return tr('घर नंबर 0 नहीं हो सकता', 'घर क्रमांक 0 असू शकत नाही', 'House number cannot be 0');
  return null;
}

export function validateAge(value: string, tr: Tr): string | null {
  if (isBlank(value)) return null;
  const n = strictNumber(value);
  if (n === null || !Number.isInteger(n)) return tr('आयु पूर्ण वर्षों में लिखें', 'वय पूर्ण वर्षांत लिहा', 'Enter age in completed years');
  if (n > LIMITS.ageMax) return tr(`आयु ${LIMITS.ageMax} वर्ष से अधिक नहीं`, `वय ${LIMITS.ageMax} वर्षांपेक्षा जास्त नाही`, `Age cannot exceed ${LIMITS.ageMax} years`);
  return null;
}

/** Date of birth (DD/MM/YYYY): real calendar date, not in the future, not over 120 years ago. */
export function validateDob(value: string, tr: Tr): string | null {
  if (isBlank(value)) return null;
  const d = parseClinicalDate(value);
  if (!d) return tr('जन्म तिथि DD/MM/YYYY में लिखें', 'जन्मतारीख DD/MM/YYYY मध्ये लिहा', 'Enter date of birth as DD/MM/YYYY');
  if (d.getTime() > Date.now()) return tr('जन्म तिथि भविष्य की नहीं हो सकती', 'जन्मतारीख भविष्यातील असू शकत नाही', 'Date of birth cannot be in the future');
  const minYear = new Date().getFullYear() - LIMITS.ageMax;
  if (d.getFullYear() < minYear) return tr('जन्म तिथि सही नहीं है', 'जन्मतारीख योग्य नाही', 'Date of birth is not valid');
  return null;
}

/** Whole years between DOB and today. */
export function ageFromDob(value: string): number | null {
  const d = parseClinicalDate(value);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

/** Age entered and age derived from DOB must agree (±1 year for birthday rounding). */
export function validateAgeMatchesDob(age: string, dob: string, tr: Tr): string | null {
  const a = strictNumber(age);
  const derived = ageFromDob(dob);
  if (a === null || derived === null) return null;
  if (Math.abs(a - derived) > 1) return tr(`जन्म तिथि के अनुसार आयु ${derived} वर्ष है`, `जन्मतारखेनुसार वय ${derived} वर्षे आहे`, `Age by date of birth is ${derived} years`);
  return null;
}

export function validatePregnancyAge(age: number | null, tr: Tr): string | null {
  if (age === null) return null;
  if (age < LIMITS.pregnancyAgeMin || age > LIMITS.pregnancyAgeMax)
    return tr(`गर्भवती की आयु ${LIMITS.pregnancyAgeMin}–${LIMITS.pregnancyAgeMax} वर्ष हो`, `गरोदर स्त्रीचे वय ${LIMITS.pregnancyAgeMin}–${LIMITS.pregnancyAgeMax} वर्षे असावे`, `Pregnant woman's age must be ${LIMITS.pregnancyAgeMin}–${LIMITS.pregnancyAgeMax} years`);
  return null;
}

/** "120/80": systolic 60–250, diastolic 30–150, systolic above diastolic. */
export function validateBp(value: string, tr: Tr): string | null {
  if (isBlank(value)) return null;
  const m = String(value).trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!m) return tr('बी.पी. 120/80 जैसे लिखें', 'बी.पी. 120/80 असे लिहा', 'Write BP like 120/80');
  const sys = +m[1];
  const dia = +m[2];
  if (sys < LIMITS.sysMin || sys > LIMITS.sysMax) return tr(`ऊपर वाला बी.पी. ${LIMITS.sysMin}–${LIMITS.sysMax} हो`, `वरचा बी.पी. ${LIMITS.sysMin}–${LIMITS.sysMax} असावा`, `Upper BP must be ${LIMITS.sysMin}–${LIMITS.sysMax}`);
  if (dia < LIMITS.diaMin || dia > LIMITS.diaMax) return tr(`नीचे वाला बी.पी. ${LIMITS.diaMin}–${LIMITS.diaMax} हो`, `खालचा बी.पी. ${LIMITS.diaMin}–${LIMITS.diaMax} असावा`, `Lower BP must be ${LIMITS.diaMin}–${LIMITS.diaMax}`);
  if (sys <= dia) return tr('ऊपर वाला बी.पी. नीचे वाले से अधिक हो', 'वरचा बी.पी. खालच्यापेक्षा जास्त असावा', 'Upper BP must be higher than lower BP');
  return null;
}

function validateRange(value: unknown, min: number, max: number, unitHi: string, unitMr: string, unitEn: string, tr: Tr, integer = false): string | null {
  if (isBlank(value)) return null;
  const n = strictNumber(value);
  if (n === null || (integer && !Number.isInteger(n))) return tr('केवल अंक लिखें', 'फक्त अंक लिहा', 'Enter digits only');
  if (n < min || n > max) return tr(`${min}–${max} ${unitHi} के बीच लिखें`, `${min}–${max} ${unitMr} दरम्यान लिहा`, `Enter between ${min}–${max} ${unitEn}`);
  return null;
}

export const validateAdultWeight = (v: unknown, tr: Tr) =>
  validateRange(v, LIMITS.adultWeightMin, LIMITS.adultWeightMax, 'किलो', 'किलो', 'kg', tr);
export const validateChildWeight = (v: unknown, tr: Tr) =>
  validateRange(v, LIMITS.childWeightMin, LIMITS.childWeightMax, 'किलो', 'किलो', 'kg', tr);
export const validateHb = (v: unknown, tr: Tr) => validateRange(v, LIMITS.hbMin, LIMITS.hbMax, 'g/dL', 'g/dL', 'g/dL', tr);
export const validateTablets = (v: unknown, tr: Tr) =>
  validateRange(v, 0, LIMITS.tabletsMax, 'गोली', 'गोळ्या', 'tablets', tr, true);

/** Keeps only characters a numeric field can contain (digits + one decimal point). */
export function sanitizeDecimal(raw: string): string {
  const s = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const i = s.indexOf('.');
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
}

export const sanitizeInteger = (raw: string) => raw.replace(/[^0-9]/g, '');
