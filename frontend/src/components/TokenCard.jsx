import React, { useEffect, useState } from 'react';
import { fetchAsObjectUrl, queueApi } from '../api/client';
import { Button, StatusBadge, fmtDateTime, fmtMinutes } from './ui';
import { useToast } from '../context/ToastContext';

/** Full status view of one token -- position, ETA, QR, "share location" / "will I make it" actions. Reused by the public token page and the patient portal's own-token view. */
export default function TokenCard({ token, onRefresh }) {
  const [sharing, setSharing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feasibility, setFeasibility] = useState(null);
  const [qrObjectUrl, setQrObjectUrl] = useState(null);
  const toast = useToast();

  // Plain <img src="..."> can't carry the ngrok-skip-browser-warning header axios
  // attaches for VITE_API_URL pointed at an ngrok tunnel -- ngrok then serves its
  // HTML interstitial instead of the PNG, and the <img> just shows broken. Route
  // the QR fetch through the same authed/headered axios client used elsewhere for
  // protected binary routes and hand the browser an object URL instead.
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setQrObjectUrl(null);
    fetchAsObjectUrl(queueApi.qrUrl(token.id))
      .then((url) => {
        if (cancelled) return;
        objectUrl = url;
        setQrObjectUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token.id]);

  const terminal = ['completed', 'missed', 'rejected'].includes(token.status);
  // Patient-facing number: resets per hospital+department+day (dailyNumber) instead
  // of the raw `id`, which is one sequence shared across every hospital/department.
  const displayNumber = token.dailyNumber ?? token.id;

  function shareLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser.');
      return;
    }
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await queueApi.setLocation(token.id, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          toast.success('Location shared successfully.');
          onRefresh?.();
        } catch (err) {
          toast.error(err.message);
        } finally {
          setSharing(false);
        }
      },
      (err) => {
        setSharing(false);
        toast.error(err.message || 'Could not get your location.');
      }
    );
  }

  function checkClosing() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser.');
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setFeasibility(await queueApi.closingTimeCheck(pos.coords.latitude, pos.coords.longitude));
        } catch (err) {
          toast.error(err.message);
        } finally {
          setChecking(false);
        }
      },
      (err) => {
        setChecking(false);
        toast.error(err.message || 'Could not get your location.');
      }
    );
  }

  // Calculate Date and Slot window
  const dateObj = token.createdAt ? new Date(token.createdAt) : new Date();
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });


  return (
    <div>
      {/* Registration Summary Banner */}
      <div className="callout callout-ok" style={{ display: 'block', margin: '0 0 20px', padding: '18px' }}>
        <div style={{ fontWeight: 800, fontSize: '16px', color: '#047857', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ Registration Confirmed</span>
          <StatusBadge status={token.status} />
        </div>
        <dl className="detail-list" style={{ margin: 0 }}>
          {token.hospitalName && <Row label="🏛️ Hospital" value={token.hospitalName} />}
          <Row label="📅 Booking Date" value={dateStr} />
          <Row label="🎟️ Token Number" value={`#${displayNumber}`} />
          {token.name && <Row label="👤 Patient Name" value={token.name} />}
          {token.category && <Row label="🏥 Department" value={token.category} />}
        </dl>
      </div>

      <div className="token-summary">
        <div className="token-number">#{displayNumber}</div>
        <StatusBadge status={token.status} />
      </div>
      {!terminal && (
        <div className="token-position">
          {token.position ? `Position ${token.position} in queue` : 'Position updating…'}
          {typeof token.peopleAhead === 'number' && <span> · {token.peopleAhead} ahead of you</span>}
        </div>
      )}

      <dl className="detail-list">
        {typeof token.currentServing === 'number' && <Row label="Now serving" value={`#${token.currentServing}`} />}
        {token.treatmentRemainingMinutes != null && (
          <Row label="Estimated wait" value={fmtMinutes(token.treatmentRemainingMinutes)} />
        )}
        {token.anomalyControlUntil && <Row label="Please arrive by" value={fmtDateTime(token.anomalyControlUntil)} />}
        <Row label="Checked in" value={fmtDateTime(token.createdAt)} />
      </dl>

      {!terminal && (
        <div className="row-gap">
          <Button variant="secondary" onClick={shareLocation} loading={sharing}>
            Share my location
          </Button>
          <Button variant="ghost" onClick={checkClosing} loading={checking}>
            Will I make it before closing?
          </Button>
        </div>
      )}

      {feasibility && (
        <div className={`callout ${feasibility.canMakeIt === false ? 'callout-warn' : 'callout-ok'}`} style={{ marginTop: '16px' }}>
          {feasibility.canMakeIt === false
            ? `You may not make it in time — about ${fmtMinutes(feasibility.travelMinutes)} away, ${fmtMinutes(
                feasibility.minutesUntilClose
              )} left before closing.`
            : `You're on track — about ${fmtMinutes(feasibility.travelMinutes)} away, ${fmtMinutes(
                feasibility.minutesUntilClose
              )} left before closing.`}
        </div>
      )}

      <div className="qr-block">
        {qrObjectUrl ? (
          <img src={qrObjectUrl} alt="Token QR" width={200} height={200} />
        ) : (
          <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="muted-text">Loading QR…</span>
          </div>
        )}
        <p className="muted-text">Show this QR to staff when called.</p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
