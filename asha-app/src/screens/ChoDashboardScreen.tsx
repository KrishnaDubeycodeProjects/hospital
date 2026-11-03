/**
 * CHO sector screen. Bottom-tab view selects the content:
 *   - 'referrals' (रेफरल): sector KPIs + open referrals with approve / clinical advice.
 *   - 'workers'   (आशा):   ASHA & ANM roster + CHO onboarding (the only way workers are registered).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Activity,
  Check,
  CircleCheck,
  Phone,
  Pill,
  Clock,
  ShieldCheck,
  UserPlus,
  FileText,
  Calendar,
  AlertTriangle,
  ChevronRight,
  MapPin,
  ClipboardList,
  Users,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useOfflineData } from '../context/OfflineDataContext';
import { SyncApi, ChoSectorWorker } from '../api/syncApi';
import { ChoBroadcastPanel } from '../components/ChoBroadcastPanel';
import {
  Screen,
  Card,
  Stat,
  SectionTitle,
  StatusPill,
  Button,
  ListRow,
  Field,
  Segmented,
  EmptyState,
  Sheet,
  color,
  radius,
  space,
  text,
  useTr,
} from '../ui';

const AUTH_WORKERS_KEY = '@cho_authorized_workers_v6';

type WorkerRow = {
  id: string;
  name: string;
  role: 'ASHA' | 'ANM';
  village: string;
  phone: string;
  families: number;
  surveys: number;
  referrals: number;
  isChoAdded: boolean;
};

export const ChoDashboardScreen: React.FC<{ view?: 'referrals' | 'workers' }> = ({ view = 'referrals' }) => {
  const { addWorkerByCho } = useAuth();
  const { families, members, followUps, surveys, approveReferralByCho } = useOfflineData();
  const tr = useTr();

  // ---- Workers ----
  const [authorizedWorkers, setAuthorizedWorkers] = useState<any[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'ASHA' | 'ANM'>('ASHA');
  const [newVillage, setNewVillage] = useState('');
  const [newLang, setNewLang] = useState<'hi' | 'mr'>('hi');
  const [addLoading, setAddLoading] = useState(false);
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAuthorizedWorkers = async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_WORKERS_KEY);
      if (raw) setAuthorizedWorkers(JSON.parse(raw));
    } catch {}
  };

  // Live sector roster from GET /api/asha/cho/workers.
  const [sectorWorkers, setSectorWorkers] = useState<ChoSectorWorker[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState(false);

  const loadSectorWorkers = async () => {
    setWorkersLoading(true);
    setWorkersError(false);
    try {
      setSectorWorkers(await SyncApi.getChoSectorWorkers());
    } catch {
      setWorkersError(true);
    } finally {
      setWorkersLoading(false);
    }
  };

  useEffect(() => {
    loadAuthorizedWorkers();
    loadSectorWorkers();
  }, []);

  const resetAddForm = () => {
    setNewName('');
    setNewPhone('');
    setNewVillage('');
    setNewRole('ASHA');
    setNewLang('hi');
    setAddStatus(null);
  };

  const handleAddWorker = async () => {
    if (!newName.trim()) {
      setAddStatus({ type: 'error', text: tr('नाम डालें', 'नाव टाका') });
      return;
    }
    const digits = newPhone.replace(/[^0-9]/g, '');
    if (digits.length !== 10) {
      setAddStatus({ type: 'error', text: tr('10 अंकों का नंबर डालें', '10 अंकी नंबर टाका') });
      return;
    }
    setAddLoading(true);
    setAddStatus(null);
    const result = await addWorkerByCho({
      name: newName.trim(),
      phone: digits,
      role: newRole,
      village: newVillage.trim(),
      preferredLanguage: newLang,
    });
    setAddLoading(false);
    if (result.success) {
      setAddStatus({ type: 'success', text: result.message });
      await loadAuthorizedWorkers();
      loadSectorWorkers();
      setTimeout(() => {
        setShowAdd(false);
        resetAddForm();
      }, 1600);
    } else {
      setAddStatus({ type: 'error', text: result.message });
    }
  };

  // ---- Referrals ----
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [adviceTask, setAdviceTask] = useState<any>(null);
  const [adviceNotes, setAdviceNotes] = useState('');
  const [adviceSaved, setAdviceSaved] = useState(false);

  const markApproved = (id: string) =>
    setApprovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const handleApprove = async (id: string) => {
    markApproved(id);
    await approveReferralByCho(id);
  };

  const handleSaveAdvice = async () => {
    if (!adviceTask) return;
    await approveReferralByCho(adviceTask.id, adviceNotes);
    markApproved(adviceTask.id);
    setAdviceSaved(true);
    setTimeout(() => {
      setAdviceSaved(false);
      setAdviceTask(null);
      setAdviceNotes('');
    }, 1500);
  };

  // ---- Metrics (all derived from live data; nothing typed in by hand) ----
  const sectorReferrals = followUps.filter((f) => f.referredToCho || f.choStatus);
  const isApprovedTask = (f: { id: string; choStatus?: string }) => approvedIds.has(f.id) || f.choStatus === 'APPROVED_CHO';
  const pendingReferralCount = sectorReferrals.filter((f) => !f.isCompleted && !isApprovedTask(f)).length;
  const approvedReferralCount = sectorReferrals.filter((f) => isApprovedTask(f)).length;
  const urgentTasks = followUps.filter((f) => !f.isCompleted);

  const tenDigits = (p: string) => (p || '').replace(/[^0-9]/g, '').slice(-10);
  const serverPhones = new Set(sectorWorkers.map((w) => tenDigits(w.phone)));

  const allWorkers: WorkerRow[] = [
    ...sectorWorkers.map((w) => ({
      id: `s-${tenDigits(w.phone)}`,
      name: w.name,
      role: (String(w.role).toUpperCase() === 'ANM' ? 'ANM' : 'ASHA') as 'ASHA' | 'ANM',
      village: w.villageName || '',
      phone: w.phone,
      families: w.familyCount,
      surveys: w.surveyCount,
      referrals: w.pendingReferralCount,
      isChoAdded: false,
    })),
    // Workers this CHO just authorized on this device that the server list doesn't show yet.
    ...authorizedWorkers
      .filter((w) => w?.phone && !serverPhones.has(tenDigits(w.phone)))
      .map((w) => ({
        id: w.id || `w-${w.phone}`,
        name: w.name,
        role: (w.role === 'ANM' ? 'ANM' : 'ASHA') as 'ASHA' | 'ANM',
        village: w.village || '',
        phone: w.phone,
        families: 0,
        surveys: 0,
        referrals: 0,
        isChoAdded: true,
      })),
  ];

  const roleLabel = (r: 'ASHA' | 'ANM') => (r === 'ANM' ? tr('एएनएम', 'एएनएम') : tr('आशा', 'आशा'));

  // =============================================================================================
  // Workers view
  // =============================================================================================
  if (view === 'workers') {
    return (
      <Screen>
        <Button
          label={tr('कार्यकर्ता जोड़ें', 'कार्यकर्ता जोडा')}
          icon={UserPlus}
          onPress={() => {
            resetAddForm();
            setShowAdd(true);
          }}
        />

        {/* NHM work messages to the sector (compose · read / done counts · withdraw) */}
        <ChoBroadcastPanel />

        <SectionTitle label={tr('कार्यकर्ता', 'कार्यकर्ते')} count={allWorkers.length} />
        {workersError ? (
          <Card tone="amber">
            <Text style={text.body}>{tr('कार्यकर्ता सूची लोड नहीं हुई', 'कार्यकर्ता यादी लोड झाली नाही')}</Text>
            <Button label={tr('फिर से कोशिश करें', 'पुन्हा प्रयत्न करा')} icon={RefreshCw} variant="secondary" onPress={loadSectorWorkers} />
          </Card>
        ) : null}
        {!workersLoading && !workersError && allWorkers.length === 0 ? (
          <EmptyState icon={Users} title={tr('कोई आशा कार्यकर्ता पंजीकृत नहीं है', 'कोणतीही आशा कार्यकर्ती नोंदणीकृत नाही')} />
        ) : null}
        <View style={styles.list}>
          {allWorkers.map((w) => (
            <Card key={w.id} onPress={() => setSelectedWorker(w)} accessibilityLabel={w.name}>
              <View style={styles.workerHead}>
                <View style={[styles.avatar, w.role === 'ANM' && styles.avatarAnm]}>
                  <Text style={[styles.avatarText, w.role === 'ANM' && styles.avatarTextAnm]}>
                    {w.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={text.heading} numberOfLines={1}>
                    {w.name}
                  </Text>
                  {w.village ? (
                    <Text style={text.caption} numberOfLines={1}>
                      {w.village}
                    </Text>
                  ) : null}
                </View>
                <StatusPill tone={w.role === 'ANM' ? 'neutral' : 'accent'} label={roleLabel(w.role)} />
                <ChevronRight size={20} color={color.faint} strokeWidth={2} />
              </View>
              <View style={styles.statRow}>
                <Stat value={w.families} label={tr('परिवार', 'कुटुंबे')} />
                <Stat value={w.surveys} label={tr('सर्वे', 'सर्वे')} />
                <Stat value={w.referrals} label={tr('रेफरल', 'रेफरल')} tone={w.referrals > 0 ? 'red' : 'neutral'} />
              </View>
              {w.isChoAdded ? (
                <View style={styles.pillLeft}>
                  <StatusPill tone="green" icon={ShieldCheck} label={tr('सीएचओ अधिकृत', 'सीएचओ अधिकृत')} />
                </View>
              ) : null}
            </Card>
          ))}
        </View>

        {/* Worker detail */}
        <Sheet
          visible={!!selectedWorker}
          onClose={() => setSelectedWorker(null)}
          title={selectedWorker?.name}
          closeLabel={tr('बंद करें', 'बंद करा')}
        >
          {selectedWorker ? (
            <View style={styles.sheetBody}>
              <ListRow icon={MapPin} title={selectedWorker.village || '—'} subtitle={roleLabel(selectedWorker.role)} />
              <ListRow
                icon={Phone}
                title={selectedWorker.phone}
                subtitle={tr('कॉल करें', 'कॉल करा')}
                onPress={() => Linking.openURL(`tel:${selectedWorker.phone}`)}
              />
              <View style={styles.statRow}>
                <Stat value={selectedWorker.families} label={tr('परिवार', 'कुटुंबे')} />
                <Stat value={selectedWorker.surveys} label={tr('सर्वे', 'सर्वे')} />
                <Stat value={selectedWorker.referrals} label={tr('रेफरल', 'रेफरल')} tone={selectedWorker.referrals > 0 ? 'red' : 'neutral'} />
              </View>
            </View>
          ) : null}
        </Sheet>

        {/* CHO onboarding */}
        <Sheet
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          title={tr('नया कार्यकर्ता', 'नवीन कार्यकर्ता')}
          closeLabel={tr('बंद करें', 'बंद करा')}
        >
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {addStatus ? <StatusBanner type={addStatus.type} message={addStatus.text} /> : null}

            <Text style={text.label}>{tr('पद', 'पद')}</Text>
            <Segmented
              options={[
                { key: 'ASHA', label: tr('आशा', 'आशा') },
                { key: 'ANM', label: tr('एएनएम', 'एएनएम') },
              ]}
              value={newRole}
              onChange={setNewRole}
            />
            <Field label={tr('पूरा नाम', 'पूर्ण नाव')} voice="name" value={newName} onChangeText={setNewName} />
            <Field
              label={tr('मोबाइल नंबर', 'मोबाइल नंबर')} voice="phone"
              value={newPhone}
              onChangeText={(v) => setNewPhone(v.replace(/[^0-9]/g, '').slice(0, 10))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="98765 43210"
            />
            <Field label={tr('गाँव / उपकेंद्र', 'गाव / उपकेंद्र')} voice="text" value={newVillage} onChangeText={setNewVillage} />
            <Text style={text.label}>{tr('ऐप भाषा', 'ॲप भाषा')}</Text>
            <Segmented
              options={[
                { key: 'hi', label: 'हिंदी' },
                { key: 'mr', label: 'मराठी' },
              ]}
              value={newLang}
              onChange={setNewLang}
            />
            <Button label={tr('अधिकृत करें', 'अधिकृत करा')} icon={ShieldCheck} loading={addLoading} onPress={handleAddWorker} />
          </ScrollView>
        </Sheet>
      </Screen>
    );
  }

  // =============================================================================================
  // Referrals view
  // =============================================================================================
  return (
    <Screen>
      <View style={styles.statGrid}>
        <View style={styles.statCell}>
          <Card tone="amber">
            <Stat value={pendingReferralCount} label={tr('लंबित रेफरल', 'प्रलंबित रेफरल')} tone="amber" />
          </Card>
        </View>
        <View style={styles.statCell}>
          <Card tone="green">
            <Stat value={approvedReferralCount} label={tr('सत्यापित रेफरल', 'सत्यापित रेफरल')} tone="green" />
          </Card>
        </View>
      </View>

      <SectionTitle label={tr('खुले रेफरल', 'खुले रेफरल')} count={urgentTasks.length} />

      {urgentTasks.length === 0 ? (
        <EmptyState icon={CircleCheck} title={tr('कोई रेफरल नहीं', 'रेफरल नाही')} />
      ) : (
        <View style={styles.list}>
          {urgentTasks.map((task: any) => {
            const isApproved = approvedIds.has(task.id) || task.choStatus === 'APPROVED_CHO';
            return (
              <Card key={task.id} tone={isApproved ? 'green' : 'red'}>
                {/* Patient */}
                <View style={styles.refHead}>
                  <View style={styles.flex}>
                    <Text style={text.heading} numberOfLines={2}>
                      {task.name}
                    </Text>
                    <Text style={text.caption} numberOfLines={1}>
                      {[
                        task.age ? `${task.age} ${tr('वर्ष', 'वर्षे')}` : null,
                        task.gender || null,
                        task.houseNumber ? `${tr('घर', 'घर')} ${task.houseNumber}` : null,
                        task.villageName || null,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  </View>
                  <StatusPill
                    tone={isApproved ? 'green' : 'red'}
                    icon={isApproved ? Check : AlertTriangle}
                    label={isApproved ? tr('स्वीकृत', 'मंजूर') : tr('अति-आवश्यक', 'अति-तातडीचे')}
                  />
                </View>

                <Text style={[text.body, styles.reason]}>{task.taskType}</Text>

                {/* Contact + ABHA */}
                {task.phone || task.abhaNumber ? (
                  <View style={styles.chipRow}>
                    {task.phone ? (
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${task.phone}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${tr('कॉल करें', 'कॉल करा')} ${task.phone}`}
                        style={({ pressed }) => [styles.callChip, pressed && styles.pressed]}
                      >
                        <Phone size={16} color={color.accent} strokeWidth={2} />
                        <Text style={[text.label, { color: color.accentPressed }]}>{task.phone}</Text>
                      </Pressable>
                    ) : null}
                    {task.abhaNumber ? <StatusPill tone="green" icon={ShieldCheck} label={`ABHA ${task.abhaNumber}`} /> : null}
                  </View>
                ) : null}

                {/* Condition & vitals */}
                {task.condition || task.vitals ? (
                  <View style={[styles.infoBox, styles.infoNeutral]}>
                    {task.condition ? (
                      <InfoLine icon={Activity} label={tr('निदान', 'निदान')} value={task.condition} />
                    ) : null}
                    {task.vitals ? (
                      <InfoLine icon={ClipboardList} label={tr('जाँच', 'तपासणी')} value={task.vitals} />
                    ) : null}
                  </View>
                ) : null}

                {/* Prescription */}
                {task.prescriptionDetails ? (
                  <View style={[styles.infoBox, styles.infoAmber]}>
                    <InfoLine icon={Pill} label={tr('दवा', 'औषध')} value={task.prescriptionDetails} tint={color.amberText} />
                    {task.prescriptionDeadline ? (
                      <InfoLine icon={Clock} label={tr('समयसीमा', 'मुदत')} value={task.prescriptionDeadline} tint={color.redText} />
                    ) : null}
                  </View>
                ) : null}

                {/* Source + due */}
                <View style={styles.metaRow}>
                  <Text style={[text.caption, styles.flex]} numberOfLines={1}>
                    {task.doctorName
                      ? `${tr('डॉक्टर', 'डॉक्टर')} ${task.doctorName}`
                      : `${tr('आशा', 'आशा')} ${task.ashaWorkerPhone || ''}`}
                  </Text>
                  {task.dueDate ? (
                    <View style={styles.inline}>
                      <Calendar size={14} color={color.muted} strokeWidth={2} />
                      <Text style={text.caption}>{task.dueDate}</Text>
                    </View>
                  ) : null}
                </View>

                {task.choAdvice ? (
                  <View style={[styles.infoBox, styles.infoAccent]}>
                    <InfoLine icon={FileText} label={tr('सीएचओ सलाह', 'सीएचओ सल्ला')} value={task.choAdvice} tint={color.accentPressed} />
                  </View>
                ) : null}

                {/* Actions */}
                <View style={styles.actions}>
                  <View style={styles.flex}>
                    <Button
                      label={isApproved ? tr('स्वीकृत', 'मंजूर') : tr('स्वीकृत करें', 'मंजूर करा')}
                      icon={Check}
                      disabled={isApproved}
                      onPress={() => handleApprove(task.id)}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      label={tr('सलाह लिखें', 'सल्ला लिहा')}
                      icon={FileText}
                      variant="secondary"
                      onPress={() => {
                        setAdviceNotes('');
                        setAdviceTask(task);
                      }}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Clinical advice */}
      <Sheet
        visible={!!adviceTask}
        onClose={() => setAdviceTask(null)}
        title={adviceTask?.name}
        closeLabel={tr('बंद करें', 'बंद करा')}
      >
        <View style={styles.sheetBody}>
          <Field
            label={tr('नैदानिक सलाह', 'वैद्यकीय सल्ला')} voice="long"
            value={adviceNotes}
            onChangeText={setAdviceNotes}
            multiline
            helper={tr('आशा को भेजी जाएगी', 'आशाला पाठवला जाईल')}
          />
          {adviceSaved ? <StatusBanner type="success" message={tr('सलाह भेजी गई', 'सल्ला पाठवला')} /> : null}
          <Button label={tr('सहेजें व स्वीकृत करें', 'जतन व मंजूर करा')} icon={Check} onPress={handleSaveAdvice} />
        </View>
      </Sheet>
    </Screen>
  );
};

// ---------------------------------------------------------------------------------------------

const InfoLine: React.FC<{ icon: React.ComponentType<any>; label: string; value: string; tint?: string }> = ({
  icon: Icon,
  label,
  value,
  tint = color.text,
}) => (
  <View style={styles.infoLine}>
    <Icon size={16} color={tint} strokeWidth={2} />
    <Text style={[text.body, styles.flex, { color: tint }]}>
      <Text style={styles.infoLabel}>{label}: </Text>
      {value}
    </Text>
  </View>
);

const StatusBanner: React.FC<{ type: 'success' | 'error'; message: string }> = ({ type, message }) => (
  <View style={[styles.banner, type === 'error' ? styles.bannerError : styles.bannerOk]} accessibilityLiveRegion="polite">
    {type === 'error' ? (
      <AlertTriangle size={18} color={color.red} strokeWidth={2} />
    ) : (
      <CircleCheck size={18} color={color.green} strokeWidth={2} />
    )}
    <Text style={[text.body, styles.flex, { color: type === 'error' ? color.redText : color.greenText }]}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.md },
  pressed: { opacity: 0.85 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },

  // KPI grid (2 × 2)
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  statCell: { width: '50%', padding: space.xs },

  // Workers
  workerHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAnm: { backgroundColor: color.lineSoft },
  avatarText: { fontSize: 15, fontWeight: '800', color: color.accentPressed },
  avatarTextAnm: { color: color.text },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  pillLeft: { flexDirection: 'row', marginTop: space.md },

  // Referrals
  refHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  reason: { marginTop: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md },
  callChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accentLine,
  },
  infoBox: { marginTop: space.md, padding: space.md, borderRadius: radius.control, borderWidth: 1, gap: space.sm },
  infoNeutral: { backgroundColor: color.canvas, borderColor: color.line },
  infoAmber: { backgroundColor: color.amberSoft, borderColor: color.amberLine },
  infoAccent: { backgroundColor: color.accentSoft, borderColor: color.accentLine },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  infoLabel: { fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },

  // Sheets
  sheetBody: { gap: space.lg, paddingBottom: space.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  bannerError: { backgroundColor: color.redSoft, borderColor: color.redLine },
  bannerOk: { backgroundColor: color.greenSoft, borderColor: color.greenLine },
});
