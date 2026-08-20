import React, { useEffect, useState } from 'react';
import { hospitalApi } from '../../api/client';
import { Button, Card, Field, Input, Modal, Select, Spinner, Table } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminHospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      setHospitals(await hospitalApi.list());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    hospitalApi.categories().then(setAllCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack-lg">
      <h1>Hospitals</h1>
      <Card title="Directory" actions={<Button size="sm" onClick={() => setCreateOpen(true)}>+ New hospital</Button>}>
        {loading ? (
          <Spinner />
        ) : (
          <Table
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'uriSlug', header: 'Slug' },
              { key: 'address', header: 'Address', render: (r) => r.address || '—' },
              { key: 'activeCounters', header: 'Counters' },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                    Manage
                  </Button>
                ),
              },
            ]}
            rows={hospitals}
            emptyText="No hospitals yet — create one to get started."
          />
        )}
      </Card>

      {selected && (
        <HospitalDetail
          hospital={selected}
          allCategories={allCategories}
          onClose={() => setSelected(null)}
          onUpdated={(h) => {
            setSelected(h);
            load();
          }}
        />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New hospital" wide>
        <CreateHospitalForm
          allCategories={allCategories}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function CreateHospitalForm({ allCategories, onCreated }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [locMode, setLocMode] = useState('digipin');
  const [form, setForm] = useState({
    uriSlug: '',
    name: '',
    address: '',
    digipin: '',
    latitude: '',
    longitude: '',
    openTime: '09:00',
    closeTime: '17:00',
    avgPatientsPerDay: '',
    avgServiceMinutes: '',
    minServiceMinutes: '',
    activeCounters: '1',
    ownership: '',
    yearEstablished: '',
    accreditation: '',
    genderSpecific: '',
    categories: [],
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleCategory(cat) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const location =
        locMode === 'digipin' ? { digipin: form.digipin } : { latitude: Number(form.latitude), longitude: Number(form.longitude) };
      const payload = {
        uriSlug: form.uriSlug,
        name: form.name,
        address: form.address || undefined,
        location,
        openTime: form.openTime || undefined,
        closeTime: form.closeTime || undefined,
        avgPatientsPerDay: form.avgPatientsPerDay ? Number(form.avgPatientsPerDay) : undefined,
        avgServiceMinutes: form.avgServiceMinutes ? Number(form.avgServiceMinutes) : undefined,
        minServiceMinutes: form.minServiceMinutes ? Number(form.minServiceMinutes) : undefined,
        activeCounters: form.activeCounters ? Number(form.activeCounters) : undefined,
        ownership: form.ownership || undefined,
        yearEstablished: form.yearEstablished ? Number(form.yearEstablished) : undefined,
        accreditation: form.accreditation
          ? form.accreditation.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        genderSpecific: form.genderSpecific || undefined,
        categories: form.categories.length ? form.categories : undefined,
      };
      await hospitalApi.create(payload);
      toast.success('Hospital created.');
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack-md">
      <div className="field-row">
        <Field label="URI slug" hint="lowercase letters, digits, hyphens">
          <Input value={form.uriSlug} onChange={(e) => update('uriSlug', e.target.value)} required />
        </Field>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </Field>
      </div>
      <Field label="Address">
        <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
      </Field>

      <Field label="Location">
        <div className="row-gap">
          <label className="radio-label">
            <input type="radio" checked={locMode === 'digipin'} onChange={() => setLocMode('digipin')} /> DIGIPIN
          </label>
          <label className="radio-label">
            <input type="radio" checked={locMode === 'latlon'} onChange={() => setLocMode('latlon')} /> Lat / Lon
          </label>
        </div>
        {locMode === 'digipin' ? (
          <Input value={form.digipin} onChange={(e) => update('digipin', e.target.value)} placeholder="39J-438-TJC7" required />
        ) : (
          <div className="field-row">
            <Input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => update('latitude', e.target.value)}
              placeholder="Latitude"
              required
            />
            <Input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => update('longitude', e.target.value)}
              placeholder="Longitude"
              required
            />
          </div>
        )}
      </Field>

      <div className="field-row">
        <Field label="Open time">
          <Input type="time" value={form.openTime} onChange={(e) => update('openTime', e.target.value)} />
        </Field>
        <Field label="Close time">
          <Input type="time" value={form.closeTime} onChange={(e) => update('closeTime', e.target.value)} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Avg patients / day" hint="used to derive per-patient service time">
          <Input type="number" min="1" value={form.avgPatientsPerDay} onChange={(e) => update('avgPatientsPerDay', e.target.value)} />
        </Field>
        <Field label="Avg service minutes" hint="overrides the derived value">
          <Input type="number" min="1" value={form.avgServiceMinutes} onChange={(e) => update('avgServiceMinutes', e.target.value)} />
        </Field>
        <Field label="Min service minutes">
          <Input type="number" min="1" value={form.minServiceMinutes} onChange={(e) => update('minServiceMinutes', e.target.value)} />
        </Field>
        <Field label="Active counters">
          <Input type="number" min="1" value={form.activeCounters} onChange={(e) => update('activeCounters', e.target.value)} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Ownership">
          <Select value={form.ownership} onChange={(e) => update('ownership', e.target.value)}>
            <option value="">—</option>
            <option value="Private">Private</option>
            <option value="Trust">Trust</option>
            <option value="Government">Government</option>
            <option value="Chain-affiliated">Chain-affiliated</option>
          </Select>
        </Field>
        <Field label="Year established">
          <Input type="number" value={form.yearEstablished} onChange={(e) => update('yearEstablished', e.target.value)} />
        </Field>
        <Field label="Gender specific">
          <Select value={form.genderSpecific} onChange={(e) => update('genderSpecific', e.target.value)}>
            <option value="">General / co-ed</option>
            <option value="male">Male only</option>
            <option value="female">Female only</option>
          </Select>
        </Field>
      </div>

      <Field label="Accreditation" hint="comma-separated, e.g. NABH, ISO 9001">
        <Input value={form.accreditation} onChange={(e) => update('accreditation', e.target.value)} />
      </Field>

      <Field label="Departments offered">
        <div className="checkbox-grid">
          {allCategories.map((c) => (
            <label key={c} className="checkbox-label">
              <input type="checkbox" checked={form.categories.includes(c)} onChange={() => toggleCategory(c)} />
              {c}
            </label>
          ))}
        </div>
      </Field>

      <Button type="submit" loading={submitting}>
        Create hospital
      </Button>
    </form>
  );
}

function HospitalDetail({ hospital, allCategories, onClose, onUpdated }) {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [joinCode, setJoinCode] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [digipin, setDigipin] = useState(hospital.digipin || '');
  const [savingLoc, setSavingLoc] = useState(false);
  const [assign, setAssign] = useState({ doctorId: '', counterId: '', category: '' });
  const [slotForm, setSlotForm] = useState({ date: '', startTime: '', endTime: '', category: '', doctorIds: '' });

  useEffect(() => {
    hospitalApi.departments(hospital.uriSlug).then(setDepartments).catch(() => {});
    hospitalApi.timeSlots(hospital.uriSlug).then(setTimeSlots).catch(() => {});
  }, [hospital.uriSlug]);

  async function saveLocation(e) {
    e.preventDefault();
    setSavingLoc(true);
    try {
      const updated = await hospitalApi.updateLocation(hospital.uriSlug, { digipin });
      toast.success('Location updated.');
      onUpdated(updated);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingLoc(false);
    }
  }

  async function loadJoinCode() {
    try {
      const res = await hospitalApi.getJoinCode(hospital.uriSlug);
      setJoinCode(res.doctorJoinCode);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function regenerateJoinCode() {
    try {
      const res = await hospitalApi.regenerateJoinCode(hospital.uriSlug);
      setJoinCode(res.doctorJoinCode);
      toast.success('Join code rotated.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function updateCounters(category, activeCounters) {
    try {
      const dep = await hospitalApi.updateDepartmentCounters(hospital.uriSlug, category, Number(activeCounters));
      setDepartments((ds) => {
        const others = ds.filter((d) => d.category !== category);
        return [...others, dep];
      });
      toast.success(`${category} now has ${activeCounters} counter(s).`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function submitAssign(e) {
    e.preventDefault();
    try {
      await hospitalApi.assignDoctorLocation(hospital.uriSlug, Number(assign.doctorId), {
        counterId: Number(assign.counterId),
        category: assign.category,
      });
      toast.success(`Doctor #${assign.doctorId} assigned to counter ${assign.counterId} (${assign.category}).`);
      setAssign({ doctorId: '', counterId: '', category: '' });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function submitSlot(e) {
    e.preventDefault();
    try {
      const payload = {
        date: slotForm.date,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        category: slotForm.category || undefined,
        doctorIds: slotForm.doctorIds
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !Number.isNaN(n)),
      };
      const created = await hospitalApi.createTimeSlot(hospital.uriSlug, payload);
      setTimeSlots((s) => [...s, created]);
      toast.success('Time slot created.');
      setSlotForm({ date: '', startTime: '', endTime: '', category: '', doctorIds: '' });
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Card title={`Manage: ${hospital.name}`} actions={<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="stack-lg">
        <section>
          <h4>Location</h4>
          <form onSubmit={saveLocation} className="row-gap">
            <Input value={digipin} onChange={(e) => setDigipin(e.target.value)} placeholder="DIGIPIN" />
            <Button type="submit" size="sm" loading={savingLoc}>
              Update
            </Button>
          </form>
        </section>

        <section>
          <h4>Departments &amp; counters</h4>
          <Table
            columns={[
              { key: 'category', header: 'Department' },
              {
                key: 'activeCounters',
                header: 'Counters',
                render: (d) => (
                  <CounterStepper value={d.activeCounters ?? 1} onSave={(v) => updateCounters(d.category, v)} />
                ),
              },
            ]}
            rows={departments}
            emptyText="No departments configured yet."
          />
        </section>

        <section>
          <h4>Doctor join code</h4>
          <div className="row-gap">
            <Button size="sm" variant="secondary" onClick={loadJoinCode}>
              Reveal code
            </Button>
            <Button size="sm" variant="ghost" onClick={regenerateJoinCode}>
              Regenerate
            </Button>
            {joinCode && <code className="join-code">{joinCode}</code>}
          </div>
        </section>

        <section>
          <h4>Assign a doctor to a counter</h4>
          <p className="muted-text">The doctor's own profile page shows their doctor ID.</p>
          <form onSubmit={submitAssign} className="field-row">
            <Input
              placeholder="Doctor ID"
              type="number"
              value={assign.doctorId}
              onChange={(e) => setAssign((a) => ({ ...a, doctorId: e.target.value }))}
              required
            />
            <Input
              placeholder="Counter #"
              type="number"
              min="1"
              value={assign.counterId}
              onChange={(e) => setAssign((a) => ({ ...a, counterId: e.target.value }))}
              required
            />
            <Select value={assign.category} onChange={(e) => setAssign((a) => ({ ...a, category: e.target.value }))} required>
              <option value="">Department…</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm">
              Assign
            </Button>
          </form>
        </section>

        <section>
          <h4>OPD time slots</h4>
          <Table
            columns={[
              { key: 'slotDate', header: 'Date' },
              { key: 'startTime', header: 'Start' },
              { key: 'endTime', header: 'End' },
              { key: 'category', header: 'Department', render: (r) => r.category || 'Hospital-wide' },
              { key: 'doctorIds', header: 'Doctors', render: (r) => (r.doctorIds || []).join(', ') },
            ]}
            rows={timeSlots}
            emptyText="No time slots yet."
          />
          <form onSubmit={submitSlot} className="field-row" style={{ marginTop: 12 }}>
            <Input type="date" value={slotForm.date} onChange={(e) => setSlotForm((s) => ({ ...s, date: e.target.value }))} required />
            <Input
              type="time"
              value={slotForm.startTime}
              onChange={(e) => setSlotForm((s) => ({ ...s, startTime: e.target.value }))}
              required
            />
            <Input
              type="time"
              value={slotForm.endTime}
              onChange={(e) => setSlotForm((s) => ({ ...s, endTime: e.target.value }))}
              required
            />
            <Select value={slotForm.category} onChange={(e) => setSlotForm((s) => ({ ...s, category: e.target.value }))}>
              <option value="">Hospital-wide</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Doctor IDs, comma separated"
              value={slotForm.doctorIds}
              onChange={(e) => setSlotForm((s) => ({ ...s, doctorIds: e.target.value }))}
              required
            />
            <Button type="submit" size="sm">
              Add slot
            </Button>
          </form>
        </section>
      </div>
    </Card>
  );
}

function CounterStepper({ value, onSave }) {
  const [v, setV] = useState(value);
  return (
    <div className="row-gap">
      <Input type="number" min="1" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 72 }} />
      <Button size="sm" variant="ghost" onClick={() => onSave(v)}>
        Save
      </Button>
    </div>
  );
}
