/**
 * Printable / shareable CHO sector performance report (A4 landscape PDF).
 * Android/iOS: rendered with expo-print and handed to the share sheet (save, WhatsApp, email).
 * Web: opens the browser print dialog ("Save as PDF").
 */
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export interface ReportRow {
  name: string;
  village: string;
  phone: string;
  families: number;
  visited30d: number;
  coverage: number;
  surveys30d: number;
  surveys7d: number;
  tasksDone: number;
  tasksOpen: number;
  tasksOverdue: number;
  pendingReferrals: number;
  pregnant: number;
  ncd: number;
  children: number;
  lastActive: string;
  inactive: boolean;
  score: number;
  grade: string;
}

export interface ReportMeta {
  lang: 'hi' | 'mr' | 'en';
  choName: string;
  block?: string;
  district?: string;
  generatedAt: Date;
  avgScore: number;
  avgGrade: string;
  active: string;
  coverage: string;
  surveys30d: number;
  pendingReferrals: number;
  overdue: number;
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const scoreColor = (s: number) => (s >= 75 ? '#059669' : s >= 50 ? '#047857' : s >= 30 ? '#D97706' : '#DC2626');
const scoreBg = (s: number) => (s >= 75 ? '#ECFDF5' : s >= 50 ? '#F0FDF4' : s >= 30 ? '#FFFBEB' : '#FEF2F2');

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDateTime = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function buildChoReportHtml(rows: ReportRow[], m: ReportMeta): string {
  const t = (hi: string, mr: string, en: string) => (m.lang === 'mr' ? mr : m.lang === 'en' ? en : hi);
  const sum = (f: (r: ReportRow) => number) => rows.reduce((s, r) => s + f(r), 0);

  const body = rows
    .map(
      (r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td><div class="nm">${esc(r.name)}</div><div class="sub">${esc(r.phone)}</div></td>
        <td>${esc(r.village || '—')}</td>
        <td class="n">${r.families}</td>
        <td class="n">${r.visited30d} <span class="sub">(${r.coverage}%)</span></td>
        <td class="n">${r.surveys30d} <span class="sub">/ ${r.surveys7d}</span></td>
        <td class="n">${r.tasksDone}</td>
        <td class="n">${r.tasksOpen}</td>
        <td class="n ${r.tasksOverdue > 0 ? 'bad' : ''}">${r.tasksOverdue}</td>
        <td class="n ${r.pendingReferrals > 0 ? 'warn' : ''}">${r.pendingReferrals}</td>
        <td class="n">${r.pregnant} / ${r.ncd} / ${r.children}</td>
        <td>${esc(r.lastActive)}${r.inactive ? ` <span class="tag">${t('निष्क्रिय', 'निष्क्रिय', 'Inactive')}</span>` : ''}</td>
        <td class="c"><span class="score" style="color:${scoreColor(r.score)};background:${scoreBg(r.score)}">${r.score}</span>
          <div class="sub">${esc(r.grade)}</div></td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${m.lang}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t('आशा प्रदर्शन रिपोर्ट', 'आशा कामगिरी अहवाल', 'ASHA Performance Report')}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  @media screen { body { padding: 16px; } }
  body { font-family: 'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', sans-serif; color: #0F172A; margin: 0; font-size: 11px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #047857; padding-bottom: 8px; }
  .brand { font-size: 11px; font-weight: 700; color: #047857; letter-spacing: .3px; }
  h1 { font-size: 20px; margin: 2px 0 0; }
  .meta { text-align: right; color: #475569; line-height: 1.5; }
  .meta b { color: #0F172A; }
  .kpis { display: flex; gap: 8px; margin: 12px 0; }
  .kpi { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px; }
  .kpi .v { font-size: 18px; font-weight: 800; color: #047857; }
  .kpi .l { color: #64748B; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #047857; color: #fff; font-weight: 700; font-size: 10px; padding: 7px 6px; text-align: left; }
  thead th.n, thead th.c { text-align: center; }
  tbody td { padding: 6px; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #F8FAFC; }
  tfoot td { padding: 7px 6px; font-weight: 800; background: #ECFDF5; border-top: 2px solid #047857; }
  td.n { text-align: center; }
  td.c { text-align: center; }
  .nm { font-weight: 700; }
  .sub { color: #64748B; font-size: 9px; font-weight: 500; }
  .bad { color: #DC2626; font-weight: 800; }
  .warn { color: #D97706; font-weight: 800; }
  .tag { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; border-radius: 10px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
  .score { display: inline-block; min-width: 34px; padding: 2px 6px; border-radius: 6px; font-weight: 800; font-size: 13px; }
  .notes { margin-top: 10px; color: #64748B; font-size: 9.5px; line-height: 1.5; }
  .sign { display: flex; justify-content: space-between; margin-top: 28px; }
  .sign div { width: 30%; border-top: 1px solid #94A3B8; padding-top: 4px; text-align: center; color: #475569; }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="brand">${t('राष्ट्रीय स्वास्थ्य मिशन · आरोग्यफ्लो', 'राष्ट्रीय आरोग्य अभियान · आरोग्यफ्लो', 'National Health Mission · AarogyaFlow')}</div>
      <h1>${t('आशा कार्यकर्ता प्रदर्शन रिपोर्ट', 'आशा कार्यकर्ती कामगिरी अहवाल', 'ASHA Worker Performance Report')}</h1>
    </div>
    <div class="meta">
      ${t('सीएचओ', 'सीएचओ', 'CHO')}: <b>${esc(m.choName)}</b><br/>
      ${[m.block, m.district].filter(Boolean).map(esc).join(', ') || ''}${m.block || m.district ? '<br/>' : ''}
      ${t('तैयार', 'तयार', 'Generated')}: <b>${fmtDateTime(m.generatedAt)}</b>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="v">${m.avgScore}/100</div><div class="l">${t('औसत स्कोर', 'सरासरी गुण', 'Average score')} · ${esc(m.avgGrade)}</div></div>
    <div class="kpi"><div class="v">${esc(m.active)}</div><div class="l">${t('सक्रिय आशा (7 दिन)', 'सक्रिय आशा (7 दिवस)', 'Active ASHAs (7 days)')}</div></div>
    <div class="kpi"><div class="v">${esc(m.coverage)}</div><div class="l">${t('घर कवरेज (30 दिन)', 'घर व्याप्ती (30 दिवस)', 'Home coverage (30 days)')}</div></div>
    <div class="kpi"><div class="v">${m.surveys30d}</div><div class="l">${t('सर्वे (30 दिन)', 'सर्वे (30 दिवस)', 'Surveys (30 days)')}</div></div>
    <div class="kpi"><div class="v" style="color:#D97706">${m.pendingReferrals}</div><div class="l">${t('लंबित रेफरल', 'प्रलंबित रेफरल', 'Pending referrals')}</div></div>
    <div class="kpi"><div class="v" style="color:#DC2626">${m.overdue}</div><div class="l">${t('अतिदेय कार्य', 'थकीत कामे', 'Overdue tasks')}</div></div>
  </div>

  <table>
    <thead><tr>
      <th class="c">#</th>
      <th>${t('आशा', 'आशा', 'ASHA')}</th>
      <th>${t('गाँव', 'गाव', 'Village')}</th>
      <th class="n">${t('परिवार', 'कुटुंबे', 'Families')}</th>
      <th class="n">${t('भ्रमण (30 दिन)', 'भेटी (30 दिवस)', 'Visits (30 days)')}</th>
      <th class="n">${t('सर्वे 30 / 7 दिन', 'सर्वे 30 / 7 दिवस', 'Surveys 30 / 7 days')}</th>
      <th class="n">${t('कार्य पूर्ण', 'काम पूर्ण', 'Tasks done')}</th>
      <th class="n">${t('खुले', 'खुले', 'Open')}</th>
      <th class="n">${t('अतिदेय', 'थकीत', 'Overdue')}</th>
      <th class="n">${t('लंबित रेफरल', 'प्रलंबित रेफरल', 'Pending referrals')}</th>
      <th class="n">${t('गर्भवती / एनसीडी / बच्चे', 'गर्भवती / एनसीडी / बालके', 'Pregnant / NCD / Children')}</th>
      <th>${t('अंतिम गतिविधि', 'शेवटची क्रिया', 'Last activity')}</th>
      <th class="c">${t('स्कोर', 'गुण', 'Score')}</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td></td>
      <td colspan="2">${t('कुल', 'एकूण', 'Total')} (${rows.length})</td>
      <td class="n">${sum((r) => r.families)}</td>
      <td class="n">${sum((r) => r.visited30d)}</td>
      <td class="n">${sum((r) => r.surveys30d)} / ${sum((r) => r.surveys7d)}</td>
      <td class="n">${sum((r) => r.tasksDone)}</td>
      <td class="n">${sum((r) => r.tasksOpen)}</td>
      <td class="n">${sum((r) => r.tasksOverdue)}</td>
      <td class="n">${sum((r) => r.pendingReferrals)}</td>
      <td class="n">${sum((r) => r.pregnant)} / ${sum((r) => r.ncd)} / ${sum((r) => r.children)}</td>
      <td></td>
      <td class="c">${m.avgScore}</td>
    </tr></tfoot>
  </table>

  <div class="notes">
    ${t(
      'स्कोर = 40% घर कवरेज (30 दिन) + 30% कार्य पूर्णता + 20% सर्वे गतिविधि (लक्ष्य 20/माह) + 10% समयपालन (अतिदेय कार्य पर कटौती)। 75+ उत्कृष्ट · 50–74 अच्छा · 30–49 सुधार चाहिए · 30 से कम कमज़ोर। 7 दिन से अधिक कोई गतिविधि न होने पर "निष्क्रिय"।',
      'गुण = 40% घर व्याप्ती (30 दिवस) + 30% काम पूर्णता + 20% सर्वे क्रिया (लक्ष्य 20/महिना) + 10% वेळपालन (थकीत कामांवर कपात). 75+ उत्कृष्ट · 50–74 चांगले · 30–49 सुधारणा हवी · 30 पेक्षा कमी कमकुवत. 7 दिवसांपेक्षा जास्त क्रिया नसल्यास "निष्क्रिय".',
      'Score = 40% home coverage (30 days) + 30% task completion + 20% survey activity (target 20/month) + 10% punctuality (deducted for overdue tasks). 75+ Excellent · 50–74 Good · 30–49 Needs improvement · below 30 Weak. "Inactive" when there is no activity for more than 7 days.',
    )}
  </div>

  <div class="sign">
    <div>${t('तैयारकर्ता (सीएचओ)', 'तयार करणारे (सीएचओ)', 'Prepared by (CHO)')}</div>
    <div>${t('एएनएम', 'एएनएम', 'ANM')}</div>
    <div>${t('चिकित्सा अधिकारी, पीएचसी', 'वैद्यकीय अधिकारी, पीएचसी', 'Medical Officer, PHC')}</div>
  </div>
</body></html>`;
}

/** Renders the report and opens the share / save sheet (or the print dialog on web). */
export async function downloadChoReport(rows: ReportRow[], meta: ReportMeta): Promise<void> {
  const html = buildChoReportHtml(rows, meta);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri: tmp } = await Print.printToFileAsync({ html, width: 842, height: 595 });
  const d = meta.generatedAt;
  const uri = `${FileSystem.cacheDirectory}ASHA_Performance_Report_${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}.pdf`;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    await FileSystem.moveAsync({ from: tmp, to: uri });
  } catch {
    // keep the generated name if the rename fails
  }
  const finalUri = (await FileSystem.getInfoAsync(uri)).exists ? uri : tmp;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: meta.lang === 'mr' ? 'आशा कामगिरी अहवाल' : meta.lang === 'en' ? 'ASHA Performance Report' : 'आशा प्रदर्शन रिपोर्ट',
    });
  } else {
    await Print.printAsync({ uri: finalUri });
  }
}
