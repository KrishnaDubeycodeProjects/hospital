package com.jansamvaad.asha.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jansamvaad.asha.dto.SurveyResponseDto;
import com.jansamvaad.asha.dto.SurveyTemplateDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SurveyService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> listCategories() {
        String sql = "SELECT category_code, category_label, COUNT(id) as questions " +
                "FROM clinicqueue.survey_templates WHERE is_active = true GROUP BY category_code, category_label";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource());
    }

    public List<SurveyTemplateDto> getTemplate(String categoryCode) {
        String sql = "SELECT * FROM clinicqueue.survey_templates WHERE is_active = true";
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (categoryCode != null && !categoryCode.trim().isEmpty()) {
            sql += " AND category_code = :code ORDER BY version DESC";
            params.addValue("code", categoryCode);
        } else {
            sql += " ORDER BY version DESC";
        }
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> mapTemplate(rs));
    }

    public SurveyTemplateDto getTemplateById(Integer id) {
        String sql = "SELECT * FROM clinicqueue.survey_templates WHERE id = :id";
        return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", id), (rs, rowNum) -> mapTemplate(rs));
    }

    @Transactional
    public SurveyResponseDto submitResponse(SurveyResponseDto body) {
        String sql = "INSERT INTO clinicqueue.survey_responses (family_unit_id, family_member_id, template_id, category_code, asha_worker_phone, answers, synced_to_anm, offline_id, created_at) " +
                "VALUES (:familyUnitId, :familyMemberId, :templateId, :categoryCode, :ashaPhone, :answers, false, :offlineId, NOW()) " +
                "ON CONFLICT (offline_id) DO NOTHING RETURNING id";
        
        try {
            PGobject jsonAnswers = new PGobject();
            jsonAnswers.setType("jsonb");
            jsonAnswers.setValue(objectMapper.writeValueAsString(body.getAnswers() != null ? body.getAnswers() : Map.of()));

            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("familyUnitId", body.getFamilyUnitId())
                    .addValue("familyMemberId", body.getFamilyMemberId())
                    .addValue("templateId", body.getTemplateId())
                    .addValue("categoryCode", body.getCategoryCode())
                    .addValue("ashaPhone", body.getAshaWorkerPhone())
                    .addValue("answers", jsonAnswers)
                    .addValue("offlineId", body.getOfflineId());

            List<Integer> returnedIds = jdbcTemplate.query(sql, params, (rs, rowNum) -> rs.getInt("id"));
            Integer finalId = returnedIds.isEmpty() ? getResponseIdByOfflineId(body.getOfflineId()) : returnedIds.get(0);

            // Side effects
            String updateMemberSql = "UPDATE clinicqueue.family_members SET last_survey_date = NOW()";
            MapSqlParameterSource memberParams = new MapSqlParameterSource("memberId", body.getFamilyMemberId());
            
            if ("PREGNANCY".equalsIgnoreCase(body.getCategoryCode()) && body.getAnswers() != null &&
                    Boolean.TRUE.equals(body.getAnswers().get("isPregnant"))) {
                updateMemberSql += ", is_pregnant = true";
            }
            updateMemberSql += " WHERE id = :memberId";
            jdbcTemplate.update(updateMemberSql, memberParams);
            
            return getResponse(finalId);
        } catch (Exception e) {
            log.error("Failed to submit response", e);
            throw new RuntimeException("Failed to submit response", e);
        }
    }

    public List<SurveyResponseDto> listResponses(Integer familyUnitId, Integer memberId, String categoryCode) {
        StringBuilder sql = new StringBuilder("SELECT r.*, f.head_name as family_head_name, m.name as member_name " +
                "FROM clinicqueue.survey_responses r " +
                "LEFT JOIN clinicqueue.family_units f ON r.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON r.family_member_id = m.id " +
                "WHERE 1=1 ");
        
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (familyUnitId != null) {
            sql.append("AND r.family_unit_id = :familyId ");
            params.addValue("familyId", familyUnitId);
        }
        if (memberId != null) {
            sql.append("AND r.family_member_id = :memberId ");
            params.addValue("memberId", memberId);
        }
        if (categoryCode != null) {
            sql.append("AND r.category_code = :categoryCode ");
            params.addValue("categoryCode", categoryCode);
        }
        sql.append("ORDER BY r.created_at DESC");
        
        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> mapResponse(rs));
    }

    public SurveyResponseDto getResponse(Integer id) {
        String sql = "SELECT r.*, f.head_name as family_head_name, m.name as member_name " +
                "FROM clinicqueue.survey_responses r " +
                "LEFT JOIN clinicqueue.family_units f ON r.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON r.family_member_id = m.id " +
                "WHERE r.id = :id";
        return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", id), (rs, rowNum) -> mapResponse(rs));
    }

    private Integer getResponseIdByOfflineId(String offlineId) {
        return jdbcTemplate.queryForObject("SELECT id FROM clinicqueue.survey_responses WHERE offline_id = :oid", 
                new MapSqlParameterSource("oid", offlineId), Integer.class);
    }

    private SurveyTemplateDto mapTemplate(ResultSet rs) throws SQLException {
        SurveyTemplateDto dto = new SurveyTemplateDto();
        dto.setId(rs.getInt("id"));
        dto.setCategoryCode(rs.getString("category_code"));
        dto.setCategoryLabel(rs.getString("category_label"));
        dto.setCategoryLabelHi(rs.getString("category_label_hi"));
        dto.setIconName(rs.getString("icon_name"));
        dto.setVersion(rs.getInt("version"));
        try {
            String qJson = rs.getString("questions");
            if (qJson != null) {
                List<Map<String, Object>> questions = objectMapper.readValue(qJson, new TypeReference<List<Map<String, Object>>>() {});
                dto.setQuestions(questions);
            }
        } catch (JsonProcessingException e) {
            log.error("Error parsing questions JSONB", e);
        }
        return dto;
    }
    
    private SurveyResponseDto mapResponse(ResultSet rs) throws SQLException {
        SurveyResponseDto dto = new SurveyResponseDto();
        dto.setId(rs.getInt("id"));
        dto.setFamilyUnitId(rs.getInt("family_unit_id"));
        dto.setFamilyMemberId(rs.getInt("family_member_id"));
        dto.setTemplateId(rs.getInt("template_id"));
        dto.setCategoryCode(rs.getString("category_code"));
        dto.setAshaWorkerPhone(rs.getString("asha_worker_phone"));
        dto.setSyncedToAnm(rs.getBoolean("synced_to_anm"));
        dto.setTargetAnmPhone(rs.getString("target_anm_phone"));
        java.sql.Timestamp syncedAt = rs.getTimestamp("synced_at");
        if (syncedAt != null) dto.setSyncedAt(syncedAt.toLocalDateTime());
        dto.setOfflineId(rs.getString("offline_id"));
        java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) dto.setCreatedAt(createdAt.toLocalDateTime());
        
        try {
            dto.setFamilyHeadName(rs.getString("family_head_name"));
        } catch(SQLException ignore) {}
        try {
            dto.setMemberName(rs.getString("member_name"));
        } catch(SQLException ignore) {}
        
        try {
            String aJson = rs.getString("answers");
            if (aJson != null) {
                Map<String, Object> answers = objectMapper.readValue(aJson, new TypeReference<Map<String, Object>>() {});
                dto.setAnswers(answers);
            }
        } catch (JsonProcessingException e) {
            log.error("Error parsing answers JSONB", e);
        }
        
        return dto;
    }
}
