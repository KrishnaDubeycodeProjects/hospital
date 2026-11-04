/**
 * Visit-status badge (same API as before) rendered with the kit's StatusPill.
 * Colour = meaning: 7 days red · 15 days / due amber · visited green · rest neutral.
 */
import React from 'react';
import { StatusPill, Tone, useTr } from '../ui';

export type StatusType = '7days' | '15days' | '30days' | 'visited' | 'noData' | 'pregnant' | 'dueSoon';

interface StatusBadgeProps {
  type: StatusType;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, label }) => {
  const tr = useTr();
  const config: Record<StatusType, { tone: Tone; label: string }> = {
    '7days': { tone: 'red', label: tr('7 दिन', '7 दिवस') },
    '15days': { tone: 'amber', label: tr('15 दिन', '15 दिवस') },
    '30days': { tone: 'neutral', label: tr('30 दिन', '30 दिवस') },
    dueSoon: { tone: 'amber', label: tr('देय', 'देय') },
    visited: { tone: 'green', label: tr('भेंट पूर्ण', 'भेट पूर्ण') },
    pregnant: { tone: 'accent', label: tr('गर्भवती', 'गरोदर') },
    noData: { tone: 'neutral', label: tr('जानकारी नहीं', 'माहिती नाही') },
  };
  const c = config[type] || config.noData;
  return <StatusPill tone={c.tone} label={label || c.label} />;
};
