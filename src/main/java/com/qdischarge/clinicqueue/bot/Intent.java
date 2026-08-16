package com.qdischarge.clinicqueue.bot;

import java.util.Set;

/**
 * The three menu actions the WhatsApp bot understands, matched against
 * either a Meta interactive-button id or free-typed text -- in English,
 * Hindi, or Marathi, regardless of which language the session is currently
 * in, so a patient can always fall back to typing the English word too.
 */
public enum Intent {
    GENERATE_TOKEN("btn_generate_token", Set.of(
            "1", "generate token", "token", "new token", "book token",
            "टोकन", "टोकन बनाएं", "टोकन बनाओ",
            "टोकन तयार करा", "नवीन टोकन")),
    CHECK_STATUS("btn_check_status", Set.of(
            "2", "check status", "status",
            "स्थिति", "स्थिति देखें", "स्टेटस",
            "स्थिती", "स्थिती पहा")),
    CANCEL_TOKEN("btn_cancel_token", Set.of(
            "3", "cancel token", "cancel",
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
            if (intent.buttonId.equals(buttonId) || intent.keywords.contains(cleanMessage)) {
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
