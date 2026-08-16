package com.qdischarge.clinicqueue.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Pulls the JwtAuthFilter-decoded token (subject/role/doctorId) for the
 * current request out of the SecurityContext, so patient- and
 * doctor-scoped controllers can identify "who's calling" (their own phone
 * number, or their doctorId) without re-parsing the Authorization header or
 * doing an extra DB lookup.
 */
@Component
public class CurrentUser {

    /** Null if there's no authenticated caller on this request (public endpoint hit anonymously). */
    public JwtService.DecodedToken get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getDetails() instanceof JwtService.DecodedToken decoded)) {
            return null;
        }
        return decoded;
    }

    /** The calling patient's phone number (JWT subject). Throws if there's no valid ROLE_PATIENT token -- SecurityConfig should already have rejected that request. */
    public String requirePatientPhone() {
        JwtService.DecodedToken decoded = get();
        if (decoded == null || !JwtService.PATIENT_ROLE.equals(decoded.role())) {
            throw new IllegalStateException("No authenticated patient on this request.");
        }
        return decoded.subject();
    }

    /** The calling doctor's id (JWT claim). Throws if there's no valid ROLE_DOCTOR token -- SecurityConfig should already have rejected that request. */
    public int requireDoctorId() {
        JwtService.DecodedToken decoded = get();
        if (decoded == null || !JwtService.DOCTOR_ROLE.equals(decoded.role()) || decoded.doctorId() == null) {
            throw new IllegalStateException("No authenticated doctor on this request.");
        }
        return decoded.doctorId();
    }
}
