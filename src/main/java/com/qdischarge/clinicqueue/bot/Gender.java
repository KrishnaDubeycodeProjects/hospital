package com.qdischarge.clinicqueue.bot;

import java.util.Set;

/**
 * The three gender options captured during registration (tokens.gender) and
 * used to filter a hospital's gender_specific flag during hospital search --
 * same match-by-buttonId-or-keyword pattern as {@link Lang} and {@link Intent}.
 */
public enum Gender {
    MALE("btn_gender_male", Set.of("male", "m", "पुरुष")),
    FEMALE("btn_gender_female", Set.of("female", "f", "महिला", "स्त्री")),
    OTHER("btn_gender_other", Set.of("other", "o", "अन्य", "इतर"));

    private final String buttonId;
    private final Set<String> keywords;

    Gender(String buttonId, Set<String> keywords) {
        this.buttonId = buttonId;
        this.keywords = keywords;
    }

    public String buttonId() {
        return buttonId;
    }

    /** Lowercase value stored in tokens.gender / matched against hospitals.gender_specific. */
    public String code() {
        return name().toLowerCase();
    }

    public static Gender match(String buttonId, String cleanMessage) {
        for (Gender g : values()) {
            if (g.buttonId.equals(buttonId) || g.keywords.contains(cleanMessage)) {
                return g;
            }
        }
        return null;
    }
}
