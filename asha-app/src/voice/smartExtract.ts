/**
 * Smart extraction of a spoken answer into the shape a form field needs.
 *
 *   "मेरा नंबर है 88509 34544"      → phone  → "8850934544"
 *   "my number is double eight 50…" → phone  → "88 50…" digits only
 *   "मेरा नाम सुनीता देवी है"        → name   → "सुनीता देवी"
 *   "उम्र 32 साल"                   → age    → "32"
 *   "120 बटा 80"                    → bp     → "120/80"
 *   "हीमोग्लोबिन 6 पॉइंट 8"           → decimal → "6.8"
 *
 * Works fully offline (pure string rules, no model). Hindi, Marathi, Hinglish and English phrasing.
 */

export type VoiceKind =
  | 'phone' // 10-digit Indian mobile
  | 'name' // person / head-of-family name
  | 'age' // whole years, 0–120
  | 'number' // whole count (attendees, tablets)
  | 'house' // house number, may carry a letter (12A)
  | 'decimal' // Hb, weight
  | 'bp' // systolic/diastolic
  | 'text' // short free text (village, venue) — replaced on re-speak
  | 'long'; // comments / notes — appended on re-speak

/** Short fields are replaced when the worker speaks again; comment fields keep growing. */
export const appendsOnRespeak = (kind: VoiceKind) => kind === 'long';

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

// Spoken single digits (Hindi, Marathi, Hinglish, English). Multi-digit words are rare in recognizer
// output (it already emits numerals), but digit-by-digit phone dictation is common.
const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  shunya: '0', ek: '1', do: '2', teen: '3', char: '4', chaar: '4', paanch: '5', panch: '5', chhe: '6', che: '6',
  saat: '7', aath: '8', nau: '9',
  'शून्य': '0', 'जीरो': '0', 'ज़ीरो': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5',
  'छह': '6', 'छः': '6', 'छे': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
  'दोन': '2', 'पाच': '5', 'सहा': '6', 'नऊ': '9',
};
const REPEAT_WORDS: Record<string, number> = {
  double: 2, triple: 3, 'डबल': 2, 'ट्रिपल': 3, 'दुहेरी': 2,
};
const DECIMAL_WORDS = ['point', 'dot', 'पॉइंट', 'पॉईंट', 'प्वाइंट', 'दशमलव', 'दशांश', 'पूर्णांक'];

/** Devanagari numerals → ASCII, unify spacing. */
export function normalizeDigits(input: string): string {
  return (input || '').replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] || d);
}

/** Spoken digit words ("double nine", "आठ आठ") → numerals; other words are kept. */
function wordsToDigits(input: string): string {
  const tokens = normalizeDigits(input).toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[.,!?।]+$/g, '');
    const repeat = REPEAT_WORDS[t];
    if (repeat && i + 1 < tokens.length) {
      const next = tokens[i + 1].replace(/[.,!?।]+$/g, '');
      const digit = DIGIT_WORDS[next] ?? (/^\d$/.test(next) ? next : undefined);
      if (digit !== undefined) {
        out.push(digit.repeat(repeat));
        i++;
        continue;
      }
    }
    out.push(DIGIT_WORDS[t] ?? t);
  }
  return out.join(' ');
}

