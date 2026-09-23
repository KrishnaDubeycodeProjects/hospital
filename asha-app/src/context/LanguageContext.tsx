import React, { createContext, useContext, useState, ReactNode } from 'react';

export type LanguageCode = 'hi' | 'en' | 'mr';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  localeCode: string;
  t: (key: string) => string;
}

const translations: Record<LanguageCode, Record<string, string>> = {
  hi: {
    // Branding & Navigation
    appTitle: 'आरोग्य फ्लो',
    appSubtitle: 'घर के करीब देखभाल, स्वस्थ कल।',
    grid: 'ग्रिड',
    families: 'परिवार',
    followups: 'फॉलो-अप',
    meetings: 'बैठक',
    profile: 'प्रोफ़ाइल',
    more: 'प्रोफ़ाइल',

    // Common Buttons
    saveLocally: 'स्थानीय रूप से सहेजें',
    saveMemberLocally: 'सदस्य को सहेजें',
    saveProfileChanges: 'प्रोफ़ाइल सहेजें',
    back: 'पीछे',
    next: 'आगे बढ़ें',
    saveAndComplete: 'सहेजें और पूरा करें',
    saving: 'सहेजा जा रहा है...',
    close: 'बंद करें',
    edit: 'संपादित करें',
    add: 'जोड़ें',
    send: 'भेजें',
    yes: 'हाँ',
    no: 'नहीं',

    // Grid Screen
    all: 'सभी',
    pregnancy: 'गर्भावस्था',
    disease: 'रोग जांच',
    child: 'बाल स्वास्थ्य',
    selectFilter: 'अनुभाग फ़िल्टर चुनें',
    sendDataToAnm: 'एएनएम को डेटा भेजें',
    sevenDays: '7 दिन (अति आवश्यक)',
    fifteenDays: '15 दिन (शीघ्र देय)',
    thirtyDays: '30 दिन (नियमित)',
    visited: 'भेंट हो गई',
    noData: 'कोई डेटा नहीं / लागू नहीं',
    viewMembers: 'सदस्य देखें',
    lastVisited: 'अंतिम भेंट',
    nextVisit: 'अगली भेंट',

    // Families Screen
    searchPlaceholder: 'नाम या मकान संख्या से खोजें',
    searchListening: 'सुन रहे हैं... बोलिए',
    allFilter: 'सभी',
    dueFilter: 'देय',
    visitedFilter: 'भेंट हो गई',
    notVisitedFilter: 'अपरिक्षित',
    addHousehold: 'परिवार जोड़ें',
    addHouseholdTitle: 'नया परिवार पंजीकृत करें',
    familyNameLabel: 'परिवार / मुखिया का नाम',
    houseNumberLabel: 'मकान संख्या',
    phoneLabel: 'प्राथमिक फ़ोन नंबर',
    dobLabel: 'मुखिया की जन्मतिथि (DD/MM/YYYY)',
    villageLabel: 'गाँव का नाम',
    membersCount: 'सदस्य',

    // Family Details
    familyFolder: 'पारिवारिक फ़ोल्डर',
    familyMembers: 'परिवार के सदस्य',
    addMemberBtn: '+ सदस्य जोड़ें',
    addMemberTitle: 'नया सदस्य जोड़ें',
    fullNameLabel: 'पूरा नाम',
    ageLabel: 'आयु',
    relationshipLabel: 'संबंध',
    genderLabel: 'लिंग',
    female: 'महिला',
    male: 'पुरुष',
    other: 'अन्य',
    pregnant: 'गर्भवती',
    chronicIssue: 'पुरानी बीमारी',
    lastSurvey: 'पिछला सर्वेक्षण',

    // Survey
    pregnancyCare: 'मातृ एवं शिशु देखभाल',
    speak: 'बोलें',
    tapToSpeakObservation: 'मौखिक अवलोकन बोलने के लिए टैप करें',
    listening: 'सुन रहे हैं...',
    spokenNotesLabel: 'दर्ज किए गए मौखिक नोट्स:',
    firstPregnancyQuestion: 'क्या यह इनकी पहली गर्भावस्था है? (उत्तर दें: हाँ या नहीं)',
    lmpLabel: 'अंतिम मासिक धर्म की तारीख (LMP)',
    highRiskSymptomsLabel: 'कोई गंभीर जोखिम लक्षण?',

    pending: 'लंबित',
    completed: 'पूर्ण',
    noPendingTasks: 'कोई लंबित फॉलो-अप नहीं है! सब काम पूरा।',
    noCompletedTasks: 'अभी तक कोई पूर्ण कार्य दर्ज नहीं है।',
    missedReferrals: 'अस्पताल रेफरल आगमन',
    urgentReferralAlert: '⚠️ अस्पताल रेफरल छूटा हुआ: 7 दिनों के भीतर तत्काल गृह भेंट आवश्यक है!',
    referral15Alert: '⚠️ अस्पताल रेफरल 15 दिन पुराना: शीघ्र अनुवर्ती भेंट करें।',
    memberHealthProfile: 'सदस्य स्वास्थ्य प्रोफाइल',
    clinicalSummary: 'स्मार्ट नैदानिक संक्षेप',
    tapToListenSummary: 'सुनने के लिए टैप करें (ऑफलाइन आवाज़)',
    speakingSummary: 'संक्षेप बोला जा रहा है...',
    stopSpeaking: 'आवाज़ रोकें',
    viewDetailedResponses: 'विस्तृत प्रश्नावली देखें',
    hideDetailedResponses: 'विवरण छिपाएं',
    startNewSurvey: '+ नया सर्वेक्षण दर्ज करें',
    keyFindings: 'प्रमुख निष्कर्ष (महत्वपूर्ण बिंदु)',

    // Send Data & Sync
    sendDataTitle: 'एएनएम को डेटा भेजें',
    selectCareSection: 'भेजने के लिए अनुभाग चुनें:',
    localDataReady: 'स्थानीय डेटा भेजने के लिए तैयार है',
    scanAnmQr: 'एएनएम क्यूआर कोड स्कैन करें',
    scanQrSubtitle: 'एएनएम के फ़ोन पर खुले फॉर्म के क्यूआर कोड पर कैमरा रखें',
    privacyNote: 'केवल चयनित अनुभाग का डेटा ही स्थानांतरित किया जाएगा।',
    enterCodeManually: 'एएनएम का नाम / कोड दर्ज करें',
    hideManualInput: 'मैन्युअल इनपुट छिपाएं',
    autoSyncServer: 'क्लाउड / सर्वर से स्वतः सिंक करें',
    connecting: 'कनेक्ट हो रहा है...',
    dataSentSuccess: 'डेटा सफलतापूर्वक भेजा गया!',
    dataSentSubtitle: 'आपके भरे हुए फॉर्म एएनएम के साथ सिंक्रनाइज़ हो गए हैं।',
    sendAnotherForm: 'अन्य फॉर्म भेजें',
    backToHome: 'होम स्क्रीन पर वापस जाएं',

    // Profile Screen
    profileTitle: 'आशा कार्यकर्ता प्रोफ़ाइल',
    workerDetails: 'कार्यकर्ता विवरण',
    workerName: 'कार्यकर्ता का नाम',
    roleLabel: 'पद / भूमिका',
    villageSubCenter: 'गाँव / उप-केंद्र',
    workerPhone: 'फ़ोन नंबर',
    ashaId: 'आशा पंजीकरण संख्या (ID)',
    assignedAnm: 'संबंधित एएनएम का नाम / फ़ोन',
    appLanguage: 'एप्लिकेशन भाषा (App Language)',
    profileSaved: 'प्रोफ़ाइल विवरण सफलतापूर्वक सहेजे गए!',
  },
  en: {
    // Branding & Navigation
    appTitle: 'Aarogya Flow',
    appSubtitle: 'Care Closer. Healthier Tomorrow.',
    grid: 'Grid',
    families: 'Families',
    followups: 'Follow-ups',
    meetings: 'Meetings',
    profile: 'Profile',
    more: 'Profile',

    // Common Buttons
    saveLocally: 'Save Locally',
    saveMemberLocally: 'Save Member Locally',
    saveProfileChanges: 'Save Profile Changes',
    back: 'Back',
    next: 'Next',
    saveAndComplete: 'Save & Complete',
    saving: 'Saving...',
    close: 'Close',
    edit: 'Edit',
    add: 'Add',
    send: 'Send',
    yes: 'Yes',
    no: 'No',

    // Grid Screen
    all: 'All',
    pregnancy: 'Pregnancy',
    disease: 'Disease',
    child: 'Child',
    selectFilter: 'Select Section Filter',
    sendDataToAnm: 'Send Data to ANM',
    sevenDays: '7 days (Urgent)',
    fifteenDays: '15 days (Due Soon)',
    thirtyDays: '30 days (Routine)',
    visited: 'Visited',
    noData: 'No data / NA',
    viewMembers: 'View Members',
    lastVisited: 'Last Visited',
    nextVisit: 'Next Visit',

    // Families Screen
    searchPlaceholder: 'Search by name or house no.',
    searchListening: 'Listening... please speak',
    allFilter: 'All',
    dueFilter: 'Due',
    visitedFilter: 'Visited',
    notVisitedFilter: 'Not Visited',
    addHousehold: 'Add Household',
    addHouseholdTitle: 'Add New Household',
    familyNameLabel: 'Family / Head Name',
    houseNumberLabel: 'House Number',
    phoneLabel: 'Primary Contact Phone',
    dobLabel: 'Head Date of Birth (DD/MM/YYYY)',
    villageLabel: 'Village Name',
    membersCount: 'Members',

    // Family Details
    familyFolder: 'Family Folder',
    familyMembers: 'Family Members',
    addMemberBtn: '+ Add Member',
    addMemberTitle: 'Add Family Member',
    fullNameLabel: 'Full Name',
    ageLabel: 'Age',
    relationshipLabel: 'Relationship',
    genderLabel: 'Gender',
    female: 'Female',
    male: 'Male',
    other: 'Other',
    pregnant: 'Pregnant',
    chronicIssue: 'Chronic Issue',
    lastSurvey: 'Last Survey',

    // Survey
    pregnancyCare: 'Pregnancy Care',
    speak: 'Speak',
    tapToSpeakObservation: 'Tap to speak observation',
    listening: 'Listening...',
    spokenNotesLabel: 'Spoken Clinical Notes:',
    firstPregnancyQuestion: "Is this the beneficiary's first pregnancy? (Answer: Yes or No)",
    lmpLabel: 'Last Menstrual Period (LMP)',
    highRiskSymptomsLabel: 'Any Identified High-Risk Symptoms?',

    pending: 'Pending',
    completed: 'Completed',
    noPendingTasks: 'No pending follow-ups! All clear.',
    noCompletedTasks: 'No completed tasks recorded yet.',
    missedReferrals: 'Missed Hospital Referrals',
    urgentReferralAlert: '⚠️ Hospital Referral Missed: Urgent home visit required within 7 days!',
    referral15Alert: '⚠️ Hospital Referral 15 Days Overdue: Follow-up visit due soon.',
    memberHealthProfile: 'Member Health Profile',
    clinicalSummary: 'Smart Clinical Summary',
    tapToListenSummary: 'Tap to Listen (Offline Voice)',
    speakingSummary: 'Speaking Summary...',
    stopSpeaking: 'Stop Audio',
    viewDetailedResponses: 'View Detailed Questionnaire',
    hideDetailedResponses: 'Hide Details',
    startNewSurvey: '+ Record New Survey',
    keyFindings: 'Key Findings & Important Indicators',

    // Send Data & Sync
    sendDataTitle: 'Send Data to ANM',
    selectCareSection: 'Select Care Section to Send:',
    localDataReady: 'Local Data Ready for Sync',
    scanAnmQr: 'Scan ANM QR Code',
    scanQrSubtitle: 'Point camera at the open form QR code on ANM phone',
    privacyNote: 'Only data for the selected section will be transferred.',
    enterCodeManually: 'Enter ANM Name / Code Manually',
    hideManualInput: 'Hide Manual Input',
    autoSyncServer: 'Auto-Sync to Cloud / Server',
    connecting: 'Connecting...',
    dataSentSuccess: 'Data Sent Successfully!',
    dataSentSubtitle: 'Your filled forms have been synchronized with ANM.',
    sendAnotherForm: 'Send Another Form',
    backToHome: 'Back to Home',

    // Profile Screen
    profileTitle: 'ASHA Worker Profile',
    workerDetails: 'Worker Details',
    workerName: 'Worker Name',
    roleLabel: 'Role / Designation',
    villageSubCenter: 'Village / Sub-Center',
    workerPhone: 'Phone Number',
    ashaId: 'ASHA Registration ID',
    assignedAnm: 'Assigned ANM Name / Phone',
    appLanguage: 'Application Language',
    profileSaved: 'Profile details saved successfully!',
  },
  mr: {
    // Branding & Navigation
    appTitle: 'आरोग्य फ्लो',
    appSubtitle: 'घराजवळ काळजी, निरोगी उद्या.',
    grid: 'ग्रिड',
    families: 'कुटुंबे',
    followups: 'पाठपुरावा',
    meetings: 'बैठका',
    profile: 'प्रोफाइल',
    more: 'प्रोफाइल',

    // Common Buttons
    saveLocally: 'स्थानिकरित्या जतन करा',
    saveMemberLocally: 'सदस्य जतन करा',
    saveProfileChanges: 'प्रोफाइल जतन करा',
    back: 'मागे',
    next: 'पुढे',
    saveAndComplete: 'जतन करा आणि पूर्ण करा',
    saving: 'जतन करत आहे...',
    close: 'बंद करा',
    edit: 'संपादित करा',
    add: 'जोडा',
    send: 'पाठवा',
    yes: 'होय',
    no: 'नाही',

    // Grid Screen
    all: 'सर्व',
    pregnancy: 'गरोदरपण',
    disease: 'आजारी तपासणी',
    child: 'बाल आरोग्य',
    selectFilter: 'विभाग फिल्टर निवडा',
    sendDataToAnm: 'एएनएमला डेटा पाठवा',
    sevenDays: '7 दिवस (तातडीचे)',
    fifteenDays: '15 दिवस (लवकरच देय)',
    thirtyDays: '30 दिवस (नियमित)',
    visited: 'भेट दिली',
    noData: 'डेटा नाही / लागू नाही',
    viewMembers: 'सदस्य पहा',
    lastVisited: 'शेवटची भेट',
    nextVisit: 'पुढील भेट',

    // Families Screen
    searchPlaceholder: 'नाव किंवा घर क्रमांकाने शोधा',
    searchListening: 'ऐकत आहे... बोला',
    allFilter: 'सर्व',
    dueFilter: 'देय',
    visitedFilter: 'भेट दिली',
    notVisitedFilter: 'अपरिक्षित',
    addHousehold: 'कुटुंब जोडा',
    addHouseholdTitle: 'नवीन कुटुंब नोंदणी करा',
    familyNameLabel: 'कुटुंब / प्रमुखाचे नाव',
    houseNumberLabel: 'घर क्रमांक',
    phoneLabel: 'प्राथमिक संपर्क फोन',
    dobLabel: 'प्रमुखाची जन्मतारीख (DD/MM/YYYY)',
    villageLabel: 'गावाचे नाव',
    membersCount: 'सदस्य',

    // Family Details
    familyFolder: 'कौटुंबिक फोल्डर',
    familyMembers: 'कुटुंबातील सदस्य',
    addMemberBtn: '+ सदस्य जोडा',
    addMemberTitle: 'नवीन सदस्य जोडा',
    fullNameLabel: 'पूर्ण नाव',
    ageLabel: 'वय',
    relationshipLabel: 'नाते',
    genderLabel: 'लिंग',
    female: 'महिला',
    male: 'पुरुष',
    other: 'इतर',
    pregnant: 'गरोदर',
    chronicIssue: 'दीर्घ आजार',
    lastSurvey: 'शेवटचे सर्वेक्षण',

    // Survey
    pregnancyCare: 'मातृ व बाल संगोपन',
    speak: 'बोला',
    tapToSpeakObservation: 'तोंडी निरीक्षण बोलण्यासाठी टॅप करा',
    listening: 'ऐकत आहे...',
    spokenNotesLabel: 'नोंदवलेल्या तोंडी नोंदी:',
    firstPregnancyQuestion: 'ही लाभार्थींची पहिली गर्भधारणा आहे का? (उत्तर: होय किंवा नाही)',
    lmpLabel: 'शेवटच्या मासिक पाळीची तारीख (LMP)',
    highRiskSymptomsLabel: 'काही गंभीर धोक्याची लक्षणे आढळली का?',

    pending: 'प्रलंबित',
    completed: 'पूर्ण',
    noPendingTasks: 'कोणतेही प्रलंबित काम नाही! सर्व काम पूर्ण.',
    noCompletedTasks: 'अद्याप कोणतेही पूर्ण काम नोंदवलेले नाही.',
    missedReferrals: 'रुग्णालय संदर्भ आगमन',
    urgentReferralAlert: '⚠️ रुग्णालय संदर्भ चुकला: 7 दिवसांच्या आत तातडीने गृह भेट आवश्यक आहे!',
    referral15Alert: '⚠️ रुग्णालय संदर्भ 15 दिवस थकीत: लवकरच पाठपुरावा भेट द्या.',
    memberHealthProfile: 'सदस्य आरोग्य प्रोफाइल',
    clinicalSummary: 'स्मार्ट वैद्यकीय सारांश',
    tapToListenSummary: 'ऐकण्यासाठी टॅप करा (ऑफलाइन आवाज)',
    speakingSummary: 'सारांश बोलत आहे...',
    stopSpeaking: 'आवाज थांबवा',
    viewDetailedResponses: 'तपशीलवार प्रश्नावली पहा',
    hideDetailedResponses: 'तपशील लपवा',
    startNewSurvey: '+ नवीन सर्वेक्षण नोंदवा',
    keyFindings: 'महत्त्वाचे निष्कर्ष (मुख्य मुद्दे)',

    // Send Data & Sync
    sendDataTitle: 'एएनएमला डेटा पाठवा',
    selectCareSection: 'पाठवण्यासाठी विभाग निवडा:',
    localDataReady: 'स्थानिक डेटा पाठवण्यासाठी तयार आहे',
    scanAnmQr: 'एएनएम क्यूआर कोड स्कॅन करा',
    scanQrSubtitle: 'एएनएमच्या फोनवरील उघड्या फॉर्मच्या क्यूआर कोडवर कॅमेरा धरा',
    privacyNote: 'फक्त निवडलेल्या विभागाचा डेटा पाठवला जाईल.',
    enterCodeManually: 'एएनएम नाव / कोड प्रविष्ट करा',
    hideManualInput: 'मॅन्युअल इनपुट लपवा',
    autoSyncServer: 'क्लाउड / सर्व्हरशी स्वयंचलित सिंक करा',
    connecting: 'कनेक्ट करत आहे...',
    dataSentSuccess: 'डेटा यशस्वीरित्या पाठवला!',
    dataSentSubtitle: 'तुमचे भरलेले फॉर्म एएनएमशी समक्रमित झाले आहेत.',
    sendAnotherForm: 'दुसरा फॉर्म पाठवा',
    backToHome: 'मुख्य पृष्ठावर परत जा',

    // Profile Screen
    profileTitle: 'आशा कार्यकर्ती प्रोफाइल',
    workerDetails: 'कार्यकर्ती तपशील',
    workerName: 'कार्यकर्तीचे नाव',
    roleLabel: 'भूमिका / पद',
    villageSubCenter: 'गाव / उप-केंद्र',
    workerPhone: 'फोन नंबर',
    ashaId: 'आशा नोंदणी आयडी',
    assignedAnm: 'संबंधित एएनएम नाव / फोन',
    appLanguage: 'अ‍ॅप भाषा (App Language)',
    profileSaved: 'प्रोफाइल तपशील यशस्वीरित्या जतन केले!',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'hi',
  setLanguage: () => {},
  ttsEnabled: true,
  setTtsEnabled: () => {},
  localeCode: 'hi-IN',
  t: (key: string) => key,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<LanguageCode>('hi');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);

  const localeMap: Record<LanguageCode, string> = {
    hi: 'hi-IN',
    en: 'en-IN',
    mr: 'mr-IN',
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        ttsEnabled,
        setTtsEnabled,
        localeCode: localeMap[language],
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
