import React, { useEffect, useState } from 'react';
import { doctorApi, hospitalApi } from '../../api/client';
import { Button, Card, Field, Input, Select, Spinner, Table } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Stethoscope, Phone, Building2, ShieldCheck, Hash, UserCheck, Layers } from 'lucide-react';

export default function DoctorProfile() {
  const { setDoctorProfile } = useAuth();
  const [me, setMe] = useState(null);
  const [slots, setSlots] = useState(null);
  const [hospitalCode, setHospitalCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [editingCounter, setEditingCounter] = useState(false);
  const [selectedCounterId, setSelectedCounterId] = useState('1');
  const [updatingCounter, setUpdatingCounter] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const profile = await doctorApi.me();
      setMe(profile);
      setDoctorProfile(profile);
      if (profile?.counterId) {
        setSelectedCounterId(String(profile.counterId));
      }
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

  async function handleUpdateCounter(e) {
    if (e) e.preventDefault();
    setUpdatingCounter(true);
    try {
      const counterNum = parseInt(selectedCounterId) || 1;
      await doctorApi.updateMyCounter({
        counterId: counterNum,
        category: me?.category || 'General Medicine / Internal Medicine',
      });
      toast.success(`Assigned to Counter #${counterNum} successfully.`);
      setEditingCounter(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to update counter assignment');
    } finally {
      setUpdatingCounter(false);
    }
  }

  if (!me) return <Spinner label="Loading doctor profile..." />;

  return (
    <div className="stack-lg">
      <div className="card-head">
        <div>
          <h1 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Stethoscope size={26} color="#00A884" />
            Doctor Profile
          </h1>
          <p className="muted-text">
            Registered Healthcare Professional
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#DCFCE7', color: '#15803D' }}>
            <ShieldCheck size={14} />
            Verified Practitioner
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
                Assigned identification across all OPD counters
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
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                Direct clinical notifications enabled
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
              <Building2 size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Hospital / Clinic</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                {me.hospitalName || 'Not Linked Yet'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                {me.category ? `Department: ${me.category}` : 'General OPD'}
              </div>
            </div>
          </div>

        </div>

        {/* Multi-Counter Station Configuration */}
        {me.hospitalId && (
          <div style={{ marginTop: '16px', padding: '14px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                <Layers size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                  Assigned Station: Counter #{me.counterId || 1}
                </div>
                <div style={{ fontSize: '11.5px', color: '#15803D' }}>
                  Multi-counter queue assignment. Patients called from your console will be directed to this counter.
                </div>
              </div>
            </div>

            {editingCounter ? (
              <form onSubmit={handleUpdateCounter} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={selectedCounterId}
                  onChange={(e) => setSelectedCounterId(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #86EFAC', fontSize: '13px', fontWeight: 700 }}
                >
                  <option value="1">Counter 1</option>
                  <option value="2">Counter 2</option>
                  <option value="3">Counter 3</option>
                  <option value="4">Counter 4</option>
                  <option value="5">Counter 5</option>
                  <option value="6">Counter 6</option>
                </select>
                <Button size="sm" type="submit" loading={updatingCounter} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff', fontWeight: 700 }}>
                  Save Counter
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCounter(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditingCounter(true)} style={{ fontWeight: 700 }}>
                Change Counter
              </Button>
            )}
          </div>
        )}
      </Card>

      {!me.hospitalId && (
        <Card title="Join a Hospital">
          <p className="muted-text">Enter the hospital code provided by your hospital administrator.</p>
          <form onSubmit={joinHospital} className="row-gap">
            <Field label="Hospital Code">
              <Input value={hospitalCode} onChange={(e) => setHospitalCode(e.target.value.toUpperCase())} placeholder="e.g. AIIMS-01" required />
            </Field>
            <Button type="submit" loading={joining} style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff' }}>
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
              { key: 'startTime', header: 'Start Time' },
              { key: 'endTime', header: 'End Time' },
              { key: 'status', header: 'Shift Status' },
            ]}
            rows={slots}
            emptyText="No scheduled duty shifts registered for this week."
          />
        ) : (
          <p className="muted-text">No active time slots found.</p>
        )}
      </Card>
    </div>
  );
}
