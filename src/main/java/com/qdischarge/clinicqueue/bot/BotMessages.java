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

    public String headingToHospitalNotification(Lang lang, String patientName, int tokenNumber, String departmentName, String hospitalName) {
        return switch (lang) {
            case EN -> "Hello %s, your token number %d for %s at %s is about to be called. We request you to please start heading to the hospital now."
                    .formatted(patientName, tokenNumber, departmentName, hospitalName);
            case HI -> "नमस्ते %s, %s में %s के लिए आपका टोकन नंबर %d जल्द ही बुलाया जाने वाला है। कृपया अब अस्पताल की ओर रवाना हो जाएं।"
                    .formatted(patientName, hospitalName, departmentName, tokenNumber);
            case MR -> "नमस्कार %s, %s येथे %s साठी आपला टोकन क्रमांक %d लवकरच बोलावला जाणार आहे. कृपया आता रुग्णालयाकडे रवाना व्हा."
                    .formatted(patientName, hospitalName, departmentName, tokenNumber);
        };
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
            case EN -> List.of(new com.qdischarge.clinicqueue.dto.WaListSection("Available Services", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_book", "🎫 Book OPD Token", "Book clinic OPD appointment"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_track", "📊 Track Live Token", "Live queue & serving token"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_records", "💊 Records & Referrals", "Prescriptions & referrals"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_family", "👨‍👩‍👧 Family Members", "View & manage family unit")
            )));
            case HI -> List.of(new com.qdischarge.clinicqueue.dto.WaListSection("उपलब्ध सेवाएं", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_book", "🎫 ओपीडी टोकन बुक करें", "क्लीनिक अपॉइंटमेंट बुक करें"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_track", "📊 लाइव टोकन ट्रैक करें", "वर्तमान कतार व टोकन स्थिति"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_records", "💊 मेडिकल रिकॉर्ड/रेफरल", "दस्तावेज़ व रेफरल देखें"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_family", "👨‍👩‍👧 परिवार के सदस्य", "परिवार व आभा आईडी प्रबंधन")
            )));
            case MR -> List.of(new com.qdischarge.clinicqueue.dto.WaListSection("उपलब्ध सेवा", List.of(
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_book", "🎫 ओपीडी टोकन बुक करा", "रुग्णालय ओपीडी नोंदणी"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_track", "📊 थेट टोकन तपासा", "रांगेची थेट स्थिती"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_records", "💊 नोंदी व रेफरल", "कागदपत्रे व तपासणी अहवाल"),
                    new com.qdischarge.clinicqueue.dto.WaListRow("srv_family", "👨‍👩‍👧 कुटुंबातील सदस्य", "कुटुंब व आभा व्यवस्थापन")
            )));
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

    public String alreadyActiveToken(Lang lang, int id, String status) {
        return switch (lang) {
            case EN -> "⚠️ You already have active Token #" + id + " (" + status.toUpperCase() + ").";
            case HI -> "⚠️ आपके पास पहले से ही सक्रिय टोकन #" + id + " (" + status.toUpperCase() + ") है।";
            case MR -> "⚠️ तुमच्याकडे आधीच सक्रिय टोकन #" + id + " (" + status.toUpperCase() + ") आहे.";
        };
    }

    // -------------------------------------------------------------
    // Token dashboard (STEP: token just generated / refreshed)
    // -------------------------------------------------------------

    public String statusBadge(Lang lang, String status) {
        boolean serving = "serving".equals(status);
        return switch (lang) {
            case EN -> serving ? "🔔 NOW SERVING!" : "⏳ WAITING IN QUEUE";
            case HI -> serving ? "🔔 अभी सेवा में!" : "⏳ कतार में प्रतीक्षारत";
            case MR -> serving ? "🔔 आत्ता सेवा सुरू आहे!" : "⏳ रांगेत प्रतीक्षेत";
        };
    }

    public String dashboardTitle(Lang lang, int id) {
        return switch (lang) {
            case EN -> "🎫 TOKEN #" + id + " GENERATED!";
            case HI -> "🎫 टोकन #" + id + " जनरेट हुआ!";
            case MR -> "🎫 टोकन #" + id + " तयार झाला!";
        };
    }

    public String dashboardDescription(Lang lang, String name, Integer age, String statusBadge, String position, int ahead, int waitMinutes) {
        return dashboardDescription(lang, name, age, statusBadge, position, ahead, waitMinutes, null, 0);
    }

    public String dashboardDescription(Lang lang, String name, Integer age, String statusBadge, String position, int ahead, int waitMinutes, String currentServing, int yourToken) {
        String ageLine = ageLine(lang, age);
        String servingText = (currentServing != null && !currentServing.isBlank()) ? currentServing : "--";
        String tokenText = yourToken > 0 ? String.valueOf(yourToken) : position;
        return switch (lang) {
            case EN -> """
                    Hello %s,%s

                    Your queue token has been generated successfully!

                    🔔 *CURRENT SERVING TOKEN: #%s*
                    🎫 *YOUR TOKEN NUMBER: #%s*

                    📌 *Status:* %s

                    Tap below to open your live queue tracker!"""
                    .formatted(name, ageLine, servingText, tokenText, statusBadge);
            case HI -> """
                    नमस्ते %s,%s

                    आपका कतार टोकन सफलतापूर्वक बन गया है!

                    🔔 *वर्तमान में सेवारत टोकन: #%s*
                    🎫 *आपका टोकन नंबर: #%s*

                    📌 *स्थिति:* %s

                    अपना लाइव कतार ट्रैकर खोलने के लिए नीचे टैप करें!"""
                    .formatted(name, ageLine, servingText, tokenText, statusBadge);
            case MR -> """
                    नमस्कार %s,%s

                    तुमचा रांग टोकन यशस्वीरित्या तयार झाला आहे!

                    🔔 *सध्या सुरू असलेला टोकन: #%s*
                    🎫 *तुमचा टोकन क्रमांक: #%s*

                    📌 *स्थिती:* %s

                    तुमचे लाइव्ह रांग ट्रॅकर उघडण्यासाठी खाली टॅप करा!"""
                    .formatted(name, ageLine, servingText, tokenText, statusBadge);
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
        String ageSuffix = age != null ? " (" + age + ")" : "";
        String servingText = (currentServing != null && !currentServing.isBlank()) ? currentServing : "--";
        return switch (lang) {
            case EN -> """
                    🔔 *CURRENT SERVING TOKEN: #%s*
                    🎫 *YOUR TOKEN: #%d*

                    👤 Patient: %s%s
                    ⚡ Status: %s"""
                    .formatted(servingText, id, name, ageSuffix, status.toUpperCase());
            case HI -> """
                    🔔 *वर्तमान में सेवारत टोकन: #%s*
                    🎫 *आपका टोकन: #%d*

                    👤 मरीज़: %s%s
                    ⚡ स्थिति: %s"""
                    .formatted(servingText, id, name, ageSuffix, status.toUpperCase());
            case MR -> """
                    🔔 *सध्या सुरू असलेला टोकन: #%s*
                    🎫 *तुमचा टोकन: #%d*

                    👤 रुग्ण: %s%s
                    ⚡ स्थिती: %s"""
                    .formatted(servingText, id, name, ageSuffix, status.toUpperCase());
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

    public String tokenCancelled(Lang lang, int id) {
        return switch (lang) {
            case EN -> "❌ *TOKEN CANCELLED*\n\nYour Token *#" + id + "* has been cancelled.\n\nSend *Hi* anytime to generate a new token.";
            case HI -> "❌ *टोकन रद्द किया गया*\n\nआपका टोकन *#" + id + "* रद्द कर दिया गया है।\n\nनया टोकन बनाने के लिए कभी भी *Hi* भेजें।";
            case MR -> "❌ *टोकन रद्द केला*\n\nतुमचा टोकन *#" + id + "* रद्द करण्यात आला आहे.\n\nनवीन टोकन तयार करण्यासाठी केव्हाही *Hi* पाठवा.";
        };
    }

    public String noActiveTokenToCancel(Lang lang) {
        return switch (lang) {
            case EN -> "❌ No active token to cancel.";
            case HI -> "❌ रद्द करने के लिए कोई सक्रिय टोकन नहीं है।";
            case MR -> "❌ रद्द करण्यासाठी कोणताही सक्रिय टोकन नाही.";
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
                    new com.qdischarge.clinicqueue.dto.WaListSection("⭐ Common Health Needs", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_General Medicine / Internal Medicine", "🩺 General / Fever / Cold", "Fever, cough, body pain, BP, Sugar"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Paediatrics", "👶 Child Care (Bal Rog)", "Infants, kids sickness & vaccination"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Obstetrics & Gynaecology", "🌸 Women & Maternity", "Pregnancy, delivery, women's health"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Orthopaedics", "🦴 Bone & Joint Pain", "Fracture, joint pain, spine & backache")
                    )),
                    new com.qdischarge.clinicqueue.dto.WaListSection("➕ More Specialties", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_all_list", "📋 All 33 Departments", "Heart, Eye, Dental, Skin, Surgery & more")
                    ))
            );
            case HI -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaListSection("⭐ मुख्य आवश्यकताएं", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_General Medicine / Internal Medicine", "🩺 सामान्य / बुखार / खांसी", "बुखार, सर्दी, कमजोरी, बीपी, शुगर"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Paediatrics", "👶 बाल रोग (बच्चे)", "बच्चों की बीमारी व टीकाकरण"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Obstetrics & Gynaecology", "🌸 महिला व प्रसूति", "गर्भावस्था, प्रसव व स्त्री रोग"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Orthopaedics", "🦴 हड्डी व जोड़ दर्द", "फ्रैक्चर, जोड़ों व कमर का दर्द")
                    )),
                    new com.qdischarge.clinicqueue.dto.WaListSection("➕ अन्य विभाग", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_all_list", "📋 सभी ३३ विभाग देखें", "आंख, दांत, हृदय, चमड़ी व अन्य")
                    ))
            );
            case MR -> List.of(
                    new com.qdischarge.clinicqueue.dto.WaListSection("⭐ मुख्य गरज", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_General Medicine / Internal Medicine", "🩺 सामान्य / ताप / खोकला", "ताप, सर्दी, कमजोरी, बीपी, शुगर"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Paediatrics", "👶 बालरोग (लहान मुले)", "लहान मुलांचे आजार व लसीकरण"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Obstetrics & Gynaecology", "🌸 महिला व प्रसूती", "गरोदरपण, प्रसूती व स्त्रीरोग"),
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_Orthopaedics", "🦴 हाडे व सांधेदुखी", "फ्रॅक्चर, सांधे व कंबरदुखी")
                    )),
                    new com.qdischarge.clinicqueue.dto.WaListSection("➕ इतर विभाग", List.of(
                            new com.qdischarge.clinicqueue.dto.WaListRow("dept_all_list", "📋 सर्व ३३ विभाग पहा", "डोळे, दात, हृदय, त्वचा व इतर")
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
