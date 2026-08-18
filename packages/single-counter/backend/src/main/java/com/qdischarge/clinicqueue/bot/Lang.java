package com.qdischarge.clinicqueue.bot;

import java.util.Set;

/**
 * The three languages the WhatsApp bot converses in. Each phone number picks
 * one on first contact (see {@link WaSessionService}) and every subsequent
 * reply -- greeting, menu, token dashboard, status, cancel -- is rendered in
 * it via {@link BotMessages}.
 */
public enum Lang {
    EN(Set.of("english", "en"), "btn_lang_en"),
    HI(Set.of("hindi", "hi", "हिंदी"), "btn_lang_hi"),
    MR(Set.of("marathi", "mr", "मराठी"), "btn_lang_mr");

    private final Set<String> keywords;
    private final String buttonId;

    Lang(Set<String> keywords, String buttonId) {
        this.keywords = keywords;
        this.buttonId = buttonId;
    }

    /** DB code stored in wa_sessions.language, e.g. "EN". */
    public static Lang fromCode(String code) {
        if (code == null) {
            return null;
        }
        try {
            return Lang.valueOf(code.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Matches a language selection tap (Meta button id) or typed word
     * ("english"/"hindi"/"marathi", or the native script). Used both for the
     * initial picker and for switching language later. Deliberately excludes
     * bare "1"/"2"/"3" -- those are already the main-menu shortcuts once a
     * language is chosen, see {@link #matchInitial}.
     */
    public static Lang match(String buttonId, String cleanMessage) {
        for (Lang lang : values()) {
            if (lang.buttonId.equals(buttonId) || lang.keywords.contains(cleanMessage)) {
                return lang;
            }
        }
        return null;
    }

    /**
     * Same as {@link #match}, plus "1"/"2"/"3" -- safe only for the very
     * first language prompt, before those digits become the generate/status/
     * cancel menu shortcuts.
     */
    public static Lang matchInitial(String buttonId, String cleanMessage) {
        Lang direct = match(buttonId, cleanMessage);
        if (direct != null) {
            return direct;
        }
        return switch (cleanMessage) {
            case "1" -> EN;
            case "2" -> HI;
            case "3" -> MR;
            default -> null;
        };
    }
}
