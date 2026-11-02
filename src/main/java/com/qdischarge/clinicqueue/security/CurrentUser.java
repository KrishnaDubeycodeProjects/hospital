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

    /**
     * Phone of the calling field worker (normalized +91XXXXXXXXXX), or null.
     * <ul>
     *   <li>ASHA / ANM / CHO token: the OTP-verified JWT subject (the SecurityContext name).</li>
     *   <li>ADMIN token: may act on a worker's records via X-ASHA-Phone / X-ANM-Phone (web admin).</li>
     *   <li>DOCTOR token: its own subject (legacy behaviour).</li>
     *   <li>Header-only identity exists only when app.allow-header-identity=true (local dev);
     *       JwtAuthFilter then authenticates the request itself.</li>
     * </ul>
     * PATIENT tokens and anonymous callers get null: an unverified X-ASHA-Phone is never trusted.
     */
    public String getAshaPhone() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        JwtService.DecodedToken decoded = get();
        if (auth == null || decoded == null) return null;
        String role = decoded.role();
        if (JwtService.isWorkerRole(role)) {
            return blankToNull(com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(auth.getName()));
        }
        if (JwtService.ADMIN_ROLE.equals(role)) {
            return blankToNull(adminSelectedWorkerPhone());
        }
        if (JwtService.DOCTOR_ROLE.equals(role) && decoded.subject() != null) {
            return blankToNull(com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(decoded.subject()));
        }
        return null;
    }

    /** Phone of the calling CHO (verified CHO token), or the worker selected by an ADMIN; else null. */
    public String getChoPhone() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        JwtService.DecodedToken decoded = get();
        if (auth == null || decoded == null) return null;
        if (JwtService.CHO_ROLE.equals(decoded.role())) {
            return blankToNull(com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(auth.getName()));
        }
        if (JwtService.ADMIN_ROLE.equals(decoded.role())) {
            return blankToNull(adminSelectedWorkerPhone());
        }
        return null;
    }

    /** Verified field-worker phone; 401 when absent (no more default-phone fallback). */
    public String requireAshaPhone() {
        String phone = getAshaPhone();
        if (phone == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "Verified field-worker identity required");
        }
        return phone;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private String adminSelectedWorkerPhone() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) return null;
        HttpServletRequest req = attrs.getRequest();
        String h = req.getHeader("X-ASHA-Phone");
        if (h == null || h.isBlank()) h = req.getHeader("X-ANM-Phone");
        return h == null || h.isBlank() ? null : com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(h);
    }
}
