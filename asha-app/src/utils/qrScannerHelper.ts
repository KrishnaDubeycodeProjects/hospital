import jsQR from 'jsqr';

/**
 * Universal QR parser: extracts session ID, ANM code, or phone from any scanned string,
 * URL, JSON payload, or formatted identifier.
 */
export function parseQrIdentifier(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

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
      // fallback to regex query param match
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

/**
 * Multi-pass robust QR code scanner:
 * - Uses native BarcodeDetector if available (hardware accelerated, high accuracy)
 * - Multi-resolution canvas passes (1200px, 800px, 500px)
 * - Center-crop pass (for when QR is centered in camera viewfinder)
 * - Contrast & adaptive binarization pass (for low lighting, phone screen glare, reflections)
 */
export async function scanQrFromImageFile(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('फ़ोटो फ़ाइल लोड नहीं हो सकी (Failed to read file)'));
    reader.onload = async (e) => {
      const src = e.target?.result as string;
      if (!src) {
        return reject(new Error('फ़ोटो खाली है (Empty image)'));
      }

      const img = new Image();
      img.onerror = () => reject(new Error('छवि लोड करने में त्रुटि (Failed to load image)'));
      img.onload = async () => {
        try {
          // Pass 1: Native BarcodeDetector (Chrome, Edge, Android Chrome, Safari 17+)
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              const codes = await detector.detect(img);
              if (codes && codes.length > 0 && codes[0]?.rawValue) {
                return resolve(codes[0].rawValue);
              }
            } catch (err) {
              console.warn('Native BarcodeDetector pass failed, proceeding to jsQR:', err);
            }
          }

          // Pass 2: Helper to render to canvas and attempt jsQR decode
          const tryDecode = (
            targetW: number,
            targetH: number,
            crop?: { sx: number; sy: number; sw: number; sh: number },
            binarize?: boolean
          ): string | null => {
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;

            if (crop) {
              ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, targetW, targetH);
            } else {
              ctx.drawImage(img, 0, 0, targetW, targetH);
            }

            const imgData = ctx.getImageData(0, 0, targetW, targetH);
            const d = imgData.data;

            if (binarize) {
              let sum = 0;
              const len = d.length;
              for (let i = 0; i < len; i += 4) {
                sum += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
              }
              const avg = sum / (len / 4);
              for (let i = 0; i < len; i += 4) {
                const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
                const v = lum > avg ? 255 : 0;
                d[i] = v;
                d[i + 1] = v;
                d[i + 2] = v;
              }
            }

            const result = jsQR(d, targetW, targetH, {
              inversionAttempts: 'attemptBoth',
            });
            return result?.data || null;
          };

          const origW = img.width;
          const origH = img.height;

          // Scale helper
          const getDims = (maxDim: number) => {
            let tw = origW;
            let th = origH;
            if (tw > maxDim || th > maxDim) {
              if (tw > th) {
                th = Math.round((th * maxDim) / tw);
                tw = maxDim;
              } else {
                tw = Math.round((tw * maxDim) / th);
                tw = maxDim;
              }
            }
            return { tw, th };
          };

          // Attempt A: 1000px scale
          const d1000 = getDims(1000);
          let found = tryDecode(d1000.tw, d1000.th);
          if (found) return resolve(found);

          // Attempt B: 700px scale
          const d700 = getDims(700);
          found = tryDecode(d700.tw, d700.th);
          if (found) return resolve(found);

          // Attempt C: Center Crop (50% box in middle) at 700px
          const cropW = Math.round(origW * 0.6);
          const cropH = Math.round(origH * 0.6);
          const cropX = Math.round((origW - cropW) / 2);
          const cropY = Math.round((origH - cropH) / 2);
          found = tryDecode(600, 600, { sx: cropX, sy: cropY, sw: cropW, sh: cropH });
          if (found) return resolve(found);

          // Attempt D: Binarized / High-contrast pass at 700px (handles glare & low light)
          found = tryDecode(d700.tw, d700.th, undefined, true);
          if (found) return resolve(found);

          // Attempt E: Binarized Center Crop
          found = tryDecode(600, 600, { sx: cropX, sy: cropY, sw: cropW, sh: cropH }, true);
          if (found) return resolve(found);

          // Attempt F: Full unscaled resolution (if under 1600px)
          if (origW <= 1600 && origH <= 1600 && (origW !== d700.tw || origH !== d700.th)) {
            found = tryDecode(origW, origH);
            if (found) return resolve(found);
          }

          reject(new Error('QR कोड पहचाना नहीं जा सका। कृपया कैमरे को सीधा रखें और स्पष्ट फोटो लें।'));
        } catch (err: any) {
          reject(err);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
