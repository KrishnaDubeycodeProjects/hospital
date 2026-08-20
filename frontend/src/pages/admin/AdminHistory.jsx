import React, { useState } from 'react';
import { queueApi } from '../../api/client';
import { Button, Card, Field, Input, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const columns = [
  { key: 'id', header: 'Visit ID' },
  { key: 'name', header: 'Name', render: (r) => r.name || '—' },
  { key: 'age', header: 'Age', render: (r) => r.age ?? '—' },
  { key: 'category', header: 'Department', render: (r) => r.category || '—' },
  { key: 'servedAt', header: 'Served', render: (r) => fmtDateTime(r.servedAt) },
  { key: 'completedAt', header: 'Completed', render: (r) => fmtDateTime(r.completedAt) },
];

export default function AdminHistory() {
  const [phone, setPhone] = useState('');
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await queueApi.history(phone);
      setRows(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <h1>Visit History</h1>
      <Card title="Look up by phone number">
        <form onSubmit={search} className="row-gap">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" required />
          </Field>
          <Button type="submit" loading={loading}>
            Search
          </Button>
        </form>
      </Card>
      {rows && (
        <Card title={`Past visits for ${phone}`}>
          <Table columns={columns} rows={rows} emptyText="No past visits under this number." />
        </Card>
      )}
    </div>
  );
}
