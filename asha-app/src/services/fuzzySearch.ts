import { FamilyUnit, FamilyMember } from '../types/storage';

export interface SearchMatchResult {
  family: FamilyUnit;
  score: number;
  matchedMember?: FamilyMember;
  matchType: 'head_exact' | 'head_prefix' | 'head_fuzzy' | 'house_number' | 'member_exact' | 'member_prefix' | 'member_fuzzy';
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calculates match score between query and target string.
 * Returns: { score: number, type: 'exact' | 'prefix' | 'fuzzy' | null }
 */
function calculateSimilarity(
  query: string,
  target: string
): { score: number; type: 'exact' | 'prefix' | 'fuzzy' | null } {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (!q || !t) return { score: 0, type: null };

  // 1. Exact match
  if (q === t) {
    return { score: 100, type: 'exact' };
  }

  // 2. Starts with query (prefix match)
  if (t.startsWith(q)) {
    return { score: 85, type: 'prefix' };
  }

  // Target has multiple words; check if any word starts with query
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w === q) return { score: 95, type: 'exact' };
    if (w.startsWith(q)) return { score: 80, type: 'prefix' };
  }

  // 3. Substring match
  if (t.includes(q)) {
    return { score: 70, type: 'prefix' };
  }

  // 4. Fuzzy typo-tolerant matching using Levenshtein distance
  // Allow max edit distance based on query length
  const maxDistance = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;

  // Check against full string or each word
  let minDistance = levenshteinDistance(q, t);
  for (const w of words) {
    const dist = levenshteinDistance(q, w);
    if (dist < minDistance) minDistance = dist;
  }

  if (minDistance <= maxDistance) {
    // Score proportionally to distance
    const fuzzyScore = Math.max(35, 60 - minDistance * 12);
    return { score: fuzzyScore, type: 'fuzzy' };
  }

  return { score: 0, type: null };
}

/**
 * Fuzzy search across Family Folders and Individual Members with intelligent ranking.
 */
export function fuzzySearchFamilies(
  query: string,
  families: FamilyUnit[],
  members: FamilyMember[]
): SearchMatchResult[] {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) {
    // Return all families with neutral score
    return families.map((fam) => ({
      family: fam,
      score: 1,
      matchType: 'head_prefix',
    }));
  }

  const results: SearchMatchResult[] = [];
  const processedFamilyIds = new Set<string>();

  for (const family of families) {
    let bestScore = 0;
    let matchType: SearchMatchResult['matchType'] = 'head_fuzzy';
    let matchedMember: FamilyMember | undefined = undefined;

    // A. Check House Number
    if (family.houseNumber.toString().includes(cleanQuery)) {
      bestScore = 90;
      matchType = 'house_number';
    }

    // B. Check Head Name
    const headMatch = calculateSimilarity(cleanQuery, family.headName);
    if (headMatch.score > bestScore) {
      bestScore = headMatch.score;
      matchType =
        headMatch.type === 'exact'
          ? 'head_exact'
          : headMatch.type === 'prefix'
          ? 'head_prefix'
          : 'head_fuzzy';
    }

    // C. Check All Members in this Family
    const familyMembers = members.filter((m) => m.familyUnitId === family.id);
    for (const member of familyMembers) {
      const memberMatch = calculateSimilarity(cleanQuery, member.name);
      if (memberMatch.score > bestScore) {
        bestScore = memberMatch.score;
        matchedMember = member;
        matchType =
          memberMatch.type === 'exact'
            ? 'member_exact'
            : memberMatch.type === 'prefix'
            ? 'member_prefix'
            : 'member_fuzzy';
      }
    }

    if (bestScore > 0) {
      results.push({
        family,
        score: bestScore,
        matchedMember,
        matchType,
      });
      processedFamilyIds.add(family.id);
    }
  }

  // Sort by highest score first (rank order)
  results.sort((a, b) => b.score - a.score);

  return results;
}
