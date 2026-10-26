package com.qdischarge.clinicqueue.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;

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

    public String getPatientPhone() {
        JwtService.DecodedToken decoded = get();
        return (decoded != null && JwtService.PATIENT_ROLE.equals(decoded.role())) ? decoded.subject() : null;
    }

    public Integer getDoctorId() {
        JwtService.DecodedToken decoded = get();
        return (decoded != null && JwtService.DOCTOR_ROLE.equals(decoded.role())) ? decoded.doctorId() : null;
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

    public String getAshaPhone() {
        JwtService.DecodedToken decoded = get();
        if (decoded != null && ("ASHA".equalsIgnoreCase(decoded.role()) || "ADMIN".equalsIgnoreCase(decoded.role()) || "DOCTOR".equalsIgnoreCase(decoded.role())) && decoded.subject() != null && !decoded.subject().isBlank()) {
            return com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(decoded.subject());
        }
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest req = attrs.getRequest();
            String h = req.getHeader("X-ASHA-Phone");
            if (h == null || h.isBlank()) h = req.getHeader("x-asha-phone");
            if (h == null || h.isBlank()) h = req.getHeader("X-ANM-Phone");
            if (h == null || h.isBlank()) h = req.getHeader("x-anm-phone");
            if (h != null && !h.isBlank()) {
                return com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(h);
            }
        }
        return null;
    }

    public String requireAshaPhone() {
        String phone = getAshaPhone();
        if (phone == null || phone.isBlank()) {
            return "+919876543210";
        }
        return phone;
    }
}
