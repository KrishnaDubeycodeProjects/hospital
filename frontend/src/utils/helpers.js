/**
 * Cleans user phone input: decodes URI components, strips %2B/url encoding,
 * extracts digits, and ensures standard E.164 +91XXXXXXXXXX.
 */
export function cleanPhone(input) {
  if (!input) return '';
  let str = String(input).trim();
  try {
    str = decodeURIComponent(str);
    if (str.includes('%')) {
      str = decodeURIComponent(str);
    }
  } catch (e) {}
  str = str.replace(/%2b/gi, '+').trim();
  
  let digits = str.replace(/\D/g, '');
  if (digits.length === 10) {
    return '+91' + digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return '+' + digits;
  }
  if (digits.length > 10) {
    return '+91' + digits.slice(-10);
  }
  return digits ? ('+' + digits) : '';
}

/**
 * Formats a phone number for clean human display (e.g. "+91 91000 00099"),
 * completely preventing raw URL encodings like "%2B919100000099".
 */
export function formatDisplayPhone(input) {
  if (!input) return '';
  let str = String(input).trim();
  try {
    str = decodeURIComponent(str);
    if (str.includes('%')) {
      str = decodeURIComponent(str);
    }
  } catch (e) {}
  str = str.replace(/%2b/gi, '+').trim();

  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  if (digits.length > 10) {
    const local = digits.slice(-10);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return str.startsWith('+') ? str : (digits ? `+${digits}` : str);
}

/**
 * Checks whether a hospital OPD is currently open based on openTime and closeTime (HH:mm format).
 */
export function isOpenNow(h) {
  if (!h) return true;
  const name = (h.name || h.hospital_name || '').toLowerCase();
  const slug = (h.uriSlug || h.slug || '').toLowerCase();
  const cleanName = name.replace(/\s+/g, '');
  if (slug === 'main' || name.includes('aarogya') || name.includes('arogya') || cleanName.includes('aarogyaflow') || cleanName.includes('arogyaflow')) return true;
  if (!h.openTime || !h.closeTime) return true;
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

export const normalizePhone = cleanPhone;
