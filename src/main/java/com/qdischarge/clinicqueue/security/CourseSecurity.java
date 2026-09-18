package com.qdischarge.clinicqueue.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

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
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM courses WHERE id = :courseId AND patient_phone = :phone",
                    Map.of("courseId", courseId, "phone", phone.trim()),
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

                // 3. Active consent / access grant check
                Integer grantCount = jdbc.queryForObject(
                        """
                        SELECT COUNT(*) FROM access_grants ag
                        JOIN courses c ON ag.patient_phone = c.patient_phone
                        WHERE c.id = :courseId
                          AND ag.hospital_id = :hospitalId
                          AND ag.status = 'approved'
                          AND (ag.expires_at IS NULL OR ag.expires_at > NOW())
                        """,
                        Map.of("courseId", courseId, "hospitalId", hospitalId),
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
            Integer count = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM course_referrals r
                    JOIN courses c ON r.course_id = c.id
                    WHERE r.id = :refId AND c.patient_phone = :phone
                    """,
                    Map.of("refId", referralId, "phone", phone.trim()),
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
}
