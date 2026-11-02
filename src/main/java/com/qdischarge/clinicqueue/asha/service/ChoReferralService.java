package com.qdischarge.clinicqueue.asha.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Sector-level CHO referral review: physical referral validation, triage and transport sign-off
 * (no teleconsultation).
 *
 * A CHO's sector is the set of workers that CHO registered (asha_workers.anm_phone = CHO phone,
 * which is how the app records the registering officer), plus the workers whose ANM was
 * registered by that CHO. Phones are compared on their last 10 digits so "+91 98765 22222",
 * "+919876522222" and "9876522222" all match.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChoReferralService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SyncService syncService;

    /** Referral task types a CHO validates. */
    static final List<String> REFERRAL_TYPES = List.of("ASHA_TO_CHO_REFERRAL", "REFERRAL_CONFIRMATION", "REFERRAL_MISSED");

    private static final String DIGITS10 = "RIGHT(regexp_replace(COALESCE(%s, ''), '[^0-9]', '', 'g'), 10)";

    private static String d10(String column) {
        return String.format(DIGITS10, column);
    }

    /** Sub-select of 10-digit phones of every worker in the CHO's sector. */
    private static final String SECTOR_PHONES =
            "SELECT " + d10("a.phone") + " FROM clinicqueue.asha_workers a " +
            "WHERE (a.is_active IS NULL OR a.is_active = TRUE) AND (" +
            d10("a.anm_phone") + " = :cho OR " + d10("a.anm_phone") + " IN (" +
            "SELECT " + d10("b.phone") + " FROM clinicqueue.asha_workers b WHERE " + d10("b.anm_phone") + " = :cho))";

    public static String lastTenDigits(String phone) {
        if (phone == null) return "";
        String digits = phone.replaceAll("[^0-9]", "");
        return digits.length() > 10 ? digits.substring(digits.length() - 10) : digits;
    }

    /** Number of workers in the CHO's sector (0 → caller is not a registering CHO). */
    public int sectorSize(String choPhone) {
        Integer n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM (" + SECTOR_PHONES + ") s",
                new MapSqlParameterSource("cho", lastTenDigits(choPhone)), Integer.class);
        return n != null ? n : 0;
    }

    /** True when the ASHA (any phone format) is an active worker in the CHO's sector. */
    public boolean isAshaInSector(String choPhone, String ashaPhone) {
        String asha = lastTenDigits(ashaPhone);
        if (asha.isEmpty() || lastTenDigits(choPhone).isEmpty()) return false;
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM (" + SECTOR_PHONES + ") s(p) WHERE s.p = :asha",
                new MapSqlParameterSource("cho", lastTenDigits(choPhone)).addValue("asha", asha), Integer.class);
        return n != null && n > 0;
    }

    /** True when the ASHA (any phone format) is an active worker assigned to this ANM. */
    public boolean isAshaAssignedToAnm(String anmPhone, String ashaPhone) {
        String asha = lastTenDigits(ashaPhone);
        String anm = lastTenDigits(anmPhone);
        if (asha.isEmpty() || anm.isEmpty()) return false;
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM clinicqueue.asha_workers a WHERE (a.is_active IS NULL OR a.is_active = TRUE) AND "
                        + d10("a.phone") + " = :asha AND " + d10("a.anm_phone") + " = :anm",
                new MapSqlParameterSource("asha", asha).addValue("anm", anm), Integer.class);
        return n != null && n > 0;
    }

    public List<Map<String, Object>> listSectorReferrals(String choPhone, boolean pendingOnly) {
        syncService.ensureSyncSchema();
        String sql = """
            SELECT
                t.id                       AS "id",
                t.offline_id               AS "offlineId",
                t.task_type                AS "taskType",
                t.title                    AS "title",
                t.description              AS "description",
                t.due_date                 AS "dueDate",
                t.status                   AS "status",
                t.created_at               AS "createdAt",
                t.cho_note                 AS "choNote",
                t.cho_approved_at          AS "choApprovedAt",
                t.asha_worker_phone        AS "ashaWorkerPhone",
                a.name                     AS "ashaWorkerName",
                f.head_name                AS "familyHeadName",
                f.house_number             AS "houseNumber",
                f.village_name             AS "villageName",
                fm.id                      AS "memberId",
                fm.name                    AS "patientName",
                COALESCE(NULLIF(fm.phone, ''),
                         CASE WHEN f.primary_phone = '' OR f.primary_phone LIKE 'NOPHONE-%%' THEN NULL ELSE f.primary_phone END)
                                           AS "patientPhone",
                fm.age                     AS "age",
                fm.gender                  AS "gender",
                fm.is_pregnant             AS "isPregnant",
                fm.expected_delivery_date  AS "expectedDeliveryDate",
                fm.has_chronic_condition   AS "hasChronicCondition",
                fm.chronic_condition_type  AS "chronicConditionType"
            FROM clinicqueue.follow_up_tasks t
            LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id
            LEFT JOIN clinicqueue.family_members fm ON t.family_member_id = fm.id
            LEFT JOIN clinicqueue.asha_workers a ON %s = %s
            WHERE t.task_type IN (:types)
              AND %s IN (%s)
              AND (f.is_deleted IS NULL OR f.is_deleted = FALSE)
              AND (fm.is_deleted IS NULL OR fm.is_deleted = FALSE)
            """.formatted(d10("a.phone"), d10("t.asha_worker_phone"), d10("t.asha_worker_phone"), SECTOR_PHONES)
                + (pendingOnly ? " AND t.status NOT IN ('APPROVED_CHO', 'COMPLETED')" : "")
                + " ORDER BY (t.status = 'APPROVED_CHO'), t.due_date ASC NULLS LAST, t.created_at DESC LIMIT 500";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("cho", lastTenDigits(choPhone)).addValue("types", REFERRAL_TYPES));
    }

    /** Workers in the CHO's sector with activity counts (no data from outside the sector). */
    public List<Map<String, Object>> listSectorWorkers(String choPhone) {
        syncService.ensureSyncSchema();
        String w10 = d10("w.phone");
        String sql = "SELECT w.phone AS \"phone\", w.name AS \"name\", w.village_name AS \"villageName\", " +
                "UPPER(COALESCE(w.role, 'ASHA')) AS \"role\", " +
                "(SELECT COUNT(*) FROM clinicqueue.family_units f WHERE " + d10("f.asha_worker_phone") + " = " + w10 +
                "   AND (f.is_deleted IS NULL OR f.is_deleted = FALSE)) AS \"familyCount\", " +
                "(SELECT COUNT(*) FROM clinicqueue.survey_responses s WHERE " + d10("s.asha_worker_phone") + " = " + w10 + ") AS \"surveyCount\", " +
                "(SELECT COUNT(*) FROM clinicqueue.follow_up_tasks t WHERE " + d10("t.asha_worker_phone") + " = " + w10 +
                "   AND t.task_type IN (:types)) AS \"referralCount\", " +
                "(SELECT COUNT(*) FROM clinicqueue.follow_up_tasks t WHERE " + d10("t.asha_worker_phone") + " = " + w10 +
                "   AND t.task_type IN (:types) AND t.status NOT IN ('APPROVED_CHO', 'COMPLETED')) AS \"pendingReferralCount\", " +
                "(SELECT COUNT(*) FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON f.id = m.family_unit_id " +
                "   WHERE " + d10("f.asha_worker_phone") + " = " + w10 + " AND m.is_pregnant = TRUE " +
                "   AND (m.is_deleted IS NULL OR m.is_deleted = FALSE)) AS \"pregnantCount\", " +
                "(SELECT COUNT(*) FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON f.id = m.family_unit_id " +
                "   WHERE " + d10("f.asha_worker_phone") + " = " + w10 + " AND m.has_chronic_condition = TRUE " +
                "   AND (m.is_deleted IS NULL OR m.is_deleted = FALSE)) AS \"ncdCount\", " +
                "(SELECT MAX(s.created_at) FROM clinicqueue.survey_responses s WHERE " + d10("s.asha_worker_phone") + " = " + w10 + ") AS \"lastActive\" " +
                "FROM clinicqueue.asha_workers w WHERE " + w10 + " IN (" + SECTOR_PHONES + ") ORDER BY w.name";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("cho", lastTenDigits(choPhone)).addValue("types", REFERRAL_TYPES));
    }

    public enum ApproveOutcome { APPROVED, ALREADY_APPROVED, NOT_IN_SECTOR }

    /** Validates a referral inside the CHO's sector; idempotent for repeat taps / offline replays. */
    public ApproveOutcome approve(String choPhone, int taskId, String note) {
        syncService.ensureSyncSchema();
        String cho = lastTenDigits(choPhone);
        String trimmedNote = note != null && !note.isBlank() ? note.trim() : null;
        MapSqlParameterSource p = new MapSqlParameterSource("cho", cho)
                .addValue("id", taskId)
                .addValue("types", REFERRAL_TYPES)
                .addValue("choPhone", choPhone)
                .addValue("note", trimmedNote);

        String sectorScope = " AND t.task_type IN (:types) AND " + d10("t.asha_worker_phone") + " IN (" + SECTOR_PHONES + ")";
        List<Integer> updated = jdbcTemplate.query(
                "UPDATE clinicqueue.follow_up_tasks t SET status = 'APPROVED_CHO', cho_approved_by = :choPhone, " +
                "cho_approved_at = NOW(), cho_note = COALESCE(CAST(:note AS text), t.cho_note) " +
                "WHERE t.id = :id AND t.status NOT IN ('APPROVED_CHO', 'COMPLETED')" + sectorScope + " RETURNING t.id",
                p, (rs, rn) -> rs.getInt(1));
        if (!updated.isEmpty()) {
            log.info("CHO {} validated referral task {}", cho, taskId);
            return ApproveOutcome.APPROVED;
        }
        Optional<String> status = jdbcTemplate.query(
                "SELECT t.status FROM clinicqueue.follow_up_tasks t WHERE t.id = :id" + sectorScope,
                p, (rs, rn) -> rs.getString(1)).stream().findFirst();
        return status.isPresent() ? ApproveOutcome.ALREADY_APPROVED : ApproveOutcome.NOT_IN_SECTOR;
    }
}
