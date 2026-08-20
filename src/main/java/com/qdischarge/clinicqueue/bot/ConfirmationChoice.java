package com.qdischarge.clinicqueue.bot;

import java.util.Set;

/**
 * The two choices offered after a hospital is picked -- book it, or go back
 * and choose a different one. Evolution API has no tappable button here (see
 * WhatsAppService#formatButtonsAsText, which renders "buttons" as a plain
 * numbered list), so the prompt asks the patient to type their choice and
 * this matches free-typed text in English, Hindi, or Marathi, regardless of
 * which language the session is currently in -- mirroring {@link Intent}.
 */
public enum ConfirmationChoice {
    CONFIRM("btn_confirm_booking", Set.of(
            "1", "confirm", "yes", "y", "book", "confirm booking",
            "पुष्टि करें", "पुष्टि", "हां", "हाँ",
            "पुष्टी करा", "पुष्टी", "हो")),
    CHOOSE_AGAIN("btn_choose_again", Set.of(
            "2", "choose again", "change", "no", "n", "back",
            "फिर से चुनें", "फिर से", "नहीं",
            "पुन्हा निवडा", "पुन्हा", "नाही"));

    private final String buttonId;
    private final Set<String> keywords;

    ConfirmationChoice(String buttonId, Set<String> keywords) {
        this.buttonId = buttonId;
        this.keywords = keywords;
    }

    public static ConfirmationChoice match(String buttonId, String cleanMessage) {
        for (ConfirmationChoice choice : values()) {
            if (choice.buttonId.equals(buttonId) || choice.keywords.contains(cleanMessage)) {
                return choice;
            }
        }
        return null;
    }
}
