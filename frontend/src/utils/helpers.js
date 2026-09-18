/**
 * Cleans user phone input: strips non-digits, prepends +91 if 10-digit Indian number.
 */
export function cleanPhone(input) {
  if (!input) return '';
  let digits = input.trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = '+' + digits.slice(1).replace(/\D/g, '');
  } else if (digits.length === 10) {
    digits = '+91' + digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    digits = '+' + digits;
  }
  return digits;
}

/**
 * Checks whether a hospital OPD is currently open based on openTime and closeTime (HH:mm format).
 */
export function isOpenNow(h) {
  if (!h || !h.openTime || !h.closeTime) return true;
  if (h.openTime === '00:00' && (h.closeTime === '23:59' || h.closeTime === '24:00')) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMins = (str) => {
    if (!str) return 0;
    const [hh, mm] = str.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  const openMins = parseMins(h.openTime);
  const closeMins = parseMins(h.closeTime);

  if (closeMins > openMins) {
    return currentMinutes >= openMins && currentMinutes < closeMins;
  } else {
    // Overnight shift e.g. 20:00 to 06:00
    return currentMinutes >= openMins || currentMinutes < closeMins;
  }
}

/**
 * Formats distance in km or meters nicely.
 */
export function formatDistance(distanceKm) {
  if (distanceKm == null || isNaN(distanceKm)) return null;
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Formats distance in km or meters nicely as an approximate human-friendly string (e.g. ~11.2 km).
 */
export function formatApproxDistance(distanceKm, fallback = '~8.8 km') {
  if (distanceKm == null || distanceKm === '') return fallback;
  const cleaned = String(distanceKm).replace('~', '').replace(/km/i, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return String(distanceKm);
  if (num < 1) {
    return `~${Math.round(num * 1000)} m`;
  }
  return `~${num.toFixed(1)} km`;
}

/**
 * Formats ISO date or timestamp into human friendly string.
 */
export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}
