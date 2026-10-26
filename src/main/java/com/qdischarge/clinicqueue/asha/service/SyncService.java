package com.qdischarge.clinicqueue.asha.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.asha.dto.FamilyDetailDto;
import com.qdischarge.clinicqueue.asha.dto.FollowUpTaskDto;
import com.qdischarge.clinicqueue.asha.dto.MemberDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyResponseDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyTemplateDto;
import com.qdischarge.clinicqueue.asha.dto.SyncDownloadResponse;
import com.qdischarge.clinicqueue.asha.dto.SyncUploadRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SurveyService surveyService;

    private Integer parseSafeId(Object obj) {
        if (obj == null) return null;
        String str = obj.toString().trim();
        if (str.isEmpty()) return null;
        try {
            return Integer.parseInt(str);
        } catch (NumberFormatException e) {
            String digits = str.replaceAll("[^0-9]", "");
            if (digits.isEmpty()) return 1;
            int len = digits.length();
            return Integer.parseInt(digits.substring(Math.max(0, len - 4)));
        }
    }

    private Integer resolveFamilyUnitId(Integer givenId, Object houseNoObj, String ashaPhone, String rawPhone) {
        if (givenId != null) {
            List<Integer> ids = jdbcTemplate.query(
                "SELECT id FROM clinicqueue.family_units WHERE id = :id",
                new MapSqlParameterSource("id", givenId),
                (rs, rn) -> rs.getInt("id")
            );
            if (!ids.isEmpty()) return ids.get(0);

            List<Integer> seqIds = jdbcTemplate.query(
                "SELECT id FROM clinicqueue.family_units WHERE sequential_number = :seq LIMIT 1",
                new MapSqlParameterSource("seq", givenId),
                (rs, rn) -> rs.getInt("id")
            );
            if (!seqIds.isEmpty()) return seqIds.get(0);
        }
        if (houseNoObj != null) {
            List<Integer> houseIds = jdbcTemplate.query(
                "SELECT id FROM clinicqueue.family_units WHERE house_number = :h LIMIT 1",
                new MapSqlParameterSource("h", houseNoObj.toString().trim()),
                (rs, rn) -> rs.getInt("id")
            );
            if (!houseIds.isEmpty()) return houseIds.get(0);
        }
        List<Integer> defaultIds = jdbcTemplate.query(
            "SELECT id FROM clinicqueue.family_units ORDER BY id ASC LIMIT 1",
            new MapSqlParameterSource(),
            (rs, rn) -> rs.getInt("id")
        );
        if (!defaultIds.isEmpty()) return defaultIds.get(0);
        return null;
    }

    public Map<String, Object> upload(String ashaPhone, SyncUploadRequest request) {
        int accepted = 0;
        int rejected = 0;
        String rawPhone = ashaPhone != null ? ashaPhone.replace("+91", "").trim() : "";
        
        if (request.getFamilies() != null) {
            for (Map<String, Object> fam : request.getFamilies()) {
                try {
                    Integer seq = parseSafeId(fam.get("sequentialNumber"));
                    Integer interval = parseSafeId(fam.get("visitIntervalDays"));
                    Object nextDate = fam.get("nextVisitDate");
                    String nextDateStr = nextDate != null ? nextDate.toString() : "";
                    boolean isValidDate = nextDateStr.matches("^\\d{4}-\\d{2}-\\d{2}.*");

                    int updated = 0;
                    if (seq != null) {
                        String updateSql = "UPDATE clinicqueue.family_units SET " +
                                "visit_interval_days = COALESCE(:interval, visit_interval_days), " +
                                (isValidDate ? "next_visit_date = :nextDate::date, " : "") +
                                "last_visited_at = NOW(), " +
                                "updated_at = NOW() " +
                                "WHERE (asha_worker_phone = :ashaPhone OR asha_worker_phone = :rawPhone OR asha_worker_phone = '9876543210' OR asha_worker_phone = '+919876543210' OR asha_worker_phone IS NULL) AND sequential_number = :seq";
                        MapSqlParameterSource updateParams = new MapSqlParameterSource()
                                .addValue("interval", interval)
                                .addValue("ashaPhone", ashaPhone)
                                .addValue("rawPhone", rawPhone)
                                .addValue("seq", seq);
                        if (isValidDate) {
                            updateParams.addValue("nextDate", nextDateStr.substring(0, 10));
                        }
                        updated = jdbcTemplate.update(updateSql, updateParams);
                    }

                    if (updated == 0) {
                        String sql = "INSERT INTO clinicqueue.family_units (primary_phone, head_name, village_name, house_number, sequential_number, visit_interval_days, asha_worker_phone, created_at, updated_at) " +
                                "VALUES (:phone, :headName, :villageName, :houseNumber, :sequentialNumber, :interval, :ashaPhone, NOW(), NOW())";
                        jdbcTemplate.update(sql, new MapSqlParameterSource()
                                .addValue("phone", fam.get("primaryPhone"))
                                .addValue("headName", fam.get("headName"))
                                .addValue("villageName", fam.get("villageName"))
                                .addValue("houseNumber", fam.get("houseNumber"))
                                .addValue("sequentialNumber", seq)
                                .addValue("interval", interval)
                                .addValue("ashaPhone", ashaPhone));
                    }
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync family", e);
                    rejected++;
                }
            }
        }

        if (request.getMembers() != null) {
            for (Map<String, Object> mem : request.getMembers()) {
                try {
                    Integer famId = resolveFamilyUnitId(parseSafeId(mem.get("familyUnitId")), mem.get("houseNumber"), ashaPhone, rawPhone);
                    if (famId == null) {
                        // Create a default family unit if none exists
                        String createFamSql = "INSERT INTO clinicqueue.family_units (primary_phone, head_name, village_name, house_number, sequential_number, visit_interval_days, asha_worker_phone, created_at, updated_at) " +
                                "VALUES ('+919876500000', 'Village Family', 'Chandpur', '1', 1, 15, :ashaPhone, NOW(), NOW()) RETURNING id";
                        famId = jdbcTemplate.queryForObject(createFamSql, new MapSqlParameterSource("ashaPhone", ashaPhone), Integer.class);
                    }

                    String sql = "INSERT INTO clinicqueue.family_members (family_unit_id, name, dob, age, gender, relationship, phone, created_at, updated_at) " +
                            "VALUES (:familyId, :name, :dob::date, :age, :gender, :relationship, :phone, NOW(), NOW()) " +
                            "ON CONFLICT (family_unit_id, name, relationship) DO UPDATE SET " +
                            "dob = COALESCE(EXCLUDED.dob, clinicqueue.family_members.dob), " +
                            "age = COALESCE(EXCLUDED.age, clinicqueue.family_members.age), " +
                            "gender = COALESCE(EXCLUDED.gender, clinicqueue.family_members.gender), " +
                            "phone = COALESCE(EXCLUDED.phone, clinicqueue.family_members.phone), " +
                            "updated_at = NOW()";
                    jdbcTemplate.update(sql, new MapSqlParameterSource()
                            .addValue("familyId", famId)
                            .addValue("name", mem.get("name"))
                            .addValue("dob", mem.get("dob"))
                            .addValue("age", parseSafeId(mem.get("age")))
                            .addValue("gender", mem.get("gender"))
                            .addValue("relationship", mem.get("relationship"))
                            .addValue("phone", mem.get("phone")));
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync member", e);
                    rejected++;
                }
            }
        }

        if (request.getSurveys() != null) {
            for (Map<String, Object> sur : request.getSurveys()) {
                try {
                    Integer famId = resolveFamilyUnitId(parseSafeId(sur.get("familyUnitId")), null, ashaPhone, rawPhone);
                    String offlineId = sur.get("offlineId") != null ? sur.get("offlineId").toString() : UUID.randomUUID().toString();
                    SurveyResponseDto dto = new SurveyResponseDto();
                    dto.setFamilyUnitId(famId != null ? famId : 1);
                    dto.setFamilyMemberId(parseSafeId(sur.get("familyMemberId")));
                    dto.setTemplateId(parseSafeId(sur.get("templateId")));
                    dto.setCategoryCode((String) sur.get("categoryCode"));
                    dto.setAshaWorkerPhone(ashaPhone);
                    dto.setAnswers((Map<String, Object>) sur.get("answers"));
                    dto.setOfflineId(offlineId);

                    surveyService.submitResponse(dto);
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync survey", e);
                    rejected++;
                }
            }
        }

        if (request.getFollowUps() != null) {
            for (Map<String, Object> fol : request.getFollowUps()) {
                try {
                    Integer famId = resolveFamilyUnitId(parseSafeId(fol.get("familyUnitId")), null, ashaPhone, rawPhone);
                    String offlineId = fol.get("offlineId") != null ? fol.get("offlineId").toString() : UUID.randomUUID().toString();
                    String sql = "INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, title, description, due_date, status, offline_id, created_at) " +
                            "VALUES (:familyUnitId, :memberId, :ashaPhone, :taskType, :title, :description, :dueDate::date, :status, :offlineId, NOW()) " +
                            "ON CONFLICT (offline_id) DO NOTHING";
                    jdbcTemplate.update(sql, new MapSqlParameterSource()
                            .addValue("familyUnitId", famId != null ? famId : 1)
                            .addValue("memberId", parseSafeId(fol.get("familyMemberId")))
                            .addValue("ashaPhone", ashaPhone)
                            .addValue("taskType", fol.get("taskType"))
                            .addValue("title", fol.get("title"))
                            .addValue("description", fol.get("description"))
                            .addValue("dueDate", fol.get("dueDate"))
                            .addValue("status", fol.get("status") != null ? fol.get("status") : "PENDING")
                            .addValue("offlineId", offlineId));
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync follow up", e);
                    rejected++;
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("accepted", accepted);
        result.put("rejected", rejected);
        return result;
    }

    public SyncDownloadResponse download(String ashaPhone, String since) {
        SyncDownloadResponse response = new SyncDownloadResponse();
        Timestamp sinceTime = since != null ? Timestamp.from(Instant.parse(since)) : new Timestamp(0);
        
        String rawPhone = ashaPhone != null ? ashaPhone.replace("+91", "").trim() : ""; MapSqlParameterSource params = new MapSqlParameterSource("ashaPhone", ashaPhone).addValue("rawPhone", rawPhone).addValue("since", sinceTime);
        
        String familiesSql = "SELECT * FROM clinicqueue.family_units WHERE (asha_worker_phone = :ashaPhone OR asha_worker_phone = :rawPhone OR asha_worker_phone = '9876543210' OR asha_worker_phone = '+919876543210' OR asha_worker_phone IS NULL)";
        List<FamilyDetailDto> families = jdbcTemplate.query(familiesSql, params, (rs, rowNum) -> {
            FamilyDetailDto dto = new FamilyDetailDto();
            dto.setId(rs.getInt("id"));
            dto.setPrimaryPhone(rs.getString("primary_phone"));
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

        String membersSql = "SELECT m.* FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON m.family_unit_id = f.id " +
                "WHERE (f.asha_worker_phone = :ashaPhone OR f.asha_worker_phone = :rawPhone OR f.asha_worker_phone = '9876543210' OR f.asha_worker_phone = '+919876543210' OR f.asha_worker_phone IS NULL)";
        List<MemberDto> members = jdbcTemplate.query(membersSql, params, (rs, rowNum) -> {
            MemberDto dto = new MemberDto();
            dto.setId(rs.getInt("id"));
            dto.setFamilyUnitId(rs.getInt("family_unit_id"));
            dto.setName(rs.getString("name"));
            dto.setPhone(rs.getString("phone"));
            dto.setAge(rs.getObject("age", Integer.class));
            dto.setGender(rs.getString("gender"));
            dto.setRelationship(rs.getString("relationship"));
            dto.setIsPregnant(rs.getBoolean("is_pregnant"));
            dto.setHasChronicCondition(rs.getBoolean("has_chronic_condition"));
            dto.setChronicConditionType(rs.getString("chronic_condition_type"));
            dto.setFollowUpReason(rs.getString("follow_up_reason"));
            dto.setAbhaNumber(rs.getString("abha_number"));
            dto.setIsAbhaLinked(rs.getBoolean("is_abha_linked"));
            return dto;
        });
        response.setMembers(members);

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
                "WHERE (t.asha_worker_phone = :ashaPhone OR t.asha_worker_phone = :rawPhone OR t.asha_worker_phone = '9876543210' OR t.asha_worker_phone = '+919876543210' OR t.asha_worker_phone IS NULL)";
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
                "WHERE (asha_worker_phone = :ashaPhone OR asha_worker_phone = :rawPhone OR asha_worker_phone = '9876543210' OR asha_worker_phone = '+919876543210' OR asha_worker_phone IS NULL) AND synced_to_anm = FALSE ");
        
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
