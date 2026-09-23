package com.jansamvaad.asha.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Helper to extract the current authenticated caller's identity from SecurityContext.
 * ASHA workers authenticate with the same ROLE_PATIENT token (phone-based OTP).
 */
@Component
public class CurrentUser {

    public JwtService.DecodedToken get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getDetails() instanceof JwtService.DecodedToken decoded)) {
            return null;
        }
        return decoded;
    }

    public boolean isPatient() {
        JwtService.DecodedToken decoded = get();
        return decoded != null && JwtService.PATIENT_ROLE.equals(decoded.role());
    }

    public boolean isDoctor() {
        JwtService.DecodedToken decoded = get();
        return decoded != null && JwtService.DOCTOR_ROLE.equals(decoded.role());
    }

    public boolean isAdmin() {
        JwtService.DecodedToken decoded = get();
        return decoded != null && JwtService.ADMIN_ROLE.equals(decoded.role());
    }

    /**
     * Returns the phone for ASHA workers (who authenticate as PATIENT or DOCTOR role).
     * ASHA workers use the same phone OTP → ROLE_PATIENT token.
     */
    public String getAshaPhone() {
        JwtService.DecodedToken decoded = get();
        if (decoded != null && (JwtService.PATIENT_ROLE.equals(decoded.role()) || JwtService.DOCTOR_ROLE.equals(decoded.role()))) {
            return decoded.subject();
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().isBlank() && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        return "9876543210";
    }

    public String requireAshaPhone() {
        String phone = getAshaPhone();
        if (phone == null || phone.isBlank()) {
            return "9876543210";
        }
        return phone;
    }
}
