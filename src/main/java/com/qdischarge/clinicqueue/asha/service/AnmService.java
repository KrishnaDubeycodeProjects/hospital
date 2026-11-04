package com.qdischarge.clinicqueue.asha.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.asha.dto.AnmProfileDto;
import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyResponseDto;
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

    /** anm_phone of the active ASHA record for this phone (compared on last 10 digits), if any. */
    public Optional<String> findAssignedAnmPhone(String ashaPhone) {
        String digits = ashaPhone == null ? "" : ashaPhone.replaceAll("[^0-9]", "");
        if (digits.length() > 10) digits = digits.substring(digits.length() - 10);
        if (digits.isEmpty()) return Optional.empty();
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT anm_phone FROM clinicqueue.asha_workers WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = :p " +
                        "AND (is_active IS NULL OR is_active = TRUE) AND anm_phone IS NOT NULL AND anm_phone <> '' LIMIT 1",
                new MapSqlParameterSource("p", digits), String.class);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<AnmProfileDto> getByPhone(String phone) {
        String rawPhone = phone != null ? phone.replace("+91", "").trim() : "";
        String normPhone = phone != null ? com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(phone) : "";
        String sql = "SELECT * FROM clinicqueue.anm_profiles WHERE (phone = :phone OR phone = :rawPhone OR phone = :normPhone) LIMIT 1";
        MapSqlParameterSource params = new MapSqlParameterSource("phone", phone != null ? phone : "")
                .addValue("rawPhone", rawPhone)
                .addValue("normPhone", normPhone);
        List<AnmProfileDto> list = jdbcTemplate.query(sql, params, (rs, rowNum) -> mapAnm(rs));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Optional<AnmProfileDto> getByQrCode(String qrCodeData) {
        if (qrCodeData == null || qrCodeData.isBlank()) return Optional.empty();
        String sql = "SELECT * FROM clinicqueue.anm_profiles WHERE qr_code_data = :qrCodeData LIMIT 1";
        List<AnmProfileDto> list = jdbcTemplate.query(sql, new MapSqlParameterSource("qrCodeData", qrCodeData), (rs, rowNum) -> mapAnm(rs));
        if (!list.isEmpty()) return Optional.of(list.get(0));

        // Extract any digits from QR code (e.g. ANM-QR-9876543211)
        String digits = qrCodeData.replaceAll("[^0-9]", "");
        if (digits.length() >= 10) {
            String extractedPhone = digits.substring(digits.length() - 10);
            Optional<AnmProfileDto> byPhone = getByPhone(extractedPhone);
            if (byPhone.isPresent()) return byPhone;
        }

        return Optional.empty();
    }

    public Map<String, Object> createOrUpdateSession(String anmPhone, String title, String category, String qrCode) {
        String targetPhone = (anmPhone != null && !anmPhone.isBlank()) ? anmPhone.replace("+91", "").trim() : "";
        String finalQr = (qrCode != null && !qrCode.isBlank()) ? qrCode : "ANM-QR-" + UUID.randomUUID().toString().substring(0, 8);
        
        int updated = jdbcTemplate.update(
            "UPDATE clinicqueue.anm_profiles SET qr_code_data = :qr WHERE phone = :phone OR phone = :fullPhone",
            new MapSqlParameterSource("qr", finalQr).addValue("phone", targetPhone).addValue("fullPhone", "+91" + targetPhone)
        );
        if (updated == 0) {
            jdbcTemplate.update(
                "INSERT INTO clinicqueue.anm_profiles (phone, name, phc_name, qr_code_data, created_at) VALUES (:phone, 'ANM Nurse Midwife', 'Sector PHC', :qr, NOW())",
                new MapSqlParameterSource("phone", targetPhone).addValue("qr", finalQr)
            );
        }
        return Map.of("success", true, "qrCode", finalQr, "anmPhone", targetPhone, "title", title != null ? title : "ANM Session");
    }

    public String generateQrCodeImage(String qrCodeData) {
        return "data:image/png;base64,mocked_base64_string_for_" + qrCodeData;
    }

    public List<Map<String, Object>> getIncomingData(String anmPhone, String sectionFilter) {
        String rawPhone = anmPhone != null ? anmPhone.replace("+91", "").trim() : "";
        String normPhone = anmPhone != null ? com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(anmPhone) : "";
        
        StringBuilder sql = new StringBuilder(
                "SELECT asha_worker_phone, COUNT(*) as count " +
                "FROM clinicqueue.survey_responses " +
                "WHERE (target_anm_phone = :phone OR target_anm_phone = :rawPhone OR target_anm_phone = :normPhone) AND synced_to_anm = TRUE ");
        
        MapSqlParameterSource params = new MapSqlParameterSource("phone", anmPhone != null ? anmPhone : "")
                .addValue("rawPhone", rawPhone)
                .addValue("normPhone", normPhone);
        if (sectionFilter != null && !sectionFilter.equals("ALL")) {
            sql.append("AND category_code = :sectionFilter ");
            params.addValue("sectionFilter", sectionFilter);
        }
        sql.append("GROUP BY asha_worker_phone");
        
        return jdbcTemplate.queryForList(sql.toString(), params);
    }

    public List<AshaWorkerDto> listAshaWorkers(String anmPhone) {
        String rawPhone = anmPhone != null ? anmPhone.replace("+91", "").trim() : "";
        String normPhone = anmPhone != null ? com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(anmPhone) : "";
        String sql = "SELECT * FROM clinicqueue.asha_workers WHERE (anm_phone = :phone OR anm_phone = :rawPhone OR anm_phone = :normPhone) AND is_active = true";
        MapSqlParameterSource params = new MapSqlParameterSource("phone", anmPhone != null ? anmPhone : "")
                .addValue("rawPhone", rawPhone)
                .addValue("normPhone", normPhone);
        return jdbcTemplate.query(sql, params, (rs, rowNum) -> {
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
        String rawPhone = ashaPhone != null ? ashaPhone.replace("+91", "").trim() : "";
        String normPhone = ashaPhone != null ? com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(ashaPhone) : "";
        StringBuilder sql = new StringBuilder("SELECT r.*, f.head_name as family_head_name, m.name as member_name " +
                "FROM clinicqueue.survey_responses r " +
                "LEFT JOIN clinicqueue.family_units f ON r.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON r.family_member_id = m.id " +
                "WHERE (r.asha_worker_phone = :ashaPhone OR r.asha_worker_phone = :rawPhone OR r.asha_worker_phone = :normPhone) " +
                "AND r.synced_to_anm = TRUE ");
        
        MapSqlParameterSource params = new MapSqlParameterSource("ashaPhone", ashaPhone != null ? ashaPhone : "")
                .addValue("rawPhone", rawPhone)
                .addValue("normPhone", normPhone);
        if (memberId != null) {
            sql.append("AND r.family_member_id = :memberId ");
            params.addValue("memberId", memberId);
        }
        if (category != null && !category.isBlank() && !category.equals("ALL")) {
            sql.append("AND r.category_code = :category ");
            params.addValue("category", category);
        }
        sql.append("ORDER BY r.created_at DESC");
        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> {
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
