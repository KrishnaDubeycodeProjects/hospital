import { FamilyMember, SurveyResponse } from '../types/storage';
import { LanguageCode } from '../context/LanguageContext';
import { TR_ENGLISH_DICT } from '../ui/trDictionary';
import {
  parseClinicalDate,
  formatClinicalDate,
  calculateEdd,
  gestationalWeeks,
  trimesterFromWeeks,
  classifyHb,
  HbGrade,
  parseNumber,
  parseBp,
  isHypertensive,
  parseAffirmative,
} from './maternalMath';

export interface SummaryHighlight {
  id: string;
  label: string;
  value: string;
  isAlert?: boolean;
  isNormal?: boolean;
  statusType: 'check' | 'alert' | 'info';
}

export interface DetailedFormEntry {
  questionNumber: number;
  questionText: string;
  answerText: string;
  isNormal: boolean;
  note?: string;
}

export interface MemberClinicalSummary {
  memberId: string;
  memberName: string;
  categoryTitle: string;
  surveyDate: string;
  highlights: SummaryHighlight[];
  spokenText: string;
  detailedEntries: DetailedFormEntry[];
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tri = true | false | null;

/** Interpret a recorded answer as yes / no / not recorded (shared with the sync payload builder). */
const triState = (value: unknown): Tri => parseAffirmative(value);

/** First non-empty value among the given answer keys. */
function pick(answers: Record<string, any>, keys: string[]): any {
  for (const k of keys) {
    const v = answers[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** Latest ANC-visit-scoped key first (anc4X … anc1X), then the plain keys. */
function ancKeys(suffix: string, plain: string[]): string[] {
  return [...plain, `anc4${suffix}`, `anc3${suffix}`, `anc2${suffix}`, `anc1${suffix}`];
}

const NCD_NAMES: Record<string, { hi: string; mr: string; en: string }> = {
  hypertension: { hi: 'उच्च रक्तचाप', mr: 'उच्च रक्तदाब', en: 'Hypertension' },
  diabetes: { hi: 'मधुमेह', mr: 'मधुमेह', en: 'Diabetes' },
  'oral cancer': { hi: 'मुख कैंसर', mr: 'तोंडाचा कर्करोग', en: 'Oral cancer' },
  'breast cancer': { hi: 'स्तन कैंसर', mr: 'स्तनाचा कर्करोग', en: 'Breast cancer' },
  'cervical cancer': { hi: 'गर्भाशय ग्रीवा कैंसर', mr: 'गर्भाशय मुख कर्करोग', en: 'Cervical cancer' },
  'other cancer': { hi: 'अन्य कैंसर', mr: 'इतर कर्करोग', en: 'Other cancer' },
  'other ncd': { hi: 'अन्य असंक्रामक रोग', mr: 'इतर असंसर्गजन्य आजार', en: 'Other NCD' },
};

export function generateClinicalSummary(
  member: FamilyMember,
  survey: SurveyResponse | undefined,
  lang: LanguageCode = 'hi'
): MemberClinicalSummary {
  // Hindi, Marathi, and English trilingual support
  const tr = (hi: string, mr: string, en?: string) => {
    if (lang === 'mr') return mr;
    if (lang === 'en') {
      if (en && en.trim().length > 0) return en;
      return TR_ENGLISH_DICT[hi] || TR_ENGLISH_DICT[mr] || hi;
    }
    return hi;
  };
  const NOT_RECORDED = tr('दर्ज नहीं', 'नोंद नाही', 'Not recorded');
  const yesNo = (v: Tri) => (v === null ? NOT_RECORDED : v ? tr('हाँ', 'होय', 'Yes') : tr('नहीं', 'नाही', 'No'));
  const sentenceEnd = tr('।', '.', '.');

  const localizeCondition = (raw: unknown): string => {
    if (raw == null || raw === '') return NOT_RECORDED;
    const s = String(raw);
    const key = s.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
    const hit = NCD_NAMES[key];
    return hit ? tr(hit.hi, hit.mr, hit.en) : s;
  };

  const hbLabel = (g: HbGrade) =>
    g === 'NORMAL'
      ? tr('सामान्य', 'सामान्य', 'Normal')
      : g === 'MILD'
      ? tr('हल्का एनीमिया', 'सौम्य रक्तक्षय', 'Mild anaemia')
      : g === 'MODERATE'
      ? tr('मध्यम एनीमिया', 'मध्यम रक्तक्षय', 'Moderate anaemia')
      : tr('गंभीर एनीमिया', 'तीव्र रक्तक्षय', 'Severe anaemia');

  const hbAdvice = (g: HbGrade) =>
    g === 'NORMAL'
      ? tr('IFA 180 गोलियाँ', 'IFA 180 गोळ्या', 'IFA 180 tablets')
      : g === 'MILD'
      ? tr('IFA 360 गोलियाँ', 'IFA 360 गोळ्या', 'IFA 360 tablets')
      : g === 'MODERATE'
      ? tr('निकट निगरानी, पोषण परामर्श', 'जवळून देखरेख, पोषण समुपदेशन', 'Close monitoring, nutrition counselling')
      : tr('तुरंत FRU रेफरल', 'तातडीने FRU संदर्भ', 'Immediate FRU referral');

  const surveyDateOf = (s: SurveyResponse) => {
    const d = new Date(s.createdAt);
    return isNaN(d.getTime()) ? NOT_RECORDED : formatClinicalDate(d);
  };

  const pendingSurveyLabel = member.lastSurveyDate || tr('सर्वे शेष', 'सर्वेक्षण बाकी', 'Survey pending');

  // =========================================================================
  // 1. No survey yet — summarise only what is actually on the member record
  // =========================================================================
  if (!survey) {
    const isFemalePregnant = member.gender === 'Female' && member.isPregnant && (!member.age || member.age >= 12);

    if (isFemalePregnant) {
      const eddDate = parseClinicalDate(member.expectedDeliveryDate);
      const eddText = eddDate ? formatClinicalDate(eddDate) : member.expectedDeliveryDate || NOT_RECORDED;
      const hrp = member.isHrp === true;

      const highlights: SummaryHighlight[] = [
        {
          id: 'preg',
          label: tr('गर्भावस्था स्थिति', 'गर्भधारणा स्थिती', 'Pregnancy status'),
          value: tr('गर्भवती ✓', 'गरोदर ✓', 'Pregnant ✓'),
          isNormal: true,
          statusType: 'check',
        },
        {
          id: 'edd',
          label: tr('संभावित प्रसव तिथि (EDD)', 'संभाव्य प्रसूती तारीख (EDD)', 'Expected delivery date (EDD)'),
          value: eddText,
          statusType: 'info',
        },
        {
          id: 'hrp',
          label: tr('उच्च जोखिम', 'उच्च जोखीम', 'High risk'),
          value: hrp ? `${tr('हाँ', 'होय', 'Yes')} ⚠️` : NOT_RECORDED,
          isAlert: hrp,
          statusType: hrp ? 'alert' : 'info',
        },
      ];

      const spokenText =
        `${member.name}${tr(' का संक्षेप: ', ' सारांश: ', '\'s summary: ')}` +
        `${tr('गर्भवती', 'गरोदर', 'Pregnant')}${sentenceEnd} ` +
        `${tr('संभावित प्रसव तिथि', 'संभाव्य प्रसूती तारीख', 'Expected delivery date')}: ${eddText}${sentenceEnd} ` +
        (hrp ? `${tr('उच्च जोखिम गर्भावस्था', 'उच्च जोखमीची गर्भधारणा', 'High-risk pregnancy')}${sentenceEnd} ` : '') +
        `${tr('प्रसव पूर्व जांच अभी दर्ज नहीं', 'प्रसूतीपूर्व तपासणी अद्याप नोंद नाही', 'Antenatal check-up not recorded yet')}${sentenceEnd}`;

      return {
        memberId: member.id,
        memberName: member.name,
        categoryTitle: tr('मातृ एवं शिशु स्वास्थ्य', 'मातृ व बाल आरोग्य', 'Maternal & child health'),
        surveyDate: pendingSurveyLabel,
        highlights,
        spokenText,
        detailedEntries: [],
        hasData: true,
      };
    }

    if (member.isChild || (member.age != null && member.age <= 5)) {
      const ageText =
        member.age == null
          ? NOT_RECORDED
          : member.age < 1
          ? tr('1 वर्ष से कम', '1 वर्षापेक्षा कमी', 'Under 1 year')
          : `${member.age} ${tr('वर्ष', 'वर्षे', 'yrs')}`;
      const highlights: SummaryHighlight[] = [
        {
          id: 'child_age',
          label: tr('उम्र', 'वय', 'Age'),
          value: ageText,
          statusType: 'info',
        },
        {
          id: 'child_vax',
          label: tr('टीकाकरण', 'लसीकरण', 'Immunisation'),
          value: tr('टीका कार्ड देखें', 'लस कार्ड पहा', 'View vaccine card'),
          statusType: 'info',
        },
      ];
      const spokenText =
        `${member.name}${tr(' का संक्षेप: ', ' सारांश: ', '\'s summary: ')}${tr('उम्र', 'वय', 'Age')} ${ageText}${sentenceEnd} ` +
        `${tr('बाल सर्वे अभी दर्ज नहीं', 'बाल सर्वेक्षण अद्याप नोंद नाही', 'Child survey not recorded yet')}${sentenceEnd}`;

      return {
        memberId: member.id,
        memberName: member.name,
        categoryTitle: tr('बाल स्वास्थ्य एवं टीकाकरण', 'बाल आरोग्य व लसीकरण', 'Child health & immunisation'),
        surveyDate: pendingSurveyLabel,
        highlights,
        spokenText,
        detailedEntries: [],
        hasData: true,
      };
    }

    if (member.hasChronicCondition || member.isNcdPatient) {
      const condition = localizeCondition(member.chronicConditionType || member.ncdDiagnosis);
      const highlights: SummaryHighlight[] = [
        {
          id: 'chronic',
          label: tr('पुरानी बीमारी', 'दीर्घकालीन आजार', 'Chronic disease'),
          value: `${condition} ⚠️`,
          isAlert: true,
          statusType: 'alert',
        },
        {
          id: 'bp',
          label: tr('रक्तचाप (बी.पी.)', 'रक्तदाब (बी.पी.)', 'Blood pressure (BP)'),
          value: NOT_RECORDED,
          statusType: 'info',
        },
      ];

      const spokenText =
        `${member.name}${tr(' का संक्षेप: ', ' सारांश: ', '\'s summary: ')}${tr('पुरानी बीमारी', 'जुनाट आजार', 'Chronic disease')}: ${condition}${sentenceEnd} ` +
        `${tr('रक्तचाप अभी दर्ज नहीं', 'रक्तदाब अद्याप नोंद नाही', 'Blood pressure not recorded yet')}${sentenceEnd}`;

      return {
        memberId: member.id,
        memberName: member.name,
        categoryTitle: tr('असंक्रामक रोग (NCD)', 'असंसर्गजन्य आजार (NCD)', 'Non-communicable disease (NCD)'),
        surveyDate: pendingSurveyLabel,
        highlights,
        spokenText,
        detailedEntries: [],
        hasData: true,
      };
    }

    return {
      memberId: member.id,
      memberName: member.name,
      categoryTitle: tr('सामान्य स्वास्थ्य', 'सामान्य आरोग्य', 'General health'),
      surveyDate: member.lastSurveyDate || tr('पंजीकृत', 'नोंदणीकृत', 'Registered'),
      highlights: [
        {
          id: 'gen',
          label: tr('स्वास्थ्य स्थिति', 'आरोग्य स्थिती', 'Health status'),
          value: tr('कोई जोखिम दर्ज नहीं', 'जोखीम नोंद नाही', 'No risk recorded'),
          statusType: 'info',
        },
      ],
      spokenText: `${member.name}${tr(' का संक्षेप: ', ' सारांश: ', '\'s summary: ')}${tr('कोई जोखिम दर्ज नहीं', 'कोणतीही जोखीम नोंद नाही', 'No risk recorded')}${sentenceEnd}`,
      detailedEntries: [],
      hasData: true,
    };
  }

  // =========================================================================
  // 2. Submitted survey — every value below comes from recorded answers only
  // =========================================================================
  const answers: Record<string, any> = survey.answers || {};
  const remarksText = survey.voiceNotes || answers.remarks || answers.clinicalNote || NOT_RECORDED;

  // ---------------------------- CHILD ----------------------------
  if (survey.categoryCode === 'CHILD') {
    const vaccineGiven = triState(answers.vaccineGiven);
    const weight = parseNumber(answers.childWeight);
    const condition: string | undefined = answers.childCondition;
    const isDanger = condition ? /गंभीर|रेफरल|severe|referral/i.test(condition) : false;
    const isSick = condition ? !/स्वस्थ|निरोगी|healthy/i.test(condition) : false;
    const sessionStatus: string | undefined = answers.childStatus;

    const highlights: SummaryHighlight[] = [
      {
        id: 'c_vax',
        label: tr('आज टीका', 'आज लस', 'Vaccine today'),
        value: vaccineGiven === null ? NOT_RECORDED : vaccineGiven ? `${tr('लगाया', 'दिली', 'Given')} ✓` : tr('नहीं लगाया', 'दिली नाही', 'Not given'),
        isNormal: vaccineGiven === true,
        statusType: vaccineGiven === null ? 'info' : 'check',
      },
      {
        id: 'c_wt',
        label: tr('वजन', 'वजन', 'Weight'),
        value: weight === null ? NOT_RECORDED : `${weight} kg`,
        statusType: 'info',
      },
      {
        id: 'c_cond',
        label: tr('खतरे के लक्षण', 'धोक्याची लक्षणे', 'Danger signs'),
        value: condition ? (isDanger ? `${condition} ⚠️` : condition) : NOT_RECORDED,
        isAlert: isDanger || isSick,
        isNormal: condition ? !isSick : undefined,
        statusType: !condition ? 'info' : isDanger || isSick ? 'alert' : 'check',
      },
    ];

    const spokenText =
      `${member.name}${tr(' का बाल संक्षेप: ', ' बाल सारांश: ', '\'s child summary: ')}` +
      `${tr('टीका', 'लस', 'Vaccine')}: ${yesNo(vaccineGiven)}${sentenceEnd} ` +
      `${tr('वजन', 'वजन', 'Weight')}: ${weight === null ? NOT_RECORDED : `${weight} ${tr('किलो', 'किलो', 'kg')}`}${sentenceEnd} ` +
      `${tr('लक्षण', 'लक्षणे', 'Symptoms')}: ${condition || NOT_RECORDED}${sentenceEnd}`;

    return {
      memberId: member.id,
      memberName: member.name,
      categoryTitle: tr('बाल स्वास्थ्य एवं टीकाकरण', 'बाल आरोग्य व लसीकरण', 'Child health & immunisation'),
      surveyDate: surveyDateOf(survey),
      highlights,
      spokenText,
      detailedEntries: [
        { questionNumber: 1, questionText: tr('आज टीका लगाया गया?', 'आज लस दिली का?', 'Vaccine given today?'), answerText: yesNo(vaccineGiven), isNormal: vaccineGiven !== false },
        { questionNumber: 2, questionText: tr('शिशु का वजन', 'बाळाचे वजन', 'Infant weight'), answerText: weight === null ? NOT_RECORDED : `${weight} kg`, isNormal: true },
        {
          questionNumber: 3,
          questionText: tr('बीमारी / खतरे के लक्षण', 'आजार / धोक्याची लक्षणे', 'Illness / danger signs'),
          answerText: condition || NOT_RECORDED,
          isNormal: !isSick,
          note: isDanger ? tr('तुरंत रेफरल', 'तातडीने संदर्भ', 'Immediate referral') : undefined,
        },
        { questionNumber: 4, questionText: tr('सत्र की स्थिति', 'सत्राची स्थिती', 'Session status'), answerText: sessionStatus || NOT_RECORDED, isNormal: true },
        { questionNumber: 5, questionText: tr('मौखिक नोट्स', 'तोंडी नोंदी', 'Voice notes'), answerText: remarksText, isNormal: true },
      ],
      hasData: true,
    };
  }

  // ---------------------------- GENERAL (Other services) ----------------------------
  if (survey.categoryCode === 'GENERAL' && !member.isPregnant) {
    const service: string | undefined = answers.otherCategory;
    const supplies: string | undefined = answers.suppliesGiven;
    const status: string | undefined = answers.otherStatus;
    const isReferral = status ? /रेफरल|संदर्भ|referral/i.test(status) : false;

    return {
      memberId: member.id,
      memberName: member.name,
      categoryTitle: tr('अन्य सेवाएँ', 'इतर सेवा', 'Other services'),
      surveyDate: surveyDateOf(survey),
      highlights: [
        { id: 'o_svc', label: tr('सेवा', 'सेवा', 'Service'), value: service || NOT_RECORDED, statusType: 'info' },
        { id: 'o_sup', label: tr('सामग्री वितरण', 'साहित्य वाटप', 'Supplies distributed'), value: supplies || NOT_RECORDED, statusType: 'info' },
        {
          id: 'o_status',
          label: tr('स्थिति', 'स्थिती', 'Status'),
          value: status || NOT_RECORDED,
          isAlert: isReferral,
          statusType: !status ? 'info' : isReferral ? 'alert' : 'check',
        },
      ],
      spokenText:
        `${member.name}${tr(' का संक्षेप: ', ' सारांश: ', '\'s summary: ')}` +
        `${tr('सेवा', 'सेवा', 'Service')}: ${service || NOT_RECORDED}${sentenceEnd} ` +
        `${tr('स्थिति', 'स्थिती', 'Status')}: ${status || NOT_RECORDED}${sentenceEnd}`,
      detailedEntries: [
        { questionNumber: 1, questionText: tr('सेवा का प्रकार', 'सेवेचा प्रकार', 'Service type'), answerText: service || NOT_RECORDED, isNormal: true },
        { questionNumber: 2, questionText: tr('सामग्री / दवा वितरण', 'साहित्य / औषध वाटप', 'Supplies / medicine distribution'), answerText: supplies || NOT_RECORDED, isNormal: true },
        { questionNumber: 3, questionText: tr('सत्यापन', 'पडताळणी', 'Verification'), answerText: status || NOT_RECORDED, isNormal: !isReferral },
        { questionNumber: 4, questionText: tr('मौखिक नोट्स', 'तोंडी नोंदी', 'Voice notes'), answerText: remarksText, isNormal: true },
      ],
      hasData: true,
    };
  }

  // ---------------------------- PREGNANCY / ANC ----------------------------
  const isPregnancySurvey =
    (survey.categoryCode === 'PREGNANCY' || member.isPregnant) &&
    survey.categoryCode !== 'DISEASE' &&
    member.gender === 'Female' &&
    (!member.age || member.age >= 12);

  if (isPregnancySurvey) {
    // LMP / EDD — EDD strictly derived via Naegele's rule when LMP is known
    const lmpDate = parseClinicalDate(pick(answers, ['lmpDate', 'lmp']));
    const recordedEdd = parseClinicalDate(pick(answers, ['eddDate', 'edd'])) || parseClinicalDate(member.expectedDeliveryDate);
    const eddDate = lmpDate ? calculateEdd(lmpDate) : recordedEdd;
    const weeks = lmpDate ? gestationalWeeks(lmpDate) : null;
    const trimester = weeks !== null ? trimesterFromWeeks(weeks) : null;
    const lmpText = lmpDate ? formatClinicalDate(lmpDate) : NOT_RECORDED;
    const eddText = eddDate ? formatClinicalDate(eddDate) : NOT_RECORDED;
    const gaText =
      weeks !== null
        ? `${weeks} ${tr('सप्ताह', 'आठवडे', 'weeks')} • ${tr('तिमाही', 'तिमाही', 'Trimester')} ${trimester}`
        : null;

    const firstPreg = triState(pick(answers, ['isFirstPregnancy', 'firstPregnancy']));

    // Danger signs / complications
    const compList: string[] | null = Array.isArray(answers.complicationsList)
      ? answers.complicationsList.filter((c: any) => c && c !== 'None')
      : null;
    const hrpFlag = triState(pick(answers, ['hasComplications', 'isHrp'])) === true || member.isHrp === true;
    const hasComplications = hrpFlag || (compList !== null && compList.length > 0);
    const compText =
      compList && compList.length > 0
        ? compList.join(', ')
        : answers.highRiskSymptoms || (hasComplications ? tr('हाँ', 'होय', 'Yes') : null);
    const compKnown = compList !== null || answers.highRiskSymptoms != null || pick(answers, ['hasComplications', 'isHrp']) != null || member.isHrp != null;

    // Blood pressure
    const sysNum = parseNumber(answers.bpSystolic);
    const diaNum = parseNumber(answers.bpDiastolic);
    const bp =
      sysNum !== null && diaNum !== null
        ? { sys: sysNum, dia: diaNum }
        : parseBp(pick(answers, ancKeys('Bp', ['bp'])));
    const bpHigh = bp ? isHypertensive(bp) : false;
    const bpText = bp ? `${bp.sys}/${bp.dia} mmHg` : NOT_RECORDED;

    // Hemoglobin
    const hb = parseNumber(pick(answers, ancKeys('Hb', ['hemoglobin', 'hb'])));
    const hbGrade = hb !== null ? classifyHb(hb) : null;
    const hbText = hb !== null && hbGrade ? `${hb} g/dL • ${hbLabel(hbGrade)}` : NOT_RECORDED;

    // Td / TT
    const td = triState(pick(answers, ancKeys('TtDose', ['ttGiven', 'ttVaccination', 'ttDone'])));

    // Institutional delivery plan
    const inst = triState(answers.institutionalDelivery);
    const instPlace: string | undefined = answers.deliveryPlace || answers.plannedDeliveryPlace;

    const anyAlert = hasComplications || bpHigh || hbGrade === 'SEVERE';

    const highlights: SummaryHighlight[] = [
      {
        id: 'p1',
        label: tr('पहली गर्भावस्था', 'पहिली गर्भधारणा', 'First pregnancy'),
        value: yesNo(firstPreg),
        statusType: 'info',
      },
      {
        id: 'edd',
        label: tr('संभावित प्रसव (EDD)', 'संभाव्य प्रसूती (EDD)', 'Expected delivery (EDD)'),
        value: gaText ? `${eddText} • ${gaText}` : eddText,
        statusType: 'info',
      },
      {
        id: 'comp',
        label: tr('जोखिम लक्षण', 'धोक्याची लक्षणे', 'Risk signs'),
        value: !compKnown ? NOT_RECORDED : hasComplications ? `${compText} ⚠️` : `${tr('कोई नहीं', 'काहीही नाही', 'None')} ✓`,
        isAlert: hasComplications,
        isNormal: compKnown && !hasComplications,
        statusType: !compKnown ? 'info' : hasComplications ? 'alert' : 'check',
      },
      {
        id: 'bp',
        label: tr('रक्तचाप (बी.पी.)', 'रक्तदाब (बी.पी.)', 'Blood pressure (BP)'),
        value: bp ? `${bpText} ${bpHigh ? '⚠️' : '✓'}` : NOT_RECORDED,
        isAlert: bpHigh,
        isNormal: bp ? !bpHigh : undefined,
        statusType: !bp ? 'info' : bpHigh ? 'alert' : 'check',
      },
      {
        id: 'hb',
        label: tr('हीमोग्लोबिन (Hb)', 'हिमोग्लोबिन (Hb)', 'Haemoglobin (Hb)'),
        value: hbGrade ? `${hbText} ${hbGrade === 'NORMAL' ? '✓' : '⚠️'}` : NOT_RECORDED,
        isAlert: hbGrade !== null && hbGrade !== 'NORMAL',
        isNormal: hbGrade === 'NORMAL' ? true : hbGrade ? false : undefined,
        statusType: !hbGrade ? 'info' : hbGrade === 'NORMAL' ? 'check' : 'alert',
      },
      {
        id: 'tt',
        label: tr('Td टीका', 'Td लस', 'Td vaccine'),
        value: td === null ? NOT_RECORDED : td ? `${tr('लगाया', 'दिली', 'Given')} ✓` : tr('लंबित', 'प्रलंबित', 'Pending'),
        isNormal: td === true,
        statusType: td === null ? 'info' : td ? 'check' : 'alert',
      },
      {
        id: 'del',
        label: tr('संस्थागत प्रसव', 'संस्थात्मक प्रसूती', 'Institutional delivery'),
        value: inst === null ? NOT_RECORDED : inst ? `${instPlace || tr('योजना तय', 'नियोजन निश्चित', 'Plan fixed')} ✓` : tr('तय नहीं', 'निश्चित नाही', 'Not fixed'),
        isNormal: inst === true,
        statusType: inst === null ? 'info' : inst ? 'check' : 'alert',
      },
    ];

    if (hbGrade === 'SEVERE' || bpHigh) {
      highlights.unshift({
        id: 'urgent',
        label: tr('उच्च जोखिम', 'उच्च जोखीम', 'High risk'),
        value: `${tr('तुरंत रेफरल', 'तातडीने संदर्भ', 'Immediate referral')} ⚠️`,
        isAlert: true,
        statusType: 'alert',
      });
    }

    const spokenParts = [
      `${member.name}${tr(' का नैदानिक संक्षेप', ' चा वैद्यकीय सारांश', '\'s clinical summary')}`,
      `${tr('पहली गर्भावस्था', 'पहिली गर्भधारणा', 'First pregnancy')}: ${yesNo(firstPreg)}`,
      `${tr('अंतिम माहवारी', 'शेवटची मासिक पाळी', 'Last menstrual period')}: ${lmpText}`,
      `${tr('संभावित प्रसव तिथि', 'संभाव्य प्रसूती तारीख', 'Expected delivery date')}: ${eddText}`,
      ...(weeks !== null ? [`${tr('गर्भ अवधि', 'गर्भ कालावधी', 'Gestation')}: ${weeks} ${tr('सप्ताह', 'आठवडे', 'weeks')}`] : []),
      `${tr('जोखिम लक्षण', 'धोक्याची लक्षणे', 'Risk signs')}: ${!compKnown ? NOT_RECORDED : hasComplications ? compText : tr('कोई नहीं', 'काहीही नाही', 'None')}`,
      `${tr('रक्तचाप', 'रक्तदाब', 'Blood pressure')}: ${bp ? `${bp.sys} ${tr('बटा', 'बाय', 'over')} ${bp.dia}${bpHigh ? `, ${tr('अधिक', 'जास्त', 'High')}` : ''}` : NOT_RECORDED}`,
      `${tr('हीमोग्लोबिन', 'हिमोग्लोबिन', 'Haemoglobin')}: ${hb !== null && hbGrade ? `${hb}, ${hbLabel(hbGrade)}` : NOT_RECORDED}`,
      `${tr('टीडी टीका', 'टीडी लस', 'Td vaccine')}: ${yesNo(td)}`,
      ...(anyAlert ? [tr('रेफरल की सलाह', 'संदर्भाचा सल्ला', 'Referral advised')] : []),
    ];
    const spokenText = spokenParts.join(`${sentenceEnd} `) + sentenceEnd;

    const ancVisit: string | undefined = answers.ancVisit;
    const urine: string | undefined = pick(answers, ancKeys('UrineTest', ['urine']));

    const detailedEntries: DetailedFormEntry[] = [
      { questionNumber: 1, questionText: tr('पहली गर्भावस्था?', 'पहिली गर्भधारणा?', 'First pregnancy?'), answerText: yesNo(firstPreg), isNormal: true },
      { questionNumber: 2, questionText: tr('अंतिम मासिक धर्म तिथि (LMP)', 'शेवटची मासिक पाळीची तारीख (LMP)', 'Last menstrual period date (LMP)'), answerText: lmpText, isNormal: true },
      {
        questionNumber: 3,
        questionText: tr('संभावित प्रसव तिथि (EDD)', 'संभाव्य प्रसूतीची तारीख (EDD)', 'Expected delivery date (EDD)'),
        answerText: eddText,
        isNormal: true,
        note: lmpDate ? tr('LMP + 9 माह + 7 दिन', 'LMP + 9 महिने + 7 दिवस', 'LMP + 9 months + 7 days') : undefined,
      },
      { questionNumber: 4, questionText: tr('ANC विजिट', 'ANC भेट', 'ANC visit'), answerText: ancVisit || NOT_RECORDED, isNormal: true },
      {
        questionNumber: 5,
        questionText: tr('जोखिम लक्षण', 'धोक्याची लक्षणे', 'Risk signs'),
        answerText: !compKnown ? NOT_RECORDED : hasComplications ? String(compText) : tr('कोई नहीं', 'काहीही नाही', 'None'),
        isNormal: !hasComplications,
        note: hasComplications ? tr('PHC रेफरल सलाह', 'PHC संदर्भ सल्ला', 'PHC referral advice') : undefined,
      },
      {
        questionNumber: 6,
        questionText: tr('रक्तचाप (बी.पी.)', 'रक्तदाब (बी.पी.)', 'Blood pressure (BP)'),
        answerText: bpText,
        isNormal: !bpHigh,
        note: bpHigh ? tr('≥140/90 — रेफरल', '≥140/90 — संदर्भ', '≥140/90 — referral') : undefined,
      },
      {
        questionNumber: 7,
        questionText: tr('हीमोग्लोबिन स्तर', 'हिमोग्लोबिन पातळी', 'Haemoglobin level'),
        answerText: hbText,
        isNormal: hbGrade === null || hbGrade === 'NORMAL',
        note: hbGrade ? hbAdvice(hbGrade) : undefined,
      },
      { questionNumber: 8, questionText: tr('मूत्र जाँच', 'लघवी तपासणी', 'Urine test'), answerText: urine || NOT_RECORDED, isNormal: urine ? !/असामान्य|प्रोटीन|प्रथिने|protein|albumin|sugar/i.test(urine) : true },
      { questionNumber: 9, questionText: tr('Td टीका लगाया गया?', 'Td लस दिली का?', 'Td vaccine given?'), answerText: yesNo(td), isNormal: td !== false },
      { questionNumber: 10, questionText: tr('संस्थागत प्रसव योजना', 'संस्थात्मक प्रसूती नियोजन', 'Institutional delivery plan'), answerText: inst === null ? NOT_RECORDED : instPlace || yesNo(inst), isNormal: inst !== false },
      { questionNumber: 11, questionText: tr('मौखिक नोट्स', 'तोंडी नोंदी', 'Voice notes'), answerText: remarksText, isNormal: true },
    ];

    return {
      memberId: member.id,
      memberName: member.name,
      categoryTitle: tr('प्रसव पूर्व जांच (ANC)', 'प्रसूतीपूर्व तपासणी (ANC)', 'Antenatal check-up (ANC)'),
      surveyDate: surveyDateOf(survey),
      highlights,
      spokenText,
      detailedEntries,
      hasData: true,
    };
  }

  // ---------------------------- NCD / DISEASE ----------------------------
  const condition = localizeCondition(
    pick(answers, ['chronicCondition', 'diagnosis']) || member.ncdDiagnosis || member.chronicConditionType
  );
  const sysN = parseNumber(answers.bpSystolic);
  const diaN = parseNumber(answers.bpDiastolic);
  const ncdBp = sysN !== null && diaN !== null ? { sys: sysN, dia: diaN } : parseBp(answers.bp);
  const ncdBpHigh = ncdBp ? isHypertensive(ncdBp) : false;
  const meds = triState(pick(answers, ['onRegularMedication', 'medication', 'treatmentStarted']));
  const saltDiet = triState(answers.dietSaltReduced);
  const dizziness = triState(answers.chestPainOrDizziness);

  const highlights: SummaryHighlight[] = [
    {
      id: 'ncd_cond',
      label: tr('पुरानी बीमारी', 'दीर्घकालीन आजार', 'Chronic disease'),
      value: condition === NOT_RECORDED ? condition : `${condition} ⚠️`,
      isAlert: condition !== NOT_RECORDED,
      statusType: condition === NOT_RECORDED ? 'info' : 'alert',
    },
    {
      id: 'ncd_bp',
      label: tr('रक्तचाप (बी.पी.)', 'रक्तदाब (बी.पी.)', 'Blood pressure (BP)'),
      value: ncdBp ? `${ncdBp.sys}/${ncdBp.dia} mmHg ${ncdBpHigh ? '⚠️' : '✓'}` : NOT_RECORDED,
      isAlert: ncdBpHigh,
      isNormal: ncdBp ? !ncdBpHigh : undefined,
      statusType: !ncdBp ? 'info' : ncdBpHigh ? 'alert' : 'check',
    },
    {
      id: 'ncd_med',
      label: tr('नियमित दवा', 'नियमित औषध', 'Regular medicine'),
      value: meds === null ? NOT_RECORDED : meds ? `${tr('हाँ', 'होय', 'Yes')} ✓` : `${tr('नहीं', 'नाही', 'No')} ⚠️`,
      isNormal: meds === true,
      isAlert: meds === false,
      statusType: meds === null ? 'info' : meds ? 'check' : 'alert',
    },
    {
      id: 'ncd_salt',
      label: tr('नमक नियंत्रण', 'मीठ नियंत्रण', 'Salt control'),
      value: yesNo(saltDiet),
      isNormal: saltDiet === true,
      statusType: saltDiet === null ? 'info' : 'check',
    },
    {
      id: 'ncd_dizz',
      label: tr('सीने में दर्द / चक्कर', 'छातीत दुखणे / चक्कर', 'Chest pain / dizziness'),
      value: dizziness === null ? NOT_RECORDED : dizziness ? `${tr('हाँ', 'होय', 'Yes')} ⚠️` : `${tr('नहीं', 'नाही', 'No')} ✓`,
      isAlert: dizziness === true,
      isNormal: dizziness === false,
      statusType: dizziness === null ? 'info' : dizziness ? 'alert' : 'check',
    },
  ];

  const ncdSpoken = [
    `${member.name}${tr(' का नैदानिक संक्षेप', ' चा वैद्यकीय सारांश', '\'s clinical summary')}`,
    `${tr('पुरानी बीमारी', 'जुनाट आजार', 'Chronic disease')}: ${condition}`,
    `${tr('रक्तचाप', 'रक्तदाब', 'Blood pressure')}: ${ncdBp ? `${ncdBp.sys} ${tr('बटा', 'बाय', 'over')} ${ncdBp.dia}${ncdBpHigh ? `, ${tr('अधिक', 'जास्त', 'High')}` : ''}` : NOT_RECORDED}`,
    `${tr('नियमित दवा', 'नियमित औषध', 'Regular medicine')}: ${yesNo(meds)}`,
    `${tr('नमक नियंत्रण', 'मीठ नियंत्रण', 'Salt control')}: ${yesNo(saltDiet)}`,
    `${tr('सीने में दर्द', 'छातीत दुखणे', 'Chest pain')}: ${yesNo(dizziness)}`,
    ...(member.followUpDueDate ? [`${tr('अगला फॉलो-अप', 'पुढील पाठपुरावा', 'Next follow-up')}: ${member.followUpDueDate}`] : []),
  ];

  const detailedEntries: DetailedFormEntry[] = [
    { questionNumber: 1, questionText: tr('पहचानी गई बीमारी', 'ओळखलेला आजार', 'Identified disease'), answerText: condition, isNormal: condition === NOT_RECORDED },
    {
      questionNumber: 2,
      questionText: tr('रक्तचाप (बी.पी.)', 'रक्तदाब (बी.पी.)', 'Blood pressure (BP)'),
      answerText: ncdBp ? `${ncdBp.sys}/${ncdBp.dia} mmHg` : NOT_RECORDED,
      isNormal: !ncdBpHigh,
      note: ncdBpHigh ? tr('≥140/90 — अधिक', '≥140/90 — जास्त', '≥140/90 — high') : undefined,
    },
    { questionNumber: 3, questionText: tr('नियमित दवा ले रहे हैं?', 'नियमित औषध घेतात का?', 'Taking regular medicine?'), answerText: yesNo(meds), isNormal: meds !== false },
    { questionNumber: 4, questionText: tr('नमक कम किया?', 'मीठ कमी केले?', 'Reduced salt?'), answerText: yesNo(saltDiet), isNormal: saltDiet !== false },
    { questionNumber: 5, questionText: tr('सीने में दर्द या चक्कर?', 'छातीत दुखणे किंवा चक्कर?', 'Chest pain or dizziness?'), answerText: yesNo(dizziness), isNormal: dizziness !== true },
    { questionNumber: 6, questionText: tr('मौखिक परामर्श नोट्स', 'तोंडी समुपदेशन नोंदी', 'Voice counselling notes'), answerText: remarksText, isNormal: true },
  ];

  return {
    memberId: member.id,
    memberName: member.name,
    categoryTitle: tr('असंक्रामक रोग (NCD)', 'असंसर्गजन्य आजार (NCD)', 'Non-communicable disease (NCD)'),
    surveyDate: surveyDateOf(survey),
    highlights,
    spokenText: ncdSpoken.join(`${sentenceEnd} `) + sentenceEnd,
    detailedEntries,
    hasData: true,
  };
}
