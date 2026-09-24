import React, { useEffect, useState } from 'react';
import { doctorApi } from '../../api/client';
import { Button, Card, Field, Input, Spinner, Table } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function DoctorProfile() {
  const { setDoctorProfile } = useAuth();
  const [me, setMe] = useState(null);
  const [slots, setSlots] = useState(null);
  const [hospitalCode, setHospitalCode] = useState('');
  const [joining, setJoining] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const profile = await doctorApi.me();
      setMe(profile);
      setDoctorProfile(profile);
      const mySlots = await doctorApi.myTimeSlots();
      setSlots(mySlots);
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function joinHospital(e) {
    e.preventDefault();
    setJoining(true);
    try {
      await doctorApi.joinHospital(hospitalCode);
      toast.success('Joined hospital.');
      setHospitalCode('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (!me) return <Spinner />;

  return (
    <div className="stack-lg">
      <h1>My Profile</h1>
      <Card title={me.name}>
        <dl className="detail-list">
          <div className="detail-row">
            <dt>Doctor ID</dt>
            <dd>
              <code>{me.id}</code> — share this with hospital reception so they can assign you to a counter.
            </dd>
          </div>
          <div className="detail-row" style={{ alignItems: 'center' }}>
            <dt>Doctor Phone</dt>
            <dd>
              <span
                style={{
                  fontSize: '14.5px',
                  fontWeight: '700',
                  color: '#0f172a',
                  backgroundColor: '#f1f5f9',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  display: 'inline-block',
                  letterSpacing: '0.03em',
                  fontFamily: 'monospace',
                }}
              >
                📞 {me.phone}
              </span>
            </dd>
          </div>
          <div className="detail-row">
            <dt>Hospital</dt>
            <dd>{me.hospitalName || 'Not linked yet'}</dd>
          </div>
          {me.category && (
            <div className="detail-row">
              <dt>Assigned location</dt>
              <dd>
                Counter {me.counterId} — {me.category}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {!me.hospitalId && (
        <Card title="Join a hospital">
          <p className="muted-text">Enter the join code your hospital's admin gave you.</p>
          <form onSubmit={joinHospital} className="row-gap">
            <Field label="Hospital code">
              <Input value={hospitalCode} onChange={(e) => setHospitalCode(e.target.value)} required />
            </Field>
            <Button type="submit" loading={joining}>
              Join
            </Button>
          </form>
        </Card>
      )}

      <Card title="My OPD schedule">
        {slots ? (
          <Table
            columns={[
              { key: 'slotDate', header: 'Date' },
              { key: 'startTime', header: 'Start' },
              { key: 'endTime', header: 'End' },
              { key: 'category', header: 'Department', render: (r) => r.category || 'Hospital-wide' },
            ]}
            rows={slots}
            emptyText="No upcoming time slots."
          />
        ) : (
          <Spinner />
        )}
      </Card>
    </div>
  );
}
