package com.qdischarge.clinicqueue.bot;

import com.qdischarge.clinicqueue.catalog.MedicalCategory;
import com.qdischarge.clinicqueue.dto.WaButton;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Every string the WhatsApp bot sends, in English, Hindi, and Marathi. Kept
 * as one lookup table (rather than a properties/i18n bundle) so the whole
 * conversation -- greeting, language picker, menu, registration, token
 * dashboard, status, cancel -- is easy to audit language-by-language in one
 * file.
 */
@Component
public class BotMessages {

    // -------------------------------------------------------------
    // Greeting + language picker (shown before any language is chosen,
    // so always trilingual)
    // -------------------------------------------------------------

    public String greetingAndLanguagePrompt(String clinicName) {
        return """
                🙏 Welcome to %1$s / %1$s में आपका स्वागत है / %1$s मध्ये आपले स्वागत आहे!

                Please choose your language / कृपया अपनी भाषा चुनें / कृपया तुमची भाषा निवडा:

                1️⃣ Type *English* for English
                2️⃣ Type *Hindi* for हिंदी
                3️⃣ Type *Marathi* for मराठी"""
                .formatted(clinicName);
    }

    public String languageNotUnderstood() {
        return """
                ❗ Sorry, I didn't understand that. / क्षमा करें, मुझे समझ नहीं आया। / माफ करा, मला समजले नाही.

                Please type *English*, *Hindi*, or *Marathi* to continue. / कृपया आगे बढ़ने के लिए *English*, *Hindi* या *Marathi* टाइप करें। / पुढे जाण्यासाठी कृपया *English*, *Hindi* किंवा *Marathi* टाइप करा.""";
    }

    public String languageSwitched(Lang lang) {
        return switch (lang) {
            case EN -> "✅ Language set to English.";
            case HI -> "✅ भाषा हिंदी में सेट कर दी गई है।";
            case MR -> "✅ भाषा मराठी मध्ये सेट केली आहे.";
        };
    }

    // -------------------------------------------------------------
    // Treatment-timing "go now" trigger (see
    // service.QueueManagerService#runTreatmentTimingTick): sent -- together
    // with the Twilio voice call, see service.TwilioStudioCallService --
    // the moment a patient's real routing ETA is no longer comfortably
    // shorter than the queue's remaining treatment time.
    // -------------------------------------------------------------

    public String headingToHospitalNotification(Lang lang, String patientName, String tokenCode, double travelMinutes, String departmentName, String hospitalName) {
        return switch (lang) {
            case EN -> "🚗 *TIME TO HEAD TO HOSPITAL!*\n\n"
                    + "Hello %s, your turn for *%s* at *%s* is approaching.\n\n"
                    + "🎟️ Token Code: #%s\n\n"
                    + "👉 *Please head to the hospital now!* On arrival, check in at reception with your QR code to receive top priority service."
                    .formatted(patientName, departmentName, hospitalName, tokenCode);
            case HI -> "🚗 *अस्पताल के लिए निकलने का समय!*\n\n"
                    + "नमस्ते %s, *%s* में *%s* विभाग के लिए आपकी बारी पास आ रही है।\n\n"
                    + "🎟️ टोकन कोड: #%s\n\n"
                    + "👉 *कृपया अभी अस्पताल के लिए निकलें!* पहुंचने पर प्राथमिकता सेवा के लिए अपने क्यूआर कोड से रिसेप्शन पर चेक-इन करें।"
                    .formatted(patientName, hospitalName, departmentName, tokenCode);
            case MR -> "🚗 *रुग्णालयासाठी निघण्याची वेळ!*\n\n"
                    + "नमस्कार %s, *%s* येथे *%s* विभागासाठी आपली पाळी जवळ येत आहे.\n\n"
                    + "🎟️ टोकन कोड: #%s\n\n"
                    + "👉 *कृपया आता रुग्णालयासाठी निघा!* पोहोचल्यावर प्राधान्य सेवेसाठी आपल्या क्यूआर कोडने रिसेप्शनवर चेक-इन करा."
                    .formatted(patientName, hospitalName, departmentName, tokenCode);
        };
    }

    public String headingToHospitalNotification(Lang lang, String patientName, int tokenNumber, String departmentName, String hospitalName) {
        return headingToHospitalNotification(lang, patientName, "AF-" + String.format("%02d", tokenNumber), 5.0, departmentName, hospitalName);
    }

    // -------------------------------------------------------------
    // Welcome menu (STEP: no active token)
    // -------------------------------------------------------------

    public String welcomeTitle(Lang lang, String clinicName) {
        return switch (lang) {
            case EN -> "🏥 WELCOME TO " + clinicName.toUpperCase();
            case HI -> "🏥 " + clinicName + " में आपका स्वागत है";
            case MR -> "🏥 " + clinicName + " मध्ये आपले स्वागत आहे";
        };
    }

    public String welcomeDescription(Lang lang) {
        return switch (lang) {
            case EN -> "Welcome to our Smart Queue Management System.\n\nTap an option below, or type it:\n1️⃣ Generate Token\n2️⃣ Check Status";
            case HI -> "हमारे स्मार्ट कतार प्रबंधन सिस्टम में आपका स्वागत है।\n\nनीचे कोई विकल्प चुनें या टाइप करें:\n1️⃣ टोकन बनाएं\n2️⃣ स्थिति देखें";
            case MR -> "आमच्या स्मार्ट रांग व्यवस्थापन प्रणालीमध्ये आपले स्वागत आहे.\n\nखालील पर्याय निवडा किंवा टाइप करा:\n1️⃣ टोकन तयार करा\n2️⃣ स्थिती तपासा";
        };
    }

    public List<WaButton> welcomeButtons(Lang lang) {
        return switch (lang) {
            case EN -> List.of(
                    new WaButton("btn_generate_token", "🎫 Book Token"),
                    new WaButton("btn_check_status", "📊 Check Status"),
                    new WaButton("btn_services", "📋 Services"));
            case HI -> List.of(
                    new WaButton("btn_generate_token", "🎫 टोकन बनाएं"),
                    new WaButton("btn_check_status", "📊 स्थिति देखें"),
                    new WaButton("btn_services", "📋 अन्य सेवाएं"));
            case MR -> List.of(
                    new WaButton("btn_generate_token", "🎫 टोकन तयार करा"),
                    new WaButton("btn_check_status", "📊 स्थिती तपासा"),
                    new WaButton("btn_services", "📋 इतर सेवा"));
        };
    }

    public String servicesMenuTitle(Lang lang) {
        return switch (lang) {
            case EN -> "📋 PATIENT HEALTH SERVICES";
            case HI -> "📋 मरीज़ स्वास्थ्य सेवाएं";
            case MR -> "📋 रुग्ण आरोग्य सेवा";
        };
    }

    public String servicesMenuDescription(Lang lang) {
        return switch (lang) {
            case EN -> "Access your referrals, medical documents, and family members below:";
            case HI -> "अपने रेफरल, मेडिकल दस्तावेज़ और परिवार के सदस्यों को नीचे देखें:";
            case MR -> "आपले रेफरल, वैद्यकीय कागदपत्रे आणि कुटुंबातील सदस्य खाली पहा:";
        };
    }

    public List<WaButton> servicesButtons(Lang lang) {
        return switch (lang) {
            case EN -> List.of(
                    new WaButton("srv_book", "🎫 Book Token"),
                    new WaButton("srv_track", "📊 Track Token"),
                    new WaButton("btn_services", "📋 All Services"));
            case HI -> List.of(
                    new WaButton("srv_book", "🎫 टोकन बनाएं"),
                    new WaButton("srv_track", "📊 ट्रैक करें"),
                    new WaButton("btn_services", "📋 सेवाएं"));
            case MR -> List.of(
                    new WaButton("srv_book", "🎫 टोकन काढा"),
                    new WaButton("srv_track", "📊 तपासा"),
                    new WaButton("btn_services", "📋 सेवा"));
        };
    }

    public String unregisteredPrompt(Lang lang, String clinicName) {
        return switch (lang) {
            case EN -> "👋 *Welcome to " + clinicName + "*\n\nYour mobile number is not registered yet. Please take 1 minute to complete your digital patient profile to access OPD booking, live token tracking, and health records:";
            case HI -> "👋 *" + clinicName + " में आपका स्वागत है*\n\nआपका मोबाइल नंबर अभी पंजीकृत नहीं है। ओपीडी अपॉइंटमेंट, लाइव टोकन ट्रैकिंग और स्वास्थ्य रिकॉर्ड के लिए कृपया 1 मिनट में अपना प्रोफ़ाइल पूरा करें:";
            case MR -> "👋 *" + clinicName + " मध्ये आपले स्वागत आहे*\n\nआपला मोबाईल नंबर अद्याप नोंदणीकृत नाही. ओपीडी अपॉइंटमेंट, थेट टोकन ट्रॅकिंग आणि आरोग्य नोंदींसाठी कृपया 1 मिनिटात आपली नोंदणी पूर्ण करा:";
        };
    }

