package com.qdischarge.clinicqueue.asha.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.asha.dto.FamilyDetailDto;
import com.qdischarge.clinicqueue.asha.dto.FollowUpTaskDto;
import com.qdischarge.clinicqueue.asha.dto.MemberDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyResponseDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyTemplateDto;
import com.qdischarge.clinicqueue.asha.dto.SyncDownloadResponse;
import com.qdischarge.clinicqueue.asha.dto.SyncRecordResult;
import com.qdischarge.clinicqueue.asha.dto.SyncUploadRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Offline outbox sync for the ASHA app.
 *
 * <h2>Sync contract v2</h2>
 * Every uploaded record carries the client's {@code outboxId} and {@code clientUuid}. Records are
 * bound to server rows by {@code client_uuid} (families, members, meetings) or {@code offline_id}
 * (surveys, follow-ups) — never by guessing. References may be a client UUID or a numeric server
 * id, and every lookup is scoped to the authenticated ASHA's own records. The response contains a
 * per-record {@link SyncRecordResult} so the client can retire accepted items individually.
 *
 * Processing order is families → members → surveys → follow-ups → meetings → deletes, so a
 * record created and deleted within one batch ends up deleted.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SurveyService surveyService;

    public static final int CONTRACT_VERSION = 2;

    /**
     * Placeholder written by an earlier v2 build for families without a phone (when primary_phone
     * was globally UNIQUE). Phone-less families are now stored as '' — this prefix is only
     * recognised so such rows still download as "no phone".
     */
    static final String NO_PHONE_PREFIX = "NOPHONE-";
    /** Placeholder older app builds substituted for a missing phone; never a real number. */
    private static final String LEGACY_PLACEHOLDER_DIGITS = "919876500000";

    private static final Pattern SERVER_ID = Pattern.compile("^\\d{1,9}$");
    private static final Pattern INT_LIKE = Pattern.compile("^\\d{1,9}(\\.0+)?$");
    private static final Set<String> CATEGORIES = Set.of("PREGNANCY", "CHILD", "DISEASE", "GENERAL");

    private static final String PHONE_MATCH = "(asha_worker_phone = :ashaPhone OR asha_worker_phone = :rawPhone)";
    private static final String F_PHONE_MATCH = "(f.asha_worker_phone = :ashaPhone OR f.asha_worker_phone = :rawPhone)";
    private static final String NOT_DELETED = "(is_deleted = FALSE OR is_deleted IS NULL)";

    private final AtomicBoolean syncSchemaReady = new AtomicBoolean(false);

    // ------------------------------------------------------------------------------------------
    // Schema (idempotent; also in schema.sql, but SchemaInitRunner is skipped on AWS Lambda)
    // ------------------------------------------------------------------------------------------

    public void ensureSyncSchema() {
        if (syncSchemaReady.get()) return;
        String[] ddl = {
            "ALTER TABLE clinicqueue.family_units ADD COLUMN IF NOT EXISTS client_uuid VARCHAR(64)",
            "ALTER TABLE clinicqueue.family_members ADD COLUMN IF NOT EXISTS client_uuid VARCHAR(64)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_fu_client_uuid ON clinicqueue.family_units (client_uuid) WHERE client_uuid IS NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_fm_client_uuid ON clinicqueue.family_members (client_uuid) WHERE client_uuid IS NOT NULL",
            "CREATE TABLE IF NOT EXISTS clinicqueue.asha_meetings (" +
                "id SERIAL PRIMARY KEY, client_uuid VARCHAR(64) NOT NULL UNIQUE, asha_worker_phone VARCHAR(50) NOT NULL, " +
                "meeting_date DATE, payload JSONB NOT NULL, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE INDEX IF NOT EXISTS idx_am_asha ON clinicqueue.asha_meetings (asha_worker_phone)",
            // Shared household phones: ASHA-registered families may share (or omit) a contact number,
            // so the global UNIQUE(primary_phone) is replaced by uniqueness for hospital family
            // accounts only (rows with no asha_worker_phone).
            "DO $$ DECLARE c text; BEGIN " +
                "SELECT con.conname INTO c FROM pg_constraint con " +
                "JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey) " +
                "WHERE con.conrelid = 'clinicqueue.family_units'::regclass AND con.contype = 'u' " +
                "AND array_length(con.conkey, 1) = 1 AND att.attname = 'primary_phone' LIMIT 1; " +
                "IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE clinicqueue.family_units DROP CONSTRAINT %I', c); END IF; " +
                "END $$",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_fu_phone_hospital ON clinicqueue.family_units (primary_phone) WHERE asha_worker_phone IS NULL",
            // CHO sector referral validation (who approved, when, transport/triage note)
            "ALTER TABLE clinicqueue.follow_up_tasks ADD COLUMN IF NOT EXISTS cho_approved_by VARCHAR(50)",
            "ALTER TABLE clinicqueue.follow_up_tasks ADD COLUMN IF NOT EXISTS cho_approved_at TIMESTAMP",
            "ALTER TABLE clinicqueue.follow_up_tasks ADD COLUMN IF NOT EXISTS cho_note TEXT"
        };
        boolean allOk = true;
        for (String statement : ddl) {
            try {
                jdbcTemplate.getJdbcTemplate().execute(statement);
            } catch (Exception e) {
                allOk = false;
                log.warn("Sync schema statement failed: {} -> {}", statement, e.getMessage());
            }
        }
        if (allOk) syncSchemaReady.set(true);
    }

    // ------------------------------------------------------------------------------------------
    // Value helpers
    // ------------------------------------------------------------------------------------------

    private static String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /** Strict integer parse — no digit scraping. "12" / 12 / "12.0" → 12; "f012-…" → null. */
    private static Integer strictInt(Object o) {
        if (o instanceof Number n) return n.intValue();
        String s = str(o);
        if (s == null || !INT_LIKE.matcher(s).matches()) return null;
        return Integer.parseInt(s.replaceAll("\\.0+$", ""));
    }

    private static boolean isServerId(String ref) {
        return ref != null && SERVER_ID.matcher(ref).matches();
    }

    private static String firstNonNull(String a, String b) {
        return a != null ? a : b;
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static String isoDate(Object o) {
        LocalDate d = ClinicalValueNormalizer.parseDate(o);
        return d != null ? d.toString() : null;
    }

    private static String rawPhoneOf(String ashaPhone) {
        return ashaPhone != null ? ashaPhone.replace("+91", "").trim() : "";
    }

    private static MapSqlParameterSource scoped(String ashaPhone, String rawPhone) {
        return new MapSqlParameterSource("ashaPhone", ashaPhone).addValue("rawPhone", rawPhone);
    }

    private List<Integer> ids(String sql, MapSqlParameterSource params) {
        return jdbcTemplate.query(sql, params, (rs, rn) -> rs.getInt(1));
    }

    private static <T> List<T> nz(List<T> list) {
        return list != null ? list : Collections.emptyList();
    }

    /** Binds a client UUID to a legacy row that has none yet (table name is a fixed literal). */
    private void bindClientUuid(String table, int id, String clientUuid) {
        try {
            jdbcTemplate.update("UPDATE clinicqueue." + table + " SET client_uuid = :uuid WHERE id = :id AND client_uuid IS NULL",
                    new MapSqlParameterSource("uuid", clientUuid).addValue("id", id));
        } catch (DuplicateKeyException e) {
            log.warn("client_uuid {} already bound elsewhere in {}", clientUuid, table);
        }
    }

    // ------------------------------------------------------------------------------------------
    // Reference resolution (always scoped to the authenticated ASHA)
    // ------------------------------------------------------------------------------------------

    /**
     * Resolves a family reference: numeric → server id, otherwise → client_uuid. When not found
     * and a sequential number hint is given, a legacy row (uploaded before v2, no client_uuid)
     * with that number is adopted and bound to the UUID. Returns null when unresolvable — callers
     * reject; there is no "first family" fallback.
     */
    Integer resolveFamilyId(String ref, Integer seqHint, String ashaPhone, String rawPhone) {
        if (ref != null) {
            MapSqlParameterSource p = scoped(ashaPhone, rawPhone);
            List<Integer> found = isServerId(ref)
                    ? ids("SELECT id FROM clinicqueue.family_units WHERE id = :id AND " + PHONE_MATCH, p.addValue("id", Integer.parseInt(ref)))
                    : ids("SELECT id FROM clinicqueue.family_units WHERE client_uuid = :uuid AND " + PHONE_MATCH, p.addValue("uuid", ref));
            if (!found.isEmpty()) return found.get(0);
        }
        if (seqHint != null) {
            boolean bindUuid = ref != null && !isServerId(ref);
            List<Integer> found = ids("SELECT id FROM clinicqueue.family_units WHERE sequential_number = :seq AND " + PHONE_MATCH +
                            " AND " + NOT_DELETED + (bindUuid ? " AND client_uuid IS NULL" : "") + " ORDER BY id LIMIT 1",
                    scoped(ashaPhone, rawPhone).addValue("seq", seqHint));
            if (!found.isEmpty()) {
                if (bindUuid) bindClientUuid("family_units", found.get(0), ref);
                return found.get(0);
            }
        }
        return null;
    }

    /**
     * Resolves a member reference (numeric server id or client_uuid) within the ASHA's families.
     * A legacy member (no client_uuid) is adopted by exact name within the resolved family.
     */
    Integer resolveMemberId(String ref, Integer familyId, String nameHint, String ashaPhone, String rawPhone) {
        if (ref != null) {
            MapSqlParameterSource p = scoped(ashaPhone, rawPhone);
            String where = isServerId(ref) ? "m.id = :ref" : "m.client_uuid = :ref";
            p.addValue("ref", isServerId(ref) ? Integer.parseInt(ref) : ref);
            List<Integer> found = ids("SELECT m.id FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON f.id = m.family_unit_id " +
                    "WHERE " + where + " AND " + F_PHONE_MATCH, p);
            if (!found.isEmpty()) return found.get(0);
        }
        if (familyId != null && nameHint != null) {
            boolean bindUuid = ref != null && !isServerId(ref);
            List<Integer> found = ids("SELECT id FROM clinicqueue.family_members WHERE family_unit_id = :fid AND name = :name AND " + NOT_DELETED +
                            (bindUuid ? " AND client_uuid IS NULL" : "") + " ORDER BY id LIMIT 1",
                    new MapSqlParameterSource("fid", familyId).addValue("name", nameHint));
            if (!found.isEmpty()) {
                if (bindUuid) bindClientUuid("family_members", found.get(0), ref);
                return found.get(0);
            }
        }
        return null;
    }

    private Integer familyOfMember(int memberId) {
        List<Integer> found = ids("SELECT family_unit_id FROM clinicqueue.family_members WHERE id = :id", new MapSqlParameterSource("id", memberId));
        return found.isEmpty() ? null : found.get(0);
    }

    private Integer resolveTemplateId(String categoryCode, Integer givenId) {
        List<Integer> found = ids("SELECT id FROM clinicqueue.survey_templates WHERE category_code = :code AND is_active = TRUE ORDER BY version DESC LIMIT 1",
                new MapSqlParameterSource("code", categoryCode));
        if (!found.isEmpty()) return found.get(0);
        if (givenId != null) {
            found = ids("SELECT id FROM clinicqueue.survey_templates WHERE id = :id", new MapSqlParameterSource("id", givenId));
            if (!found.isEmpty()) return found.get(0);
        }
        return null;
    }

    // ------------------------------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------------------------------

    public Map<String, Object> upload(String ashaPhone, SyncUploadRequest request) {
        ensureSyncSchema();
        String rawPhone = rawPhoneOf(ashaPhone);
        List<SyncRecordResult> results = new ArrayList<>();

        for (Map<String, Object> rec : nz(request.getFamilies()))
            results.add(guarded("FAMILY", rec, () -> upsertFamily(rec, ashaPhone, rawPhone)));
        for (Map<String, Object> rec : nz(request.getMembers()))
            results.add(guarded("MEMBER", rec, () -> upsertMember(rec, ashaPhone, rawPhone)));
        for (Map<String, Object> rec : nz(request.getSurveys()))
            results.add(guarded("SURVEY", rec, () -> upsertSurvey(rec, ashaPhone, rawPhone)));
        for (Map<String, Object> rec : nz(request.getFollowUps()))
            results.add(guarded("FOLLOW_UP", rec, () -> upsertFollowUp(rec, ashaPhone, rawPhone)));
        for (Map<String, Object> rec : nz(request.getMeetings()))
            results.add(guarded("MEETING", rec, () -> upsertMeeting(rec, ashaPhone)));
        for (Map<String, Object> rec : nz(request.getDeletedFamilies()))
            results.add(guarded("DELETE_FAMILY", rec, () -> deleteFamily(rec, ashaPhone, rawPhone)));
        for (Map<String, Object> rec : nz(request.getDeletedMembers()))
            results.add(guarded("DELETE_MEMBER", rec, () -> deleteMember(rec, ashaPhone, rawPhone)));

        // Legacy v1 tombstone lists (older app builds) — now scoped to the caller's own records.
        for (Object legacy : nz(request.getDeletedFamilyIds())) {
            Integer id = strictInt(legacy);
            if (id == null) continue;
            MapSqlParameterSource p = scoped(ashaPhone, rawPhone).addValue("id", id);
            List<Integer> fams = ids("SELECT id FROM clinicqueue.family_units WHERE (id = :id OR sequential_number = :id) AND " + PHONE_MATCH, p);
            for (Integer famId : fams) softDeleteFamily(famId);
            results.add(SyncRecordResult.accepted(null, String.valueOf(id), "DELETE_FAMILY", fams.isEmpty() ? null : fams.get(0),
                    fams.isEmpty() ? "NOT_ON_SERVER" : null));
        }
        for (Object legacy : nz(request.getDeletedMemberIds())) {
            Integer id = strictInt(legacy);
            if (id == null) continue;
            Integer memId = resolveMemberId(String.valueOf(id), null, null, ashaPhone, rawPhone);
            if (memId != null) softDeleteMember(memId);
            results.add(SyncRecordResult.accepted(null, String.valueOf(id), "DELETE_MEMBER", memId, memId == null ? "NOT_ON_SERVER" : null));
        }

        long accepted = results.stream().filter(r -> SyncRecordResult.ACCEPTED.equals(r.status())).count();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("contractVersion", CONTRACT_VERSION);
        response.put("accepted", accepted);
        response.put("rejected", results.size() - accepted);
        response.put("results", results);
        return response;
    }

    /** Runs one record in isolation (autocommit) so a bad record never sinks the batch. */
    private SyncRecordResult guarded(String entity, Map<String, Object> rec, Supplier<SyncRecordResult> work) {
        String outboxId = str(rec.get("outboxId"));
        String clientUuid = firstNonNull(str(rec.get("clientUuid")), str(rec.get("offlineId")));
        try {
            return work.get();
        } catch (DuplicateKeyException e) {
            log.warn("Sync {} {} rejected: duplicate key ({})", entity, clientUuid, e.getMostSpecificCause().getMessage());
            return SyncRecordResult.rejected(outboxId, clientUuid, entity, "DUPLICATE", false);
        } catch (DataIntegrityViolationException e) {
            log.warn("Sync {} {} rejected: invalid data ({})", entity, clientUuid, e.getMostSpecificCause().getMessage());
            return SyncRecordResult.rejected(outboxId, clientUuid, entity, "INVALID_DATA", false);
        } catch (Exception e) {
            log.error("Sync {} {} failed", entity, clientUuid, e);
            return SyncRecordResult.rejected(outboxId, clientUuid, entity, "SERVER_ERROR", true);
        }
    }

    private SyncRecordResult upsertFamily(Map<String, Object> rec, String ashaPhone, String rawPhone) {
        String outboxId = str(rec.get("outboxId"));
        String uuid = str(rec.get("clientUuid"));
        Integer seq = strictInt(rec.get("sequentialNumber"));
        Integer interval = strictInt(rec.get("visitIntervalDays"));
        String nextVisit = isoDate(rec.get("nextVisitDate"));
        String headName = truncate(str(rec.get("headName")), 100);
        String village = truncate(str(rec.get("villageName")), 200);
        String house = truncate(str(rec.get("houseNumber")), 50);
        String phone = str(rec.get("primaryPhone"));
        if (phone != null && phone.replaceAll("[^0-9]", "").equals(LEGACY_PLACEHOLDER_DIGITS)) phone = null;

        Integer existing = (uuid != null || seq != null) ? resolveFamilyId(uuid, seq, ashaPhone, rawPhone) : null;

        if (existing != null) {
            MapSqlParameterSource p = new MapSqlParameterSource("id", existing)
                    .addValue("headName", headName).addValue("village", village).addValue("house", house)
                    .addValue("seq", seq).addValue("interval", interval).addValue("nextVisit", nextVisit);
            jdbcTemplate.update("UPDATE clinicqueue.family_units SET " +
                    "head_name = COALESCE(:headName, head_name), village_name = COALESCE(:village, village_name), " +
                    "house_number = COALESCE(:house, house_number), sequential_number = COALESCE(:seq, sequential_number), " +
                    "visit_interval_days = COALESCE(:interval, visit_interval_days), " +
                    "next_visit_date = COALESCE(CAST(:nextVisit AS date), next_visit_date), " +
                    "last_visited_at = NOW(), updated_at = NOW() WHERE id = :id", p);
            String reason = null;
            if (phone != null) {
                try {
                    jdbcTemplate.update("UPDATE clinicqueue.family_units SET primary_phone = :phone WHERE id = :id",
                            new MapSqlParameterSource("phone", truncate(phone, 50)).addValue("id", existing));
                } catch (DuplicateKeyException e) {
                    reason = "PHONE_IN_USE"; // record saved; phone kept as before
                }
            }
            return SyncRecordResult.accepted(outboxId, uuid, "FAMILY", existing, reason);
        }

        if (headName == null) return SyncRecordResult.rejected(outboxId, uuid, "FAMILY", "MISSING_HEAD_NAME", false);
        // Phone is optional and may be shared by several households (members inherit the head's phone).
        String storedPhone = phone != null ? truncate(phone, 50) : "";
        try {
            Integer id = jdbcTemplate.queryForObject(
                    "INSERT INTO clinicqueue.family_units (primary_phone, head_name, village_name, house_number, sequential_number, " +
                    "visit_interval_days, next_visit_date, asha_worker_phone, client_uuid, is_deleted, created_at, updated_at) " +
                    "VALUES (:phone, :headName, :village, :house, :seq, :interval, CAST(:nextVisit AS date), :ashaPhone, :uuid, FALSE, NOW(), NOW()) RETURNING id",
                    new MapSqlParameterSource("phone", storedPhone).addValue("headName", headName).addValue("village", village)
                            .addValue("house", house).addValue("seq", seq).addValue("interval", interval)
                            .addValue("nextVisit", nextVisit).addValue("ashaPhone", ashaPhone).addValue("uuid", uuid),
                    Integer.class);
            return SyncRecordResult.accepted(outboxId, uuid, "FAMILY", id, null);
        } catch (DuplicateKeyException e) {
            // primary_phone is globally UNIQUE (shared with hospital family accounts).
            return SyncRecordResult.rejected(outboxId, uuid, "FAMILY", "PHONE_IN_USE", false);
        }
    }

    private SyncRecordResult upsertMember(Map<String, Object> rec, String ashaPhone, String rawPhone) {
        String outboxId = str(rec.get("outboxId"));
        String uuid = str(rec.get("clientUuid"));
        String famRef = firstNonNull(str(rec.get("familyClientUuid")), str(rec.get("familyUnitId")));
        Integer famId = resolveFamilyId(famRef, strictInt(rec.get("familySequentialNumber")), ashaPhone, rawPhone);
        if (famId == null) return SyncRecordResult.rejected(outboxId, uuid, "MEMBER", "FAMILY_NOT_FOUND", true);

        String name = truncate(str(rec.get("name")), 100);
        String relationship = truncate(str(rec.get("relationship")), 50);
        if (name == null) return SyncRecordResult.rejected(outboxId, uuid, "MEMBER", "MISSING_NAME", false);
        if (relationship == null) return SyncRecordResult.rejected(outboxId, uuid, "MEMBER", "MISSING_RELATIONSHIP", false);

        MapSqlParameterSource p = new MapSqlParameterSource("fid", famId)
                .addValue("uuid", uuid)
                .addValue("name", name)
                .addValue("rel", relationship)
                .addValue("dob", isoDate(rec.get("dob")))
                .addValue("age", strictInt(rec.get("age")))
                .addValue("gender", truncate(str(rec.get("gender")), 10))
                .addValue("phone", truncate(str(rec.get("phone")), 50))
                .addValue("preg", ClinicalValueNormalizer.affirmative(rec.get("isPregnant")))
                .addValue("edd", isoDate(rec.get("expectedDeliveryDate")))
                .addValue("chronic", ClinicalValueNormalizer.affirmative(rec.get("hasChronicCondition")))
                .addValue("ctype", truncate(str(rec.get("chronicConditionType")), 100));

        Integer existing = uuid != null ? resolveMemberId(uuid, famId, name, ashaPhone, rawPhone) : null;
        if (existing != null) {
            jdbcTemplate.update("UPDATE clinicqueue.family_members SET family_unit_id = :fid, name = :name, relationship = :rel, " +
                    "dob = COALESCE(CAST(:dob AS date), dob), age = COALESCE(:age, age), gender = COALESCE(:gender, gender), " +
                    "phone = COALESCE(:phone, phone), is_pregnant = COALESCE(CAST(:preg AS boolean), is_pregnant), " +
                    "expected_delivery_date = COALESCE(CAST(:edd AS date), expected_delivery_date), " +
                    "has_chronic_condition = COALESCE(CAST(:chronic AS boolean), has_chronic_condition), " +
                    "chronic_condition_type = COALESCE(:ctype, chronic_condition_type), updated_at = NOW() WHERE id = :id",
                    p.addValue("id", existing));
            return SyncRecordResult.accepted(outboxId, uuid, "MEMBER", existing, null);
        }

        Integer id = jdbcTemplate.queryForObject(
                "INSERT INTO clinicqueue.family_members (family_unit_id, client_uuid, name, dob, age, gender, relationship, phone, " +
                "is_pregnant, expected_delivery_date, has_chronic_condition, chronic_condition_type, is_deleted, created_at, updated_at) " +
                "VALUES (:fid, :uuid, :name, CAST(:dob AS date), :age, :gender, :rel, :phone, CAST(:preg AS boolean), CAST(:edd AS date), " +
                "CAST(:chronic AS boolean), :ctype, FALSE, NOW(), NOW()) " +
                "ON CONFLICT (family_unit_id, name, relationship) DO UPDATE SET " +
                "client_uuid = COALESCE(clinicqueue.family_members.client_uuid, EXCLUDED.client_uuid), " +
                "dob = COALESCE(EXCLUDED.dob, clinicqueue.family_members.dob), " +
                "age = COALESCE(EXCLUDED.age, clinicqueue.family_members.age), " +
                "gender = COALESCE(EXCLUDED.gender, clinicqueue.family_members.gender), " +
                "phone = COALESCE(EXCLUDED.phone, clinicqueue.family_members.phone), " +
                "is_pregnant = COALESCE(EXCLUDED.is_pregnant, clinicqueue.family_members.is_pregnant), " +
                "expected_delivery_date = COALESCE(EXCLUDED.expected_delivery_date, clinicqueue.family_members.expected_delivery_date), " +
                "has_chronic_condition = COALESCE(EXCLUDED.has_chronic_condition, clinicqueue.family_members.has_chronic_condition), " +
                "chronic_condition_type = COALESCE(EXCLUDED.chronic_condition_type, clinicqueue.family_members.chronic_condition_type), " +
                "is_deleted = FALSE, updated_at = NOW() RETURNING id",
                p, Integer.class);
        return SyncRecordResult.accepted(outboxId, uuid, "MEMBER", id, null);
    }

    @SuppressWarnings("unchecked")
    private SyncRecordResult upsertSurvey(Map<String, Object> rec, String ashaPhone, String rawPhone) {
        String outboxId = str(rec.get("outboxId"));
        String offlineId = firstNonNull(str(rec.get("offlineId")), str(rec.get("clientUuid")));
        if (offlineId == null) return SyncRecordResult.rejected(outboxId, null, "SURVEY", "MISSING_ID", false);

        Integer famId = resolveFamilyId(firstNonNull(str(rec.get("familyClientUuid")), str(rec.get("familyUnitId"))),
                strictInt(rec.get("familySequentialNumber")), ashaPhone, rawPhone);
        if (famId == null) return SyncRecordResult.rejected(outboxId, offlineId, "SURVEY", "FAMILY_NOT_FOUND", true);

        Integer memId = resolveMemberId(firstNonNull(str(rec.get("memberClientUuid")), str(rec.get("familyMemberId"))),
                famId, str(rec.get("memberName")), ashaPhone, rawPhone);
        if (memId == null) return SyncRecordResult.rejected(outboxId, offlineId, "SURVEY", "MEMBER_NOT_FOUND", true);
        Integer memberFamily = familyOfMember(memId);
        if (memberFamily != null) famId = memberFamily;

        String code = str(rec.get("categoryCode"));
        code = code != null && CATEGORIES.contains(code.toUpperCase()) ? code.toUpperCase() : "GENERAL";
        Integer templateId = resolveTemplateId(code, strictInt(rec.get("templateId")));
        if (templateId == null) return SyncRecordResult.rejected(outboxId, offlineId, "SURVEY", "TEMPLATE_NOT_FOUND", false);

        Map<String, Object> answers = rec.get("answers") instanceof Map<?, ?> m
                ? new HashMap<>((Map<String, Object>) m) : new HashMap<>();
        if (answers.containsKey("isPregnant")) {
            Boolean preg = ClinicalValueNormalizer.affirmative(answers.get("isPregnant"));
            if (preg != null) answers.put("isPregnant", preg);
        }

        SurveyResponseDto dto = new SurveyResponseDto();
        dto.setFamilyUnitId(famId);
        dto.setFamilyMemberId(memId);
        dto.setTemplateId(templateId);
        dto.setCategoryCode(code);
        dto.setAshaWorkerPhone(ashaPhone);
        dto.setAnswers(answers);
        dto.setOfflineId(offlineId);
        SurveyResponseDto saved = surveyService.submitResponse(dto);
        return SyncRecordResult.accepted(outboxId, offlineId, "SURVEY", saved != null ? saved.getId() : null, null);
    }

    private SyncRecordResult upsertFollowUp(Map<String, Object> rec, String ashaPhone, String rawPhone) {
        String outboxId = str(rec.get("outboxId"));
        String offlineId = firstNonNull(str(rec.get("offlineId")), str(rec.get("clientUuid")));
        if (offlineId == null) return SyncRecordResult.rejected(outboxId, null, "FOLLOW_UP", "MISSING_ID", false);
        String status = truncate(firstNonNull(str(rec.get("status")), "PENDING").toUpperCase(), 20);
        String note = str(rec.get("note"));

        // 1. Status change on a task this ASHA already owns (completion, CHO approval note).
        List<Integer> updated = ids("UPDATE clinicqueue.follow_up_tasks SET status = :status, " +
                "completed_at = CASE WHEN :status = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE NULL END, " +
                "description = CASE WHEN CAST(:note AS text) IS NULL THEN description " +
                "ELSE COALESCE(description || E'\\n', '') || CAST(:note AS text) END " +
                "WHERE offline_id = :oid AND " + PHONE_MATCH + " RETURNING id",
                scoped(ashaPhone, rawPhone).addValue("status", status).addValue("note", note).addValue("oid", offlineId));
        if (!updated.isEmpty()) return SyncRecordResult.accepted(outboxId, offlineId, "FOLLOW_UP", updated.get(0), null);

        // 2. New task — must bind to a real family member of this ASHA.
        Integer famId = resolveFamilyId(firstNonNull(str(rec.get("familyClientUuid")), str(rec.get("familyUnitId"))),
                strictInt(rec.get("familySequentialNumber")), ashaPhone, rawPhone);
        if (famId == null) return SyncRecordResult.rejected(outboxId, offlineId, "FOLLOW_UP", "FAMILY_NOT_FOUND", true);
        Integer memId = resolveMemberId(firstNonNull(str(rec.get("memberClientUuid")), str(rec.get("familyMemberId"))),
                famId, str(rec.get("memberName")), ashaPhone, rawPhone);
        if (memId == null) return SyncRecordResult.rejected(outboxId, offlineId, "FOLLOW_UP", "MEMBER_NOT_FOUND", true);

        String taskType = truncate(firstNonNull(str(rec.get("taskType")), "FOLLOW_UP"), 50);
        String title = truncate(firstNonNull(str(rec.get("title")), taskType), 200);
        String description = str(rec.get("description"));
        if (note != null) description = description != null ? description + "\n" + note : note;
        String dueDate = firstNonNull(isoDate(rec.get("dueDate")), LocalDate.now().toString());

        List<Integer> inserted = ids("INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, " +
                "title, description, due_date, status, completed_at, offline_id, created_at) VALUES (:fid, :mid, :ashaPhone, :taskType, :title, " +
                ":description, CAST(:dueDate AS date), :status, CASE WHEN :status = 'COMPLETED' THEN NOW() ELSE NULL END, :oid, NOW()) " +
                "ON CONFLICT (offline_id) DO NOTHING RETURNING id",
                new MapSqlParameterSource("fid", famId).addValue("mid", memId).addValue("ashaPhone", ashaPhone)
                        .addValue("taskType", taskType).addValue("title", title).addValue("description", description)
                        .addValue("dueDate", dueDate).addValue("status", status).addValue("oid", offlineId));
        if (inserted.isEmpty()) {
            // offline_id exists but belongs to another worker — never overwrite it.
            return SyncRecordResult.rejected(outboxId, offlineId, "FOLLOW_UP", "OWNED_BY_OTHER_WORKER", false);
        }
        return SyncRecordResult.accepted(outboxId, offlineId, "FOLLOW_UP", inserted.get(0), null);
    }

    private SyncRecordResult upsertMeeting(Map<String, Object> rec, String ashaPhone) {
        String outboxId = str(rec.get("outboxId"));
        String uuid = str(rec.get("clientUuid"));
        if (uuid == null) return SyncRecordResult.rejected(outboxId, null, "MEETING", "MISSING_ID", false);
        Object payload = rec.get("payload") != null ? rec.get("payload") : Map.of();
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return SyncRecordResult.rejected(outboxId, uuid, "MEETING", "INVALID_DATA", false);
        }
        List<Integer> saved = ids("INSERT INTO clinicqueue.asha_meetings (client_uuid, asha_worker_phone, meeting_date, payload) " +
                "VALUES (:uuid, :ashaPhone, CAST(:meetingDate AS date), CAST(:payload AS jsonb)) " +
                "ON CONFLICT (client_uuid) DO UPDATE SET payload = EXCLUDED.payload, meeting_date = EXCLUDED.meeting_date, updated_at = NOW() " +
                "WHERE clinicqueue.asha_meetings.asha_worker_phone = EXCLUDED.asha_worker_phone RETURNING id",
                new MapSqlParameterSource("uuid", uuid).addValue("ashaPhone", ashaPhone)
                        .addValue("meetingDate", isoDate(rec.get("meetingDate"))).addValue("payload", json));
        if (saved.isEmpty()) return SyncRecordResult.rejected(outboxId, uuid, "MEETING", "OWNED_BY_OTHER_WORKER", false);
        return SyncRecordResult.accepted(outboxId, uuid, "MEETING", saved.get(0), null);
    }

    private SyncRecordResult deleteFamily(Map<String, Object> rec, String ashaPhone, String rawPhone) {
        String outboxId = str(rec.get("outboxId"));
        String uuid = str(rec.get("clientUuid"));
        Integer famId = resolveFamilyId(firstNonNull(uuid, str(rec.get("serverId"))), strictInt(rec.get("sequentialNumber")), ashaPhone, rawPhone);
        if (famId == null) return SyncRecordResult.accepted(outboxId, uuid, "DELETE_FAMILY", null, "NOT_ON_SERVER");
        softDeleteFamily(famId);
        return SyncRecordResult.accepted(outboxId, uuid, "DELETE_FAMILY", famId, null);
    }

    private SyncRecordResult deleteMember(Map<String, Object> rec, String ashaPhone, String rawPhone) {
        String outboxId = str(rec.get("outboxId"));
        String uuid = str(rec.get("clientUuid"));
        Integer memId = resolveMemberId(firstNonNull(uuid, str(rec.get("serverId"))), null, null, ashaPhone, rawPhone);
        if (memId == null) return SyncRecordResult.accepted(outboxId, uuid, "DELETE_MEMBER", null, "NOT_ON_SERVER");
        softDeleteMember(memId);
        return SyncRecordResult.accepted(outboxId, uuid, "DELETE_MEMBER", memId, null);
    }

    /** Soft delete only — epidemiological audit trail (no hard deletes). */
    private void softDeleteFamily(int famId) {
        MapSqlParameterSource p = new MapSqlParameterSource("id", famId);
        jdbcTemplate.update("UPDATE clinicqueue.family_units SET is_deleted = TRUE, updated_at = NOW() WHERE id = :id", p);
        jdbcTemplate.update("UPDATE clinicqueue.family_members SET is_deleted = TRUE, updated_at = NOW() WHERE family_unit_id = :id", p);
    }

    private void softDeleteMember(int memId) {
        jdbcTemplate.update("UPDATE clinicqueue.family_members SET is_deleted = TRUE, updated_at = NOW() WHERE id = :id",
                new MapSqlParameterSource("id", memId));
    }

    // ------------------------------------------------------------------------------------------
    // Download
    // ------------------------------------------------------------------------------------------

    public SyncDownloadResponse download(String ashaPhone, String since) {
        ensureSyncSchema();
        SyncDownloadResponse response = new SyncDownloadResponse();
        Timestamp sinceTime = since != null ? Timestamp.from(Instant.parse(since)) : new Timestamp(0);

        String rawPhone = rawPhoneOf(ashaPhone);
        MapSqlParameterSource params = new MapSqlParameterSource("ashaPhone", ashaPhone)
                .addValue("rawPhone", rawPhone)
                .addValue("since", sinceTime);

        // Active families only
        String familiesSql = "SELECT * FROM clinicqueue.family_units " +
                "WHERE " + PHONE_MATCH + " AND " + NOT_DELETED;
        List<FamilyDetailDto> families = jdbcTemplate.query(familiesSql, params, (rs, rowNum) -> {
            FamilyDetailDto dto = new FamilyDetailDto();
            dto.setId(rs.getInt("id"));
            dto.setClientUuid(rs.getString("client_uuid"));
            String phone = rs.getString("primary_phone");
            dto.setPrimaryPhone(phone == null || phone.isBlank() || phone.startsWith(NO_PHONE_PREFIX) ? null : phone);
            dto.setHeadName(rs.getString("head_name"));
            dto.setVillageName(rs.getString("village_name"));
            dto.setHouseNumber(rs.getString("house_number"));
            dto.setSequentialNumber(rs.getObject("sequential_number", Integer.class));
            dto.setVisitIntervalDays(rs.getObject("visit_interval_days", Integer.class));
            java.sql.Date nvd = rs.getDate("next_visit_date");
            if (nvd != null) dto.setNextVisitDate(nvd.toLocalDate());
            java.sql.Timestamp lva = rs.getTimestamp("last_visited_at");
            if (lva != null) dto.setLastVisitedAt(lva.toLocalDateTime());
            return dto;
        });
        response.setFamilies(families);

        // Active members only
        String membersSql = "SELECT m.*, f.client_uuid AS family_client_uuid FROM clinicqueue.family_members m " +
                "JOIN clinicqueue.family_units f ON m.family_unit_id = f.id " +
                "WHERE " + F_PHONE_MATCH + " " +
                "AND (m.is_deleted = FALSE OR m.is_deleted IS NULL) AND (f.is_deleted = FALSE OR f.is_deleted IS NULL)";
        List<MemberDto> members = jdbcTemplate.query(membersSql, params, (rs, rowNum) -> {
            MemberDto dto = new MemberDto();
            dto.setId(rs.getInt("id"));
            dto.setFamilyUnitId(rs.getInt("family_unit_id"));
            dto.setClientUuid(rs.getString("client_uuid"));
            dto.setFamilyClientUuid(rs.getString("family_client_uuid"));
            dto.setName(rs.getString("name"));
            dto.setPhone(rs.getString("phone"));
            dto.setAge(rs.getObject("age", Integer.class));
            dto.setGender(rs.getString("gender"));
            dto.setRelationship(rs.getString("relationship"));
            dto.setIsPregnant(rs.getBoolean("is_pregnant"));
            java.sql.Date edd = rs.getDate("expected_delivery_date");
            if (edd != null) dto.setExpectedDeliveryDate(edd.toLocalDate());
            dto.setHasChronicCondition(rs.getBoolean("has_chronic_condition"));
            dto.setChronicConditionType(rs.getString("chronic_condition_type"));
            dto.setFollowUpReason(rs.getString("follow_up_reason"));
            dto.setAbhaNumber(rs.getString("abha_number"));
            dto.setIsAbhaLinked(rs.getBoolean("is_abha_linked"));
            return dto;
        });
        response.setMembers(members);

        // Tombstones for client-side purging (numeric ids for legacy clients, UUIDs for v2)
        String delFamSql = "SELECT id, client_uuid FROM clinicqueue.family_units WHERE " + PHONE_MATCH + " AND is_deleted = TRUE";
        List<Integer> deletedFamilyIds = new ArrayList<>();
        List<String> deletedFamilyUuids = new ArrayList<>();
        jdbcTemplate.query(delFamSql, params, rs -> {
            deletedFamilyIds.add(rs.getInt("id"));
            String u = rs.getString("client_uuid");
            if (u != null) deletedFamilyUuids.add(u);
        });
        response.setDeletedFamilyIds(deletedFamilyIds);
        response.setDeletedFamilyClientUuids(deletedFamilyUuids);

        String delMemSql = "SELECT m.id, m.client_uuid FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON m.family_unit_id = f.id " +
                "WHERE " + F_PHONE_MATCH + " AND m.is_deleted = TRUE";
        List<Integer> deletedMemberIds = new ArrayList<>();
        List<String> deletedMemberUuids = new ArrayList<>();
        jdbcTemplate.query(delMemSql, params, rs -> {
            deletedMemberIds.add(rs.getInt("id"));
            String u = rs.getString("client_uuid");
            if (u != null) deletedMemberUuids.add(u);
        });
        response.setDeletedMemberIds(deletedMemberIds);
        response.setDeletedMemberClientUuids(deletedMemberUuids);

        String templatesSql = "SELECT * FROM clinicqueue.survey_templates WHERE is_active = true";
        List<SurveyTemplateDto> templates = jdbcTemplate.query(templatesSql, new MapSqlParameterSource(), (rs, rowNum) -> {
            SurveyTemplateDto dto = new SurveyTemplateDto();
            dto.setId(rs.getInt("id"));
            dto.setCategoryCode(rs.getString("category_code"));
            dto.setCategoryLabel(rs.getString("category_label"));
            try {
                String qJson = rs.getString("questions");
                if (qJson != null) {
                    dto.setQuestions(objectMapper.readValue(qJson, new TypeReference<List<Map<String, Object>>>() {}));
                }
            } catch (Exception e) {}
            return dto;
        });
        response.setTemplates(templates);

        String followUpsSql = "SELECT t.*, f.head_name as family_head_name, f.house_number, fm.name as member_name " +
                "FROM clinicqueue.follow_up_tasks t " +
                "LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members fm ON t.family_member_id = fm.id " +
                "WHERE (t.asha_worker_phone = :ashaPhone OR t.asha_worker_phone = :rawPhone)";
        List<FollowUpTaskDto> followUps = jdbcTemplate.query(followUpsSql, params, (rs, rowNum) -> {
            FollowUpTaskDto dto = new FollowUpTaskDto();
            dto.setId(rs.getInt("id"));
            dto.setFamilyUnitId(rs.getObject("family_unit_id", Integer.class));
            dto.setFamilyMemberId(rs.getObject("family_member_id", Integer.class));
            dto.setTaskType(rs.getString("task_type"));
            dto.setTitle(rs.getString("title"));
            dto.setDescription(rs.getString("description"));
            if (rs.getDate("due_date") != null) {
                dto.setDueDate(rs.getDate("due_date").toLocalDate());
            }
            dto.setStatus(rs.getString("status"));
            dto.setSourceReferralId(rs.getObject("source_referral_id", Integer.class));
            dto.setOfflineId(rs.getString("offline_id"));
            dto.setChoNote(rs.getString("cho_note"));
            dto.setMemberName(rs.getString("member_name"));
            dto.setFamilyHeadName(rs.getString("family_head_name"));
            dto.setHouseNumber(rs.getString("house_number"));
            return dto;
        });
        response.setFollowUps(followUps);

        response.setServerTimestamp(Instant.now().toString());
        return response;
    }

    @Transactional
    public Map<String, Object> sendToAnm(String ashaPhone, String sectionFilter, String anmPhone) {
        String rawPhone = ashaPhone != null ? ashaPhone.replace("+91", "").trim() : "";
        StringBuilder sql = new StringBuilder("UPDATE clinicqueue.survey_responses SET synced_to_anm = TRUE, target_anm_phone = :anmPhone, synced_at = NOW() " +
                "WHERE (asha_worker_phone = :ashaPhone OR asha_worker_phone = :rawPhone) AND synced_to_anm = FALSE ");

        MapSqlParameterSource params = new MapSqlParameterSource("ashaPhone", ashaPhone)
                .addValue("rawPhone", rawPhone)
                .addValue("anmPhone", anmPhone);

        if (sectionFilter != null && !"ALL".equals(sectionFilter)) {
            sql.append("AND category_code = :sectionFilter");
            params.addValue("sectionFilter", sectionFilter);
        }

        int count = jdbcTemplate.update(sql.toString(), params);

        Map<String, Object> result = new HashMap<>();
        result.put("sent", count);
        result.put("section", sectionFilter);
        return result;
    }
}
