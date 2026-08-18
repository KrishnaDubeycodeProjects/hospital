import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { queueApi } from '../api/client';
import { Button, Card, EmptyState, Field, Input, Spinner } from '../components/ui';

export default function Track() {
  const params = useParams();
  const [phone, setPhone] = useState(params.phone || '');
  const [loading, setLoading] = useState(!!params.phone);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (params.phone) lookup(params.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.phone]);

  async function lookup(p) {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await queueApi.position(p);
      navigate(`/token/${data.id}`);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (phone.trim()) {
      navigate(`/track/${encodeURIComponent(phone.trim())}`);
      lookup(phone.trim());
    }
  }

  return (
    <div className="public-page">
      <Link to="/" className="auth-back">
        ← Back to home
      </Link>
      <Card title="Track my token" className="narrow-card">
        <form onSubmit={submit} className="stack-md">
          <Field label="Phone number used at check-in">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" required />
          </Field>
          <Button type="submit">Check status</Button>
        </form>
        {loading && <Spinner label="Looking up your token…" />}
        {notFound && (
          <EmptyState title="No active token found for this number." hint="It may have been completed already, or you haven't checked in yet." />
        )}
        {notFound && (
          <Link to="/book">
            <Button variant="secondary" className="full-width">
              Book a new token
            </Button>
          </Link>
        )}
      </Card>
    </div>
  );
}
