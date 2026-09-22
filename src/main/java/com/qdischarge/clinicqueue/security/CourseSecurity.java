package com.qdischarge.clinicqueue.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("courseSecurity")
@RequiredArgsConstructor
@Slf4j
public class CourseSecurity {

    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentUser currentUser;

    /**
     * Enforces fine-grained BOLA/IDOR authorization on clinical courses:
     * - Admins have full administrative oversight.
     * - Patients can only access their own courses (by verified phone number).
     * - Doctors can access a course IF AND ONLY IF:
     *   1) They are the initiating doctor (started_by_doctor_id).
     *   2) There is an active referral to their facility/department.
     *   3) An active ABDM / local consent access grant has been approved for their hospital.
     */
    public boolean canAccessCourse(Authentication auth, int courseId) {
        if (currentUser.isAdmin()) {
            return true;
        }

        if (currentUser.isPatient()) {
            String phone = currentUser.getPatientPhone();
            if (phone == null || phone.isBlank()) {
                return false;
            }
            List<String> phones = getPhoneVariants(phone);
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM courses WHERE id = :courseId AND patient_phone IN (:phones)",
                    Map.of("courseId", courseId, "phones", phones),
                    Integer.class);
            return count != null && count > 0;
        }

        if (currentUser.isDoctor()) {
            Integer doctorId = currentUser.getDoctorId();
            if (doctorId == null) {
                return false;
            }

            Integer hospitalId = null;
            try {
                hospitalId = jdbc.queryForObject(
                        "SELECT hospital_id FROM doctors WHERE id = :doctorId",
                        Map.of("doctorId", doctorId),
                        Integer.class);
            } catch (Exception e) {
                log.warn("Could not find hospital affiliation for doctor {}", doctorId);
            }

            // 1. Initiating doctor check
            Integer creatorCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM courses WHERE id = :courseId AND started_by_doctor_id = :doctorId",
                    Map.of("courseId", courseId, "doctorId", doctorId),
                    Integer.class);
            if (creatorCount != null && creatorCount > 0) {
                return true;
            }

            // 2. Active referral check
            if (hospitalId != null) {
                Integer referralCount = jdbc.queryForObject(
                        """
                        SELECT COUNT(*) FROM course_referrals
                        WHERE course_id = :courseId
                          AND (to_hospital_id = :hospitalId OR referred_doctor_id = :doctorId)
                          AND status IN ('issued', 'booked')
                        """,
                        Map.of("courseId", courseId, "hospitalId", hospitalId, "doctorId", doctorId),
                        Integer.class);
                if (referralCount != null && referralCount > 0) {
                    return true;
                }

                // 3. Active consent / access grant check for this doctor
                Integer grantCount = jdbc.queryForObject(
                        """
                        SELECT COUNT(*) FROM access_grants ag
                        JOIN courses c ON ag.patient_phone = c.patient_phone
                        WHERE c.id = :courseId
                          AND ag.doctor_id = :doctorId
                          AND ag.revoked_at IS NULL
                        """,
                        Map.of("courseId", courseId, "doctorId", doctorId),
                        Integer.class);
                if (grantCount != null && grantCount > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Enforces access control on referrals.
     */
    public boolean canAccessReferral(Authentication auth, int referralId) {
        if (currentUser.isAdmin()) {
            return true;
        }

        if (currentUser.isPatient()) {
            String phone = currentUser.getPatientPhone();
            if (phone == null || phone.isBlank()) {
                return false;
            }
            List<String> phones = getPhoneVariants(phone);
            Integer count = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM course_referrals r
                    JOIN courses c ON r.course_id = c.id
                    WHERE r.id = :refId AND c.patient_phone IN (:phones)
                    """,
                    Map.of("refId", referralId, "phones", phones),
                    Integer.class);
            return count != null && count > 0;
        }

        if (currentUser.isDoctor()) {
            Integer doctorId = currentUser.getDoctorId();
            if (doctorId == null) {
                return false;
            }

            Integer hospitalId = null;
            try {
                hospitalId = jdbc.queryForObject(
                        "SELECT hospital_id FROM doctors WHERE id = :doctorId",
                        Map.of("doctorId", doctorId),
                        Integer.class);
            } catch (Exception ignored) {
            }

            Integer count = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM course_referrals
                    WHERE id = :refId
                      AND (referring_doctor_id = :doctorId
                           OR referred_doctor_id = :doctorId
                           OR from_hospital_id = :hospitalId
                           OR to_hospital_id = :hospitalId)
                    """,
                    Map.of("refId", referralId, "doctorId", doctorId, "hospitalId", hospitalId != null ? hospitalId : -1),
                    Integer.class);
            return count != null && count > 0;
        }

        return false;
    }

    private List<String> getPhoneVariants(String phone) {
        if (phone == null || phone.isBlank()) return List.of();
        String p = phone.trim();
        String digits = p.replaceAll("[^0-9]", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        return List.of(p, digits, "+91" + digits, "91" + digits);
    }
}
