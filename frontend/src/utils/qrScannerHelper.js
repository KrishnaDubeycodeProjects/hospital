/**
 * Universal QR parser: extracts session ID, ANM code, or phone from any scanned string,
 * URL, JSON payload, or formatted identifier.
 */
export function parseQrIdentifier(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();

  // 1. If wrapped in quotes, unwrap
  let clean = trimmed.replace(/^["']+|["']+$/g, '');

  // 2. If URL, parse query params
  if (clean.includes('?') && (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/'))) {
    try {
      const url = new URL(clean, 'https://dummy.org');
      const paramVal =
        url.searchParams.get('code') ||
        url.searchParams.get('qr') ||
        url.searchParams.get('anm') ||
        url.searchParams.get('session') ||
        url.searchParams.get('phone') ||
        url.searchParams.get('id');
      if (paramVal) return paramVal.trim();
    } catch {
      const m = clean.match(/[?&](?:code|qr|anm|session|phone|id)=([^&]+)/i);
      if (m) return decodeURIComponent(m[1]).trim();
    }
  }

  // 3. If JSON payload (e.g. from ASHA sync QR or ANM session export)
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.session) return String(parsed.session).trim();
      if (parsed.code) return String(parsed.code).trim();
      if (parsed.qrCode) return String(parsed.qrCode).trim();
      if (parsed.qrCodeValue) return String(parsed.qrCodeValue).trim();
      if (parsed.anmIdentifier) return String(parsed.anmIdentifier).trim();
      if (parsed.anmPhone) return String(parsed.anmPhone).trim();
      if (parsed.p) return String(parsed.p).trim();
      if (parsed.phone) return String(parsed.phone).trim();
    } catch {
      // not valid JSON, proceed
    }
  }

  // 4. If matches ANM session token (e.g. ANM-QR-CHILD-VAX-CHANDPUR, ANM-QR-VAX-1234, ANM-CHANDPUR-01)
  const anmMatch = clean.match(/ANM(?:-QR)?-[A-Za-z0-9_-]+/i);
  if (anmMatch) {
    return anmMatch[0].trim();
  }

  // 5. If contains a 10-digit mobile number (e.g. 9876543211 or +919876543211)
  const digits = clean.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return clean;
}
