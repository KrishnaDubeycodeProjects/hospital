/**
 * ANM home — three bottom-tab views on the shared design kit:
 *   आज  (queue)   : survey forms ASHAs sent to this ANM, grouped per ASHA, awaiting review
 *   आशा (workers) : ASHAs assigned to this ANM
 *   सत्र (session): VHND session folders · create · session QR · receive ASHA data QR
 * ANM is the clinical validator (BP, Hb, vaccines with batch). Only real data is shown.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  ClipboardList,
  Users,
  QrCode,
  Plus,
  ScanLine,
  Syringe,
  HeartPulse,
  Activity,
  Trash2,
  MapPin,
  CircleCheck,
  CloudOff,
  RotateCcw,
  Inbox,
  type LucideIcon,
} from 'lucide-react-native';
import { scanQrFromImageFile } from '../utils/qrScannerHelper';
import { SyncApi, AnmAshaWorker } from '../api/syncApi';
import { useOfflineData } from '../context/OfflineDataContext';
import { RealQrCode } from '../components/RealQrCode';
import { AnmSessionFolder } from '../types/storage';
import {
  Screen,
  Card,
  ListRow,
  StatusPill,
  SectionTitle,
  EmptyState,
  SkeletonRows,
  Button,
  IconButton,
  Chips,
  Field,
  Sheet,
  Stat,
  Tone,
  color,
  space,
  text,
  useTr,
} from '../ui';

interface AnmOpenFormsScreenProps {
  onSelectAsha?: (worker: { name: string; village: string; phone: string }) => void;
  /** Bottom-tab view: आज (form queue) · आशा (workers) · सत्र (VHND session QR). */
  view?: 'queue' | 'workers' | 'session';
}

type Category = AnmSessionFolder['category'];

interface IncomingRow {
  asha_worker_phone: string;
  count: number;
}

const last10 = (p?: string) => (p || '').replace(/[^0-9]/g, '').slice(-10);