    public String registrationSuccessMessage(Lang lang, String name) {
        String patient = (name != null && !name.isBlank()) ? name : "Patient";
        return switch (lang) {
            case EN -> "🎉 *Registration Complete!*\n\nWelcome *" + patient + "*! Your Ayushman digital profile is now active. Please choose a service:";
            case HI -> "🎉 *पंजीकरण सफल रहा!*\n\nस्वागत है *" + patient + "*! आपका आयुष्मान डिजिटल प्रोफ़ाइल अब सक्रिय है। कृपया नीचे दी गई सेवा चुनें:";
            case MR -> "🎉 *नोंदणी यशस्वी झाली!*\n\nस्वागत आहे *" + patient + "*! आपले आयुष्मान डिजिटल प्रोफाइल आता सक्रिय आहे. कृपया खालील सेवा निवडा:";
        };
    }

    public List<com.qdischarge.clinicqueue.dto.WaListSection> servicesListSections(Lang lang) {
        return switch (lang) {
            case EN -> List.of(
                new com.qdischarge.clinicqueue.dto.WaListSection("Available Services", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_appointment", "🏥 OPD Appointment", "Book or track OPD token"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_family_abha", "👥 Family & ABHA", "Manage family members & ABHA"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_health_records", "💊 Health Records", "Upload & view medical records"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_referrals", "📋 Referrals", "Check doctor referrals")
                )),
                new com.qdischarge.clinicqueue.dto.WaListSection("Settings", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_lang_change", "🌐 Change Language", "English / हिंदी / मराठी")
                ))
            );
            case HI -> List.of(
                new com.qdischarge.clinicqueue.dto.WaListSection("उपलब्ध सेवाएं", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_appointment", "🏥 ओपीडी अपॉइंटमेंट", "टोकन बुक करें या स्थिति देखें"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_family_abha", "👥 परिवार और आभा", "परिवार के सदस्य और आभा कार्ड"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_health_records", "💊 स्वास्थ्य रिकॉर्ड", "दस्तावेज़ अपलोड और देखें"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_referrals", "📋 डॉक्टर रेफरल", "डॉक्टर के रेफरल देखें")
                )),
                new com.qdischarge.clinicqueue.dto.WaListSection("सेटिंग्स", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_lang_change", "🌐 भाषा बदलें", "English / हिंदी / मराठी")
                ))
            );
            case MR -> List.of(
                new com.qdischarge.clinicqueue.dto.WaListSection("उपलब्ध सेवा", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_appointment", "🏥 ओपीडी अपॉइंटमेंट", "टोकन नोंदवा किंवा स्थिती पहा"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_family_abha", "👥 कुटुंब आणि आभा", "कुटुंबातील सदस्य आणि आभा कार्ड"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_health_records", "💊 आरोग्य नोंदी", "कागदपत्रे अपलोड आणि पहा"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_referrals", "📋 डॉक्टर रेफरल", "डॉक्टरांचे रेफरल तपासा")
                )),
                new com.qdischarge.clinicqueue.dto.WaListSection("सेटिंग्ज", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_lang_change", "🌐 भाषा बदला", "English / हिंदी / मराठी")
                ))
            );
        };
    }

    // -------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------

    public String familyMemberPrompt(Lang lang, List<com.qdischarge.clinicqueue.dto.FamilyMemberDto> members) {
        StringBuilder sb = new StringBuilder();
        sb.append(switch (lang) {
            case EN -> "👨‍👩‍👧‍👦 *Book appointment for:*\n\n";
            case HI -> "👨‍👩‍👧‍👦 *अपॉइंटमेंट किसके लिए बुक करना चाहते हैं:*\n\n";
            case MR -> "👨‍👩‍👧‍👦 *अपॉइंटमेंट कोणासाठी बुक करायची आहे:*\n\n";
        });
        int idx = 1;
        for (com.qdischarge.clinicqueue.dto.FamilyMemberDto m : members) {
            String abhaBadge = Boolean.TRUE.equals(m.getIsAbhaLinked()) ? " [ABHA ✓]" : "";
            sb.append(idx++).append("️⃣ *").append(m.getName()).append("* (").append(m.getRelationship()).append(")").append(abhaBadge).append("\n");
        }
        sb.append(idx).append("️⃣ ➕ *").append(switch (lang) {
            case EN -> "Add new family member";
            case HI -> "नया परिवार सदस्य जोड़ें";
            case MR -> "नवीन कुटुंब सदस्य जोडा";
        }).append("*\n\n");
        sb.append(switch (lang) {
            case EN -> "👉 Reply with the number to select.";
            case HI -> "👉 चुनने के लिए संख्या के साथ उत्तर दें।";
            case MR -> "👉 निवडण्यासाठी क्रमांकासह उत्तर द्या.";
        });
        return sb.toString();
    }

    public String nameRegistrationPrompt(Lang lang) {
        return switch (lang) {
            case EN -> "✍️ *PATIENT REGISTRATION*\n\nPlease reply with your *Full Name* to generate your queue token.\n\n_Example: Yash Dubey_";
            case HI -> "✍️ *रोगी पंजीकरण*\n\nअपना क्यू टोकन बनाने के लिए कृपया अपना *पूरा नाम* भेजें।\n\n_उदाहरण: यश दुबे_";
            case MR -> "✍️ *रुग्ण नोंदणी*\n\nतुमचा रांग टोकन तयार करण्यासाठी कृपया तुमचे *पूर्ण नाव* पाठवा.\n\n_उदाहरण: यश दुबे_";
        };
    }

    public String invalidNameReminder(Lang lang) {
        return switch (lang) {
            case EN -> "✍️ *NAME REQUIRED*\n\nPlease reply with your actual *Full Name* (e.g. John Doe) to generate your token.";
            case HI -> "✍️ *नाम आवश्यक है*\n\nअपना टोकन बनाने के लिए कृपया अपना वास्तविक *पूरा नाम* (जैसे: जॉन डो) भेजें।";
            case MR -> "✍️ *नाव आवश्यक आहे*\n\nतुमचा टोकन तयार करण्यासाठी कृपया तुमचे खरे *पूर्ण नाव* (उदा. जॉन डो) पाठवा.";
        };
    }

    public String genderPrompt(Lang lang) {
        return switch (lang) {
            case EN -> "🚻 *GENDER*\n\nThanks! Please tell us your *Gender*.";
            case HI -> "🚻 *लिंग*\n\nधन्यवाद! कृपया अपना *लिंग* बताएं।";
            case MR -> "🚻 *लिंग*\n\nधन्यवाद! कृपया तुमचे *लिंग* सांगा.";
        };
    }

    public List<WaButton> genderButtons(Lang lang) {
        return switch (lang) {
            case EN -> List.of(new WaButton(Gender.MALE.buttonId(), "Male"), new WaButton(Gender.FEMALE.buttonId(), "Female"), new WaButton(Gender.OTHER.buttonId(), "Other"));
            case HI -> List.of(new WaButton(Gender.MALE.buttonId(), "पुरुष"), new WaButton(Gender.FEMALE.buttonId(), "महिला"), new WaButton(Gender.OTHER.buttonId(), "अन्य"));
            case MR -> List.of(new WaButton(Gender.MALE.buttonId(), "पुरुष"), new WaButton(Gender.FEMALE.buttonId(), "स्त्री"), new WaButton(Gender.OTHER.buttonId(), "इतर"));
        };
    }

    public String invalidGenderReminder(Lang lang) {
        return switch (lang) {
            case EN -> "🚻 *GENDER REQUIRED*\n\nPlease tap one of the options above, or type Male, Female, or Other.";
            case HI -> "🚻 *लिंग आवश्यक है*\n\nकृपया ऊपर दिए गए विकल्पों में से एक चुनें, या पुरुष, महिला, या अन्य टाइप करें।";
            case MR -> "🚻 *लिंग आवश्यक आहे*\n\nकृपया वरील पर्यायांपैकी एक निवडा, किंवा पुरुष, स्त्री किंवा इतर टाइप करा.";
        };
    }

    public String agePrompt(Lang lang) {
        return switch (lang) {
            case EN -> "🎂 *AGE*\n\nThanks! Now please reply with your *Age* (in years).\n\n_Example: 34_";
            case HI -> "🎂 *आयु*\n\nधन्यवाद! अब कृपया अपनी *आयु* (वर्षों में) बताएं।\n\n_उदाहरण: 34_";
            case MR -> "🎂 *वय*\n\nधन्यवाद! आता कृपया तुमचे *वय* (वर्षांमध्ये) सांगा.\n\n_उदाहरण: 34_";
        };
    }

    public String invalidAgeReminder(Lang lang) {
        return switch (lang) {
            case EN -> "🎂 *VALID AGE REQUIRED*\n\nPlease reply with just a number between 0 and 120 (e.g. 34).";
            case HI -> "🎂 *मान्य आयु आवश्यक है*\n\nकृपया केवल 0 से 120 के बीच की संख्या भेजें (जैसे: 34)।";
            case MR -> "🎂 *वैध वय आवश्यक आहे*\n\nकृपया फक्त 0 ते 120 मधील संख्या पाठवा (उदा. 34).";
        };
    }

    // -------------------------------------------------------------
    // Category (department) selection
    // -------------------------------------------------------------

    public String categoryPrompt(Lang lang) {
        String menu = MedicalCategory.numberedMenuText();
        return switch (lang) {
            case EN -> "🏥 *DEPARTMENT*\n\nWhich department do you need? Reply with the number.\n\n" + menu;
            case HI -> "🏥 *विभाग*\n\nआपको किस विभाग की आवश्यकता है? संख्या के साथ उत्तर दें।\n\n" + menu;
            case MR -> "🏥 *विभाग*\n\nतुम्हाला कोणत्या विभागाची गरज आहे? क्रमांकासह उत्तर द्या.\n\n" + menu;
        };
    }

    public String invalidCategoryReminder(Lang lang) {
        return switch (lang) {
            case EN -> "🏥 *NOT RECOGNIZED*\n\nPlease reply with just the *number* next to the department you need (e.g. 4).";
            case HI -> "🏥 *पहचाना नहीं गया*\n\nकृपया आपको चाहिए विभाग के आगे की *संख्या* के साथ उत्तर दें (जैसे: 4)।";
            case MR -> "🏥 *ओळखले नाही*\n\nकृपया तुम्हाला हव्या असलेल्या विभागाच्या पुढील *क्रमांका*सह उत्तर द्या (उदा. 4).";
        };
    }

    // -------------------------------------------------------------
    // Location (to search nearby hospitals offering the chosen department)
    // -------------------------------------------------------------

    public String locationPrompt(Lang lang) {
        return switch (lang) {
            case EN -> "📍 *YOUR LOCATION*\n\n1️⃣ Tap 📎 below to share your *Location Pin*, OR\n2️⃣ Type your *6-digit PIN Code* (e.g. 411001), OR\n3️⃣ Type your *Town / City name* (e.g. Baramati, Pune, Satara).";
            case HI -> "📍 *आपका स्थान*\n\n1️⃣ नीचे 📎 टैप करके अपना *स्थान (Location Pin)* भेजें, या\n2️⃣ अपना *6 अंकों का पिन कोड* भेजें (उदा. 411001), या\n3️⃣ अपने *शहर / कस्बे का नाम* लिखें (उदा. बारामती, पुणे, सतारा)।";
            case MR -> "📍 *तुमचे स्थान*\n\n1️⃣ खाली 📎 टॅप करून तुमचे *लोकेशन पिन* शेअर करा, किंवा\n2️⃣ तुमचा *6-अंकी पिन कोड* पाठवा (उदा. 411001), किंवा\n3️⃣ तुमच्या *गावाचे / शहराचे नाव* लिहा (उदा. बारामती, पुणे, सातारा).";
        };
    }

    /** Sent right after {@link #locationPrompt} as a fallback link -- see WebhookController#sendLocationPrompt. */
    public String findHospitalLinkPrompt(Lang lang) {
        return switch (lang) {
            case EN -> "Having trouble sharing your location here? Tap this link instead -- it'll ask your browser for permission and show you the same nearest-hospital list.";
            case HI -> "यहाँ स्थान साझा करने में दिक्कत हो रही है? इसके बजाय यह लिंक टैप करें -- यह आपके ब्राउज़र से अनुमति मांगेगा और वही निकटतम अस्पतालों की सूची दिखाएगा।";
            case MR -> "इथे स्थान शेअर करण्यात अडचण येत आहे? त्याऐवजी ही लिंक टॅप करा -- ती तुमच्या ब्राउझरकडून परवानगी मागेल आणि तीच जवळच्या रुग्णालयांची यादी दाखवेल.";
        };
    }

    public String findHospitalLinkButtonText(Lang lang) {
        return switch (lang) {
            case EN -> "🌐 Find Hospitals Near Me";
            case HI -> "🌐 पास के अस्पताल खोजें";
            case MR -> "🌐 जवळची रुग्णालये शोधा";
        };
    }

    public String invalidLocationReminder(Lang lang) {
        return switch (lang) {
            case EN -> "📍 *LOCATION NEEDED*\n\nPlease share your location (📎 icon), or type your *6-digit PIN Code* (e.g. 411001) or town name.";
            case HI -> "📍 *स्थान आवश्यक है*\n\nकृपया अपना स्थान (📎 आइकन) भेजें, या अपना *6-अंकों का पिन कोड* (उदा. 411001) या शहर का नाम लिखें।";
            case MR -> "📍 *स्थान आवश्यक आहे*\n\nकृपया तुमचे लोकेशन (📎 आयकॉन) शेअर करा, किंवा तुमचा *6-अंकी पिन कोड* (उदा. 411001) किंवा गावाचे नाव लिहा.";
        };
    }

    // -------------------------------------------------------------
    // Hospital search results (5 at a time, "Show more" for the next 5) and confirmation
    // -------------------------------------------------------------

    public String hospitalResultsHeader(Lang lang, String category) {
        return switch (lang) {
            case EN -> "🏥 Hospitals offering *" + category + "* near you, nearest first. Tap one to select it.";
            case HI -> "🏥 आपके पास *" + category + "* प्रदान करने वाले अस्पताल, निकटतम पहले। चुनने के लिए एक पर टैप करें।";
            case MR -> "🏥 तुमच्या जवळ *" + category + "* देणारी रुग्णालये, सर्वात जवळचे आधी. निवडण्यासाठी एकावर टॅप करा.";
        };
    }

    public String showMoreRowTitle(Lang lang) {
        return switch (lang) {
            case EN -> "➕ Show more";
            case HI -> "➕ और दिखाएं";
            case MR -> "➕ आणखी दाखवा";
        };
    }

    /** Evolution has no tappable list row, so the hint after each results page tells the patient what to type instead (see WebhookController#isShowMoreCommand). */
    public String showMoreHint(Lang lang) {
        return switch (lang) {
            case EN -> "➕ *Type \"more\"* to see the next hospitals.";
            case HI -> "➕ अगले अस्पताल देखने के लिए *\"और दिखाएं\"* लिखें।";
            case MR -> "➕ पुढील रुग्णालये पाहण्यासाठी *\"आणखी दाखवा\"* लिहा.";
        };
    }

    public String noHospitalsFound(Lang lang, String category) {
        return switch (lang) {
            case EN -> "😔 No hospitals currently offer *" + category + "* near you.\n\nPlease pick a different department.\n\n" + MedicalCategory.numberedMenuText();
            case HI -> "😔 फिलहाल आपके पास *" + category + "* प्रदान करने वाला कोई अस्पताल नहीं है।\n\nकृपया एक अलग विभाग चुनें।\n\n" + MedicalCategory.numberedMenuText();
            case MR -> "😔 सध्या तुमच्या जवळ *" + category + "* देणारे कोणतेही रुग्णालय नाही.\n\nकृपया वेगळा विभाग निवडा.\n\n" + MedicalCategory.numberedMenuText();
        };
    }

    public String invalidHospitalSelectionReminder(Lang lang) {
        return switch (lang) {
            case EN -> "🏥 Please tap a hospital from the list above, or *Show more* for more options.";
            case HI -> "🏥 कृपया ऊपर दी गई सूची से एक अस्पताल चुनें, या अधिक विकल्पों के लिए *और दिखाएं* पर टैप करें।";
            case MR -> "🏥 कृपया वरील यादीतून एक रुग्णालय निवडा, किंवा अधिक पर्यायांसाठी *आणखी दाखवा* वर टॅप करा.";
        };
    }

    /** Evolution has no tappable button, so this ends with a "type your choice" instruction instead of "tap" -- see WebhookController#sendConfirmationCard. */
    public String hospitalConfirmationPrompt(Lang lang, String hospitalName, String address, double distanceKm) {
        String addressLine = (address != null && !address.isBlank()) ? "\n📍 " + address : "";
        return switch (lang) {
            case EN -> "🏥 *%s*%s\n📏 ~%.1f km away\n\nBook your token here?\n\n1️⃣ ✅ *Confirm*\n2️⃣ 🔁 *Choose Again*\n\n👉 *Type 1* or *Confirm* to book, or *2* / *Choose Again* to pick a different hospital."
                    .formatted(hospitalName, addressLine, distanceKm);
            case HI -> "🏥 *%s*%s\n📏 ~%.1f किमी दूर\n\nक्या यहां अपना टोकन बुक करें?\n\n1️⃣ ✅ *पुष्टि करें*\n2️⃣ 🔁 *फिर से चुनें*\n\n👉 बुक करने के लिए *1* या *पुष्टि करें* लिखें, या दूसरा अस्पताल चुनने के लिए *2* या *फिर से चुनें* लिखें।"
                    .formatted(hospitalName, addressLine, distanceKm);
            case MR -> "🏥 *%s*%s\n📏 ~%.1f किमी दूर\n\nइथे तुमचा टोकन बुक करायचा का?\n\n1️⃣ ✅ *पुष्टी करा*\n2️⃣ 🔁 *पुन्हा निवडा*\n\n👉 बुक करण्यासाठी *1* किंवा *पुष्टी करा* लिहा, किंवा वेगळे रुग्णालय निवडण्यासाठी *2* किंवा *पुन्हा निवडा* लिहा."
                    .formatted(hospitalName, addressLine, distanceKm);
        };
    }

    public String invalidConfirmationReminder(Lang lang) {
        return switch (lang) {
            case EN -> "Please type *1* or *Confirm* to book this hospital, or *2* / *Choose Again* to pick a different one.";
            case HI -> "इस अस्पताल को बुक करने के लिए *1* या *पुष्टि करें* लिखें, या दूसरा चुनने के लिए *2* या *फिर से चुनें* लिखें।";
            case MR -> "हे रुग्णालय बुक करण्यासाठी *1* किंवा *पुष्टी करा* लिहा, किंवा वेगळे निवडण्यासाठी *2* किंवा *पुन्हा निवडा* लिहा.";
        };
    }

    /**
     * Sent when {@code confirmBooking} rejects the "Confirm" reply (OPD
     * closing soon, hospital gone, etc.) -- surfaces the actual reason
     * instead of repeating {@link #invalidConfirmationReminder}, which just
     * told the patient to type "1" or "Confirm" again and looped forever since
     * retrying "1" can never fix a closed OPD. Points at *Choose Again*
     * instead, since that's the only reply that can actually help here.
     */
    public String bookingFailed(Lang lang, String reason) {
        return switch (lang) {
            case EN -> "❌ %s\n\nType *2* or *Choose Again* to pick a different hospital.".formatted(reason);
            case HI -> "❌ %s\n\nदूसरा अस्पताल चुनने के लिए *2* या *फिर से चुनें* लिखें।".formatted(reason);
            case MR -> "❌ %s\n\nवेगळे रुग्णालय निवडण्यासाठी *2* किंवा *पुन्हा निवडा* लिहा.".formatted(reason);
        };
    }

    public String alreadyActiveToken(Lang lang, String tokenCode, String status) {
        return switch (lang) {
            case EN -> "⚠️ You already have an active Token *#" + tokenCode + "* (" + status.toUpperCase() + ").";
            case HI -> "⚠️ आपके पास पहले से ही सक्रिय टोकन *#" + tokenCode + "* (" + status.toUpperCase() + ") है।";
            case MR -> "⚠️ तुमच्याकडे आधीच सक्रिय टोकन *#" + tokenCode + "* (" + status.toUpperCase() + ") आहे.";
        };
    }

    public String alreadyActiveToken(Lang lang, int id, String status) {
        return alreadyActiveToken(lang, String.valueOf(id), status);
    }

    // -------------------------------------------------------------
    // Token dashboard (STEP: token just generated / refreshed)
    // -------------------------------------------------------------

    public String statusBadge(Lang lang, String status) {
        boolean serving = "serving".equals(status);
        boolean reserved = "reserved".equals(status);
        return switch (lang) {
            case EN -> serving ? "🔔 NOW SERVING!" : (reserved ? "🟡 EN ROUTE (BUFFER ACTIVE)" : "⏳ WAITING IN QUEUE");
            case HI -> serving ? "🔔 अभी सेवा में!" : (reserved ? "🟡 बफर अवधि (अस्पताल के लिए निकलें)" : "⏳ कतार में प्रतीक्षारत");
            case MR -> serving ? "🔔 आत्ता सेवा सुरू आहे!" : (reserved ? "🟡 बफर कालावधी (रुग्णालयासाठी निघा)" : "⏳ रांगेत प्रतीक्षेत");
        };
    }

    public String dashboardTitle(Lang lang, String tokenCode) {
        return switch (lang) {
            case EN -> "🎫 TOKEN #" + tokenCode + " GENERATED!";
            case HI -> "🎫 टोकन #" + tokenCode + " जनरेट हुआ!";
            case MR -> "🎫 टोकन #" + tokenCode + " तयार झाला!";
        };
    }

    public String dashboardTitle(Lang lang, int id) {
        return dashboardTitle(lang, String.valueOf(id));
    }

    public String dashboardDescription(Lang lang, String name, Integer age, String statusBadge, String position, int ahead, int waitMinutes) {
        return dashboardDescription(lang, name, age, statusBadge, position, ahead, waitMinutes, null, 0);
    }

    public String dashboardDescription(Lang lang, String name, Integer age, String statusBadge, String position, int ahead, int waitMinutes, String currentServing, int yourToken) {
        String tokenCode = yourToken > 0 ? ("AF-" + String.format("%02d", yourToken)) : position;
        return dashboardDescription(lang, name, age, statusBadge, tokenCode, ahead, waitMinutes, currentServing);
    }

    public String dashboardDescription(Lang lang, String name, Integer age, String statusBadge, String tokenCode, int ahead, int waitMinutes, String currentServing) {
        String div = "━━━━━━━━━━━━━━━━━━━━━━";
        String ageSuffix = age != null ? " (" + age + " yrs)" : "";
        return switch (lang) {
            case EN -> div + "\n" +
                    "🎫  *OPD TOKEN GENERATED*\n" +
                    div + "\n\n" +
                    "👥  *Patients Ahead:* " + ahead + " ahead of you\n" +
                    "⏳  *Status:*         " + statusBadge + "\n" +
                    "🕐  *Est. Wait:*       ~" + waitMinutes + " mins\n\n" +
                    div + "\n" +
                    "🎟️  *Token Code:*     #" + tokenCode + "\n" +
                    "👤  *Patient:*        " + name + ageSuffix + "\n\n" +
                    "👉 _Tap below to view your live queue position & QR code!_";
            case HI -> div + "\n" +
                    "🎫  *ओपीडी टोकन जनरेट हुआ*\n" +
                    div + "\n\n" +
                    "👥  *आगे मरीज़:*      " + ahead + " लोग आगे हैं\n" +
                    "⏳  *स्थिति:*          " + statusBadge + "\n" +
                    "🕐  *अनुमानित समय:*   ~" + waitMinutes + " मिनट\n\n" +
                    div + "\n" +
                    "🎟️  *टोकन कोड:*       #" + tokenCode + "\n" +
                    "👤  *मरीज़:*           " + name + ageSuffix + "\n\n" +
                    "👉 _लाइव कतार स्थिति और क्यूआर कोड देखने के लिए नीचे टैप करें!_";
            case MR -> div + "\n" +
                    "🎫  *ओपीडी टोकन तयार झाला*\n" +
                    div + "\n\n" +
                    "👥  *पुढे रुग्ण:*        " + ahead + " जण पुढे आहेत\n" +
                    "⏳  *स्थिती:*          " + statusBadge + "\n" +
                    "🕐  *अंदाजे वेळ:*      ~" + waitMinutes + " मिनिटे\n\n" +
                    div + "\n" +
                    "🎟️  *टोकन कोड:*       #" + tokenCode + "\n" +
                    "👤  *रुग्ण:*           " + name + ageSuffix + "\n\n" +
                    "👉 _थेट रांग स्थिती आणि क्यूआर कोड पाहण्यासाठी खाली टॅप करा!_";
        };
    }

    /** "\n🎂 Age: 34" (or its Hindi/Marathi equivalent), or "" when age isn't known yet -- keeps the greeting line clean either way. */
    private String ageLine(Lang lang, Integer age) {
        if (age == null) {
            return "";
        }
        return switch (lang) {
            case EN -> "\n🎂 Age: " + age;
            case HI -> "\n🎂 आयु: " + age;
            case MR -> "\n🎂 वय: " + age;
        };
    }

    public String liveTrackerButtonText(Lang lang) {
        return switch (lang) {
            case EN -> "🌐 Live Tracker Link";
            case HI -> "🌐 लाइव ट्रैकर लिंक";
            case MR -> "🌐 लाइव्ह ट्रॅकर लिंक";
        };
    }

    public List<WaButton> quickActionButtons(Lang lang) {
        return switch (lang) {
            case EN -> List.of(new WaButton("btn_check_status", "📊 Refresh Status"), new WaButton("btn_cancel_token", "❌ Cancel Token"));
            case HI -> List.of(new WaButton("btn_check_status", "📊 स्थिति ताज़ा करें"), new WaButton("btn_cancel_token", "❌ टोकन रद्द करें"));
            case MR -> List.of(new WaButton("btn_check_status", "📊 स्थिती रिफ्रेश करा"), new WaButton("btn_cancel_token", "❌ टोकन रद्द करा"));
        };
    }

    public String quickActionsFooter(Lang lang) {
        return switch (lang) {
            case EN -> "Need to manage your queue ticket?";
            case HI -> "अपना कतार टिकट प्रबंधित करना है?";
            case MR -> "तुमचे रांग तिकीट व्यवस्थापित करायचे आहे का?";
        };
    }

    // -------------------------------------------------------------
    // Status card
    // -------------------------------------------------------------

    public String statusTitle(Lang lang) {
        return switch (lang) {
            case EN -> "📊 CURRENT QUEUE STATUS";
            case HI -> "📊 वर्तमान कतार स्थिति";
            case MR -> "📊 सध्याची रांग स्थिती";
        };
    }

    public String statusDescription(Lang lang, int id, String name, Integer age, String position, int ahead, int waitMinutes, String status) {
        return statusDescription(lang, id, name, age, position, ahead, waitMinutes, status, null);
    }

    public String statusDescription(Lang lang, int id, String name, Integer age, String position, int ahead, int waitMinutes, String status, String currentServing) {
        String code = "AF-" + String.format("%02d", id);
        return statusDescription(lang, code, name, age, position, ahead, waitMinutes, status, currentServing);
    }

    public String statusDescription(Lang lang, String tokenCode, String name, Integer age, String position, int ahead, int waitMinutes, String status, String currentServing) {
        String div = "━━━━━━━━━━━━━━━━━━━━━━";
        String ageSuffix = age != null ? " (" + age + " yrs)" : "";
        boolean isServing = "serving".equals(status);
        boolean isReserved = "reserved".equals(status);
        String statusText = isServing
                ? switch (lang) { case EN -> "🟢 NOW SERVING"; case HI -> "🟢 अभी सेवा में"; case MR -> "🟢 आत्ता सेवा सुरू आहे"; }
                : (isReserved
                    ? switch (lang) { case EN -> "🟡 Reserved Buffer (Head to Hospital)"; case HI -> "🟡 बफर अवधि (अस्पताल के लिए निकलें)"; case MR -> "🟡 बफर कालावधी (रुग्णालयासाठी निघा)"; }
                    : switch (lang) { case EN -> "🔵 Waiting in Queue"; case HI -> "🔵 कतार में प्रतीक्षारत"; case MR -> "🔵 रांगेत प्रतीक्षेत"; });

        return switch (lang) {
            case EN -> div + "\n" +
                    "📊  *LIVE QUEUE STATUS*\n" +
                    div + "\n\n" +
                    (isServing
                        ? "🔔  *YOU ARE BEING SERVED NOW!*\nPlease proceed to the consultation room immediately.\n\n"
                        : "👥  *Patients Ahead:* " + ahead + " ahead of you\n" +
                          "⏳  *Queue Position:* Pos #" + position + "\n" +
                          "🕐  *Est. Wait:*       ~" + waitMinutes + " mins\n\n") +
                    div + "\n" +
                    "🎟️  *Token Code:*     #" + tokenCode + "\n" +
                    "⚡  *Status:*         " + statusText + "\n" +
                    "👤  *Patient:*        " + name + ageSuffix + "\n\n" +
                    "👉 _Tap below for real-time tracking & reception check-in QR code._";
            case HI -> div + "\n" +
                    "📊  *लाइव कतार स्थिति*\n" +
                    div + "\n\n" +
                    (isServing
                        ? "🔔  *आपकी बारी आ गई है!*\nकृपया तुरंत परामर्श कक्ष में जाएं।\n\n"
                        : "👥  *आगे मरीज़:*      " + ahead + " लोग आगे हैं\n" +
                          "⏳  *कतार स्थान:*      स्थान #" + position + "\n" +
                          "🕐  *अनुमानित समय:*   ~" + waitMinutes + " मिनट\n\n") +
                    div + "\n" +
                    "🎟️  *टोकन कोड:*       #" + tokenCode + "\n" +
                    "⚡  *स्थिति:*          " + statusText + "\n" +
                    "👤  *मरीज़:*           " + name + ageSuffix + "\n\n" +
                    "👉 _रीयल-टाइम ट्रैकिंग और रिसेप्शन क्यूआर कोड के लिए नीचे टैप करें।_";
            case MR -> div + "\n" +
                    "📊  *थेट रांग स्थिती*\n" +
                    div + "\n\n" +
                    (isServing
                        ? "🔔  *तुमची पाळी आली आहे!*\nकृपया ताबडतोब तपासणी कक्षात जा.\n\n"
                        : "👥  *पुढे रुग्ण:*        " + ahead + " जण पुढे आहेत\n" +
                          "⏳  *रांगेतील स्थान:*  स्थान #" + position + "\n" +
                          "🕐  *अंदाजे वेळ:*      ~" + waitMinutes + " मिनिटे\n\n") +
                    div + "\n" +
                    "🎟️  *टोकन कोड:*       #" + tokenCode + "\n" +
                    "⚡  *स्थिती:*          " + statusText + "\n" +
                    "👤  *रुग्ण:*           " + name + ageSuffix + "\n\n" +
                    "👉 _थेट ट्रॅकिंग आणि रिसेप्शन क्यूआर कोडसाठी खाली टॅप करा._";
        };
    }

    public String noActiveTokenFound(Lang lang) {
        return switch (lang) {
            case EN -> "❌ *No Active Token Found*\n\nSend *Hi* to generate a token.";
            case HI -> "❌ *कोई सक्रिय टोकन नहीं मिला*\n\nटोकन बनाने के लिए *Hi* भेजें।";
            case MR -> "❌ *कोणताही सक्रिय टोकन आढळला नाही*\n\nटोकन तयार करण्यासाठी *Hi* पाठवा.";
        };
    }

    // -------------------------------------------------------------
    // Cancel
    // -------------------------------------------------------------

    public String tokenCancelled(Lang lang, String tokenCode) {
        return switch (lang) {
            case EN -> "❌ *TOKEN CANCELLED*\n\nYour Token *#" + tokenCode + "* has been cancelled.\n\nSend *Hi* anytime to book a new appointment.";
            case HI -> "❌ *टोकन रद्द किया गया*\n\nआपका टोकन *#" + tokenCode + "* रद्द कर दिया गया है।\n\nनया अपॉइंटमेंट बुक करने के लिए कभी भी *Hi* भेजें।";
            case MR -> "❌ *टोकन रद्द केला*\n\nतुमचा टोकन *#" + tokenCode + "* रद्द करण्यात आला आहे.\n\nनवीन अपॉइंटमेंट बुक करण्यासाठी केव्हाही *Hi* पाठवा.";
        };
    }

    public String tokenCancelled(Lang lang, int id) {
        return tokenCancelled(lang, String.valueOf(id));
    }

    public String noActiveTokenToCancel(Lang lang) {
        return switch (lang) {
            case EN -> "❌ No active token to cancel.";
            case HI -> "❌ रद्द करने के लिए कोई सक्रिय टोकन नहीं है।";
            case MR -> "❌ रद्द करण्यासाठी कोणताही सक्रिय टोकन नाही.";
        };
    }

    // -------------------------------------------------------------
    // Live Event Notifications (Reception Check-in, Demotion, Missed, Now Serving)
    // -------------------------------------------------------------

    public String receptionCheckInConfirmedReserved(Lang lang, String tokenCode, String patientName, String department, String hospitalName) {
        return switch (lang) {
            case EN -> ("✅ *RECEPTION CHECK-IN CONFIRMED!*\n\n"
                    + "Welcome to *%s*, %s!\n\n"
                    + "🎟️ Token Code: #%s\n"
                    + "🏆 *Queue Position: Position #1 (TOP PRIORITY)*\n"
                    + "🩺 Department: %s\n\n"
                    + "👉 Your reception check-in was verified. You have been awarded the front of the queue! Please wait near the consultation room.")
                    .formatted(hospitalName, patientName, tokenCode, department);
            case HI -> ("✅ *रिसेप्शन चेक-इन सफल!*\n\n"
                    + "*%s* में आपका स्वागत है, %s!\n\n"
                    + "🎟️ टोकन कोड: #%s\n"
                    + "🏆 *कतार स्थान: स्थान #1 (शीर्ष प्राथमिकता)*\n"
                    + "🩺 विभाग: %s\n\n"
                    + "👉 आपका चेक-इन सत्यापित हो गया है। आपको कतार में सबसे आगे स्थान #1 दिया गया है! कृपया परामर्श कक्ष के पास प्रतीक्षा करें।")
                    .formatted(hospitalName, patientName, tokenCode, department);
            case MR -> ("✅ *रिसेप्शन चेक-इन यशस्वी!*\n\n"
                    + "*%s* मध्ये आपले स्वागत आहे, %s!\n\n"
                    + "🎟️ टोकन कोड: #%s\n"
                    + "🏆 *रांगेतील स्थान: स्थान #1 (सर्वोच्च प्राधान्य)*\n"
                    + "🩺 विभाग: %s\n\n"
                    + "👉 आपले चेक-इन सत्यापित झाले आहे. आपल्याला रांगेत सर्वात पुढे स्थान #1 देण्यात आले आहे! कृपया तपासणी कक्षाजवळ थांबा.")
                    .formatted(hospitalName, patientName, tokenCode, department);
        };
    }

    public String receptionCheckInConfirmed(Lang lang, String tokenCode, String patientName, int queuePosition, String department, String hospitalName) {
        return switch (lang) {
            case EN -> ("✅ *RECEPTION CHECK-IN CONFIRMED!*\n\n"
                    + "Welcome to *%s*, %s.\n\n"
                    + "🎟️ Token Code: #%s\n"
                    + "📊 Queue Position: Pos #%d\n"
                    + "🩺 Department: %s\n\n"
                    + "👉 Check-in verified. Please watch your live queue tracker for updates.")
                    .formatted(hospitalName, patientName, tokenCode, queuePosition, department);
            case HI -> ("✅ *रिसेप्शन चेक-इन सफल!*\n\n"
                    + "*%s* में आपका स्वागत है, %s।\n\n"
                    + "🎟️ टोकन कोड: #%s\n"
                    + "📊 कतार स्थान: स्थान #%d\n"
                    + "🩺 विभाग: %s\n\n"
                    + "👉 चेक-इन सत्यापित हो गया है। अपडेट के लिए अपने लाइव ट्रैकर पर नज़र रखें।")
                    .formatted(hospitalName, patientName, tokenCode, queuePosition, department);
            case MR -> ("✅ *रिसेप्शन चेक-इन यशस्वी!*\n\n"
                    + "*%s* मध्ये आपले स्वागत आहे, %s.\n\n"
                    + "🎟️ टोकन कोड: #%s\n"
                    + "📊 रांगेतील स्थान: स्थान #%d\n"
                    + "🩺 विभाग: %s\n\n"
                    + "👉 चेक-इन सत्यापित झाले आहे. अपडेटसाठी आपल्या थेट ट्रॅकरकडे लक्ष ठेवा.")
                    .formatted(hospitalName, patientName, tokenCode, queuePosition, department);
        };
    }

    public String exponentialDemotionNotification(Lang lang, String tokenCode, String patientName, int skippedBy, int newPosition, int ahead, String department) {
        return switch (lang) {
            case EN -> ("⚠️ *TURN SKIPPED - QUEUE UPDATE*\n\n"
                    + "Hello %s, you were not present when Token #%s (%s) was called.\n\n"
                    + "🔄 Turn moved back by: %d %s\n"
                    + "📍 *New Queue Position:* Pos #%d (%d %s ahead)\n\n"
                    + "👉 Please report to the clinic counter as soon as possible so your turn is not missed!")
                    .formatted(patientName, tokenCode, department, skippedBy, skippedBy == 1 ? "position" : "positions", newPosition, ahead, ahead == 1 ? "patient" : "patients");
            case HI -> ("⚠️ *बारी छूटी - कतार अपडेट*\n\n"
                    + "नमस्ते %s, टोकन #%s (%s) बुलाए जाने पर आप उपस्थित नहीं थे।\n\n"
                    + "🔄 बारी पीछे की गई: %d स्थान\n"
                    + "📍 *नया कतार स्थान:* स्थान #%d (%d मरीज़ आगे)\n\n"
                    + "👉 कृपया जल्द से जल्द क्लिनिक काउंटर पर रिपोर्ट करें ताकि आपकी बारी रद्द न हो!")
                    .formatted(patientName, tokenCode, department, skippedBy, newPosition, ahead);
            case MR -> ("⚠️ *पाळी चुकली - रांग अपडेट*\n\n"
                    + "नमस्कार %s, टोकन #%s (%s) बोलावल्यावर आपण उपस्थित नव्हता.\n\n"
                    + "🔄 पाळी मागे केली: %d स्थाने\n"
                    + "📍 *नवीन रांग स्थान:* स्थान #%d (%d रुग्ण पुढे)\n\n"
                    + "👉 कृपया लवकरात लवकर क्लिनिक काउंटरवर संपर्क साधा जेणेकरून आपली पाळी रद्द होणार नाही!")
                    .formatted(patientName, tokenCode, department, skippedBy, newPosition, ahead);
        };
    }

    public String movedToMissedNotification(Lang lang, String tokenCode, String patientName, String department) {
        return switch (lang) {
            case EN -> ("🔴 *APPOINTMENT MISSED*\n\n"
                    + "Hello %s, Token #%s for *%s* could not be called after multiple attempts and has been moved to the Missed Queue.\n\n"
                    + "👉 Please visit the Reception Desk to be requeued to the front of the line!")
                    .formatted(patientName, tokenCode, department);
            case HI -> ("🔴 *अपॉइंटमेंट मिस हुआ*\n\n"
                    + "नमस्ते %s, टोकन #%s (%s) को कई प्रयासों के बाद भी नहीं बुलाया जा सका और इसे मिस सूची में डाल दिया गया है।\n\n"
                    + "👉 कतार में सबसे आगे दोबारा शामिल होने के लिए कृपया रिसेप्शन डेस्क पर जाएं!")
                    .formatted(patientName, tokenCode, department);
            case MR -> ("🔴 *अपॉइंटमेंट चुकली*\n\n"
                    + "नमस्कार %s, टोकन #%s (%s) अनेक प्रयत्नांनंतरही उपलब्ध न झाल्याने मिस यादीत टाकण्यात आला आहे.\n\n"
                    + "👉 रांगेत पुन्हा सर्वात पुढे येण्यासाठी कृपया रिसेप्शन काउंटरला भेट द्या!")
                    .formatted(patientName, tokenCode, department);
        };
    }

    public String reinstatedToFrontNotification(Lang lang, String tokenCode, String patientName, String department) {
        return switch (lang) {
            case EN -> ("🎉 *TURN REINSTATED - FRONT OF LINE!*\n\n"
                    + "Hello %s, your Token #%s for *%s* has been reinstated to the very front of the active queue (*Position #1*).\n\n"
                    + "👉 Please proceed to the consultation room / counter immediately!")
                    .formatted(patientName, tokenCode, department);
            case HI -> ("🎉 *बारी बहाल - कतार में सबसे आगे!*\n\n"
                    + "नमस्ते %s, आपके टोकन #%s (%s) को कतार में सबसे आगे (*स्थान #1*) पर बहाल कर दिया गया है।\n\n"
                    + "👉 कृपया तुरंत परामर्श कक्ष / काउंटर पर पहुंचें!")
                    .formatted(patientName, tokenCode, department);
            case MR -> ("🎉 *पाळी पुनर्संचयित - रांगेत सर्वात पुढे!*\n\n"
                    + "नमस्कार %s, आपला टोकन #%s (%s) रांगेत सर्वात पुढे (*स्थान #1*) पुनर्संचयित करण्यात आला आहे.\n\n"
                    + "👉 कृपया ताबडतोब तपासणी कक्षाकडे / काउंटरकडे जा!")
                    .formatted(patientName, tokenCode, department);
        };
    }

    public String nowServingNotification(Lang lang, String tokenCode, String patientName, Integer counterId, String department) {
        String counterText = counterId != null ? "Counter " + counterId : "Consultation Room";
        return switch (lang) {
            case EN -> ("🔔 *NOW SERVING - IT'S YOUR TURN!*\n\n"
                    + "Hello %s, Token #%s for *%s* is being called right now!\n\n"
                    + "👉 Please enter *%s* immediately.")
                    .formatted(patientName, tokenCode, department, counterText);
            case HI -> ("🔔 *अभी सेवारत - आपकी बारी!*\n\n"
                    + "नमस्ते %s, *%s* के लिए टोकन #%s को अभी बुलाया जा रहा है!\n\n"
                    + "👉 कृपया तुरंत *%s* में प्रवेश करें।")
                    .formatted(patientName, department, tokenCode, counterText);
            case MR -> ("🔔 *आत्ता सेवा सुरू - आपली पाळी!*\n\n"
                    + "नमस्कार %s, *%s* साठी टोकन #%s आता बोलावला जात आहे!\n\n"
                    + "👉 कृपया ताबडतोब *%s* मध्ये जा.")
                    .formatted(patientName, department, tokenCode, counterText);
        };
    }

    public String frozenTokenBookedNotification(Lang lang, String patientName, String department, String hospitalName, int travelMinutes, String targetTimeStr) {
        return switch (lang) {
            case EN -> ("🏥 *APPOINTMENT CONFIRMED — HEAD OUT NOW*\n\n"
                    + "Hello *%s*, your appointment for *%s* at *%s* is confirmed! ✅\n\n"
                    + "👉 *Please start heading to the hospital now!*\n"
                    + "Your token is scheduled to activate as you approach the clinic so you won't wait in the lobby. You will receive your live token number and position once active.")
                    .formatted(patientName, department, hospitalName);
            case HI -> ("🏥 *अपॉइंटमेंट की पुष्टि — तुरंत निकलें*\n\n"
                    + "नमस्ते *%s*, *%s* में *%s* विभाग के लिए आपका अपॉइंटमेंट पक्का हो गया है! ✅\n\n"
                    + "👉 *कृपया अभी अस्पताल के लिए निकलें!*\n"
                    + "जैसे ही आप अस्पताल के पास पहुंचेंगे, आपका टोकन सक्रिय हो जाएगा ताकि आपको इंतज़ार न करना पड़े।")
                    .formatted(patientName, hospitalName, department);
            case MR -> ("🏥 *अपॉइंटमेंट पुष्टी — ताबडतोब निघा*\n\n"
                    + "नमस्कार *%s*, *%s* मधील *%s* विभागासाठी आपली अपॉइंटमेंट निश्चित झाली आहे! ✅\n\n"
                    + "👉 *कृपया आताच रुग्णालयासाठी निघा!*\n"
                    + "आपण रुग्णालयाजवळ पोहोचल्यावर आपला टोकन सक्रिय होईल जेणेकरून आपल्याला थांबावे लागणार नाही.")
                    .formatted(patientName, hospitalName, department);
        };
    }

    public String tokenUnfrozenActiveNotification(Lang lang, String tokenCode, String patientName, int position, String department, String hospitalName) {
        return switch (lang) {
            case EN -> ("🎉 *TOKEN ACTIVATED IN QUEUE!*\n\n"
                    + "Hello *%s*, your queue token for *%s* at *%s* is now ACTIVE! 🎟️\n\n"
                    + "🎟️ *Token Code:* #%s\n"
                    + "📊 *Live Queue Position:* Pos #%d\n\n"
                    + "👉 Please proceed to the reception counter to scan your check-in QR code upon arrival!")
                    .formatted(patientName, department, hospitalName, tokenCode, position);
            case HI -> ("🎉 *टोकन कतार में सक्रिय हो गया!*\n\n"
                    + "नमस्ते *%s*, *%s* में *%s* के लिए आपका टोकन अब सक्रिय है! 🎟️\n\n"
                    + "🎟️ *टोकन कोड:* #%s\n"
                    + "📊 *कतार स्थान:* स्थान #%d\n\n"
                    + "👉 अस्पताल पहुंचकर कृपया रिसेप्शन पर अपना चेक-इन क्यूआर कोड स्कैन कराएं!")
                    .formatted(patientName, hospitalName, department, tokenCode, position);
            case MR -> ("🎉 *टोकन रांगेत सक्रिय झाला!*\n\n"
                    + "नमस्कार *%s*, *%s* मधील *%s* साठी आपला टोकन आता सक्रिय आहे! 🎟️\n\n"
                    + "🎟️ *टोकन कोड:* #%s\n"
                    + "📊 *रांगेतील स्थान:* स्थान #%d\n\n"
                    + "👉 कृपया रुग्णालयात पोहोचल्यावर रिसेप्शन काउंटरवर आपला चेक-इन क्यूआर कोड स्कॅन करा!")
                    .formatted(patientName, hospitalName, department, tokenCode, position);
        };
    }

    public String bufferPeriodStartedNotification(Lang lang, String tokenCode, String patientName, int bufferMinutes, String department, String hospitalName) {
        return switch (lang) {
            case EN -> ("🟡 *YOUR TURN HAS ARRIVED — BUFFER ACTIVE*\n\n"
                    + "Hello *%s*, Token #%s has reached the top of the queue for *%s* at *%s*!\n\n"
                    + "⏳ *Buffer Time Remaining:* ~%d minutes to check in at reception.\n\n"
                    + "👉 If you do not check in within %d minutes, your turn will be skipped and moved back in the queue.")
                    .formatted(patientName, tokenCode, department, hospitalName, bufferMinutes, bufferMinutes);
            case HI -> ("🟡 *आपकी बारी आ गई है — बफर समय सक्रिय*\n\n"
                    + "नमस्ते *%s*, *%s* में *%s* के लिए आपका टोकन #%s कतार में शीर्ष पर पहुंच गया है!\n\n"
                    + "⏳ *शेष बफर समय:* रिसेप्शन पर चेक-इन करने के लिए ~%d मिनट।\n\n"
                    + "👉 यदि आप %d मिनट के भीतर चेक-इन नहीं करते हैं, तो आपकी बारी आगे बढ़ा दी जाएगी।")
                    .formatted(patientName, hospitalName, department, tokenCode, bufferMinutes, bufferMinutes);
            case MR -> ("🟡 *आपली पाळी आली आहे — बफर वेळ सुरू*\n\n"
                    + "नमस्कार *%s*, *%s* मधील *%s* साठी आपला टोकन #%s रांगेत सर्वात वर पोहोचला आहे!\n\n"
                    + "⏳ *शिल्लक बफर वेळ:* रिसेप्शनवर चेक-इन करण्यासाठी ~%d मिनिटे.\n\n"
                    + "👉 आपण %d मिनिटांत चेक-इन न केल्यास आपली पाळी मागे केली जाईल.")
                    .formatted(patientName, hospitalName, department, tokenCode, bufferMinutes, bufferMinutes);
        };
    }

    // -------------------------------------------------------------
    // Doctor record-access grants (see AccessService)
    // -------------------------------------------------------------

    /** Sent the moment a patient's device claims a doctor's access code (see AccessService#claim). "revoke <id>" is a literal, English-only command -- kept untranslated so it's always recognized regardless of the reply's language. */
    public String accessGranted(Lang lang, String doctorName, String hospitalName, int grantId) {
        String hospitalPart = hospitalName != null ? " (" + hospitalName + ")" : "";
        return switch (lang) {
            case EN -> "🔓 *ACCESS GRANTED*\n\nDr. " + doctorName + hospitalPart + " can now view your records.\n\nIf this wasn't you, reply *revoke " + grantId + "* to remove access immediately.";
            case HI -> "🔓 *पहुंच प्रदान की गई*\n\nडॉ. " + doctorName + hospitalPart + " अब आपके रिकॉर्ड देख सकते हैं।\n\nअगर यह आपने नहीं किया, तो तुरंत पहुंच हटाने के लिए *revoke " + grantId + "* लिखकर भेजें।";
            case MR -> "🔓 *प्रवेश मंजूर*\n\nडॉ. " + doctorName + hospitalPart + " आता तुमचे रेकॉर्ड पाहू शकतात.\n\nहे तुम्ही केले नसेल, तर लगेच प्रवेश काढण्यासाठी *revoke " + grantId + "* असे लिहून पाठवा.";
        };
    }

    public String accessRevoked(Lang lang, int grantId) {
        return switch (lang) {
            case EN -> "✅ Access #" + grantId + " has been revoked.";
            case HI -> "✅ पहुंच #" + grantId + " हटा दी गई है।";
            case MR -> "✅ प्रवेश #" + grantId + " काढून टाकला आहे.";
        };
    }

    public String accessRevokeNotFound(Lang lang) {
        return switch (lang) {
            case EN -> "❌ Couldn't find an active access grant with that number for your phone.";
            case HI -> "❌ आपके फ़ोन के लिए उस नंबर से कोई सक्रिय पहुंच नहीं मिली।";
            case MR -> "❌ तुमच्या फोनसाठी त्या क्रमांकाचा कोणताही सक्रिय प्रवेश आढळला नाही.";
        };
    }

    // -------------------------------------------------------------
    // Family Booking Prompts
    // -------------------------------------------------------------

    public String familySelectionPrompt(Lang lang, String optionsText) {
        return switch (lang) {
            case EN -> "👨‍👩‍👧 *Who is this appointment for?*\n\n" + optionsText + "\n\nReply with the number of your choice (e.g. 1 or 2).";
            case HI -> "👨‍👩‍👧 *यह अपॉइंटमेंट किसके लिए है?*\n\n" + optionsText + "\n\nकृपया अपने विकल्प का नंबर लिखकर भेजें (उदा. 1 या 2)।";
            case MR -> "👨‍👩‍👧 *ही अपॉइंटमेंट कोणासाठी आहे?*\n\n" + optionsText + "\n\nकृपया आपल्या पर्यायाचा क्रमांक पाठवा (उदा. 1 किंवा 2).";
        };
    }

    public String newMemberNamePrompt(Lang lang) {
        return switch (lang) {
            case EN -> "👤 Please enter the family member's full name:";
            case HI -> "👤 कृपया परिवार के सदस्य का पूरा नाम दर्ज करें:";
            case MR -> "👤 कृपया कुटुंब सदस्याचे पूर्ण नाव प्रविष्ट करा:";
        };
    }

    public String newMemberRelationPrompt(Lang lang) {
        return switch (lang) {
            case EN -> "🤝 What is their relationship to you? (e.g. Spouse, Child, Parent, Sibling, Other):";
            case HI -> "🤝 आपका उनसे क्या संबंध है? (उदा. पति/पत्नी, बच्चा, माता/पिता, भाई/बहन, अन्य):";
            case MR -> "🤝 त्यांचे तुमच्याशी काय नाते आहे? (उदा. पती/पत्नी, मूल, आई/वडील, इतर):";
        };
    }

    public String newMemberAgePrompt(Lang lang) {
        return switch (lang) {
            case EN -> "🎂 Please enter their age in years (e.g. 28):";
            case HI -> "🎂 कृपया उनकी आयु (वर्षों में) दर्ज करें (उदा. 28):";
            case MR -> "🎂 कृपया त्यांचे वय (वर्षांमध्ये) प्रविष्ट करा (उदा. 28):";
        };
    }

    public List<com.qdischarge.clinicqueue.dto.WaListSection> quickDepartmentSections(Lang lang) {
        return switch (lang) {
            case EN -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaListSection("Common Specialties", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_General Medicine / Internal Medicine", "🩺 General Medicine", "Fever, cold, checkup, BP"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Paediatrics", "👶 Paediatrics", "Child care, sickness & vaccines"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Obstetrics & Gynaecology", "🌸 Gynaecology", "Women health & maternity"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Orthopaedics", "🦴 Orthopaedics", "Bone, joint & spine pain")
                    )),
                    new com.qdischarge.clinicqueue.dto.WaListSection("All Specialties", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_all_list", "📋 More Departments", "View all 33 specialties")
                    ))
            );
            case HI -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaListSection("मुख्य विभाग", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_General Medicine / Internal Medicine", "🩺 सामान्य चिकित्सा", "बुखार, सर्दी, जांच, बीपी"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Paediatrics", "👶 बाल रोग", "बच्चों के रोग व टीकाकरण"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Obstetrics & Gynaecology", "🌸 महिला व प्रसूति", "महिला स्वास्थ्य व प्रसूति"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Orthopaedics", "🦴 हड्डी रोग", "हड्डी, जोड़ व कमर दर्द")
                    )),
                    new com.qdischarge.clinicqueue.dto.WaListSection("अन्य विभाग", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_all_list", "📋 अन्य सभी विभाग", "सभी ३३ विभाग देखें")
                    ))
            );
            case MR -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaListSection("मुख्य विभाग", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_General Medicine / Internal Medicine", "🩺 सामान्य वैद्यकीय", "ताप, सर्दी, तपासणी, बीपी"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Paediatrics", "👶 बालरोग", "लहान मुलांचे आजार व लस"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Obstetrics & Gynaecology", "🌸 महिला व प्रसूती", "महिला आरोग्य व प्रसूती"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Orthopaedics", "🦴 हाडे व सांधे", "हाडे, सांधे व पाठदुखी")
                    )),
                    new com.qdischarge.clinicqueue.dto.WaListSection("इतर विभाग", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_all_list", "📋 इतर सर्व विभाग", "सर्व ३३ विभाग पहा")
                    ))
            );
        };
    }

    public String familyMemberManageCard(Lang lang, com.qdischarge.clinicqueue.dto.FamilyMemberDto m) {
        String abhaStatus = Boolean.TRUE.equals(m.getIsAbhaLinked()) 
                ? (m.getAbhaAddress() != null && !m.getAbhaAddress().isBlank() ? "Linked (" + m.getAbhaAddress() + ") ✅" : "Linked ✅")
                : "Not Linked ⚠️";
        String rel = m.getRelationship() != null ? m.getRelationship() : "Self";
        String ageGender = (m.getAge() != null ? m.getAge() + " yrs" : "") + (m.getGender() != null ? " · " + m.getGender() : "");

        return switch (lang) {
            case EN -> """
                    👤 *PATIENT PROFILE*
                    ━━━━━━━━━━━━━━━━━━━━━━
                    • Name: *%s*
                    • Relation: %s
                    • Age / Gender: %s
                    • ABHA Status: %s
                    ━━━━━━━━━━━━━━━━━━━━━━
                    What would you like to do for this member?""".formatted(m.getName(), rel, ageGender, abhaStatus);
            case HI -> """
                    👤 *मरीज़ प्रोफ़ाइल*
                    ━━━━━━━━━━━━━━━━━━━━━━
                    • नाम: *%s*
                    • संबंध: %s
                    • आयु / लिंग: %s
                    • आभा स्थिति: %s
                    ━━━━━━━━━━━━━━━━━━━━━━
                    आप इस सदस्य के लिए क्या करना चाहते हैं?""".formatted(m.getName(), rel, ageGender, abhaStatus);
            case MR -> """
                    👤 *रुग्ण प्रोफाइल*
                    ━━━━━━━━━━━━━━━━━━━━━━
                    • नाव: *%s*
                    • नाते: %s
                    • वय / लिंग: %s
                    • आभा स्थिती: %s
                    ━━━━━━━━━━━━━━━━━━━━━━
                    या सदस्यासाठी आपण काय करू इच्छिता?""".formatted(m.getName(), rel, ageGender, abhaStatus);
        };
    }

    public List<com.qdischarge.clinicqueue.dto.WaButton> familyMemberManageButtons(Lang lang, int memberId) {
        return switch (lang) {
            case EN -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton("fam_book_" + memberId, "🎫 Book OPD Token"),
                    new com.qdischarge.clinicqueue.dto.WaButton("fam_records_" + memberId, "📁 Health Records"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_main_menu", "🏠 Main Menu")
            );
            case HI -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton("fam_book_" + memberId, "🎫 टोकन बुक करें"),
                    new com.qdischarge.clinicqueue.dto.WaButton("fam_records_" + memberId, "📁 स्वास्थ्य रिकॉर्ड"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_main_menu", "🏠 मुख्य मेनू")
            );
            case MR -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton("fam_book_" + memberId, "🎫 टोकन बुक करा"),
                    new com.qdischarge.clinicqueue.dto.WaButton("fam_records_" + memberId, "📁 आरोग्य नोंदी"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_main_menu", "🏠 मुख्य मेनू")
            );
        };
    }

    public String instantPrescriptionPrompt(Lang lang, String patientName) {
        return switch (lang) {
            case EN -> "📄 *DOCUMENT / PRESCRIPTION RECEIVED!*\n\nWe detected a prescription or medical report. Would you like to save this to *" + patientName + "*'s Health Vault?";
            case HI -> "📄 *दस्तावेज़ / पर्चा प्राप्त हुआ!*\n\nहमें एक मेडिकल पर्चा या रिपोर्ट मिली है। क्या आप इसे *" + patientName + "* के हेल्थ वॉल्ट में सहेजना चाहते हैं?";
            case MR -> "📄 *कागदपत्र / प्रिस्क्रिप्शन मिळाले!*\n\nआम्हाला वैद्यकीय प्रिस्क्रिप्शन किंवा अहवाल मिळाला आहे. आपण हे *" + patientName + "* च्या Health Vault मध्ये जतन करू इच्छिता?";
        };
    }

    public List<com.qdischarge.clinicqueue.dto.WaButton> instantPrescriptionButtons(Lang lang) {
        return switch (lang) {
            case EN -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_save_doc_yes", "✅ Yes, Save to Vault"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_save_doc_other", "👤 Other Family Member")
            );
            case HI -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_save_doc_yes", "✅ हां, वॉल्ट में सहेजें"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_save_doc_other", "👤 अन्य सदस्य चुनें")
            );
            case MR -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_save_doc_yes", "✅ होय, Vault मध्ये जतन करा"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_save_doc_other", "👤 इतर सदस्य निवडा")
            );
        };
    }

    public String emptyHospitalsRecoveryPrompt(Lang lang, String category, String operatingHospitalName) {
        String hosp = operatingHospitalName != null ? operatingHospitalName : "District Civil Hospital";
        return switch (lang) {
            case EN -> "📍 *NO CLINIC IN IMMEDIATE RADIUS*\n\nWe could not find a local clinic within 5 km for *" + category + "*.\n\nWould you like to book at the nearest *" + hosp + "* or search with another PIN Code?";
            case HI -> "📍 *पास में कोई क्लीनिक नहीं मिला*\n\nहमें *" + category + "* के लिए 5 किमी के भीतर कोई क्लीनिक नहीं मिला।\n\nक्या आप निकटतम *" + hosp + "* में बुक करना चाहते हैं या नया पिन कोड दर्ज करना चाहते हैं?";
            case MR -> "📍 *जवळ कोणतेही रुग्णालय आढळले नाही*\n\n*" + category + "* साठी 5 किमी अंतरावर क्लिनिक आढळले नाही.\n\nआपण जवळच्या *" + hosp + "* मध्ये बुक करू इच्छिता की दुसरा पिन कोड टाकू इच्छिता?";
        };
    }

    public List<com.qdischarge.clinicqueue.dto.WaButton> emptyHospitalsButtons(Lang lang, Integer operatingHospitalId) {
        String hospBtn = (operatingHospitalId != null) ? "hosp_" + operatingHospitalId : "btn_book_main";
        return switch (lang) {
            case EN -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton(hospBtn, "🏛️ District Hospital"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_retry_location", "📍 Change PIN/Location"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_main_menu", "🏠 Main Menu")
            );
            case HI -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton(hospBtn, "🏛️ जिला अस्पताल"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_retry_location", "📍 पिन कोड बदलें"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_main_menu", "🏠 मुख्य मेनू")
            );
            case MR -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaButton(hospBtn, "🏛️ जिल्हा रुग्णालय"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_retry_location", "📍 पिन कोड बदला"),
                    new com.qdischarge.clinicqueue.dto.WaButton("btn_main_menu", "🏠 मुख्य मेनू")
            );
        };
    }
}
