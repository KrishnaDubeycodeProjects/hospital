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
            case EN -> List.of(new WaButton("btn_generate_token", "🎫 Generate Token"), new WaButton("btn_check_status", "🔍 Check Status"));
            case HI -> List.of(new WaButton("btn_generate_token", "🎫 टोकन बनाएं"), new WaButton("btn_check_status", "🔍 स्थिति देखें"));
            case MR -> List.of(new WaButton("btn_generate_token", "🎫 टोकन तयार करा"), new WaButton("btn_check_status", "🔍 स्थिती तपासा"));
        };
    }

    // -------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------

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
            case EN -> "📍 *YOUR LOCATION*\n\nTap below to share your current location, so we can find the nearest hospitals for you.\n\n_Can't share it? Reply with a DIGIPIN instead._";
            case HI -> "📍 *आपका स्थान*\n\nनिकटतम अस्पताल खोजने के लिए नीचे टैप करके अपना वर्तमान स्थान साझा करें।\n\n_साझा नहीं कर सकते? इसके बजाय DIGIPIN भेजें।_";
            case MR -> "📍 *तुमचे स्थान*\n\nजवळचे रुग्णालय शोधण्यासाठी खाली टॅप करून तुमचे सध्याचे स्थान शेअर करा.\n\n_शेअर करू शकत नाही? त्याऐवजी DIGIPIN पाठवा._";
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
            case EN -> "📍 *LOCATION NEEDED*\n\nPlease share your current location (the 📎/location icon), or type a valid 10-character DIGIPIN.";
            case HI -> "📍 *स्थान आवश्यक है*\n\nकृपया अपना वर्तमान स्थान साझा करें (📎/स्थान आइकन), या एक मान्य 10-अक्षर का DIGIPIN टाइप करें।";
            case MR -> "📍 *स्थान आवश्यक आहे*\n\nकृपया तुमचे सध्याचे स्थान शेअर करा (📎/स्थान आयकॉन), किंवा वैध 10-अक्षरी DIGIPIN टाइप करा.";
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

    public String hospitalConfirmationPrompt(Lang lang, String hospitalName, String address, double distanceKm) {
        String addressLine = (address != null && !address.isBlank()) ? "\n📍 " + address : "";
        return switch (lang) {
            case EN -> "🏥 *%s*%s\n📏 ~%.1f km away\n\nBook your token here?".formatted(hospitalName, addressLine, distanceKm);
            case HI -> "🏥 *%s*%s\n📏 ~%.1f किमी दूर\n\nक्या यहां अपना टोकन बुक करें?".formatted(hospitalName, addressLine, distanceKm);
            case MR -> "🏥 *%s*%s\n📏 ~%.1f किमी दूर\n\nइथे तुमचा टोकन बुक करायचा का?".formatted(hospitalName, addressLine, distanceKm);
        };
    }

    public List<WaButton> confirmationButtons(Lang lang) {
        return switch (lang) {
            case EN -> List.of(new WaButton("btn_confirm_booking", "✅ Confirm"), new WaButton("btn_choose_again", "🔁 Choose Again"));
            case HI -> List.of(new WaButton("btn_confirm_booking", "✅ पुष्टि करें"), new WaButton("btn_choose_again", "🔁 फिर से चुनें"));
            case MR -> List.of(new WaButton("btn_confirm_booking", "✅ पुष्टी करा"), new WaButton("btn_choose_again", "🔁 पुन्हा निवडा"));
        };
    }

    public String invalidConfirmationReminder(Lang lang) {
        return switch (lang) {
            case EN -> "Please tap *Confirm* to book this hospital, or *Choose Again* to pick a different one.";
            case HI -> "इस अस्पताल को बुक करने के लिए *पुष्टि करें* पर टैप करें, या दूसरा चुनने के लिए *फिर से चुनें* पर टैप करें।";
            case MR -> "हे रुग्णालय बुक करण्यासाठी *पुष्टी करा* वर टॅप करा, किंवा वेगळे निवडण्यासाठी *पुन्हा निवडा* वर टॅप करा.";
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
        String ageLine = ageLine(lang, age);
        return switch (lang) {
            case EN -> """
                    Hello %s,%s

                    Your queue token has been generated successfully!

                    📌 *Status:* %s
                    📍 *Queue Position:* %s
                    👥 *Patients Ahead:* %d
                    ⏱️ *Estimated Wait:* ~%d mins

                    Tap below to open your interactive live queue dashboard!"""
                    .formatted(name, ageLine, statusBadge, position, ahead, waitMinutes);
            case HI -> """
                    नमस्ते %s,%s

                    आपका क्यू टोकन सफलतापूर्वक बन गया है!

                    📌 *स्थिति:* %s
                    📍 *कतार में स्थान:* %s
                    👥 *आगे मरीज़:* %d
                    ⏱️ *अनुमानित प्रतीक्षा:* ~%d मिनट

                    अपना लाइव कतार डैशबोर्ड खोलने के लिए नीचे टैप करें!"""
                    .formatted(name, ageLine, statusBadge, position, ahead, waitMinutes);
            case MR -> """
                    नमस्कार %s,%s

                    तुमचा रांग टोकन यशस्वीरित्या तयार झाला आहे!

                    📌 *स्थिती:* %s
                    📍 *रांगेतील स्थान:* %s
                    👥 *पुढे रुग्ण:* %d
                    ⏱️ *अंदाजे प्रतीक्षा:* ~%d मिनिटे

                    तुमचे लाइव्ह रांग डॅशबोर्ड उघडण्यासाठी खाली टॅप करा!"""
                    .formatted(name, ageLine, statusBadge, position, ahead, waitMinutes);
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
        String ageSuffix = age != null ? " (" + age + ")" : "";
        return switch (lang) {
            case EN -> """
                    🎫 Token: #%d
                    👤 Patient: %s%s
                    📍 Position: %s
                    👥 People Ahead: %d
                    ⏱️ Estimated Wait: ~%d mins
                    ⚡ Status: %s"""
                    .formatted(id, name, ageSuffix, position, ahead, waitMinutes, status.toUpperCase());
            case HI -> """
                    🎫 टोकन: #%d
                    👤 मरीज़: %s%s
                    📍 स्थान: %s
                    👥 आगे लोग: %d
                    ⏱️ अनुमानित प्रतीक्षा: ~%d मिनट
                    ⚡ स्थिति: %s"""
                    .formatted(id, name, ageSuffix, position, ahead, waitMinutes, status.toUpperCase());
            case MR -> """
                    🎫 टोकन: #%d
                    👤 रुग्ण: %s%s
                    📍 स्थान: %s
                    👥 पुढे लोक: %d
                    ⏱️ अंदाजे प्रतीक्षा: ~%d मिनिटे
                    ⚡ स्थिती: %s"""
                    .formatted(id, name, ageSuffix, position, ahead, waitMinutes, status.toUpperCase());
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
}
