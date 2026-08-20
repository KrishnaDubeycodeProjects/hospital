import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScannerModal({ isOpen, onClose, onVerify }) {
  const [manualInput, setManualInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setScanError('');
      setManualInput('');

      // Initialize HTML5 QR Scanner
      const scanner = new Html5QrcodeScanner(
        'qr-reader-container',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        /* verbose= */ false
      );

      scanner.render(
        async (decodedText) => {
          // Pause/clear scanner on successful read
          scanner.clear();
          handleVerify(decodedText);
        },
        (errorMessage) => {
          // Ignore frequent frame scan errors
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error('Scanner clear error', err));
        }
      };
    }
  }, [isOpen]);

  const handleVerify = async (dataToVerify) => {
    if (!dataToVerify) return;
    setVerifying(true);
    setScanError('');
    setScanResult(null);

    try {
      const res = await onVerify(dataToVerify);
      if (res && res.success) {
        setScanResult(res);
      } else {
        setScanError('Token verification failed.');
      }
    } catch (err) {
      setScanError(err.message || 'Failed to verify token.');
    } finally {
      setVerifying(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleVerify(manualInput.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
      padding: '1rem'
    }}>
      <div className="card modal-content" style={{
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📷 Admin QR Scanner
          </h3>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
          Scan patient's token QR code or enter Token ID to verify hospital arrival.
        </p>

        {scanError && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
            ⚠️ {scanError}
          </div>
        )}

        {scanResult && (
          <div className="alert alert-success" style={{
            backgroundColor: '#dcfce7',
            borderColor: '#86efac',
            color: '#166534',
            marginBottom: '1rem',
            padding: '1rem',
            borderRadius: '10px'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#15803d' }}>
              ✅ VERIFICATION SUCCESSFUL!
            </h4>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Token #:</strong> {scanResult.data?.id}
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Patient Name:</strong> {scanResult.data?.name}
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Status:</strong> Hospital Verified & Checked-In
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
              💬 Welcome WhatsApp message sent to patient's phone!
            </p>
            <button 
              className="btn btn-success btn-sm" 
              onClick={() => setScanResult(null)}
              style={{ marginTop: '0.75rem', width: '100%' }}
            >
              Scan Next Patient QR
            </button>
          </div>
        )}

        {!scanResult && (
          <>
            {/* Camera QR Reader Container */}
            <div 
              id="qr-reader-container" 
              style={{ 
                width: '100%', 
                borderRadius: '12px', 
                overflow: 'hidden',
                border: '2px dashed #cbd5e1',
                marginBottom: '1.25rem'
              }}
            ></div>

            {/* Manual Code Entry Option */}
            <form onSubmit={handleManualSubmit} style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                Or Enter Token ID / Code Manually:
              </label>
              <div className="input-group" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="text"
                  placeholder="e.g. 12 or TOKEN_12"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={verifying || !manualInput.trim()}
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
