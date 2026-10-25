package com.qdischarge.clinicqueue.util;

public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    /**
     * Normalizes a phone number to standard E.164 Indian format (+91XXXXXXXXXX)
     * where possible, or trims and strips whitespace.
     */
    public static String normalize(String phone) {
        if (phone == null || phone.isBlank()) {
            return "";
        }
        String clean = phone.trim();
        try {
            clean = java.net.URLDecoder.decode(clean, java.nio.charset.StandardCharsets.UTF_8).trim();
            if (clean.contains("%")) {
                clean = java.net.URLDecoder.decode(clean, java.nio.charset.StandardCharsets.UTF_8).trim();
            }
        } catch (Exception ignored) {}
        clean = clean.replaceAll("(?i)%2b", "+").trim();
        String digits = clean.replaceAll("[^0-9]", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        if (digits.length() == 10) {
            return "+91" + digits;
        }
        return clean.startsWith("+") ? clean : (clean.isEmpty() ? "" : clean);
    }

    /**
     * Checks if two phone numbers refer to the same 10-digit subscriber.
     */
    public static boolean matches(String p1, String p2) {
        if (p1 == null || p2 == null) {
            return false;
        }
        String d1 = p1.replaceAll("[^0-9]", "");
        String d2 = p2.replaceAll("[^0-9]", "");
        if (d1.length() > 10) d1 = d1.substring(d1.length() - 10);
        if (d2.length() > 10) d2 = d2.substring(d2.length() - 10);
        return !d1.isEmpty() && d1.equals(d2);
    }

    /**
     * Masks a phone number for safe logging (e.g. +91*****43210).
     */
    public static String mask(String phone) {
        if (phone == null || phone.isBlank()) {
            return "[empty]";
        }
        String clean = phone.trim();
        if (clean.length() <= 4) {
            return "****";
        }
        int keep = 4;
        String tail = clean.substring(clean.length() - keep);
        String prefix = clean.startsWith("+") ? clean.substring(0, 3) : "";
        return prefix + "*****" + tail;
    }
}
