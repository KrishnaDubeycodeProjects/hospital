/**
 * CHO sector performance dashboard (bottom tab "प्रदर्शन").
 *
 *   - Sector summary: average score, active workers, families, surveys, pending referrals, overdue tasks.
 *   - Ranked ASHA list with a 0–100 performance score, coverage, weekly activity and last-active time.
 *   - Worker detail: score breakdown, beneficiaries, task status, 14-day activity chart, recent work trail.
 *
 * Score (all from GET /api/asha/cho/workers):
 *   40% household coverage (families visited in 30 days / families)
 *   30% task completion   (done / (done + open))
 *   20% survey activity   (surveys in 30 days vs. a target of 20)
 *   10% punctuality       (penalised for overdue tasks)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Linking, ActivityIndicator, ScrollView } from 'react-native';
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Download,
  HeartPulse,
  Home,
  MapPin,
  Phone,
  RefreshCw,
  Route,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { SyncApi, ChoSectorWorker, ChoWorkerActivity } from '../api/syncApi';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { downloadChoReport } from '../utils/choReport';
import {
  Screen,
  Card,
  SectionTitle,
  StatusPill,
  Button,
  ListRow,
  Segmented,
  EmptyState,
  Sheet,
  SkeletonRows,
  IconBadge,
  color,
  radius,
  space,
  text,
  tonePalette,
  useTr,
  type Tone,
} from '../ui';

type Filter = 'all' | 'attention' | 'top';

type Scored = ChoSectorWorker & {
  score: number;
  coverage: number; // 0..100
  completion: number; // 0..100
  activity: number; // 0..100
  daysIdle: number | null;
};

const SURVEY_TARGET_30D = 20;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function scoreWorker(w: ChoSectorWorker): Scored {
  const coverage = pct(w.familiesVisited30d, w.familyCount);
  const totalTasks = w.tasksDone + w.tasksOpen;
  const completion = totalTasks > 0 ? pct(w.tasksDone, totalTasks) : w.familyCount > 0 ? 50 : 0;
  const activity = clamp(pct(w.surveys30d, SURVEY_TARGET_30D));
  const punctuality = clamp(100 - w.tasksOverdue * 20);
  const score = Math.round(coverage * 0.4 + completion * 0.3 + activity * 0.2 + punctuality * 0.1);
  const last = w.lastActive ? new Date(w.lastActive) : null;
  const daysIdle = last && !isNaN(last.getTime()) ? Math.max(0, Math.floor((Date.now() - last.getTime()) / 86400000)) : null;
  return { ...w, score: w.familyCount === 0 && w.surveyCount === 0 ? 0 : score, coverage, completion, activity, daysIdle };
}

function scoreTone(score: number): Tone {
  if (score >= 75) return 'green';
  if (score >= 50) return 'accent';
  if (score >= 30) return 'amber';
  return 'red';
}

const needsAttention = (w: Scored) => w.score < 50 || w.tasksOverdue > 0 || w.daysIdle == null || w.daysIdle > 7;

export const ChoPerformanceScreen: React.FC = () => {
  const tr = useTr();
  const [workers, setWorkers] = useState<ChoSectorWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Scored | null>(null);
  const { user } = useAuth();
  const { language } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setWorkers(await SyncApi.getChoSectorWorkers());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ashas = useMemo(
    () =>
      workers
        .filter((w) => String(w.role).toUpperCase() !== 'ANM')
        .map(scoreWorker)
        .sort((a, b) => b.score - a.score),
    [workers],
  );

  const summary = useMemo(() => {
    const n = ashas.length;
    const sum = (f: (w: Scored) => number) => ashas.reduce((s, w) => s + f(w), 0);
    return {
      avgScore: n ? Math.round(sum((w) => w.score) / n) : 0,
      active7d: ashas.filter((w) => w.daysIdle != null && w.daysIdle <= 7).length,
      families: sum((w) => w.familyCount),
      visited: sum((w) => w.familiesVisited30d),
      surveys30d: sum((w) => w.surveys30d),
      surveys7d: sum((w) => w.surveys7d),
      pendingRef: sum((w) => w.pendingReferralCount),
      overdue: sum((w) => w.tasksOverdue),
      pregnant: sum((w) => w.pregnantCount),
      ncd: sum((w) => w.ncdCount),
      children: sum((w) => w.childCount),
      attention: ashas.filter(needsAttention).length,
    };
  }, [ashas]);

  const visible =
    filter === 'attention' ? ashas.filter(needsAttention) : filter === 'top' ? ashas.filter((w) => w.score >= 75) : ashas;

  const gradeLabel = (score: number) =>
    score >= 75
      ? tr('उत्कृष्ट', 'उत्कृष्ट', 'Excellent')
      : score >= 50
      ? tr('अच्छा', 'चांगले', 'Good')
      : score >= 30
      ? tr('सुधार चाहिए', 'सुधारणा हवी', 'Needs improvement')
      : tr('कमज़ोर', 'कमकुवत', 'Weak');

  const idleLabel = (d: number | null) =>
    d == null
      ? tr('कोई गतिविधि नहीं', 'कोणतीही क्रिया नाही', 'No activity')
      : d === 0
      ? tr('आज सक्रिय', 'आज सक्रिय', 'Active today')
      : d === 1
      ? tr('कल सक्रिय', 'काल सक्रिय', 'Active yesterday')
      : tr(`${d} दिन पहले`, `${d} दिवसांपूर्वी`, `${d} days ago`);

  const handleDownload = async () => {
    setExporting(true);
    setExportError(false);
    try {
      await downloadChoReport(
        ashas.map((w) => ({
          name: w.name,
          village: w.villageName || '',
          phone: w.phone,
          families: w.familyCount,
          visited30d: w.familiesVisited30d,
          coverage: w.coverage,
          surveys30d: w.surveys30d,
          surveys7d: w.surveys7d,
          tasksDone: w.tasksDone,
          tasksOpen: w.tasksOpen,
          tasksOverdue: w.tasksOverdue,
          pendingReferrals: w.pendingReferralCount,
          pregnant: w.pregnantCount,
          ncd: w.ncdCount,
          children: w.childCount,
          lastActive: idleLabel(w.daysIdle),
          inactive: w.daysIdle == null || w.daysIdle > 7,
          score: w.score,
          grade: gradeLabel(w.score),
        })),
        {
          lang: language === 'mr' ? 'mr' : language === 'en' ? 'en' : 'hi',
          choName: user?.name || '',
          block: user?.blockName,
          district: user?.districtName,
          generatedAt: new Date(),
          avgScore: summary.avgScore,
          avgGrade: gradeLabel(summary.avgScore),
          active: `${summary.active7d}/${ashas.length}`,
          coverage: `${pct(summary.visited, summary.families)}%`,
          surveys30d: summary.surveys30d,
          pendingReferrals: summary.pendingRef,
          overdue: summary.overdue,
        },
      );
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  if (loading && workers.length === 0) {
    return (
      <Screen>
        <SkeletonRows count={6} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* ---- Sector hero ---- */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Text style={styles.heroKicker}>{tr('सेक्टर प्रदर्शन', 'सेक्टर कामगिरी', 'Sector performance')}</Text>
            <View style={styles.heroScoreRow}>
              <Text style={styles.heroScore}>{summary.avgScore}</Text>
              <Text style={styles.heroScoreMax}>/100</Text>
            </View>
            <Text style={styles.heroSub}>
              {tr('औसत आशा स्कोर', 'सरासरी आशा गुण', 'Average ASHA score')} · {gradeLabel(summary.avgScore)}
            </Text>
          </View>
          <Button label={tr('ताज़ा करें', 'रिफ्रेश', 'Refresh')} icon={RefreshCw} variant="secondary" loading={loading} onPress={load} />
        </View>
        <ProgressBar value={summary.avgScore} track="rgba(255,255,255,0.25)" fill={color.white} />
        <View style={styles.heroStats}>
          <HeroStat value={`${summary.active7d}/${ashas.length}`} label={tr('सक्रिय (7 दिन)', 'सक्रिय (7 दिवस)', 'Active (7 days)')} />
          <HeroStat value={`${pct(summary.visited, summary.families)}%`} label={tr('घर कवरेज', 'घर व्याप्ती', 'Home coverage')} />
          <HeroStat value={summary.surveys7d} label={tr('सर्वे (7 दिन)', 'सर्वे (7 दिवस)', 'Surveys (7 days)')} />
        </View>
      </View>

      {error ? (
        <Card tone="amber">
          <Text style={text.body}>{tr('डेटा लोड नहीं हुआ', 'डेटा लोड झाला नाही', 'Data not loaded')}</Text>
          <Button label={tr('फिर से कोशिश करें', 'पुन्हा प्रयत्न करा', 'Try again')} icon={RefreshCw} variant="secondary" onPress={load} />
        </Card>
      ) : null}

      {/* ---- KPI grid ---- */}
      <View style={styles.grid}>
        <Kpi icon={Home} tone="accent" value={summary.families} label={tr('परिवार', 'कुटुंबे', 'Families')} />
        <Kpi icon={ClipboardCheck} tone="green" value={summary.surveys30d} label={tr('सर्वे (30 दिन)', 'सर्वे (30 दिवस)', 'Surveys (30 days)')} />
        <Kpi
          icon={Route}
          tone={summary.pendingRef > 0 ? 'amber' : 'neutral'}
          value={summary.pendingRef}
          label={tr('लंबित रेफरल', 'प्रलंबित रेफरल', 'Pending referrals')}
        />
        <Kpi
          icon={CalendarClock}
          tone={summary.overdue > 0 ? 'red' : 'neutral'}
          value={summary.overdue}
          label={tr('अतिदेय कार्य', 'थकीत कामे', 'Overdue tasks')}
        />
      </View>

      {/* ---- Beneficiaries ---- */}
      <Card>
        <Text style={text.label}>{tr('लाभार्थी', 'लाभार्थी', 'Beneficiaries')}</Text>
        <View style={styles.benefRow}>
          <Benef icon={HeartPulse} tone="red" value={summary.pregnant} label={tr('गर्भवती', 'गर्भवती', 'Pregnant')} />
          <Benef icon={Activity} tone="amber" value={summary.ncd} label={tr('एनसीडी', 'एनसीडी', 'NCD')} />
          <Benef icon={Baby} tone="accent" value={summary.children} label={tr('5 वर्ष से कम', '5 वर्षांखालील', 'Under 5 years')} />
        </View>
      </Card>

      {/* ---- Ranked workers ---- */}
      <SectionTitle label={tr('आशा रैंकिंग', 'आशा क्रमवारी', 'ASHA ranking')} count={visible.length} />
      <Button
        label={tr('रिपोर्ट डाउनलोड (PDF)', 'अहवाल डाउनलोड (PDF)', 'Download report (PDF)')}
        icon={Download}
        variant="secondary"
        loading={exporting}
        disabled={ashas.length === 0}
        onPress={handleDownload}
      />
      {exportError ? (
        <Text style={[text.caption, { color: color.redText }]}>{tr('रिपोर्ट नहीं बन सकी', 'अहवाल तयार झाला नाही', 'Report could not be created')}</Text>
      ) : null}
      <Segmented
        options={[
          { key: 'all', label: tr('सभी', 'सर्व', 'All') },
          { key: 'attention', label: `${tr('ध्यान दें', 'लक्ष द्या', 'Needs attention')} (${summary.attention})` },
          { key: 'top', label: tr('श्रेष्ठ', 'उत्तम', 'Top') },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {!loading && !error && visible.length === 0 ? (
        <EmptyState icon={Users} title={tr('कोई आशा नहीं', 'कोणतीही आशा नाही', 'No ASHAs')} />
      ) : null}

      <View style={styles.list}>
        {visible.map((w) => {
          const rank = ashas.indexOf(w) + 1;
          const tone = scoreTone(w.score);
          const p = tonePalette(tone);
          return (
            <Card key={w.phone} onPress={() => setSelected(w)} accessibilityLabel={`${w.name} ${w.score}`}>
              <View style={styles.rowHead}>
                <View style={[styles.rank, rank <= 3 && styles.rankTop]}>
                  {rank === 1 ? (
                    <Trophy size={16} color={color.amber} strokeWidth={2} />
                  ) : (
                    <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>{rank}</Text>
                  )}
                </View>
                <View style={styles.flex}>
                  <Text style={text.heading} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <View style={styles.inline}>
                    <MapPin size={13} color={color.muted} strokeWidth={2} />
                    <Text style={text.caption} numberOfLines={1}>
                      {w.villageName || '—'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: p.bg, borderColor: p.line }]}>
                  <Text style={[styles.scoreBadgeNum, { color: p.fg }]}>{w.score}</Text>
                  <Text style={[styles.scoreBadgeLbl, { color: p.text }]}>{gradeLabel(w.score)}</Text>
                </View>
              </View>

              <ProgressBar value={w.score} fill={p.fg} />

              <View style={styles.miniRow}>
                <Mini value={`${w.coverage}%`} label={tr('कवरेज', 'व्याप्ती', 'Coverage')} />
                <Mini value={w.surveys7d} label={tr('सर्वे/सप्ताह', 'सर्वे/आठवडा', 'Surveys/week')} />
                <Mini value={`${w.completion}%`} label={tr('कार्य पूर्ण', 'काम पूर्ण', 'Tasks done')} />
                <Mini value={w.tasksOverdue} label={tr('अतिदेय', 'थकीत', 'Overdue')} tone={w.tasksOverdue > 0 ? 'red' : undefined} />
              </View>

              <View style={styles.footRow}>
                <View style={styles.inline}>
                  <Clock size={13} color={w.daysIdle != null && w.daysIdle <= 2 ? color.green : color.muted} strokeWidth={2} />
                  <Text style={[text.micro, w.daysIdle != null && w.daysIdle <= 2 && { color: color.greenText }]}>
                    {idleLabel(w.daysIdle)}
                  </Text>
                </View>
                {w.daysIdle == null || w.daysIdle > 7 ? (
                  <StatusPill tone="red" icon={AlertTriangle} label={tr('निष्क्रिय', 'निष्क्रिय', 'Inactive')} />
                ) : w.pendingReferralCount > 0 ? (
                  <StatusPill tone="amber" icon={Route} label={`${w.pendingReferralCount} ${tr('रेफरल', 'रेफरल', 'Referrals')}`} />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>

      <WorkerSheet worker={selected} onClose={() => setSelected(null)} gradeLabel={gradeLabel} idleLabel={idleLabel} />
    </Screen>
  );
};

// ---------------------------------------------------------------------------------------------
// Worker detail
// ---------------------------------------------------------------------------------------------

const WorkerSheet: React.FC<{
  worker: Scored | null;
  onClose: () => void;
  gradeLabel: (s: number) => string;
  idleLabel: (d: number | null) => string;
}> = ({ worker, onClose, gradeLabel, idleLabel }) => {
  const tr = useTr();
  const [activity, setActivity] = useState<ChoWorkerActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!worker) return;
    let alive = true;
    setActivity(null);
    setFailed(false);
    setLoading(true);
    SyncApi.getChoWorkerActivity(worker.phone)
      .then((a) => alive && setActivity(a))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [worker?.phone]);

  const catLabel = (kind: string, cat: string) => {
    if (kind === 'SURVEY') {
      if (cat === 'PREGNANCY') return tr('गर्भावस्था सर्वे', 'गर्भधारणा सर्वे', 'Pregnancy survey');
      if (cat === 'DISEASE') return tr('एनसीडी सर्वे', 'एनसीडी सर्वे', 'NCD survey');
      if (cat === 'CHILD') return tr('बाल सर्वे', 'बालक सर्वे', 'Child survey');
      return tr('सर्वे', 'सर्वे', 'Surveys');
    }
    if (cat.includes('REFERRAL')) return tr('रेफरल', 'रेफरल', 'Referrals');
    return tr('फॉलो-अप', 'फॉलो-अप', 'Follow-up');
  };
  const statusPill = (status?: string | null) => {
    if (!status) return <StatusPill tone="green" icon={CircleCheck} label={tr('दर्ज', 'नोंद', 'Recorded')} />;
    if (status === 'COMPLETED') return <StatusPill tone="green" icon={CircleCheck} label={tr('पूर्ण', 'पूर्ण', 'Done')} />;
    if (status === 'APPROVED_CHO') return <StatusPill tone="accent" icon={CircleCheck} label={tr('स्वीकृत', 'मंजूर', 'Approved')} />;
    return <StatusPill tone="amber" icon={Clock} label={tr('लंबित', 'प्रलंबित', 'Pending')} />;
  };
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  if (!worker) return null;
  const tone = scoreTone(worker.score);
  const p = tonePalette(tone);
  const maxDay = Math.max(1, ...(activity?.daily || []).map((d) => d.surveys + d.tasksDone));

  return (
    <Sheet visible onClose={onClose} title={worker.name} closeLabel={tr('बंद करें', 'बंद करा', 'Close')}>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
        {/* Score */}
        <View style={[styles.detailScore, { backgroundColor: p.bg, borderColor: p.line }]}>
          <View>
            <Text style={[styles.detailScoreNum, { color: p.fg }]}>{worker.score}</Text>
            <Text style={[text.label, { color: p.text }]}>{gradeLabel(worker.score)}</Text>
          </View>
          <View style={[styles.flex, styles.breakdown]}>
            <Breakdown label={tr('घर कवरेज', 'घर व्याप्ती', 'Home coverage')} value={worker.coverage} />
            <Breakdown label={tr('कार्य पूर्ण', 'काम पूर्ण', 'Tasks done')} value={worker.completion} />
            <Breakdown label={tr('सर्वे गतिविधि', 'सर्वे क्रिया', 'Survey activity')} value={worker.activity} />
          </View>
        </View>

        <View style={styles.inline}>
          <MapPin size={14} color={color.muted} strokeWidth={2} />
          <Text style={[text.caption, styles.flex]}>{worker.villageName || '—'}</Text>
          <Clock size={14} color={color.muted} strokeWidth={2} />
          <Text style={text.caption}>{idleLabel(worker.daysIdle)}</Text>
        </View>

        {/* Work numbers */}
        <View style={styles.grid}>
          <Kpi icon={Home} tone="accent" value={`${worker.familiesVisited30d}/${worker.familyCount}`} label={tr('घर भ्रमण (30 दिन)', 'घर भेटी (30 दिवस)', 'Home visits (30 days)')} />
          <Kpi icon={ClipboardCheck} tone="green" value={worker.surveys30d} label={tr('सर्वे (30 दिन)', 'सर्वे (30 दिवस)', 'Surveys (30 days)')} />
          <Kpi icon={TrendingUp} tone="green" value={worker.tasksDone} label={tr('कार्य पूर्ण', 'काम पूर्ण', 'Tasks done')} />
          <Kpi
            icon={CalendarClock}
            tone={worker.tasksOverdue > 0 ? 'red' : 'neutral'}
            value={`${worker.tasksOverdue}/${worker.tasksOpen}`}
            label={tr('अतिदेय / खुले', 'थकीत / खुले', 'Overdue / open')}
          />
        </View>

        <View style={styles.benefRow}>
          <Benef icon={HeartPulse} tone="red" value={worker.pregnantCount} label={tr('गर्भवती', 'गर्भवती', 'Pregnant')} />
          <Benef icon={Activity} tone="amber" value={worker.ncdCount} label={tr('एनसीडी', 'एनसीडी', 'NCD')} />
          <Benef icon={Route} tone={worker.pendingReferralCount > 0 ? 'amber' : 'neutral'} value={worker.pendingReferralCount} label={tr('लंबित रेफरल', 'प्रलंबित रेफरल', 'Pending referrals')} />
        </View>

        {/* 14-day chart */}
        <Text style={text.label}>{tr('पिछले 14 दिन', 'मागील 14 दिवस', 'Last 14 days')}</Text>
        {loading ? (
          <ActivityIndicator color={color.accent} />
        ) : failed ? (
          <Text style={text.caption}>{tr('गतिविधि लोड नहीं हुई', 'क्रिया लोड झाली नाही', 'Activity not loaded')}</Text>
        ) : (
          <View style={styles.chart} accessibilityLabel={tr('दैनिक गतिविधि', 'दैनिक क्रिया', 'Daily activity')}>
            {(activity?.daily || []).map((d) => {
              const total = d.surveys + d.tasksDone;
              return (
                <View key={d.date} style={styles.chartCol}>
                  <Text style={styles.chartVal}>{total || ''}</Text>
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${Math.round((total / maxDay) * 100)}%`, backgroundColor: total ? color.accent : color.line },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartDay}>{d.date.slice(8)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent trail */}
        {activity && activity.recent.length > 0 ? (
          <>
            <Text style={text.label}>{tr('हाल का काम', 'अलीकडील काम', 'Recent work')}</Text>
            <View style={styles.trail}>
              {activity.recent.slice(0, 10).map((r, i) => (
                <View key={`${r.at}-${i}`} style={styles.trailRow}>
                  <View style={[styles.trailDot, { backgroundColor: r.kind === 'SURVEY' ? color.accent : color.amber }]} />
                  <View style={styles.flex}>
                    <Text style={text.body} numberOfLines={1}>
                      {catLabel(r.kind, r.category)} · {r.memberName || '—'}
                    </Text>
                    <Text style={text.micro} numberOfLines={1}>
                      {[fmtDate(r.at), r.houseNumber ? `${tr('घर', 'घर', 'House')} ${r.houseNumber}` : null, r.villageName]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {statusPill(r.status)}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <ListRow
          icon={Phone}
          title={worker.phone}
          subtitle={tr('कॉल करें', 'कॉल करा', 'Call')}
          onPress={() => Linking.openURL(`tel:${worker.phone}`)}
        />
      </ScrollView>
    </Sheet>
  );
};

// ---------------------------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------------------------

const ProgressBar: React.FC<{ value: number; fill: string; track?: string }> = ({ value, fill, track = color.lineSoft }) => (
  <View style={[styles.bar, { backgroundColor: track }]}>
    <View style={[styles.barFill, { width: `${clamp(value)}%`, backgroundColor: fill }]} />
  </View>
);

const HeroStat: React.FC<{ value: number | string; label: string }> = ({ value, label }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatVal}>{value}</Text>
    <Text style={styles.heroStatLbl} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const Kpi: React.FC<{ icon: LucideIcon; tone: Tone; value: number | string; label: string }> = ({ icon, tone, value, label }) => {
  const p = tonePalette(tone);
  return (
    <View style={styles.kpiCell}>
      <View style={styles.kpi}>
        <IconBadge icon={icon} tone={tone} size="sm" />
        <Text style={[text.display, { color: tone === 'neutral' ? color.ink : p.fg }]}>{value}</Text>
        <Text style={text.caption} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
};

const Benef: React.FC<{ icon: LucideIcon; tone: Tone; value: number; label: string }> = ({ icon: Icon, tone, value, label }) => {
  const p = tonePalette(tone);
  return (
    <View style={[styles.benef, { backgroundColor: p.bg, borderColor: p.line }]}>
      <Icon size={18} color={p.fg} strokeWidth={2} />
      <Text style={[text.heading, { color: tone === 'neutral' ? color.ink : p.text }]}>{value}</Text>
      <Text style={text.micro} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const Mini: React.FC<{ value: number | string; label: string; tone?: Tone }> = ({ value, label, tone }) => (
  <View style={styles.mini}>
    <Text style={[text.label, tone ? { color: tonePalette(tone).fg } : null]}>{value}</Text>
    <Text style={styles.miniLbl} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const Breakdown: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.breakRow}>
    <View style={styles.breakHead}>
      <Text style={text.micro}>{label}</Text>
      <Text style={[text.micro, { color: color.ink }]}>{value}%</Text>
    </View>
    <ProgressBar value={value} fill={tonePalette(scoreTone(value)).fg} track={color.white} />
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  list: { gap: space.md },

  // Hero
  hero: { backgroundColor: color.accent, borderRadius: radius.card, padding: space.lg, gap: space.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  heroKicker: { fontSize: 13, fontWeight: '700', color: color.accentLine, lineHeight: 18 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: space.xs },
  heroScore: { fontSize: 44, fontWeight: '800', color: color.white, lineHeight: 50 },
  heroScoreMax: { fontSize: 16, fontWeight: '700', color: color.accentLine, marginBottom: 8 },
  heroSub: { fontSize: 13, fontWeight: '600', color: color.white, lineHeight: 18 },
  heroStats: { flexDirection: 'row', gap: space.sm },
  heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.control, padding: space.sm },
  heroStatVal: { fontSize: 18, fontWeight: '800', color: color.white, lineHeight: 24 },
  heroStatLbl: { fontSize: 11, fontWeight: '600', color: color.accentLine, lineHeight: 15 },

  // KPI grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  kpiCell: { width: '50%', padding: space.xs },
  kpi: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.md,
    gap: space.xs,
  },

  // Beneficiaries
  benefRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  benef: { flex: 1, alignItems: 'center', borderRadius: radius.control, borderWidth: 1, paddingVertical: space.md, gap: 2 },

  // Worker row
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: { backgroundColor: color.amberSoft, borderWidth: 1, borderColor: color.amberLine },
  rankText: { fontSize: 14, fontWeight: '800', color: color.muted },
  rankTextTop: { color: color.amberText },
  scoreBadge: { alignItems: 'center', borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 4, minWidth: 64 },
  scoreBadgeNum: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  scoreBadgeLbl: { fontSize: 10, fontWeight: '700', lineHeight: 14 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: space.md },
  barFill: { height: '100%', borderRadius: 3 },
  miniRow: { flexDirection: 'row', marginTop: space.md },
  mini: { flex: 1, alignItems: 'center' },
  miniLbl: { fontSize: 11, fontWeight: '600', color: color.muted, lineHeight: 15 },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
    minHeight: 36,
  },

  // Sheet
  sheetScroll: { maxHeight: 620 },
  sheetBody: { gap: space.lg, paddingBottom: space.xl },
  detailScore: { flexDirection: 'row', alignItems: 'center', gap: space.lg, borderRadius: radius.card, borderWidth: 1, padding: space.lg },
  detailScoreNum: { fontSize: 44, fontWeight: '800', lineHeight: 50 },
  breakdown: { gap: space.sm },
  breakRow: { gap: 2 },
  breakHead: { flexDirection: 'row', justifyContent: 'space-between' },

  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 3 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%' },
  chartVal: { fontSize: 10, fontWeight: '700', color: color.muted, height: 14 },
  chartTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 3, minHeight: 3 },
  chartDay: { fontSize: 10, color: color.faint, marginTop: 2 },

  trail: { gap: space.md },
  trailRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  trailDot: { width: 10, height: 10, borderRadius: 5 },
});
