package com.qdischarge.clinicqueue.asha.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
     * Returns all referrals and follow-up tasks for the CHO Admin dashboard with full patient details.
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

    /**
     * CHO Admin approves a referral.
     */
    @PostMapping("/referrals/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveReferral(@PathVariable int id) {
        log.info("CHO approving referral task {}", id);
        String sql = "UPDATE clinicqueue.follow_up_tasks SET status = 'APPROVED_CHO', completed_at = NOW() WHERE id = :id";
        jdbcTemplate.update(sql, Map.of("id", id));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("message", "Referral approved successfully by CHO.");
        return ResponseEntity.ok(resp);
    }

    /**
     * CHO Admin records teleconsultation advice and prescriptions.
     */
    @PostMapping("/referrals/{id}/advice")
    public ResponseEntity<Map<String, Object>> recordTeleconsultAdvice(
            @PathVariable int id,
            @RequestBody Map<String, String> body) {
        String advice = body.getOrDefault("advice", "");
        log.info("CHO recording teleconsult advice for task {}: {}", id, advice);

        String sql = """
            UPDATE clinicqueue.follow_up_tasks
            SET description = COALESCE(description, '') || E'\\n[CHO Teleconsult Advice]: ' || :advice,
                status = 'APPROVED_CHO',
                completed_at = NOW()
            WHERE id = :id
        """;
        jdbcTemplate.update(sql, Map.of("id", id, "advice", advice));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("message", "Teleconsult advice recorded successfully.");
        return ResponseEntity.ok(resp);
    }

    /**
     * ASHA Worker refers a patient directly to the CHO Admin.
     */
    @PostMapping("/referrals/from-asha")
    public ResponseEntity<Map<String, Object>> createReferralFromAsha(@RequestBody Map<String, Object> body) {
        log.info("ASHA submitting referral to CHO: {}", body);
        Integer familyUnitId = body.get("familyUnitId") != null ? ((Number) body.get("familyUnitId")).intValue() : 1;
        Integer memberId = body.get("memberId") != null ? ((Number) body.get("memberId")).intValue() : 1;
        String ashaPhone = (String) body.getOrDefault("ashaPhone", "9876543210");
        String reason = (String) body.getOrDefault("reason", "ASHA Field Referral to CHO");
        String vitals = (String) body.getOrDefault("vitals", "");
        String urgency = (String) body.getOrDefault("urgency", "urgent_7d");

        String sql = """
            INSERT INTO clinicqueue.follow_up_tasks
            (family_unit_id, family_member_id, asha_worker_phone, task_type, title, description, due_date, status, created_at)
            VALUES
            (:familyUnitId, :memberId, :ashaPhone, 'ASHA_TO_CHO_REFERRAL', :title, :description, CURRENT_DATE + 7, 'PENDING', NOW())
            RETURNING id
        """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("familyUnitId", familyUnitId)
                .addValue("memberId", memberId)
                .addValue("ashaPhone", ashaPhone)
                .addValue("title", "[ASHA to CHO Referral] " + reason)
                .addValue("description", "Vitals: " + vitals + " • Priority: " + urgency);

        Integer newId = jdbcTemplate.queryForObject(sql, params, Integer.class);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("taskId", newId);
        resp.put("message", "Referral successfully transmitted to CHO Admin.");
        return ResponseEntity.ok(resp);
    }
}
