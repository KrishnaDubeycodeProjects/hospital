package com.qdischarge.clinicqueue.asha.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class ClinicalValueNormalizerTest {

    @Test
    void affirmativeAcceptsBooleanAndLocalizedStrings() {
        assertEquals(Boolean.TRUE, ClinicalValueNormalizer.affirmative(true));
        assertEquals(Boolean.TRUE, ClinicalValueNormalizer.affirmative("हाँ"));
        assertEquals(Boolean.TRUE, ClinicalValueNormalizer.affirmative("हां"));
        assertEquals(Boolean.TRUE, ClinicalValueNormalizer.affirmative("होय"));
        assertEquals(Boolean.TRUE, ClinicalValueNormalizer.affirmative("Yes"));
        assertEquals(Boolean.TRUE, ClinicalValueNormalizer.affirmative("✓ लगाया गया"));

        assertEquals(Boolean.FALSE, ClinicalValueNormalizer.affirmative(false));
        assertEquals(Boolean.FALSE, ClinicalValueNormalizer.affirmative("नहीं"));
        assertEquals(Boolean.FALSE, ClinicalValueNormalizer.affirmative("नाही"));
        assertEquals(Boolean.FALSE, ClinicalValueNormalizer.affirmative("✕ नहीं लगाया"));
        assertEquals(Boolean.FALSE, ClinicalValueNormalizer.affirmative("Not given"));

        assertNull(ClinicalValueNormalizer.affirmative(null));
        assertNull(ClinicalValueNormalizer.affirmative(""));
        assertNull(ClinicalValueNormalizer.affirmative("Normal"));
    }

    @Test
    void parsesClinicalDatesAndRejectsInvalid() {
        assertEquals(LocalDate.of(2026, 1, 12), ClinicalValueNormalizer.parseDate("12/01/2026"));
        assertEquals(LocalDate.of(2026, 1, 12), ClinicalValueNormalizer.parseDate("2026-01-12"));
        assertEquals(LocalDate.of(2026, 1, 12), ClinicalValueNormalizer.parseDate("2026-01-12T00:00:00Z"));
        assertNull(ClinicalValueNormalizer.parseDate("31/02/2026"));
        assertNull(ClinicalValueNormalizer.parseDate("आज"));
        assertNull(ClinicalValueNormalizer.parseDate(null));
    }

    @Test
    void naegeleRuleMatchesClient() {
        assertEquals(LocalDate.of(2026, 10, 19), ClinicalValueNormalizer.naegeleEdd(LocalDate.of(2026, 1, 12)));
        // 31 May + 9 months clamps to 28 Feb, + 7 days = 7 Mar (same as maternalMath.ts)
        assertEquals(LocalDate.of(2027, 3, 7), ClinicalValueNormalizer.naegeleEdd(LocalDate.of(2026, 5, 31)));
    }
}
