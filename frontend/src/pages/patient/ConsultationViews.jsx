import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Eye,
  FileImage,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  Info,
  MapPin,
  Moon,
  Pill,
  Printer,
  Square,
  Stethoscope,
  Sun,
  Sunrise,
  Utensils,
  Volume2,
} from 'lucide-react';
import { Modal } from '../../components/ui';
import './ConsultationViews.css';

/* ------------------------------------------------------------------ helpers */

function fmtDate(input, withTime = true) {
  if (!input) return '—';
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: 'numeric', minute: '2-digit', hour12: true });
  return d.toLocaleString('en-IN', opts);
}

function initials(name = '') {
  const clean = name.replace(/^dr\.?\s*/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DR';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function doseSlots(frequency = '', dosage = '') {
  const f = frequency.toLowerCase();
  const d = dosage.toLowerCase();
  const pattern = `${f} ${d}`.match(/([01])\s*-\s*([01])\s*-\s*([01])/);
  if (pattern) return { m: pattern[1] === '1', a: pattern[2] === '1', n: pattern[3] === '1' };
  if (/\b(tid|tds)\b|thrice|three/.test(f)) return { m: true, a: true, n: true };
  if (/\b(bid|bd)\b|twice|two/.test(f)) return { m: true, a: false, n: true };
  if (/\b(hs)\b|night|bedtime/.test(f)) return { m: false, a: false, n: true };
  if (/\b(od|qd)\b|once|daily/.test(f)) return { m: true, a: false, n: false };
  return null; // unknown pattern (SOS, weekly…) — don't guess
}

const INVESTIGATIONS_RE = /Investigations Ordered:\s*([^\n\r]+)/i;

function extractTests(station) {
  if (Array.isArray(station?.labTests)) return station.labTests.filter(Boolean).map(String);
  if (typeof station?.labTests === 'string' && station.labTests.trim()) {
    return station.labTests.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  const n = station?.notes || {};
  const text = [n.clinicalNotes, n.plan].filter(Boolean).join('\n');
  const match = text.match(INVESTIGATIONS_RE);
  if (!match || /^\s*none\b/i.test(match[1])) return [];
  return match[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function extractVitals(text = '') {
  if (!text) return [];
  const defs = [
    ['BP', /BP\s*:?\s*([0-9]{2,3}\/[0-9]{2,3})/i, 'mmHg'],
    ['Pulse', /Pulse\s*:?\s*([0-9]{2,3})/i, 'bpm'],
    ['Temp', /Temp\s*:?\s*([0-9]{2,3}(?:\.[0-9])?)/i, '°F'],
    ['SpO₂', /SpO2\s*:?\s*([0-9]{2,3})/i, '%'],
    ['Weight', /Weight\s*:?\s*([0-9]{1,3}(?:\.[0-9])?)/i, 'kg'],
  ];
  return defs
    .map(([label, re, unit]) => {
      const m = text.match(re);
      return m ? { label, value: m[1], unit } : null;
    })
    .filter(Boolean);
}

function cleanAdvice(plan = '') {
  return (plan || '').replace(INVESTIGATIONS_RE, '').replace(/\n{2,}/g, '\n').trim();
}

function docKind(doc = {}) {
  const type = (doc.docType || '').toLowerCase();
  const name = (doc.fileName || '').toLowerCase();
  const ct = (doc.contentType || '').toLowerCase();
  const isImage = ct.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/.test(name);
  if (type.includes('prescription')) return { label: 'Prescription', tone: 'green', isImage };
  if (type.includes('lab') || type.includes('report')) return { label: 'Lab report', tone: 'blue', isImage };
  if (type.includes('scan') || type.includes('xray') || type.includes('imaging')) return { label: 'Scan', tone: 'violet', isImage };
  if (type.includes('discharge')) return { label: 'Discharge', tone: 'amber', isImage };
  return { label: isImage ? 'Image' : 'Document', tone: 'slate', isImage };
}

function fmtSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------- shared bits */

function VisitStrip({ station, course }) {
  return (
    <div className="cv-strip">
      <span className="cv-strip-item">
        <CalendarDays size={14} /> {fmtDate(station.date || course.createdAt)}
      </span>
      <span className="cv-strip-item">
        <Building2 size={14} /> {station.hospitalName}
      </span>
      {course.diagnosis && (
        <span className="cv-strip-item cv-strip-dx">
          <Stethoscope size={14} /> {course.diagnosis}
        </span>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children, count }) {
  return (
    <div className="cv-section-title">
      <Icon size={16} />
      <span>{children}</span>
      {count != null && <span className="cv-count">{count}</span>}
    </div>
  );
}

function SwitchLinks({ current, onSwitch, docCount }) {
  const items = [
    { key: 'prescription', label: 'Prescription & tests', icon: Pill },
    { key: 'doctor', label: 'Doctor profile', icon: Stethoscope },
    { key: 'documents', label: `Documents${docCount ? ` (${docCount})` : ''}`, icon: FileText },
  ].filter((i) => i.key !== current);
  return (
    <div className="cv-switch cv-no-print">
      <span className="cv-switch-label">Also for this visit</span>
      <div className="cv-switch-row">
        {items.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className="cv-switch-btn" onClick={() => onSwitch(key)}>
            <Icon size={15} />
            <span>{label}</span>
            <ChevronRight size={15} className="cv-switch-chev" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ prescription view */

function PrescriptionView({ station, course, patient }) {
  const [speaking, setSpeaking] = useState(false);
  const meds = station.prescriptions || [];
  const tests = useMemo(() => extractTests(station), [station]);
  const advice = cleanAdvice(station.notes?.plan);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const toggleSpeak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    let text = `Prescription from ${station.doctorName}. `;
    if (course.diagnosis) text += `Diagnosis: ${course.diagnosis}. `;
    meds.forEach((p, i) => {
      text += `Medicine ${i + 1}: ${p.medicineName || 'medicine'}, ${p.dosage || ''}, ${p.frequency || ''}`;
      if (p.durationDays) text += `, for ${p.durationDays} days`;
      if (p.instructions) text += `, ${p.instructions}`;
      text += '. ';
    });
    if (tests.length) text += `Tests ordered: ${tests.join(', ')}. `;
    if (advice) text += `Doctor's advice: ${advice}.`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  const print = () => {
    document.body.classList.add('cv-printing');
    const done = () => {
      document.body.classList.remove('cv-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <div className="cv-root cv-print-area">
      <div className="cv-hero cv-hero-rx">
        <div className="cv-hero-icon">℞</div>
        <div className="cv-hero-text">
          <div className="cv-hero-title">{station.doctorName}</div>
          <div className="cv-hero-sub">
            {patient?.name ? `For ${patient.name}` : 'Prescription'}
            {patient?.age ? ` · ${patient.age} yrs` : ''}
          </div>
        </div>
        <div className="cv-hero-actions cv-no-print">
          {typeof window !== 'undefined' && window.speechSynthesis && (
            <button type="button" className={`cv-icon-btn ${speaking ? 'is-on' : ''}`} onClick={toggleSpeak}>
              {speaking ? <Square size={15} /> : <Volume2 size={16} />}
              <span>{speaking ? 'Stop' : 'Listen'}</span>
            </button>
          )}
          <button type="button" className="cv-icon-btn" onClick={print}>
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      <VisitStrip station={station} course={course} />

      <section>
        <SectionTitle icon={Pill} count={meds.length}>Medicines</SectionTitle>
        {meds.length === 0 ? (
          <div className="cv-empty-inline">No medicines were prescribed at this visit.</div>
        ) : (
          <div className="cv-med-list">
            {meds.map((p, i) => {
              const slots = doseSlots(p.frequency || '', p.dosage || '');
              return (
                <div className="cv-med" key={p.id || i}>
                  <div className="cv-med-top">
                    <div className="cv-med-num">{i + 1}</div>
                    <div className="cv-med-main">
                      <div className="cv-med-name">{p.medicineName || p.drugName || 'Medicine'}</div>
                      <div className="cv-med-meta">
                        {[p.dosage, p.route, p.frequency].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {p.durationDays ? (
                      <div className="cv-med-days">
                        <strong>{p.durationDays}</strong>
                        <span>days</span>
                      </div>
                    ) : null}
                  </div>

                  {slots && (
                    <div className="cv-slots">
                      <span className={`cv-slot ${slots.m ? 'on m' : ''}`}><Sunrise size={14} /> Morning</span>
                      <span className={`cv-slot ${slots.a ? 'on a' : ''}`}><Sun size={14} /> Afternoon</span>
                      <span className={`cv-slot ${slots.n ? 'on n' : ''}`}><Moon size={14} /> Night</span>
                    </div>
                  )}

                  {p.instructions && (
                    <div className="cv-med-note">
                      <Utensils size={14} /> {p.instructions}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle icon={FlaskConical} count={tests.length}>Tests ordered</SectionTitle>
        {tests.length === 0 ? (
          <div className="cv-empty-inline">No lab tests were ordered at this visit.</div>
        ) : (
          <>
            <div className="cv-test-grid">
              {tests.map((t, i) => (
                <div className="cv-test" key={i}>
                  <FlaskConical size={15} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div className="cv-hint">
              <Info size={14} /> Show this screen at the {station.hospitalName} lab counter for sample collection.
            </div>
          </>
        )}
      </section>

      {advice && (
        <section>
          <SectionTitle icon={ClipboardList}>Doctor's advice</SectionTitle>
          <div className="cv-advice">{advice}</div>
        </section>
      )}

      <div className="cv-foot-note">
        Take medicines exactly as prescribed. Don't stop a course midway without asking your doctor.
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- doctor view */

function DoctorView({ station, course, stations }) {
  const sameDoctor = useMemo(
    () =>
      (stations || [])
        .filter((s) => (s.doctorName || '').toLowerCase() === (station.doctorName || '').toLowerCase())
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    [stations, station.doctorName]
  );
  const notes = station.notes || {};
  const vitals = extractVitals([notes.clinicalNotes, notes.examinationFindings].filter(Boolean).join(' '));
  const first = sameDoctor[sameDoctor.length - 1];

  return (
    <div className="cv-root">
      <div className="cv-profile">
        <div className="cv-avatar">{initials(station.doctorName)}</div>
        <div className="cv-profile-name">{station.doctorName}</div>
        <div className="cv-profile-dept">{station.department || 'Consulting doctor'}</div>
        <div className="cv-profile-loc">
          <MapPin size={14} /> {station.hospitalName}
        </div>
        <div className="cv-verified">
          <BadgeCheck size={14} /> Treating doctor for this care course
        </div>
      </div>

      <div className="cv-stats">
        <div className="cv-stat">
          <span className="cv-stat-val">{sameDoctor.length || 1}</span>
          <span className="cv-stat-label">{sameDoctor.length === 1 ? 'Visit' : 'Visits'} in this course</span>
        </div>
        <div className="cv-stat">
          <span className="cv-stat-val sm">{fmtDate(first?.date || station.date, false)}</span>
          <span className="cv-stat-label">First seen</span>
        </div>
        <div className="cv-stat">
          <span className="cv-stat-val sm">{fmtDate(station.date, false)}</span>
          <span className="cv-stat-label">This visit</span>
        </div>
      </div>

      <section>
        <SectionTitle icon={Stethoscope}>What the doctor noted</SectionTitle>
        <div className="cv-kv">
          {course.diagnosis && (
            <div className="cv-kv-row">
              <span>Diagnosis</span>
              <strong>{course.diagnosis}</strong>
            </div>
          )}
          {notes.chiefComplaint && (
            <div className="cv-kv-row">
              <span>Your complaint</span>
              <strong>{notes.chiefComplaint}</strong>
            </div>
          )}
          {notes.examinationFindings && (
            <div className="cv-kv-row">
              <span>Examination</span>
              <strong>{notes.examinationFindings}</strong>
            </div>
          )}
          {!course.diagnosis && !notes.chiefComplaint && !notes.examinationFindings && (
            <div className="cv-empty-inline">No consultation notes were recorded for this visit.</div>
          )}
        </div>
        {vitals.length > 0 && (
          <div className="cv-vitals">
            {vitals.map((v) => (
              <div className="cv-vital" key={v.label}>
                <span className="cv-vital-label">{v.label}</span>
                <span className="cv-vital-val">
                  {v.value}
                  <small>{v.unit}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {sameDoctor.length > 1 && (
        <section>
          <SectionTitle icon={History} count={sameDoctor.length}>Your visits with this doctor</SectionTitle>
          <div className="cv-visits">
            {sameDoctor.map((s) => (
              <div className={`cv-visit ${s.id === station.id ? 'is-current' : ''}`} key={s.id}>
                <span className="cv-visit-dot" />
                <div className="cv-visit-main">
                  <strong>{fmtDate(s.date)}</strong>
                  <span>{s.hospitalName}</span>
                </div>
                {s.id === station.id && <span className="cv-tag green">Viewing</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------- documents view */

function DocRow({ doc, fallbackDate, onView }) {
  const kind = docKind(doc);
  const Icon = kind.isImage ? FileImage : FileText;
  const meta = [fmtDate(doc.uploadedAt || doc.createdAt || fallbackDate, false), doc.uploadedByDoctorName, fmtSize(doc.fileSize)]
    .filter(Boolean)
    .join(' · ');
  return (
    <button type="button" className="cv-doc" onClick={() => onView(doc)}>
      <span className={`cv-doc-icon ${kind.tone}`}>
        <Icon size={20} />
      </span>
      <span className="cv-doc-main">
        <span className="cv-doc-name">{doc.fileName || 'Medical document'}</span>
        <span className="cv-doc-meta">
          <span className={`cv-tag ${kind.tone}`}>{kind.label}</span>
          <span>{meta}</span>
        </span>
        {doc.notes && <span className="cv-doc-notes">{doc.notes}</span>}
      </span>
      <span className="cv-doc-open">
        <Eye size={16} />
        <span>Open</span>
      </span>
    </button>
  );
}

function DocumentsView({ station, course, courseDocuments, onViewDocument, onSwitch }) {
  const visitDocs = station.documents || [];
  const visitIds = new Set(visitDocs.map((d) => d.id));
  const otherDocs = (courseDocuments || []).filter((d) => !visitIds.has(d.id));
  const open = (doc) => onViewDocument({ ...doc, isCourseDoc: true, courseId: doc.courseId || course.id });

  return (
    <div className="cv-root">
      <VisitStrip station={station} course={course} />

      <section>
        <SectionTitle icon={FileText} count={visitDocs.length}>From this visit</SectionTitle>
        {visitDocs.length === 0 ? (
          <div className="cv-empty">
            <FolderOpen size={34} />
            <div className="cv-empty-title">No files uploaded at this visit</div>
            <div className="cv-empty-sub">
              Reports, scans or slips the hospital uploads for this consultation will show up here.
            </div>
            <button type="button" className="cv-primary-btn" onClick={() => onSwitch('prescription')}>
              <Pill size={15} /> See the prescription instead
            </button>
          </div>
        ) : (
          <div className="cv-doc-list">
            {visitDocs.map((d, i) => (
              <DocRow key={d.id || i} doc={d} fallbackDate={station.date} onView={open} />
            ))}
          </div>
        )}
      </section>

      {otherDocs.length > 0 && (
        <section>
          <SectionTitle icon={FolderOpen} count={otherDocs.length}>Other files in this care course</SectionTitle>
          <div className="cv-doc-list">
            {otherDocs.map((d, i) => (
              <DocRow key={d.id || i} doc={d} fallbackDate={course.createdAt} onView={open} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ container */

const TITLES = {
  prescription: 'Prescription & Tests',
  doctor: 'Doctor Profile',
  documents: 'Visit Documents',
};

/**
 * One modal per action. Each view is purpose-built rather than a shared
 * shell with tabs, and reads only the selected station (visit).
 */
export default function ConsultationViewModal({ state, onClose, onSwitch, patient, onViewDocument }) {
  if (!state) return null;
  const { view, station, course, stations, courseDocuments } = state;
  const docCount = (station.documents || []).length;

  const close = () => {
    window.speechSynthesis?.cancel();
    onClose();
  };

  return (
    <Modal title={TITLES[view]} onClose={close} wide={view === 'prescription'}>
      {view === 'prescription' && <PrescriptionView station={station} course={course} patient={patient} />}
      {view === 'doctor' && <DoctorView station={station} course={course} stations={stations} />}
      {view === 'documents' && (
        <DocumentsView
          station={station}
          course={course}
          courseDocuments={courseDocuments}
          onViewDocument={onViewDocument}
          onSwitch={onSwitch}
        />
      )}
      <SwitchLinks current={view} onSwitch={onSwitch} docCount={docCount} />
    </Modal>
  );
}
