package com.qdischarge.clinicqueue.bot;

import java.util.Set;

public enum Intent {
    // Main services (buttonId = the WA list row id)
    APPOINTMENT("srv_appointment", Set.of("srv_appointment", "srv_book", "appointment", "opd", "book", "book appointment", "opd appointment", "token", "अपॉइंटमेंट", "अपॉइंटमेंट बुक", "ओपीडी", "अपॉइंटमेंट बुक करा")),
    FAMILY_ABHA("srv_family_abha", Set.of("srv_family_abha", "srv_family", "family", "abha", "family abha", "परिवार", "कुटुंब", "आभा")),
    HEALTH_RECORDS("srv_health_records", Set.of("srv_health_records", "srv_records", "health records", "records", "documents", "medical records", "रिकॉर्ड", "दस्तावेज़", "नोंदी")),
    REFERRALS("srv_referrals", Set.of("srv_referrals", "referrals", "referral", "follow up", "रेफरल", "फॉलो अप")),
    WEB_PORTAL("srv_web_portal", Set.of("srv_web_portal", "portal", "website", "web portal", "online portal", "वेबसाइट", "पोर्टल")),
    CHANGE_LANGUAGE("srv_lang_change", Set.of("srv_lang_change", "change language", "language", "भाषा बदलें", "भाषा", "भाषा बदला")),
    
    // Sub-service intents
    BOOK_APPOINTMENT("apt_book", Set.of("apt_book", "book appointment", "book token", "बुक", "टोकन बुक", "नोंदणी करा")),
    TRACK_APPOINTMENT("apt_track", Set.of("apt_track", "srv_track", "track", "status", "check status", "live status", "ट्रैक", "स्थिति", "स्थिती")),
    
    UPLOAD_RECORD("rec_upload", Set.of("rec_upload", "upload", "upload document", "अपलोड", "दस्तावेज़ अपलोड")),
    VIEW_RECORDS("rec_view", Set.of("rec_view", "view", "view records", "देखें", "पहा")),
    
    // Navigation
    GO_BACK("btn_go_back", Set.of("btn_go_back", "back", "go back", "पीछे", "वापस", "मागे", "पुन्हा")),
    MAIN_MENU("btn_main_menu", Set.of("btn_main_menu", "menu", "main menu", "home", "मेनू", "मुख्य मेनू", "होम", "hi", "hello", "hey", "namaste", "helo", "नमस्ते", "नमस्कार", "हाय", "start", "शुरू")),
    
    // Token actions (kept for backwards compatibility)
    CANCEL_TOKEN("btn_cancel_token", Set.of("btn_cancel_token", "cancel", "cancel token", "रद्द", "रद्द करें", "रद्द करा")),
    SERVICES("btn_services", Set.of("btn_services", "services", "सेवाएं", "सेवा"));

    /** Words that mean "start over" in any supported language -- never valid as a patient's name. */
    public static final Set<String> GREETING_WORDS = Set.of("hi", "hello", "hey", "नमस्ते", "नमस्कार", "हाय", "helo", "namaste", "start", "menu");

    private final String buttonId;
    private final Set<String> keywords;

    Intent(String buttonId, Set<String> keywords) {
        this.buttonId = buttonId;
        this.keywords = keywords;
    }

    public static Intent match(String buttonId, String cleanMessage) {
        if (buttonId != null && !buttonId.isBlank()) {
            for (Intent intent : values()) {
                if (intent.buttonId.equalsIgnoreCase(buttonId) || intent.keywords.contains(buttonId.toLowerCase())) {
                    return intent;
                }
            }
        }
        if (cleanMessage != null && !cleanMessage.isBlank()) {
            for (Intent intent : values()) {
                if (intent.keywords.contains(cleanMessage) || intent.buttonId.equalsIgnoreCase(cleanMessage)) {
                    return intent;
                }
            }
            if (GREETING_WORDS.contains(cleanMessage)) {
                return MAIN_MENU;
            }
        }
        return null;
    }

    /** True for any word this bot treats as a command rather than a real patient name (any supported language). */
    public static boolean isReservedWord(String cleanMessage) {
        if (cleanMessage == null) return false;
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
