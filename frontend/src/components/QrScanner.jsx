import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

let regionId = 0;

/** Renders an inline camera QR scanner (used for admin check-in and patient access-grant claims). Calls onResult(text) once, then keeps scanning until unmounted. */
export default function QrScanner({ onResult }) {
  const elId = useRef(`qr-region-${regionId++}`);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(elId.current, { fps: 10, qrbox: 240 }, false);
    scanner.render(
      (decodedText) => onResult(decodedText),
      () => {} // ignore per-frame scan failures -- expected while framing the code
    );
    return () => {
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={elId.current} className="qr-scanner" />;
}
