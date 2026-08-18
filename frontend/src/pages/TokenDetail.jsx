import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { queueApi } from '../api/client';
import TokenCard from '../components/TokenCard';
import { Card, EmptyState, Spinner } from '../components/ui';

export default function TokenDetail() {
  const { id } = useParams();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setToken(await queueApi.tokenDetails(id));
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <Spinner label="Loading your token…" />;

  return (
    <div className="public-page">
      <Link to="/" className="auth-back">
        ← Back to home
      </Link>
      {token ? (
        <Card title={`Token #${token.dailyNumber ?? token.id}`} className="narrow-card">
          <TokenCard token={token} onRefresh={load} />
        </Card>
      ) : (
        <EmptyState title="Token not found." />
      )}
    </div>
  );
}
