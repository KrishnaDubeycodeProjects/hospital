import React, { useEffect, useState } from 'react';
import { doctorApi } from '../../api/client';
import { Button, Card, Field, Input, Spinner, Table } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Stethoscope, Phone, Building2, Calendar, ShieldCheck, Hash, UserCheck } from 'lucide-react';

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
      toast.success('Joined hospital successfully.');
      setHospitalCode('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (!me) return <Spinner label="Loading doctor profile..." />;

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Stethoscope size={28} color="#0284c7" />
            Doctor Profile
          </h1>
          <p className="muted-text">
            Registered Healthcare Professional
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} />
            Verified Doctor
          </span>
        </div>
      </div>

      {/* Primary Clinical Credentials Card */}
      <Card title={me.name}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', padding: '6px 0' }}>
          
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7', flexShrink: 0 }}>
              <Hash size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Doctor ID</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace', marginTop: '2px' }}>
                DOC-{me.id}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                Share with hospital reception to link your room
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', flexShrink: 0 }}>
              <Phone size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Registered Contact</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace', marginTop: '2px' }}>
                {me.phone ? (me.phone.startsWith('+') ? me.phone : `+91 ${me.phone}`) : '+91 98888 77777'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#16A34A', marginTop: '2px', fontWeight: 600 }}>
                WhatsApp OTP Enabled
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Hospital / Clinic</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                {me.hospitalName || 'Not Linked Yet'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                {me.category ? `Counter ${me.counterId || '1'} (${me.category})` : 'Join code required'}
              </div>
            </div>
          </div>

        </div>
      </Card>

      {!me.hospitalId && (
        <Card title="Join a Hospital">
          <p className="muted-text">Enter the hospital code provided by your hospital administrator.</p>
          <form onSubmit={joinHospital} className="row-gap">
            <Field label="Hospital Code">
              <Input value={hospitalCode} onChange={(e) => setHospitalCode(e.target.value.toUpperCase())} placeholder="e.g. AIIMS-01" required />
            </Field>
            <Button type="submit" loading={joining}>
              Join Hospital
            </Button>
          </form>
        </Card>
      )}

      <Card title="My Duty Schedule">
        {slots ? (
          <Table
            columns={[
              { key: 'slotDate', header: 'Duty Date' },
              { key: 'startTime', header: 'Reporting Time' },
              { key: 'endTime', header: 'End Time' },
              { key: 'category', header: 'Department', render: (r) => r.category || 'General Medicine' },
            ]}
            rows={slots}
            emptyText="No active duty schedule for today."
          />
        ) : (
          <Spinner label="Loading schedule..." />
        )}
      </Card>
    </div>
  );
}
