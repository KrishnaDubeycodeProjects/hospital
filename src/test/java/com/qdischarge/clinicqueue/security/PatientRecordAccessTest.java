package com.qdischarge.clinicqueue.security;

import com.qdischarge.clinicqueue.config.AppProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Guards the fixes for "after login I can see other people's receipts":
 * phone-keyed record lookups are pinned to the caller, and the demo OTP /
 * test helpers only ever apply to configured demo numbers.
 */
class PatientRecordAccessTest {

    private final CurrentUser currentUser = new CurrentUser();

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String subject, String role, Integer doctorId) {
        var auth = new UsernamePasswordAuthenticationToken(subject, null, List.of());
        auth.setDetails(new JwtService.DecodedToken(subject, role, doctorId));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void patientAlwaysGetsOwnPhone_evenWhenAskingForSomeoneElse() {
        loginAs("+919111111111", JwtService.PATIENT_ROLE, null);
        assertEquals("+919111111111", currentUser.resolveReadablePhone("+919876543210"));
        assertEquals("+919111111111", currentUser.resolveReadablePhone(null));
    }

    @Test
    void doctorMayLookUpTheNamedPatient() {
        loginAs("+919888877777", JwtService.DOCTOR_ROLE, 7);
        assertEquals("+919876543210", currentUser.resolveReadablePhone(" +919876543210 "));
        assertThrows(IllegalArgumentException.class, () -> currentUser.resolveReadablePhone(""));
    }

    @Test
    void anonymousCallerIsRejected() {
        assertThrows(SecurityException.class, () -> currentUser.resolveReadablePhone("+919876543210"));
    }

    @Test
    void patientCanOnlyReadDocumentsOnTheirOwnNumber() {
        loginAs("+919111111111", JwtService.PATIENT_ROLE, null);
        assertTrue(currentUser.canReadPhone("9111111111"));
        assertFalse(currentUser.canReadPhone("+919876543210"));
        assertFalse(currentUser.canReadPhone(null));
    }

    @Test
    void demoPhonesOnlyCountWhenDemoModeIsOn() {
        AppProperties props = new AppProperties();
        props.setDemoPhones("+919100000099");

        props.setDemoMode(false);
        assertFalse(props.isDemoPhone("+919100000099"), "demo shortcuts must be off by default");

        props.setDemoMode(true);
        assertTrue(props.isDemoPhone("9100000099"));
        assertFalse(props.isDemoPhone("+919876543210"), "a real patient's number is never a demo number");
        assertFalse(props.isDemoPhone(null));
    }
}
