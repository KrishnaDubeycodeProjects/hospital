/**
 * Official clinical calculations per GOVERNMENT_RCH_ANMOL_SPECIFICATION.md.
 * Pure functions — no I/O, safe offline.
 */

/** Parse DD/MM/YYYY, DD-MM-YYYY or ISO YYYY-MM-DD into a local Date (midnight). */
export function parseClinicalDate(value: unknown): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (iso) {
    y = +iso[1]; m = +iso[2]; d = +iso[3];
  } else if (dmy) {
    d = +dmy[1]; m = +dmy[2]; y = +dmy[3];
  } else {
    return null;
  }
  const date = new Date(y, m - 1, d);
  // Reject rollovers such as 31/02
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Format as DD/MM/YYYY (numerals kept standard per design rules). */
export function formatClinicalDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/**
 * Naegele's Rule (Annexure 1): EDD = LMP + 9 calendar months + 7 days.
 * Month addition clamps to the last day of the target month (e.g. 31 May → 28/29 Feb).
 */
export function calculateEdd(lmp: Date): Date {
  const targetMonth = lmp.getMonth() + 9;
  const lastDayOfTarget = new Date(lmp.getFullYear(), targetMonth + 1, 0).getDate();
  const plusNine = new Date(lmp.getFullYear(), targetMonth, Math.min(lmp.getDate(), lastDayOfTarget));
  plusNine.setDate(plusNine.getDate() + 7);
  return plusNine;
}

/** Completed gestational weeks from LMP (null if LMP is in the future or > 45 weeks ago). */
export function gestationalWeeks(lmp: Date, today: Date = new Date()): number | null {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((startOfToday.getTime() - lmp.getTime()) / 86400000);
  if (days < 0) return null;
  const weeks = Math.floor(days / 7);
  return weeks > 45 ? null : weeks;
}

/** Trimester: 1 (0–13 wk), 2 (14–27 wk), 3 (28+ wk). */
export function trimesterFromWeeks(weeks: number): 1 | 2 | 3 {
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

export type HbGrade = 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';

/** Hemoglobin grading (g/dL) per spec §2.4. */
export function classifyHb(hb: number): HbGrade {
  if (hb >= 11) return 'NORMAL';
  if (hb >= 9) return 'MILD';
  if (hb >= 7) return 'MODERATE';
  return 'SEVERE';
}

/** Parse a numeric reading like "10.4", "10.4 g/dL" or 10.4. Returns null if absent/invalid. */
export function parseNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Parse "120/80" → {sys, dia}. */
export function parseBp(value: unknown): { sys: number; dia: number } | null {
  if (value == null) return null;
  const m = String(value).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  return { sys: +m[1], dia: +m[2] };
}

/** Gestational hypertension threshold: Systolic ≥ 140 or Diastolic ≥ 90 mmHg. */
export function isHypertensive(bp: { sys: number; dia: number }): boolean {
  return bp.sys >= 140 || bp.dia >= 90;
}

/**
 * Interprets a recorded yes/no answer: true for हाँ / हां / होय / Yes / ✓ …, false for
 * नहीं / नाही / No / ✕ … / "Not given", null when not recorded. Mirrors the backend's
 * ClinicalValueNormalizer.affirmative so client and server agree.
 */
export function parseAffirmative(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^(✕|no\b|not\b|false\b|नहीं|नही|नाही|negative)/i.test(s) || /not given|नहीं|नाही/i.test(s)) return false;
  if (/^(✓|yes\b|true\b|हाँ|हां|होय|given\b)/i.test(s) || /given|लगाया|दिली|की गई/i.test(s)) return true;
  return null;
}

/** Converts DD/MM/YYYY or ISO input to ISO YYYY-MM-DD (null if invalid). */
export function toIsoDate(value: unknown): string | null {
  const d = parseClinicalDate(value);
  if (!d) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
