package com.jansamvaad.asha.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jansamvaad.asha.dto.FamilyDetailDto;
import com.jansamvaad.asha.dto.FollowUpTaskDto;
import com.jansamvaad.asha.dto.MemberDto;
import com.jansamvaad.asha.dto.SurveyResponseDto;
import com.jansamvaad.asha.dto.SurveyTemplateDto;
import com.jansamvaad.asha.dto.SyncDownloadResponse;
import com.jansamvaad.asha.dto.SyncUploadRequest;
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

    @Transactional
    public Map<String, Object> upload(String ashaPhone, SyncUploadRequest request) {
        int accepted = 0;
        int rejected = 0;
        
        if (request.getFamilies() != null) {
            for (Map<String, Object> fam : request.getFamilies()) {
                try {
                    String sql = "INSERT INTO clinicqueue.family_units (primary_phone, head_name, village_name, house_number, sequential_number, asha_worker_phone, created_at, updated_at) " +
                            "VALUES (:phone, :headName, :villageName, :houseNumber, :sequentialNumber, :ashaPhone, NOW(), NOW())";
                    jdbcTemplate.update(sql, new MapSqlParameterSource()
                            .addValue("phone", fam.get("primaryPhone"))
                            .addValue("headName", fam.get("headName"))
                            .addValue("villageName", fam.get("villageName"))
                            .addValue("houseNumber", fam.get("houseNumber"))
                            .addValue("sequentialNumber", fam.get("sequentialNumber") != null ? Integer.parseInt(fam.get("sequentialNumber").toString()) : null)
                            .addValue("ashaPhone", ashaPhone));
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
                    String sql = "INSERT INTO clinicqueue.family_members (family_unit_id, name, dob, age, gender, relationship, phone, created_at, updated_at) " +
                            "VALUES (:familyId, :name, :dob::date, :age, :gender, :relationship, :phone, NOW(), NOW())";
                    jdbcTemplate.update(sql, new MapSqlParameterSource()
                            .addValue("familyId", mem.get("familyUnitId") != null ? Integer.parseInt(mem.get("familyUnitId").toString()) : null)
                            .addValue("name", mem.get("name"))
                            .addValue("dob", mem.get("dob"))
                            .addValue("age", mem.get("age") != null ? Integer.parseInt(mem.get("age").toString()) : null)
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
                    String offlineId = sur.get("offlineId") != null ? sur.get("offlineId").toString() : UUID.randomUUID().toString();
                    SurveyResponseDto dto = new SurveyResponseDto();
                    if (sur.get("familyUnitId") != null) dto.setFamilyUnitId(Integer.parseInt(sur.get("familyUnitId").toString()));
                    if (sur.get("familyMemberId") != null) dto.setFamilyMemberId(Integer.parseInt(sur.get("familyMemberId").toString()));
                    if (sur.get("templateId") != null) dto.setTemplateId(Integer.parseInt(sur.get("templateId").toString()));
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
                    String offlineId = fol.get("offlineId") != null ? fol.get("offlineId").toString() : UUID.randomUUID().toString();
                    String sql = "INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, title, description, due_date, status, offline_id, created_at) " +
                            "VALUES (:familyUnitId, :memberId, :ashaPhone, :taskType, :title, :description, :dueDate::date, :status, :offlineId, NOW()) " +
                            "ON CONFLICT (offline_id) DO NOTHING";
                    jdbcTemplate.update(sql, new MapSqlParameterSource()
                            .addValue("familyUnitId", fol.get("familyUnitId") != null ? Integer.parseInt(fol.get("familyUnitId").toString()) : null)
                            .addValue("memberId", fol.get("familyMemberId") != null ? Integer.parseInt(fol.get("familyMemberId").toString()) : null)
                            .addValue("ashaPhone", ashaPhone)
                            .addValue("taskType", fol.get("taskType"))
                            .addValue("title", fol.get("title"))
                            .addValue("description", fol.get("description"))
                            .addValue("dueDate", fol.get("dueDate"))
                            .addValue("status", fol.get("status") != null ? fol.get("status") : "PENDING")
                            .addValue("offlineId", offlineId));
                    accepted++;
                } catch (Exception e) {
                    log.error("Failed to sync followup", e);
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
        
        MapSqlParameterSource params = new MapSqlParameterSource("ashaPhone", ashaPhone).addValue("since", sinceTime);
        
        String familiesSql = "SELECT * FROM clinicqueue.family_units WHERE asha_worker_phone = :ashaPhone AND updated_at > :since";
        List<FamilyDetailDto> families = jdbcTemplate.query(familiesSql, params, (rs, rowNum) -> {
            FamilyDetailDto dto = new FamilyDetailDto();
            dto.setId(rs.getInt("id"));
            dto.setPrimaryPhone(rs.getString("primary_phone"));
            dto.setHeadName(rs.getString("head_name"));
            dto.setVillageName(rs.getString("village_name"));
            dto.setHouseNumber(rs.getString("house_number"));
            dto.setSequentialNumber(rs.getObject("sequential_number", Integer.class));
            return dto;
        });
        response.setFamilies(families);

        String membersSql = "SELECT m.* FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON m.family_unit_id = f.id " +
                "WHERE f.asha_worker_phone = :ashaPhone AND m.updated_at > :since";
        List<MemberDto> members = jdbcTemplate.query(membersSql, params, (rs, rowNum) -> {
            MemberDto dto = new MemberDto();
            dto.setId(rs.getInt("id"));
            dto.setFamilyUnitId(rs.getInt("family_unit_id"));
            dto.setName(rs.getString("name"));
            dto.setPhone(rs.getString("phone"));
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
                "WHERE t.asha_worker_phone = :ashaPhone AND t.created_at > :since";
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
        StringBuilder sql = new StringBuilder("UPDATE clinicqueue.survey_responses SET synced_to_anm = TRUE, target_anm_phone = :anmPhone, synced_at = NOW() " +
                "WHERE asha_worker_phone = :ashaPhone AND synced_to_anm = FALSE ");
        
        MapSqlParameterSource params = new MapSqlParameterSource("ashaPhone", ashaPhone)
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
