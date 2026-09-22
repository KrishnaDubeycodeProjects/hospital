package com.qdischarge.clinicqueue.bot;

import java.util.Set;

/**
 * The three menu actions the WhatsApp bot understands, matched against
 * either a Meta interactive-button id or free-typed text -- in English,
 * Hindi, or Marathi, regardless of which language the session is currently
 * in, so a patient can always fall back to typing the English word too.
 */
public enum Intent {
    GENERATE_TOKEN("srv_book", Set.of(
            "btn_generate_token", "btn_book_token", "1", "generate token", "token", "new token", "book token", "book", "appointment", "book appointment",
            "टोकन", "टोकन बनाएं", "टोकन बनाओ", "अपॉइंटमेंट", "बुक",
            "टोकन तयार करा", "नवीन टोकन", "अपॉइंटमेंट बुक करा")),
    CHECK_STATUS("srv_track", Set.of(
            "btn_check_status", "btn_track_token", "2", "check status", "status", "track", "track patient", "live token", "queue",
            "स्थिति", "स्थिति देखें", "स्टेटस", "ट्रैक",
            "स्थिती", "स्थिती पहा", "ट्रॅक")),
    DOCUMENTS("srv_records", Set.of(
            "btn_documents", "btn_referrals", "btn_records", "3", "documents", "prescriptions", "records", "my documents", "medication", "referrals", "referral",
            "दस्तावेज़", "पर्चे", "कागदपत्रे", "औषधे", "रेफरल")),
    FAMILY("srv_family", Set.of(
            "btn_family", "4", "family", "family members", "my family", "view family", "switch member", "switch", "change member", "change patient",
            "परिवार", "कुटुंब", "सदस्य बदलें", "बदलो")),
    SERVICES("btn_services", Set.of(
            "services", "more services", "more", "menu",
            "सेवाएं", "अन्य सेवाएं", "सेवा",
            "इतर सेवा", "अधिक सेवा")),
    CANCEL_TOKEN("btn_cancel_token", Set.of(
            "cancel token", "cancel",
            "रद्द करें", "टोकन रद्द करें", "रद्द",
            "रद्द करा", "टोकन रद्द करा"));

    /** Words that mean "start over" in any supported language -- never valid as a patient's name. */
    public static final Set<String> GREETING_WORDS = Set.of("hi", "hello", "hey", "नमस्ते", "नमस्कार", "हाय");

    private final String buttonId;
    private final Set<String> keywords;

    Intent(String buttonId, Set<String> keywords) {
        this.buttonId = buttonId;
        this.keywords = keywords;
    }

    public static Intent match(String buttonId, String cleanMessage) {
        for (Intent intent : values()) {
            if (intent.buttonId.equals(buttonId) || intent.keywords.contains(cleanMessage) || (buttonId != null && intent.keywords.contains(buttonId))) {
                return intent;
            }
        }
        return null;
    }

    /** True for any word this bot treats as a command rather than a real patient name (any supported language). */
    public static boolean isReservedWord(String cleanMessage) {
        if (GREETING_WORDS.contains(cleanMessage)) {
            return true;
        }
        for (Intent intent : values()) {
            if (intent.keywords.contains(cleanMessage)) {
                return true;
            }
        }
        return false;
    }
}
