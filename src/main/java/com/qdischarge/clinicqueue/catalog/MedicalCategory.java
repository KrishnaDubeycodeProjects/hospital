package com.qdischarge.clinicqueue.catalog;

import java.util.List;

/**
 * The fixed set of medical departments/specialties a hospital can offer and
 * a patient can search/book by. Deliberately a flat picklist (not free text)
 * so it's a real queue-partition key (see hospital_departments,
 * tokens.category) rather than an unbounded string -- every hospital's
 * offered categories and every token's booked category are validated
 * against this list.
 */
public final class MedicalCategory {

    public static final List<String> ALL = List.of(
            "General Medicine / Internal Medicine",
            "General Surgery",
            "Family Medicine",
            "Cardiology",
            "Cardiac Surgery",
            "Orthopaedics",
            "Oncology (Medical/Surgical)",
            "Neurology",
            "Neurosurgery",
            "Nephrology",
            "Urology",
            "Gastroenterology",
            "Gastrointestinal/Laparoscopic Surgery",
            "Endocrinology",
            "Pulmonology",
            "Dermatology",
            "Psychiatry",
            "ENT (Otorhinolaryngology)",
            "Obstetrics & Gynaecology",
            "Paediatrics",
            "Paediatric Cardiology",
            "Paediatric Nephrology",
            "Fertility/IVF",
            "Ophthalmology",
            "Dentistry",
            "Physiotherapy",
            "Nutrition & Dietetics",
            "Psychology/Counseling",
            "Bariatric Surgery",
            "Hepatobiliary & Pancreatic Surgery",
            "Colorectal Surgery",
            "Rheumatology",
            "Hematology"
    );

    private MedicalCategory() {
    }

    public static boolean isValid(String name) {
        return canonicalize(name) != null;
    }

    /** Exact (case-insensitive) match only -- returns the canonical, correctly-cased name, or null if unrecognized. */
    public static String canonicalize(String name) {
        if (name == null) {
            return null;
        }
        String trimmed = name.trim();
        for (String c : ALL) {
            if (c.equalsIgnoreCase(trimmed)) {
                return c;
            }
        }
        return null;
    }

    /**
     * Matches a patient's typed reply against the numbered menu (see
     * {@link #numberedMenuText()}): either a bare number ("4") or text that
     * exactly matches (case-insensitive) or uniquely appears as a substring
     * of exactly one category name ("cardiology" -> Cardiology; "cardi" is
     * rejected as ambiguous between Cardiology/Cardiac Surgery/Paediatric
     * Cardiology -- the patient should use the number instead).
     */
    public static String match(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String trimmed = input.trim();

        if (trimmed.matches("\\d{1,2}")) {
            int n = Integer.parseInt(trimmed);
            if (n >= 1 && n <= ALL.size()) {
                return ALL.get(n - 1);
            }
            return null;
        }

        String exact = canonicalize(trimmed);
        if (exact != null) {
            return exact;
        }

        String lower = trimmed.toLowerCase();

        // Colloquial / symptom / vernacular matching for rural patients
        if (matchesAny(lower, "fever", "cold", "cough", "bukhar", "khasi", "sardi", "taap", "khokla", "headache", "sar dard", "dokedukhi", "infection", "weakness", "kamjori", "bp", "sugar", "diabetes", "general", "opd", "medicine", "dawa", "bukhar")) {
            return "General Medicine / Internal Medicine";
        }
        if (matchesAny(lower, "bone", "joint", "fracture", "haddi", "haad", "sandhe", "kamar dard", "back pain", "sprain", "ortho", "plaster", "leg pain", "haadache", "sandhi")) {
            return "Orthopaedics";
        }
        if (matchesAny(lower, "women", "maternity", "pregnancy", "pregnant", "delivery", "mahila", "stree", "garbhvati", "periods", "gynae", "gynec", "baalpan")) {
            return "Obstetrics & Gynaecology";
        }
        if (matchesAny(lower, "child", "baby", "infant", "bachha", "bal", "lhaan", "mul", "pediatric", "paediatric", "vaccine", "teeka", "lasikaran")) {
            return "Paediatrics";
        }
        if (matchesAny(lower, "eye", "vision", "aankh", "dola", "netra", "chashma", "motiyabind", "cataract")) {
            return "Ophthalmology";
        }
        if (matchesAny(lower, "tooth", "teeth", "dant", "daad", "dental", "dentist", "root canal")) {
            return "Dentistry";
        }
        if (matchesAny(lower, "heart", "cardiac", "chest pain", "dil", "hriday", "chhati", "attack")) {
            return "Cardiology";
        }
        if (matchesAny(lower, "stomach", "digestion", "pet dard", "acidity", "gas", "ulti", "vomiting", "pott", "liver", "gastro", "diarrhea", "dast", "julab")) {
            return "Gastroenterology";
        }
        if (matchesAny(lower, "skin", "allergy", "rash", "khujli", "twacha", "chamdi", "pimple", "derma", "itch")) {
            return "Dermatology";
        }
        if (matchesAny(lower, "ear", "nose", "throat", "kaan", "naak", "gala", "ent", "tonsil")) {
            return "ENT (Otorhinolaryngology)";
        }

        List<String> substringHits = ALL.stream().filter(c -> c.toLowerCase().contains(lower)).toList();
        return substringHits.size() == 1 ? substringHits.get(0) : null;
    }

    private static boolean matchesAny(String input, String... keywords) {
        for (String kw : keywords) {
            if (input.contains(kw)) {
                return true;
            }
        }
        return false;
    }

    /** "1. General Medicine / Internal Medicine\n2. General Surgery\n..." -- the plain numbered picker sent over WhatsApp. */
    public static String numberedMenuText() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ALL.size(); i++) {
            if (i > 0) {
                sb.append('\n');
            }
            sb.append(i + 1).append(". ").append(ALL.get(i));
        }
        return sb.toString();
    }
}
