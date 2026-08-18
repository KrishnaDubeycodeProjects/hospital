import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hospitalApi } from '../api/client';
import { Badge, Button, Card, EmptyState, Field, Select, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';

const PAGE_SIZE = 20;

/**
 * Public "share your location, see nearby hospitals" page -- the web twin of
 * the WhatsApp bot's location-based hospital search (see
 * WebhookController#sendLocationPrompt / QueueManagerService#searchAndOfferHospitals).
 * Sent as a fallback link on WhatsApp for patients whose native location
 * share doesn't land (live location on Evolution API in particular).
 * Shows 20 hospitals at a time with a "Load more" for the next 20, backed by
 * GET /api/hospitals/nearby (offset/limit -- same page size as the bot).
 */
export default function FindHospital() {
  const [params] = useSearchParams();
  const initialCategory = params.get('category') || '';

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(initialCategory);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const toast = useToast();

  useEffect(() => {
    hospitalApi.categories().then(setCategories).catch(() => {});
  }, []);

  function shareLocation() {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setLocationError(err.message || 'Could not get your location. Please allow location access and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function search(offset) {
    if (!coords) return;
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await hospitalApi.nearby({
        lat: coords.lat,
        lon: coords.lon,
        category: category || undefined,
        offset,
        limit: PAGE_SIZE,
      });
      setResults((prev) => (offset === 0 ? res.results : [...prev, ...res.results]));
      setHasMore(res.hasMore);
      setNextOffset(res.nextOffset);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Fresh search from the top whenever we get a location fix or the department filter changes.
  useEffect(() => {
    if (coords) search(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, category]);

  return (
    <div className="public-page">
      <Link to="/" className="auth-back">
        ← Back to home
      </Link>
      <Card title="🏥 Find hospitals near you" className="narrow-card">
        <div className="stack-md">
          <p className="muted-text">
            Share your location and we'll show the nearest hospitals for your department, closest first -- the same
            list the WhatsApp bot offers.
          </p>

          <Field label="Department" hint="Optional -- leave blank to see every department.">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All departments</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="button" onClick={shareLocation} loading={locating}>
            📍 {coords ? 'Location shared ✓ -- refresh' : 'Share my location'}
          </Button>
          {locationError && <p className="field-error">{locationError}</p>}
        </div>
      </Card>

      {coords && (
        <Card title="Nearest hospitals" className="narrow-card">
          {loading ? (
            <Spinner label="Finding nearby hospitals…" />
          ) : results.length === 0 ? (
            <EmptyState
              title="No hospitals found nearby"
              hint={category ? 'Try clearing the department filter.' : 'Try again in a while.'}
            />
          ) : (
            <div className="stack-md">
              <div className="hospital-scroll-list">
                {results.map((r, idx) => (
                  <HospitalResultRow key={r.hospital.id} rank={idx + 1} match={r} category={category} />
                ))}
              </div>
              {hasMore && (
                <Button type="button" variant="secondary" onClick={() => search(nextOffset)} loading={loadingMore}>
                  Load 20 more
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function isOpenNow(h) {
  if (!h.openTime || !h.closeTime) return true;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + mm;
  };
  return nowMin >= toMin(h.openTime) && nowMin < toMin(h.closeTime);
}

function HospitalResultRow({ rank, match, category }) {
  const h = match.hospital;
  const open = isOpenNow(h);
  const bookHref = `/book?hospitalId=${h.id}&hospitalName=${encodeURIComponent(h.name)}${
    category ? `&category=${encodeURIComponent(category)}` : ''
  }`;
  return (
    <div className="hospital-list-item">
      <div className="hospital-item-title">
        <strong>
          #{rank} {h.name}
        </strong>
        <Badge tone={open ? 'green' : 'red'}>{open ? '🟢 Open' : '🔴 Closed'}</Badge>
      </div>
      <div className="muted-text" style={{ fontSize: '13px', marginTop: '4px' }}>
        📍 {h.address || 'Address not available'} · 📏 ~{match.distanceKm.toFixed(1)} km away
      </div>
      <div className="muted-text" style={{ fontSize: '13px', marginTop: '2px' }}>
        ⏰ OPD: {h.openTime || '—'} – {h.closeTime || '—'}
      </div>
      {h.categories && h.categories.length > 0 && (
        <div className="category-pills" style={{ marginTop: '6px' }}>
          {h.categories.map((c) => (
            <span key={c} className="cat-pill">
              {c}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: '10px' }}>
        <Link to={bookHref} className="btn btn-primary btn-sm">
          Book here
        </Link>
      </div>
    </div>
  );
}
