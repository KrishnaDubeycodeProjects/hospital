package com.qdischarge.clinicqueue.asha.service;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Normalizes field values sent by the bilingual (Hindi / Marathi) ASHA app.
 * Mirrors asha-app/src/services/maternalMath.ts so client and server agree.
 */
public final class ClinicalValueNormalizer {

    private static final Pattern NEGATIVE_PREFIX =
            Pattern.compile("^(✕|no\\b|not\\b|false\\b|नहीं|नही|नाही|negative)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern NEGATIVE_ANYWHERE =
            Pattern.compile("not given|नहीं|नाही", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern AFFIRMATIVE_PREFIX =
            Pattern.compile("^(✓|yes\\b|true\\b|y$|हाँ|हां|होय)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern ISO = Pattern.compile("^(\\d{4})-(\\d{1,2})-(\\d{1,2})");
    private static final Pattern DMY = Pattern.compile("^(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{4})$");

    private ClinicalValueNormalizer() {}

    /**
     * Interprets a yes/no answer: Boolean, or strings such as "हाँ", "होय", "Yes", "✓ …"
     * (true) and "नहीं", "नाही", "No", "✕ …" (false). Returns null when not recorded / unknown.
     */
    public static Boolean affirmative(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.intValue() != 0;
        String s = value.toString().trim();
        if (s.isEmpty()) return null;
        String lower = s.toLowerCase(Locale.ROOT);
        if (NEGATIVE_PREFIX.matcher(lower).find() || NEGATIVE_ANYWHERE.matcher(lower).find()) return Boolean.FALSE;
        if (AFFIRMATIVE_PREFIX.matcher(lower).find()) return Boolean.TRUE;
        return null;
    }

    /** Parses DD/MM/YYYY, DD-MM-YYYY or ISO YYYY-MM-DD[...]; null when absent or invalid (e.g. 31/02). */
    public static LocalDate parseDate(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        if (s.isEmpty()) return null;
        try {
            Matcher iso = ISO.matcher(s);
            if (iso.find()) {
                return LocalDate.of(Integer.parseInt(iso.group(1)), Integer.parseInt(iso.group(2)), Integer.parseInt(iso.group(3)));
            }
            Matcher dmy = DMY.matcher(s);
            if (dmy.matches()) {
                return LocalDate.of(Integer.parseInt(dmy.group(3)), Integer.parseInt(dmy.group(2)), Integer.parseInt(dmy.group(1)));
            }
        } catch (DateTimeException | NumberFormatException e) {
            return null;
        }
        return null;
    }

    /**
     * Naegele's rule (Annexure 1): EDD = LMP + 9 calendar months + 7 days.
     * {@link LocalDate#plusMonths} clamps to the month end, matching the client implementation.
     */
    public static LocalDate naegeleEdd(LocalDate lmp) {
        return lmp.plusMonths(9).plusDays(7);
    }
}
