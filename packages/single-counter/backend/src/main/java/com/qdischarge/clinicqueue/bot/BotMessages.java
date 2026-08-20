package com.qdischarge.clinicqueue.bot;

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
