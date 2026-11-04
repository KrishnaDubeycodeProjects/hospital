package com.qdischarge.clinicqueue.asha.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * System-administrator (ROLE_ADMIN) read-only oversight across all sectors.
 * CHOs use the sector-scoped endpoints in {@link ChoSectorReferralController}.
 */
@RestController
@RequestMapping("/api/cho")
@RequiredArgsConstructor
@Slf4j
public class ChoAnalyticsController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("/analytics")
    public ResponseEntity<List<Map<String, Object>>> getAnalytics() {
        log.info("Fetching CHO analytics");
        String sql = "SELECT a.phone as asha_phone, a.name as asha_name, " +
                     "(SELECT count(*) FROM family_units f WHERE f.asha_worker_phone = a.phone) as family_count, " +
                     "(SELECT count(*) FROM survey_responses s WHERE s.asha_worker_phone = a.phone) as survey_count, " +
                     "(SELECT count(*) FROM follow_up_tasks t WHERE t.asha_worker_phone = a.phone AND t.task_type = 'REFERRAL_MISSED') as referral_missed_count " +
                     "FROM asha_workers a";
        List<Map<String, Object>> analytics = jdbcTemplate.queryForList(sql, Map.of());
        return ResponseEntity.ok(analytics);
    }

    /**
     * All referrals and follow-up tasks across sectors (ADMIN oversight, read-only).
     */
    @GetMapping("/referrals")
    public ResponseEntity<List<Map<String, Object>>> getChoReferrals() {
        log.info("Fetching all referrals for CHO Admin");
        String sql = """
            SELECT
                t.id,
                t.task_type,
                t.title,
                t.description,
                t.due_date,
                t.status,
                t.source_referral_id,
                t.created_at,
                f.head_name as family_head_name,
                f.house_number,
                f.village_name,
                f.primary_phone as family_phone,
                fm.id as member_id,
                fm.name as patient_name,
                COALESCE(fm.phone, f.primary_phone) as patient_phone,
                fm.abha_number,
                fm.age,
                fm.gender,
                fm.is_pregnant,
                fm.has_chronic_condition,
                fm.chronic_condition_type,
                a.name as asha_worker_name,
                a.phone as asha_worker_phone,
                cr.reason as hospital_referral_reason,
                cr.priority_tier,
                cr.valid_until,
                h.name as target_hospital_name,
                d.name as referring_doctor_name
            FROM clinicqueue.follow_up_tasks t
            LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id
            LEFT JOIN clinicqueue.family_members fm ON t.family_member_id = fm.id
            LEFT JOIN clinicqueue.asha_workers a ON t.asha_worker_phone = a.phone
            LEFT JOIN clinicqueue.course_referrals cr ON t.source_referral_id = cr.id
            LEFT JOIN clinicqueue.hospitals h ON cr.to_hospital_id = h.id
            LEFT JOIN clinicqueue.doctors d ON cr.referring_doctor_id = d.id
            ORDER BY t.created_at DESC
        """;
        List<Map<String, Object>> list = jdbcTemplate.queryForList(sql, Map.of());
        return ResponseEntity.ok(list);
    }

    // Removed (physical referral model, no teleconsultation):
    //  - POST /referrals/{id}/approve  -> unscoped; CHOs validate via POST /api/asha/referrals/{id}/approve
    //  - POST /referrals/{id}/advice   -> teleconsultation advice (out of scope)
    //  - POST /referrals/from-asha     -> defaulted to family/member 1 and phone 9876543210;
    //                                     ASHA referrals arrive through the offline sync outbox
}
