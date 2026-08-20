import React, { useEffect, useState } from 'react';
import { patientApi } from '../../api/client';
import { Card, Spinner, Table, fmtDateTime } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const columns = [
  { key: 'id', header: 'Visit ID' },
  { key: 'name', header: 'Name', render: (r) => r.name || '—' },
  { key: 'age', header: 'Age', render: (r) => r.age ?? '—' },
  { key: 'category', header: 'Department', render: (r) => r.category || '—' },
  { key: 'servedAt', header: 'Served', render: (r) => fmtDateTime(r.servedAt) },
  { key: 'completedAt', header: 'Completed', render: (r) => fmtDateTime(r.completedAt) },
];

export default function PatientHistory() {
  const [rows, setRows] = useState(null);
  const toast = useToast();

  useEffect(() => {
    patientApi
      .history()
      .then(setRows)
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack-lg">
      <h1>Visit History</h1>
      <Card>{rows ? <Table columns={columns} rows={rows} emptyText="No past visits yet." /> : <Spinner />}</Card>
    </div>
  );
}
