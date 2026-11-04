/**
 * AarogyaFlow design tokens — the single source of truth for every screen.
 *
 * Design read: offline field tool for frontline NHM workers (low digital literacy, budget
 * Android, bright sunlight). Trust-first, icon-first, airy. Dials: variance 3 · motion 2 · density 3.
 *
 * Locks (do not deviate per screen):
 *  - ONE accent: emerald. Red / amber / green carry clinical/operational meaning only.
 *  - ONE radius scale: cards 16 · controls 14 · pills full.
 *  - Touch targets ≥ 48 dp. Devanagari line-height = 1.35 × font size.
 *  - Lucide icons only, strokeWidth 2. No emoji in UI.
 */
import { TextStyle } from 'react-native';

export const color = {
  // Accent (emerald) — primary actions, active tab, brand
  accent: '#047857',
  accentPressed: '#065F46',
  accentSoft: '#ECFDF5',
  accentLine: '#A7F3D0',

  // Status — meaning only
  red: '#DC2626', // high risk, urgent, overdue, failed
  redSoft: '#FEF2F2',
  redLine: '#FECACA',
  redText: '#991B1B',
  amber: '#D97706', // due soon, pending, local-only
  amberSoft: '#FFFBEB',
  amberLine: '#FDE68A',
  amberText: '#92400E',
  green: '#059669', // done, normal, synced
  greenSoft: '#ECFDF5',
  greenLine: '#A7F3D0',
  greenText: '#065F46',

  // Neutrals (cool slate only)
  ink: '#0F172A',
  text: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  lineSoft: '#F1F5F9',
  surface: '#FFFFFF',
  canvas: '#F8FAFC',
  white: '#FFFFFF',
} as const;

export type Tone = 'accent' | 'red' | 'amber' | 'green' | 'neutral';

/** Foreground / soft background / border triple for a tone. */
export function tonePalette(tone: Tone): { fg: string; bg: string; line: string; text: string } {
  switch (tone) {
    case 'red':
      return { fg: color.red, bg: color.redSoft, line: color.redLine, text: color.redText };
    case 'amber':
      return { fg: color.amber, bg: color.amberSoft, line: color.amberLine, text: color.amberText };
    case 'green':
      return { fg: color.green, bg: color.greenSoft, line: color.greenLine, text: color.greenText };
    case 'accent':
      return { fg: color.accent, bg: color.accentSoft, line: color.accentLine, text: color.accentPressed };
    default:
      return { fg: color.muted, bg: color.lineSoft, line: color.line, text: color.text };
  }
}

export const radius = { card: 16, control: 14, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const touch = 48;
export const icon = { stroke: 2, sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Text style with Devanagari-safe line height (1.35×). */
export function type(size: number, weight: TextStyle['fontWeight'] = '500', c: string = color.ink): TextStyle {
  return { fontSize: size, fontWeight: weight, lineHeight: Math.round(size * 1.35), color: c };
}

export const text = {
  display: type(26, '800'), // big numbers (house no., counts)
  title: type(20, '800'),
  heading: type(17, '700'),
  body: type(15, '500', color.text),
  label: type(14, '700'),
  caption: type(13, '500', color.muted),
  micro: type(12, '600', color.muted),
} as const;

/** Subtle, hue-tinted elevation (no muddy shadows). */
export const elevation = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;
