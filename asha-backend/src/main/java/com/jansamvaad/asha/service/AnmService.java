package com.jansamvaad.asha.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jansamvaad.asha.dto.AnmProfileDto;
import com.jansamvaad.asha.dto.AshaWorkerDto;
import com.jansamvaad.asha.dto.SurveyResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnmService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public AnmProfileDto register(String phone, String name, String phcName) {
        String qrCodeData = UUID.randomUUID().toString();
        String sql = "INSERT INTO clinicqueue.anm_profiles (phone, name, phc_name, qr_code_data, created_at) " +
                "VALUES (:phone, :name, :phcName, :qrCodeData, NOW())";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("phone", phone)
                .addValue("name", name)
                .addValue("phcName", phcName)
                .addValue("qrCodeData", qrCodeData);
        jdbcTemplate.update(sql, params);
        
        AnmProfileDto dto = getByPhone(phone).orElseThrow();
        dto.setQrCodeImage(generateQrCodeImage(qrCodeData));
        return dto;
    }

    public Optional<AnmProfileDto> getByPhone(String phone) {
        String sql = "SELECT * FROM clinicqueue.anm_profiles WHERE phone = :phone";
        try {
            AnmProfileDto dto = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("phone", phone), (rs, rowNum) -> mapAnm(rs));
            return Optional.ofNullable(dto);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<AnmProfileDto> getByQrCode(String qrCodeData) {
        String sql = "SELECT * FROM clinicqueue.anm_profiles WHERE qr_code_data = :qrCodeData";
        try {
            AnmProfileDto dto = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("qrCodeData", qrCodeData), (rs, rowNum) -> mapAnm(rs));
            return Optional.ofNullable(dto);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public String generateQrCodeImage(String qrCodeData) {
        return "data:image/png;base64,mocked_base64_string_for_" + qrCodeData;
    }

    public List<Map<String, Object>> getIncomingData(String anmPhone, String sectionFilter) {
        StringBuilder sql = new StringBuilder(
                "SELECT asha_worker_phone, COUNT(*) as count " +
                "FROM clinicqueue.survey_responses " +
                "WHERE target_anm_phone = :phone AND synced_to_anm = TRUE ");
        
        MapSqlParameterSource params = new MapSqlParameterSource("phone", anmPhone);
        if (sectionFilter != null && !sectionFilter.equals("ALL")) {
            sql.append("AND category_code = :sectionFilter ");
            params.addValue("sectionFilter", sectionFilter);
        }
        sql.append("GROUP BY asha_worker_phone");
        
        return jdbcTemplate.queryForList(sql.toString(), params);
    }

    public List<AshaWorkerDto> listAshaWorkers(String anmPhone) {
        String sql = "SELECT * FROM clinicqueue.asha_workers WHERE anm_phone = :phone AND is_active = true";
        return jdbcTemplate.query(sql, new MapSqlParameterSource("phone", anmPhone), (rs, rowNum) -> {
            AshaWorkerDto dto = new AshaWorkerDto();
            dto.setId(rs.getInt("id"));
            dto.setPhone(rs.getString("phone"));
            dto.setName(rs.getString("name"));
            dto.setVillageName(rs.getString("village_name"));
            dto.setBlockName(rs.getString("block_name"));
            dto.setDistrictName(rs.getString("district_name"));
            dto.setPhcId(rs.getObject("phc_id", Integer.class));
            dto.setAnmPhone(rs.getString("anm_phone"));
            dto.setIsActive(rs.getBoolean("is_active"));
            java.sql.Timestamp created = rs.getTimestamp("created_at");
            if (created != null) dto.setCreatedAt(created.toLocalDateTime());
            return dto;
        });
    }

    public List<SurveyResponseDto> getMemberForms(String ashaPhone, Integer memberId, String category) {
        String sql = "SELECT r.*, f.head_name as family_head_name, m.name as member_name " +
                "FROM clinicqueue.survey_responses r " +
                "LEFT JOIN clinicqueue.family_units f ON r.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON r.family_member_id = m.id " +
                "WHERE r.asha_worker_phone = :ashaPhone AND r.family_member_id = :memberId AND r.category_code = :category AND r.synced_to_anm = TRUE " +
                "ORDER BY r.created_at DESC";
        return jdbcTemplate.query(sql, new MapSqlParameterSource("ashaPhone", ashaPhone)
                .addValue("memberId", memberId).addValue("category", category), (rs, rowNum) -> {
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
            dto.setFamilyHeadName(rs.getString("family_head_name"));
            dto.setMemberName(rs.getString("member_name"));
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
        });
    }

    private AnmProfileDto mapAnm(ResultSet rs) throws SQLException {
        AnmProfileDto dto = new AnmProfileDto();
        dto.setId(rs.getInt("id"));
        dto.setPhone(rs.getString("phone"));
        dto.setName(rs.getString("name"));
        dto.setPhcName(rs.getString("phc_name"));
        dto.setQrCodeData(rs.getString("qr_code_data"));
        java.sql.Timestamp created = rs.getTimestamp("created_at");
        if (created != null) dto.setCreatedAt(created.toLocalDateTime());
        return dto;
    }
}
