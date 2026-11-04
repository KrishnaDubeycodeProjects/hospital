/**
 * Script-independent phonetic key for Indian names, so search works across Devanagari and Latin:
 *   "सुनीता देवी" ≡ "Sunita Devi" ≡ "sunitaa devee"      "राधा" ≡ "Radha"      "कमला" ≡ "Kamla"
 * Used silently by family search (voice in hi-IN/mr-IN returns Devanagari; many records are typed
 * in English). Pure string rules, fully offline.
 */

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai',
  'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e',
};
const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ॉ': 'o', 'ॅ': 'e',
};
const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};
const NUKTA_FORMS: Record<string, string> = { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' };
const PRECOMPOSED_NUKTA: Record<string, string> = {
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};
const VIRAMA = '्';
const NUKTA = '़';

/** Devanagari → simple Latin (final inherent "a" dropped, as spoken). Latin input is returned as-is. */
export function romanize(input: string): string {
  const chars = Array.from((input || '').normalize('NFC'));
  let out = '';
  let pendingA = false;
  const flushA = (nextIsLetter: boolean) => {
    if (pendingA && nextIsLetter) out += 'a';
    pendingA = false;
  };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (PRECOMPOSED_NUKTA[c] || CONSONANTS[c]) {
      flushA(true);
      let roman = PRECOMPOSED_NUKTA[c] || CONSONANTS[c];
      if (chars[i + 1] === NUKTA && NUKTA_FORMS[c]) {
        roman = NUKTA_FORMS[c];
        i++;
      }
      out += roman;
      pendingA = true;
      continue;
    }
    if (MATRAS[c]) {
      out += MATRAS[c];
      pendingA = false;
      continue;
    }
    if (c === VIRAMA) {
      pendingA = false;
      continue;
    }
    if (c === 'ं' || c === 'ँ') {
      flushA(true);
      out += 'n';
      continue;
    }
    if (c === 'ः') {
      flushA(true);
      out += 'h';
      continue;
    }
    if (VOWELS[c]) {
      flushA(true);
      out += VOWELS[c];
      continue;
    }
    // space / Latin / other: a word boundary drops the pending inherent vowel (schwa deletion)
    flushA(false);
    out += c;
  }
  flushA(false);
  return out;
}

/** Phonetic key of one word: spelling variants collapse to the same string. */
function wordKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  w = w
    .replace(/ph/g, 'f')
    .replace(/(chh|ch|c)/g, 'c')
    .replace(/(shh|sh)/g, 's')
    .replace(/([kgjtdpb])h/g, '$1') // aspirates → plain (bh→b, dh→d…)
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/(ee|ii|y$)/g, 'i')
    .replace(/(oo|uu)/g, 'u')
    .replace(/(ai|ei|ae)/g, 'e')
    .replace(/(au|ou)/g, 'o')
    .replace(/aa/g, 'a')
    .replace(/(.)\1+/g, '$1') // doubled letters
    .replace(/m(?=[kgcjtdpb])/g, 'n'); // anusvara spelled m/n
  // Short "a" is often dropped in speech/spelling (Kamala/Kamla, Radha): keep it only word-initially.
  return w[0] + w.slice(1).replace(/a/g, '');
}

/** Key of a full name ("Sunita Devi" → "sunit dvi"); empty when nothing letter-like is present. */
export function phoneticKey(name: string): string {
  return romanize(name)
    .split(/\s+/)
    .map(wordKey)
    .filter(Boolean)
    .join(' ');
}

/** True when the text contains Devanagari letters. */
export const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s || '');
