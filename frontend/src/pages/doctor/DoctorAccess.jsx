import React, { useState } from 'react';
import { doctorApi } from '../../api/client';
import { Button, Card, EmptyState, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function DoctorAccess() {
  const [request, setRequest] = useState(null);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  async function generate() {
    setGenerating(true);
    try {
      const data = await doctorApi.createAccessRequest();
      setRequest(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="stack-lg">
      <h1>Request Patient Access</h1>
      <Card
        title="Generate an access code"
        actions={
          <Button size="sm" onClick={generate} loading={generating}>
            New code
          </Button>
        }
      >
        {!request ? (
          <EmptyState title="Generate a code and have the patient scan it." hint="Valid for 30 minutes." />
        ) : (
          <div className="qr-block">
            <img src={doctorApi.accessRequestQrUrl(request.code)} alt="Access request QR" width={240} height={240} />
            <p className="muted-text">
              Code: <code className="join-code">{request.code}</code>
            </p>
            <p className="muted-text">Expires: {fmtDateTime(request.expiresAt)}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
