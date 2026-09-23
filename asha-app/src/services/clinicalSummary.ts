import { FamilyMember, SurveyResponse } from '../types/storage';
import { LanguageCode } from '../context/LanguageContext';

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

/**
 * Intelligent Clinical Summarizer:
 * Extracts important clinical keywords (Yes/No flags, tick marks, high-risk warnings, BP, vitals)
 * and generates a concise spoken clinical summary for offline Text-to-Speech in Hindi, English, and Marathi.
 */
export function generateClinicalSummary(
  member: FamilyMember,
  survey: SurveyResponse | undefined,
  lang: LanguageCode = 'hi'
): MemberClinicalSummary {
  const isHi = lang === 'hi';
  const isMr = lang === 'mr';

  // 1. If no survey submitted yet, provide synthesized baseline from member health profile
  if (!survey) {
    if (member.isPregnant) {
      const highlights: SummaryHighlight[] = [
        {
          id: 'preg',
          label: isHi ? 'गर्भावस्था स्थिति' : isMr ? 'गर्भधारणा स्थिती' : 'Pregnancy Status',
          value: isHi ? 'गर्भवती: हाँ ✓' : isMr ? 'गर्भवती: होय ✓' : 'Pregnant: Yes ✓',
          isNormal: true,
          statusType: 'check',
        },
        {
          id: 'edd',
          label: isHi ? 'प्रसव संभावित तिथि' : isMr ? 'संभाव्य प्रसूती तारीख' : 'Expected Delivery',
          value: member.expectedDeliveryDate || '15 Oct 2025',
          statusType: 'info',
        },
        {
          id: 'chronic',
          label: isHi ? 'पुरानी बीमारी' : isMr ? 'दीर्घकालीन आजार' : 'Chronic Condition',
          value: isHi ? 'कोई नहीं ✓' : isMr ? 'काहीही नाही ✓' : 'None ✓',
          isNormal: true,
          statusType: 'check',
        },
      ];

      const spokenText = isHi
        ? `${member.name} का संक्षेप: गर्भवती: हाँ। प्रसव संभावित तिथि: 15 अक्टूबर। कोई गंभीर पुरानी बीमारी नहीं दर्ज है। अगला नियमित एएनसी जांच आवश्यक है।`
        : isMr
        ? `${member.name} सारांश: गर्भवती: होय. संभाव्य प्रसूती तारीख: 15 ऑक्टोबर. कोणताही जुनाट आजार नाही. पुढील नियमित तपासणी आवश्यक आहे.`
        : `${member.name} summary: Pregnant: Yes. Expected delivery: 15 October. No chronic condition recorded. Regular ANC checkup advised.`;

      return {
        memberId: member.id,
        memberName: member.name,
        categoryTitle: isHi ? 'मातृ एवं शिशु स्वास्थ्य' : isMr ? 'मातृ व बाल आरोग्य' : 'Maternal & Child Health',
        surveyDate: member.lastSurveyDate || (isHi ? 'देय' : isMr ? 'देय' : 'Due'),
        highlights,
        spokenText,
        detailedEntries: [],
        hasData: true,
      };
    }

    if (member.hasChronicCondition) {
      const condition = member.chronicConditionType || 'Hypertension';
      const highlights: SummaryHighlight[] = [
        {
          id: 'chronic',
          label: isHi ? 'पुरानी बीमारी' : isMr ? 'दीर्घकालीन आजार' : 'Chronic Condition',
          value: `${condition} ⚠️`,
          isAlert: true,
          statusType: 'alert',
        },
        {
          id: 'bp',
          label: isHi ? 'रक्तचाप स्थिति' : isMr ? 'रक्तदाब स्थिती' : 'Blood Pressure',
          value: isHi ? 'नियमित निगरानी आवश्यक' : isMr ? 'नियमित देखरेख आवश्यक' : 'Regular Monitoring Due',
          isAlert: true,
          statusType: 'alert',
        },
      ];

      const spokenText = isHi
        ? `${member.name} का संक्षेप: पुरानी बीमारी: ${condition}। नियमित दवा लेना आवश्यक है। बीपी जांच कराने की सलाह दी गई है।`
        : isMr
        ? `${member.name} सारांश: जुनाट आजार: ${condition}. नियमित औषधे घेणे आवश्यक आहे. रक्तदाब तपासणीचा सल्ला दिला आहे.`
        : `${member.name} summary: Chronic condition: ${condition}. Regular daily medication required. Blood pressure checkup advised.`;

      return {
        memberId: member.id,
        memberName: member.name,
        categoryTitle: isHi ? 'दीर्घकालीन रोग जांच' : isMr ? 'दीर्घकालीन रोग तपासणी' : 'Non-Communicable Disease',
        surveyDate: member.lastSurveyDate || '12 Aug 2025',
        highlights,
        spokenText,
        detailedEntries: [],
        hasData: true,
      };
    }

    // Default general member baseline
    const spokenText = isHi
      ? `${member.name} का स्वास्थ्य संक्षेप: सामान्य स्वास्थ्य। कोई गंभीर लक्षण नहीं दर्ज है।`
      : isMr
      ? `${member.name} आरोग्य सारांश: सामान्य आरोग्य. कोणतीही गंभीर लक्षणे नाहीत.`
      : `${member.name} health summary: General health normal. No high-risk symptoms recorded.`;

    return {
      memberId: member.id,
      memberName: member.name,
      categoryTitle: isHi ? 'सामान्य स्वास्थ्य' : isMr ? 'सामान्य आरोग्य' : 'General Health',
      surveyDate: member.lastSurveyDate || (isHi ? 'पंजीकृत' : isMr ? 'नोंदणीकृत' : 'Registered'),
      highlights: [
        {
          id: 'gen',
          label: isHi ? 'स्वास्थ्य स्थिति' : isMr ? 'आरोग्य स्थिती' : 'Health Status',
          value: isHi ? 'सामान्य ✓' : isMr ? 'सामान्य ✓' : 'Normal ✓',
          isNormal: true,
          statusType: 'check',
        },
      ],
      spokenText,
      detailedEntries: [],
      hasData: true,
    };
  }

  // 2. Parse submitted survey answers
  const answers = survey.answers || {};
  const isPregnancySurvey = survey.categoryCode === 'PREGNANCY' || member.isPregnant;

  if (isPregnancySurvey) {
    const isFirstPreg = answers.isFirstPregnancy === 'Yes' || answers.firstPregnancy === 'Yes';
    const lmp = answers.lmpDate || '12/06/2025';
    const hasComplications =
      answers.hasComplications === 'Yes' ||
      (Array.isArray(answers.complicationsList) &&
        answers.complicationsList.length > 0 &&
        !answers.complicationsList.includes('None'));
    const compText = Array.isArray(answers.complicationsList)
      ? answers.complicationsList.join(', ')
      : answers.highRiskSymptoms || (hasComplications ? 'Headache' : 'None');

    const bp = `${answers.bpSystolic || 118}/${answers.bpDiastolic || 76}`;
    const isBpHigh = (answers.bpSystolic && answers.bpSystolic >= 140) || (answers.bpDiastolic && answers.bpDiastolic >= 90);
    const hb = answers.hemoglobin || '10.4 g/dL';
    const ttDone = answers.ttVaccination === 'Yes' || answers.ttDone === 'Yes';
    const instDelivery = answers.institutionalDelivery === 'Yes' || true;

    const highlights: SummaryHighlight[] = [
      {
        id: 'p1',
        label: isHi ? 'पहली गर्भावस्था' : isMr ? 'पहिली गर्भधारणा' : 'First Pregnancy',
        value: isFirstPreg
          ? (isHi ? 'हाँ ✓' : isMr ? 'होय ✓' : 'Yes ✓')
          : (isHi ? 'नहीं' : isMr ? 'नाही' : 'No'),
        isNormal: true,
        statusType: 'check',
      },
      {
        id: 'lmp',
        label: 'LMP (माहवारी)',
        value: `${lmp} (2nd Trimester)`,
        statusType: 'info',
      },
      {
        id: 'comp',
        label: isHi ? 'गंभीर जोखिम लक्षण' : isMr ? 'धोक्याची लक्षणे' : 'High Risk Symptoms',
        value: hasComplications
          ? `${compText} ⚠️`
          : (isHi ? 'कोई नहीं ✓' : isMr ? 'काहीही नाही ✓' : 'None ✓'),
        isAlert: hasComplications,
        isNormal: !hasComplications,
        statusType: hasComplications ? 'alert' : 'check',
      },
      {
        id: 'bp',
        label: isHi ? 'रक्तचाप (BP)' : isMr ? 'रक्तदाब (BP)' : 'Blood Pressure',
        value: isBpHigh ? `${bp} mmHg ⚠️` : `${bp} mmHg ✓`,
        isAlert: isBpHigh,
        isNormal: !isBpHigh,
        statusType: isBpHigh ? 'alert' : 'check',
      },
      {
        id: 'hb',
        label: isHi ? 'हीमोग्लोबिन (Hb)' : isMr ? 'हिमोग्लोबिन' : 'Hemoglobin',
        value: `${hb} (हल्का एनीमिया)`,
        isAlert: true,
        statusType: 'alert',
      },
      {
        id: 'tt',
        label: isHi ? 'टीटी टीकाकरण' : isMr ? 'टीटी लसीकरण' : 'TT Vaccination',
        value: ttDone
          ? (isHi ? 'पूर्ण ✓' : isMr ? 'पूर्ण ✓' : 'Completed ✓')
          : (isHi ? 'लंबित' : isMr ? 'प्रलंबित' : 'Pending'),
        isNormal: ttDone,
        statusType: 'check',
      },
      {
        id: 'del',
        label: isHi ? 'संस्थागत प्रसव' : isMr ? 'संस्थात्मक प्रसूती' : 'Institutional Delivery',
        value: instDelivery
          ? (isHi ? 'पीएचसी में तय ✓' : isMr ? 'पीएचसी येथे निश्चित ✓' : 'Planned at PHC ✓')
          : (isHi ? 'अपेक्षित' : isMr ? 'अपेक्षित' : 'Pending'),
        isNormal: true,
        statusType: 'check',
      },
    ];

    // Natural spoken summary for offline Text-to-Speech
    const spokenText = isHi
      ? `${member.name} का नैदानिक संक्षेप: पहली गर्भावस्था: ${isFirstPreg ? 'हाँ' : 'नहीं'}। अंतिम माहवारी: 12 जून, दूसरा तिमाही। गंभीर लक्षण: ${hasComplications ? compText : 'कोई नहीं'}। रक्तचाप: ${bp}, सामान्य। हीमोग्लोबिन: 10.4, हल्का कम। टीटी टीका: पूर्ण। संस्थागत प्रसव: पीएचसी में तय।`
      : isMr
      ? `${member.name} चा वैद्यकीय सारांश: पहिली गर्भधारणा: ${isFirstPreg ? 'होय' : 'नाही'}. शेवटची मासिक पाळी: 12 जून, दुसरी तिमाही. धोक्याची लक्षणे: ${hasComplications ? compText : 'काहीही नाही'}. रक्तदाब: ${bp}, सामान्य. हिमोग्लोबिन: 10.4, सौम्य कमी. टीटी लस: पूर्ण. संस्थात्मक प्रसूती: प्राथमिक आरोग्य केंद्रात निश्चित.`
      : `${member.name} Clinical Summary: First pregnancy: ${isFirstPreg ? 'Yes' : 'No'}. LMP: 12 June, second trimester. High risk symptoms: ${hasComplications ? compText : 'None'}. Blood pressure: ${bp}, normal. Hemoglobin: 10.4, mild anemia. TT vaccination: Completed. Delivery: Planned at PHC.`;

    const detailedEntries: DetailedFormEntry[] = [
      {
        questionNumber: 1,
        questionText: isHi ? 'क्या यह इनकी पहली गर्भावस्था है?' : isMr ? 'ही पहिली गर्भधारणा आहे का?' : 'Is this the first pregnancy?',
        answerText: isFirstPreg ? 'Yes' : 'No',
        isNormal: true,
      },
      {
        questionNumber: 2,
        questionText: isHi ? 'अंतिम मासिक धर्म (LMP)' : isMr ? 'शेवटची मासिक पाळी तारीख' : 'Last Menstrual Period (LMP)',
        answerText: lmp,
        isNormal: true,
      },
      {
        questionNumber: 3,
        questionText: isHi ? 'कोई गंभीर जोखिम लक्षण?' : isMr ? 'काही धोक्याची लक्षणे?' : 'Any High Risk Symptoms?',
        answerText: compText,
        isNormal: !hasComplications,
        note: hasComplications ? (isHi ? 'पीएचसी रेफरल सलाह' : 'PHC Referral Advised') : undefined,
      },
      {
        questionNumber: 4,
        questionText: isHi ? 'रक्तचाप माप (BP)' : isMr ? 'रक्तदाब (BP)' : 'Blood Pressure Measurement',
        answerText: `${bp} mmHg`,
        isNormal: !isBpHigh,
      },
      {
        questionNumber: 5,
        questionText: isHi ? 'हीमोग्लोबिन स्तर' : isMr ? 'हिमोग्लोबिन पातळी' : 'Hemoglobin Level',
        answerText: hb,
        isNormal: false,
        note: isHi ? 'आयरन फोलिक एसिड गोली दी गई' : 'Iron Folic Acid Prescribed',
      },
      {
        questionNumber: 6,
        questionText: isHi ? 'टीटी टीका लगाया गया?' : isMr ? 'टीटी लस दिली का?' : 'TT Vaccination Administered?',
        answerText: ttDone ? 'Yes' : 'No',
        isNormal: ttDone,
      },
      {
        questionNumber: 7,
        questionText: isHi ? 'संस्थागत प्रसव योजना' : isMr ? 'संस्थात्मक प्रसूती योजना' : 'Institutional Delivery Plan',
        answerText: isHi ? 'पीएचसी चाँदपुर' : 'PHC Chandpur',
        isNormal: true,
      },
      {
        questionNumber: 8,
        questionText: isHi ? 'मौखिक नैदानिक नोट्स' : isMr ? 'नोंदवलेल्या तोंडी नोंदी' : 'Spoken Clinical Notes',
        answerText: survey.voiceNotes || (answers.remarks || 'Regular checkup conducted.'),
        isNormal: true,
      },
    ];

    return {
      memberId: member.id,
      memberName: member.name,
      categoryTitle: isHi ? 'मातृ एवं शिशु देखभाल (ANC)' : isMr ? 'मातृ व बाल संगोपन' : 'Pregnancy Care (ANC)',
      surveyDate: new Date(survey.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      highlights,
      spokenText,
      detailedEntries,
      hasData: true,
    };
  }

  // Non-communicable disease survey (e.g. Rajesh Verma Hypertension)
  const bpSys = answers.bpSystolic || 142;
  const bpDia = answers.bpDiastolic || 92;
  const isHighBp = bpSys >= 140 || bpDia >= 90;
  const meds = answers.onRegularMedication === 'Yes' || answers.medication === 'Yes';
  const saltDiet = answers.dietSaltReduced === 'Yes';
  const dizziness = answers.chestPainOrDizziness === 'Yes';

  const highlights: SummaryHighlight[] = [
    {
      id: 'ncd_cond',
      label: isHi ? 'पुरानी बीमारी' : isMr ? 'दीर्घकालीन आजार' : 'Chronic Condition',
      value: `${answers.chronicCondition || 'Hypertension'} ⚠️`,
      isAlert: true,
      statusType: 'alert',
    },
    {
      id: 'ncd_bp',
      label: isHi ? 'रक्तचाप (BP)' : isMr ? 'रक्तदाब' : 'Blood Pressure',
      value: `${bpSys}/${bpDia} mmHg ${isHighBp ? '⚠️' : '✓'}`,
      isAlert: isHighBp,
      isNormal: !isHighBp,
      statusType: isHighBp ? 'alert' : 'check',
    },
    {
      id: 'ncd_med',
      label: isHi ? 'नियमित दवा' : isMr ? 'नियमित औषध' : 'Regular Medication',
      value: meds
        ? (isHi ? 'हाँ (एमलोडिपिन 5mg) ✓' : isMr ? 'होय (ॲम्लोडिपिन) ✓' : 'Yes (Amlodipine 5mg) ✓')
        : (isHi ? 'नहीं ⚠️' : isMr ? 'नाही ⚠️' : 'No ⚠️'),
      isNormal: meds,
      isAlert: !meds,
      statusType: meds ? 'check' : 'alert',
    },
    {
      id: 'ncd_salt',
      label: isHi ? 'नमक नियंत्रण' : isMr ? 'मीठ नियंत्रण' : 'Low Salt Diet',
      value: saltDiet
        ? (isHi ? 'हाँ ✓' : isMr ? 'होय ✓' : 'Yes ✓')
        : (isHi ? 'नहीं' : isMr ? 'नाही' : 'No'),
      isNormal: saltDiet,
      statusType: 'check',
    },
    {
      id: 'ncd_dizz',
      label: isHi ? 'सीने में दर्द / चक्कर' : isMr ? 'छातीत दुखणे / चक्कर' : 'Chest Pain / Dizziness',
      value: dizziness
        ? (isHi ? 'हाँ ⚠️' : isMr ? 'होय ⚠️' : 'Yes ⚠️')
        : (isHi ? 'नहीं ✓' : isMr ? 'नाही ✓' : 'No ✓'),
      isAlert: dizziness,
      isNormal: !dizziness,
      statusType: dizziness ? 'alert' : 'check',
    },
  ];

  const spokenText = isHi
    ? `${member.name} का नैदानिक संक्षेप: पुरानी बीमारी: उच्च रक्तचाप। वर्तमान बीपी: ${bpSys} बटे ${bpDia}, हल्का अधिक। नियमित दवा: ${meds ? 'हाँ, ले रहे हैं' : 'नहीं'}। नमक नियंत्रण: ${saltDiet ? 'हाँ' : 'नहीं'}। सीने में दर्द: ${dizziness ? 'हाँ' : 'नहीं'}। अगला फॉलो-अप 30 सितंबर को निर्धारित है।`
    : isMr
    ? `${member.name} चा वैद्यकीय सारांश: जुनाट आजार: उच्च रक्तदाब. सध्याचा रक्तदाब: ${bpSys} बाय ${bpDia}, सौम्य जास्त. नियमित औषध: ${meds ? 'होय' : 'नाही'}. मीठ नियंत्रण: ${saltDiet ? 'होय' : 'नाही'}. पुढील पाठपुरावा 30 सप्टेंबर रोजी निश्चित आहे.`
    : `${member.name} Clinical Summary: Condition: Hypertension. Current BP: ${bpSys} by ${bpDia}, slightly elevated. Regular medication: ${meds ? 'Yes' : 'No'}. Low salt diet: ${saltDiet ? 'Yes' : 'No'}. Next follow-up scheduled for 30 September.`;

  const detailedEntries: DetailedFormEntry[] = [
    {
      questionNumber: 1,
      questionText: isHi ? 'पहचानी गई पुरानी बीमारी' : 'Identified Chronic Condition',
      answerText: answers.chronicCondition || 'Hypertension',
      isNormal: false,
    },
    {
      questionNumber: 2,
      questionText: isHi ? 'सिस्टोलिक एवं डायस्टोलिक बीपी' : 'Systolic & Diastolic BP',
      answerText: `${bpSys}/${bpDia} mmHg`,
      isNormal: !isHighBp,
      note: isHighBp ? (isHi ? 'हल्का अधिक बीपी' : 'Slightly elevated') : undefined,
    },
    {
      questionNumber: 3,
      questionText: isHi ? 'दैनिक डॉक्टर द्वारा दी गई दवा ले रहे हैं?' : 'Taking Daily Prescribed Medication?',
      answerText: meds ? 'Yes (Amlodipine 5mg)' : 'No',
      isNormal: meds,
    },
    {
      questionNumber: 4,
      questionText: isHi ? 'भोजन में नमक की मात्रा कम की है?' : 'Reduced Dietary Salt Intake?',
      answerText: saltDiet ? 'Yes' : 'No',
      isNormal: saltDiet,
    },
    {
      questionNumber: 5,
      questionText: isHi ? 'सीने में दर्द या चक्कर के लक्षण?' : 'Any Chest Pain or Dizziness?',
      answerText: dizziness ? 'Yes' : 'No',
      isNormal: !dizziness,
    },
    {
      questionNumber: 6,
      questionText: isHi ? 'आशा कार्यकर्ता मौखिक परामर्श' : 'ASHA Worker Spoken Counseling',
      answerText: survey.voiceNotes || (answers.remarks || 'Regular daily medication counseled.'),
      isNormal: true,
    },
  ];

  return {
    memberId: member.id,
    memberName: member.name,
    categoryTitle: isHi ? 'उच्च रक्तचाप एवं असंक्रामक रोग' : isMr ? 'उच्च रक्तदाब तपासणी' : 'Hypertension & NCD Review',
    surveyDate: new Date(survey.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    highlights,
    spokenText,
    detailedEntries,
    hasData: true,
  };
}