const clean = (s: string) =>
  s
    .replace(/[“”"'`]/g, '')
    .replace(/[.,!?।;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function extractPhone(spoken: string): string {
  let digits = wordsToDigits(spoken).replace(/[^0-9]/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

// Lead-in phrases spoken before a name ("मेरा नाम …", "my name is …", "माझे नाव …").
const NAME_MARKERS = [
  'my name is', 'her name is', 'his name is', 'the name is', 'name is', 'naam hai', 'naam',
  'मुखिया का नाम', 'मेरा नाम', 'मेरी नाम', 'इनका नाम', 'इसका नाम', 'उनका नाम', 'उसका नाम', 'नाम है', 'नाम',
  'माझे नाव', 'माझं नाव', 'त्यांचे नाव', 'त्याचे नाव', 'तिचे नाव', 'याचे नाव', 'नाव आहे', 'नाव',
];
const NAME_LEADING_FILLERS = /^(is|hai|है|हैं|आहे|जी|ji|this is|i am|मैं|मी)\s+/i;
const NAME_TRAILING_FILLERS = /\s+(है|हैं|आहे|हे|जी|ji|hai|hain|है जी)$/i;
const NAME_POSSESSIVE_TAIL = /\s+(मेरा|मेरी|इनका|उनका|माझे|माझं)$/;

/** Last index of `phrase` as whole words (so "नाम" never matches inside the name "नामदेव"); -1 if absent. */
function findWholePhrase(haystack: string, phrase: string): number {
  let from = haystack.length;
  while (from >= 0) {
    const at = haystack.lastIndexOf(phrase, from);
    if (at < 0) return -1;
    const before = at === 0 ? ' ' : haystack[at - 1];
    const after = haystack[at + phrase.length] ?? ' ';
    if (/\s/.test(before) && /[\s,.:।]/.test(after)) return at;
    from = at - 1;
  }
  return -1;
}

export function extractName(spoken: string): string {
  let s = clean(normalizeDigits(spoken));
  const lower = s.toLowerCase();
  for (const marker of NAME_MARKERS) {
    const at = findWholePhrase(lower, marker);
    if (at < 0) continue;
    const after = s.slice(at + marker.length).trim();
    const before = s.slice(0, at).trim();
    // "मेरा नाम सुनीता है" → after; "सुनीता देवी मेरा नाम है" → before
    const afterStripped = after.replace(NAME_LEADING_FILLERS, '').replace(NAME_TRAILING_FILLERS, '').replace(/^(है|आहे|is)$/i, '').trim();
    s = afterStripped || before.replace(NAME_POSSESSIVE_TAIL, '').trim();
    break;
  }
  for (let i = 0; i < 2; i++) s = s.replace(NAME_LEADING_FILLERS, '').replace(NAME_TRAILING_FILLERS, '');
  // Keep letters (any script), combining marks, spaces, dots; drop digits and stray symbols.
  s = s.replace(/[^\p{L}\p{M}\s.]/gu, ' ').replace(/\s+/g, ' ').trim();
  // Title-case Latin words ("sunita devi" → "Sunita Devi"); Devanagari has no case.
  return s.replace(/\b([a-z])([a-z]*)/g, (_m, a: string, b: string) => a.toUpperCase() + b);
}

function firstInteger(spoken: string): string {
  const m = wordsToDigits(spoken).match(/\d+/);
  return m ? m[0] : '';
}

export function extractAge(spoken: string): string {
  const n = firstInteger(spoken);
  return n && Number(n) <= 120 ? String(Number(n)) : '';
}

export function extractHouse(spoken: string): string {
  const m = wordsToDigits(spoken).match(/(\d+)\s*([a-z])?(?![a-z])/i);
  return m ? `${m[1]}${m[2] ? m[2].toUpperCase() : ''}` : '';
}

export function extractDecimal(spoken: string): string {
  let s = wordsToDigits(spoken);
  for (const w of DECIMAL_WORDS) s = s.split(w).join(' . ');
  s = s.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

export function extractBp(spoken: string): string {
  const s = wordsToDigits(spoken);
  const m = s.match(/(\d{2,3})\D{1,12}?(\d{2,3})/);
  return m ? `${m[1]}/${m[2]}` : '';
}

/** Extract the field value from a transcript; '' when nothing usable was heard. */
export function extractForKind(kind: VoiceKind, spoken: string): string {
  switch (kind) {
    case 'phone':
      return extractPhone(spoken);
    case 'name':
      return extractName(spoken);
    case 'age':
      return extractAge(spoken);
    case 'number':
      return firstInteger(spoken);
    case 'house':
      return extractHouse(spoken);
    case 'decimal':
      return extractDecimal(spoken);
    case 'bp':
      return extractBp(spoken);
    case 'text':
    case 'long':
    default:
      return clean(normalizeDigits(spoken));
  }
}

/**
 * New field value after a spoken answer: short fields are overwritten, comment fields append.
 * Returns null when nothing usable was heard (the existing value is kept).
 */
export function applySpokenValue(kind: VoiceKind, current: string, spoken: string): string | null {
  const extracted = extractForKind(kind, spoken);
  if (!extracted) return null;
  if (appendsOnRespeak(kind) && current.trim()) return `${current.trim()} ${extracted}`;
  return extracted;
}

// Command words around a spoken search ("सुनीता का घर ढूंढो", "search Radha family", "राधाचे कुटुंब शोधा").
const SEARCH_FILLERS =
  /(^|\s)(search|find|show|open|family|house|ghar|ka|ki|ke|का|की|के|घर|परिवार|ढूंढो|ढूँढो|ढूंढें|खोजो|खोजें|दिखाओ|खोलो|चे|ची|चा|चं|कुटुंब|शोधा|दाखवा|उघडा|नंबर|number|क्रमांक)(?=\s|$)/gi;

/** Clean a spoken family search: a house number if one was said, otherwise just the name words. */
export function extractSearchQuery(spoken: string): string {
  const s = normalizeDigits(spoken);
  if (/\d/.test(s)) {
    const house = extractHouse(s);
    if (house) return house;
  }
  const name = extractName(s.replace(SEARCH_FILLERS, ' ')).replace(SEARCH_FILLERS, ' ').replace(/\s+/g, ' ').trim();
  return name || clean(s);
}