export const AnmOpenFormsScreen: React.FC<AnmOpenFormsScreenProps> = ({ onSelectAsha, view = 'queue' }) => {
  const tr = useTr();
  const { anmSessions, createAnmSession, receiveRecordsInAnmSession, deleteAnmSession, childVaccinations, isOnline } =
    useOfflineData();

  // ---------------------------------------------------------------- server data (queue + workers)
  const [workers, setWorkers] = useState<AnmAshaWorker[]>([]);
  const [incoming, setIncoming] = useState<IncomingRow[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [w, inc] = await Promise.all([SyncApi.getAnmAshas(), SyncApi.getAnmIncomingData()]);
      setWorkers(w);
      setIncoming(Array.isArray(inc) ? inc : []);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (view !== 'session') load();
  }, [view, load]);

  const workerByPhone = useMemo(() => new Map(workers.map((w) => [last10(w.phone), w])), [workers]);
  const queue = useMemo(
    () =>
      incoming
        .map((r) => ({ ...r, count: Number(r.count) || 0, worker: workerByPhone.get(last10(r.asha_worker_phone)) }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count),
    [incoming, workerByPhone]
  );
  const totalForms = queue.reduce((s, r) => s + r.count, 0);

  // ---------------------------------------------------------------- sessions
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('CHILD_VAX');
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<AnmSessionFolder | null>(null);
  const [inspected, setInspected] = useState<AnmSessionFolder | null>(null);

  const [showScan, setShowScan] = useState(false);
  const [scanNotice, setScanNotice] = useState<{ tone: Tone; msg: string } | null>(null);
  const [payload, setPayload] = useState('');
  const fileInputRef = useRef<any>(null);

  const catMeta = (c: Category): { icon: LucideIcon; tone: Tone; label: string } =>
    c === 'CHILD_VAX'
      ? { icon: Syringe, tone: 'accent', label: tr('बाल टीकाकरण', 'बाल लसीकरण') }
      : c === 'ANC'
      ? { icon: HeartPulse, tone: 'red', label: tr('प्रसव पूर्व जांच', 'प्रसूतीपूर्व तपासणी') }
      : { icon: Activity, tone: 'amber', label: tr('NCD जांच', 'NCD तपासणी') };

  const closeScanSoon = () =>
    setTimeout(() => {
      setShowScan(false);
      setScanNotice(null);
      setPayload('');
    }, 1800);

  /** ASHA data QR payload → add records to the matching session. Invalid codes add nothing. */
  const processPayload = async (raw: string) => {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      setScanNotice({ tone: 'red', msg: tr('QR कोड पढ़ा नहीं गया', 'QR कोड वाचला नाही') });
      return;
    }
    const cat: Category = ['CHILD_VAX', 'ANC', 'NCD'].includes(data.c || data.cluster) ? data.c || data.cluster : 'CHILD_VAX';
    const cnt = Number(data.cnt ?? data.count ?? (Array.isArray(data.items) ? data.items.length : 0));
    if (!Number.isFinite(cnt) || cnt <= 0) {
      setScanNotice({ tone: 'amber', msg: tr('कोड में कोई रिकॉर्ड नहीं', 'कोडमध्ये नोंद नाही') });
      return;
    }
    await receiveRecordsInAnmSession(cat, cnt);
    const who = data.n || data.ashaName;
    setScanNotice({
      tone: 'green',
      msg: who ? `${who}: ${cnt} ${tr('रिकॉर्ड प्राप्त', 'नोंदी मिळाल्या')}` : `${cnt} ${tr('रिकॉर्ड प्राप्त', 'नोंदी मिळाल्या')}`,
    });
    closeScanSoon();
  };

  const handleFileScan = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setScanNotice({ tone: 'accent', msg: tr('स्कैन हो रहा है…', 'स्कॅन होत आहे…') });
    try {
      const decoded = await scanQrFromImageFile(file);
      await processPayload(decoded);
    } catch {
      setScanNotice({ tone: 'red', msg: tr('QR नहीं मिला, साफ फोटो लें', 'QR मिळाला नाही, स्पष्ट फोटो घ्या') });
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      setTitleError(tr('शीर्षक लिखें', 'शीर्षक लिहा'));
      return;
    }
    const created = await createAnmSession({
      title: newTitle.trim(),
      category: newCategory,
      studyType: catMeta(newCategory).label,
      notes: newNotes.trim(),
      location: newLocation.trim() || tr('उपकेंद्र', 'उपकेंद्र'),
    });
    setNewTitle('');
    setNewNotes('');
    setNewLocation('');
    setTitleError(null);
    setShowCreate(false);
    setQrSession(created); // show QR immediately so ASHAs can scan
  };

  // ---------------------------------------------------------------- shared states
  const serverState = (empty: React.ReactNode) =>
    loadState === 'loading' ? (
      <SkeletonRows count={4} />
    ) : loadState === 'error' ? (
      <EmptyState
        icon={CloudOff}
        tone="amber"
        title={isOnline ? tr('डेटा लोड नहीं हुआ', 'डेटा लोड झाला नाही') : tr('इंटरनेट नहीं है', 'इंटरनेट नाही')}
        action={<Button label={tr('फिर कोशिश', 'पुन्हा प्रयत्न')} icon={RotateCcw} variant="secondary" full={false} onPress={load} />}
      />
    ) : (
      empty
    );

  // ---------------------------------------------------------------- views
  if (view === 'queue') {
    return (
      <Screen>
        <Card>
          <View style={styles.statsRow}>
            <Stat value={totalForms} label={tr('फॉर्म बाकी', 'फॉर्म बाकी')} tone="amber" />
            <View style={styles.vr} />
            <Stat value={queue.length} label={tr('आशा से', 'आशांकडून')} tone="neutral" />
          </View>
        </Card>
        <SectionTitle label={tr('समीक्षा हेतु', 'पडताळणीसाठी')} count={queue.length} />
        {loadState === 'ready' && queue.length === 0 ? (
          <EmptyState icon={CircleCheck} title={tr('कोई फॉर्म बाकी नहीं', 'कोणताही फॉर्म बाकी नाही')} />
        ) : loadState === 'ready' ? (
          <View style={styles.list}>
            {queue.map((r) => (
              <ListRow
                key={r.asha_worker_phone}
                icon={ClipboardList}
                tone="amber"
                title={r.worker?.name || r.asha_worker_phone}
                subtitle={r.worker?.villageName || undefined}
                onPress={() => onSelectAsha?.({ name: r.worker?.name || r.asha_worker_phone, village: r.worker?.villageName || '', phone: r.asha_worker_phone })}
                right={<StatusPill tone="amber" label={`${r.count} ${tr('फॉर्म', 'फॉर्म')}`} />}
              />
            ))}
          </View>
        ) : (
          serverState(null)
        )}
      </Screen>
    );
  }

  if (view === 'workers') {
    return (
      <Screen>
        <SectionTitle label={tr('मेरी आशा', 'माझ्या आशा')} count={loadState === 'ready' ? workers.length : undefined} />
        {loadState === 'ready' ? (
          workers.length === 0 ? (
            <EmptyState icon={Users} tone="neutral" title={tr('कोई आशा नहीं जुड़ी', 'कोणतीही आशा जोडलेली नाही')} />
          ) : (
            <View style={styles.list}>
              {workers.map((w) => {
                const pending = queue.find((q) => last10(q.asha_worker_phone) === last10(w.phone))?.count || 0;
                return (
                  <ListRow
                    key={w.phone}
                    icon={Users}
                    tone="accent"
                    title={w.name}
                    subtitle={w.villageName || undefined}
                    onPress={() => onSelectAsha?.({ name: w.name, village: w.villageName || '', phone: w.phone })}
                    right={
                      pending > 0 ? (
                        <StatusPill tone="amber" label={`${pending} ${tr('फॉर्म', 'फॉर्म')}`} />
                      ) : (
                        <StatusPill tone="green" label={tr('अद्यतन', 'अद्ययावत')} />
                      )
                    }
                  />
                );
              })}
            </View>
          )
        ) : (
          serverState(null)
        )}
      </Screen>
    );
  }

  // session view
  return (
    <Screen>
      {Platform.OS === 'web' ? (
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileScan} />
      ) : null}

      <View style={styles.actionsRow}>
        <View style={styles.flex}>
          <Button label={tr('नया सत्र', 'नवीन सत्र')} icon={Plus} onPress={() => setShowCreate(true)} />
        </View>
        <View style={styles.flex}>
          <Button label={tr('आशा QR स्कैन', 'आशा QR स्कॅन')} icon={ScanLine} variant="secondary" onPress={() => setShowScan(true)} />
        </View>
      </View>

      <SectionTitle label={tr('VHND सत्र', 'VHND सत्र')} count={anmSessions.length} />
      {anmSessions.length === 0 ? (
        <EmptyState icon={Inbox} tone="neutral" title={tr('अभी कोई सत्र नहीं', 'अजून सत्र नाही')} />
      ) : (
        <View style={styles.list}>
          {anmSessions.map((s) => {
            const meta = catMeta(s.category);
            const deletable = s.id.startsWith('sess-') && Number(s.id.replace('sess-', '')) > 1000;
            return (
              <Card key={s.id} tone={meta.tone}>
                <ListRow
                  icon={meta.icon}
                  tone={meta.tone}
                  title={s.title}
                  subtitle={[s.date, s.location].filter(Boolean).join(' • ')}
                  onPress={() => setInspected(s)}
                  right={
                    <StatusPill
                      tone={s.recordsCount > 0 ? 'green' : 'neutral'}
                      label={`${s.recordsCount} ${tr('रिकॉर्ड', 'नोंदी')}`}
                    />
                  }
                />
                <View style={styles.sessionActions}>
                  <View style={styles.flex}>
                    <Button label={tr('QR दिखाएँ', 'QR दाखवा')} icon={QrCode} variant="secondary" onPress={() => setQrSession(s)} />
                  </View>
                  {deletable ? (
                    <IconButton icon={Trash2} tone="red" filled label={tr('सत्र हटाएँ', 'सत्र काढा')} onPress={() => deleteAnmSession(s.id)} />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Create session */}
      <Sheet visible={showCreate} onClose={() => setShowCreate(false)} title={tr('नया सत्र', 'नवीन सत्र')} closeLabel={tr('बंद करें', 'बंद करा')}>
        <Chips
          value={newCategory}
          onChange={setNewCategory}
          options={(['CHILD_VAX', 'ANC', 'NCD'] as Category[]).map((c) => ({ key: c, label: catMeta(c).label, tone: catMeta(c).tone }))}
        />
        <Field
          label={tr('सत्र का नाम', 'सत्राचे नाव')}
          value={newTitle}
          onChangeText={(v) => {
            setNewTitle(v);
            if (titleError) setTitleError(null);
          }}
          error={titleError}
        />
        <Field
          label={tr('स्थान', 'ठिकाण')}
          value={newLocation}
          onChangeText={setNewLocation}
          helper={tr('जैसे: आंगनवाड़ी केंद्र', 'उदा. अंगणवाडी केंद्र')}
          right={<MapPin size={18} color={color.faint} />}
        />
        <Field label={tr('टिप्पणी', 'टीप')} value={newNotes} onChangeText={setNewNotes} multiline />
        <Button label={tr('सत्र बनाएँ', 'सत्र तयार करा')} icon={QrCode} onPress={handleCreate} />
      </Sheet>

      {/* Session QR for ASHAs to scan */}
      <Sheet
        visible={!!qrSession}
        onClose={() => setQrSession(null)}
        title={qrSession?.title}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        {qrSession ? (
          <View style={styles.qrWrap}>
            <StatusPill tone={catMeta(qrSession.category).tone} label={catMeta(qrSession.category).label} />
            <RealQrCode value={qrSession.qrCodeValue} size={220} label={qrSession.qrCodeValue} />
            <Text style={[text.body, styles.center]}>{tr('आशा फोन से यह QR स्कैन करें', 'आशा फोनने हा QR स्कॅन करा')}</Text>
            <Button label={tr('पूर्ण', 'पूर्ण')} icon={CircleCheck} onPress={() => setQrSession(null)} />
          </View>
        ) : null}
      </Sheet>

      {/* Session records */}
      <Sheet visible={!!inspected} onClose={() => setInspected(null)} title={inspected?.title} closeLabel={tr('बंद करें', 'बंद करा')}>
        {inspected ? (
          inspected.category === 'CHILD_VAX' && childVaccinations.length > 0 ? (
            <View style={styles.list}>
              {childVaccinations.slice(0, 20).map((c) => {
                const statuses = Object.values(c.vaccines || {});
                const due = statuses.filter((v) => v === 'Due').length;
                const given = statuses.filter((v) => v === 'Given').length;
                return (
                  <ListRow
                    key={c.id}
                    icon={Syringe}
                    tone={due > 0 ? 'amber' : 'green'}
                    title={c.childName}
                    subtitle={`${c.ageMonths} ${tr('माह', 'महिने')}${c.mctsCode ? ` • ${c.mctsCode}` : ''}`}
                    right={
                      due > 0 ? (
                        <StatusPill tone="amber" label={`${due} ${tr('देय', 'देय')}`} />
                      ) : (
                        <StatusPill tone="green" label={`${given} ${tr('दिए', 'दिल्या')}`} />
                      )
                    }
                  />
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon={inspected.recordsCount > 0 ? CircleCheck : Inbox}
              tone={inspected.recordsCount > 0 ? 'green' : 'neutral'}
              title={
                inspected.recordsCount > 0
                  ? `${inspected.recordsCount} ${tr('रिकॉर्ड प्राप्त', 'नोंदी मिळाल्या')}`
                  : tr('अभी कोई रिकॉर्ड नहीं', 'अजून नोंद नाही')
              }
            />
          )
        ) : null}
      </Sheet>

      {/* Receive ASHA data QR */}
      <Sheet
        visible={showScan}
        onClose={() => {
          setShowScan(false);
          setScanNotice(null);
        }}
        title={tr('आशा QR स्कैन', 'आशा QR स्कॅन')}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        {scanNotice ? <StatusPill tone={scanNotice.tone} label={scanNotice.msg} /> : null}
        {Platform.OS === 'web' ? (
          <Button
            label={tr('QR फोटो चुनें', 'QR फोटो निवडा')}
            icon={ScanLine}
            onPress={() => fileInputRef.current && fileInputRef.current.click()}
          />
        ) : null}
        <Field label={tr('या कोड लिखें', 'किंवा कोड लिहा')} value={payload} onChangeText={setPayload} multiline />
        <Button
          label={tr('डेटा जोड़ें', 'डेटा जोडा')}
          icon={CircleCheck}
          disabled={!payload.trim()}
          onPress={() => processPayload(payload.trim())}
        />
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  vr: { width: 1, alignSelf: 'stretch', backgroundColor: color.line },
  list: { gap: space.sm },
  actionsRow: { flexDirection: 'row', gap: space.md },
  sessionActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  qrWrap: { alignItems: 'center', gap: space.md },
});
