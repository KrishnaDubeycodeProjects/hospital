import React, { useEffect, useState } from 'react';
import { patientApi } from '../../api/client';
import QrScanner from '../../components/QrScanner';
import { Button, Card, Field, Input, Modal, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function PatientAccess() {
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState(null);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const [a, h] = await Promise.all([patientApi.activeAccess(), patientApi.accessHistory()]);
      setActive(a);
      setHistory(h);
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accept(rawCode) {
    setClaiming(true);
    try {
      await patientApi.acceptAccess(rawCode.trim());
      toast.success('Access granted to the doctor.');
      setCode('');
      setScanOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setClaiming(false);
    }
  }

  async function revoke(grantId) {
    try {
      await patientApi.revokeAccess(grantId);
      toast.success('Access revoked.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="stack-lg">
      <h1>Doctor Access</h1>

      <Card title="Grant a doctor access" actions={<Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>Scan QR</Button>}>
        <p className="muted-text">Enter the code shown on the doctor's screen, or scan their QR.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) accept(code);
          }}
          className="row-gap"
        >
          <Field label="Access code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. AB12CD" required />
          </Field>
          <Button type="submit" loading={claiming}>
            Grant access
          </Button>
        </form>
      </Card>

      <Card title="Doctors with active access">
        {active ? (
          <Table
            columns={[
              { key: 'doctorName', header: 'Doctor' },
              { key: 'hospitalName', header: 'Hospital' },
              { key: 'grantedAt', header: 'Granted', render: (r) => fmtDateTime(r.grantedAt) },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <Button size="sm" variant="danger" onClick={() => revoke(r.id)}>
                    Revoke
                  </Button>
                ),
              },
            ]}
            rows={active}
            emptyText="No doctor currently has access to your records."
          />
        ) : (
          <Spinner />
        )}
      </Card>

      <Card title="Access history">
        {history ? (
          <Table
            columns={[
              { key: 'doctorName', header: 'Doctor' },
              { key: 'hospitalName', header: 'Hospital' },
              { key: 'grantedAt', header: 'Granted', render: (r) => fmtDateTime(r.grantedAt) },
              { key: 'revokedAt', header: 'Revoked', render: (r) => fmtDateTime(r.revokedAt) },
            ]}
            rows={history}
            emptyText="No history yet."
          />
        ) : (
          <Spinner />
        )}
      </Card>

      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan doctor's QR code">
        {scanOpen && <QrScanner onResult={(text) => accept(text)} />}
      </Modal>
    </div>
  );
}
