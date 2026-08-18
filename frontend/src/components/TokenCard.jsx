import React, { useState } from 'react';
import { queueApi } from '../api/client';
import { Button, StatusBadge, fmtDateTime, fmtMinutes } from './ui';
import { useToast } from '../context/ToastContext';

/** Full status view of one token -- position, ETA, QR, "share location" / "will I make it" actions. Reused by the public token page and the patient portal's own-token view. */
export default function TokenCard({ token, onRefresh }) {
  const [sharing, setSharing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feasibility, setFeasibility] = useState(null);
  const toast = useToast();

  const terminal = ['completed', 'missed', 'rejected'].includes(token.status);

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
          toast.success('Location shared — your ETA will update shortly.');
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

  return (
    <div>
      <div className="token-summary">
        <div className="token-number">#{token.id}</div>
        <StatusBadge status={token.status} />
      </div>
      {!terminal && (
        <div className="token-position">
          {token.position ? `Position ${token.position} in queue` : 'Position updating…'}
          {typeof token.peopleAhead === 'number' && <span> · {token.peopleAhead} ahead of you</span>}
        </div>
      )}

      <dl className="detail-list">
        {token.name && <Row label="Name" value={token.name} />}
        {token.category && <Row label="Department" value={token.category} />}
        {typeof token.currentServing === 'number' && <Row label="Now serving" value={`#${token.currentServing}`} />}
        {token.travelMinutes != null && <Row label="Your travel ETA" value={fmtMinutes(token.travelMinutes)} />}
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
        <div className={`callout ${feasibility.canMakeIt === false ? 'callout-warn' : 'callout-ok'}`}>
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
        <img src={queueApi.qrUrl(token.id)} alt={`QR code for token ${token.id}`} width={220} height={220} />
        <p className="muted-text">Show this QR at reception to check in.</p>
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
