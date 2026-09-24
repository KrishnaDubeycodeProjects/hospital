package com.jansamvaad.asha.service;

import com.jansamvaad.asha.dto.FollowUpTaskDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FollowUpService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<FollowUpTaskDto> listFollowUps(String ashaPhone, String status) {
        StringBuilder sql = new StringBuilder(
                "SELECT t.*, f.head_name as family_head_name, f.house_number as house_number, m.name as member_name " +
                "FROM clinicqueue.follow_up_tasks t " +
                "LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON t.family_member_id = m.id " +
                "WHERE t.asha_worker_phone = :phone ");
        MapSqlParameterSource params = new MapSqlParameterSource("phone", ashaPhone);
        if (status != null && !status.trim().isEmpty()) {
            sql.append("AND t.status = :status ");
            params.addValue("status", status);
        }
        sql.append("ORDER BY t.due_date ASC, t.created_at DESC");
        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> mapTask(rs));
    }

    public List<FollowUpTaskDto> listOverdue(String ashaPhone) {
        String sql = "SELECT t.*, f.head_name as family_head_name, f.house_number as house_number, m.name as member_name " +
                "FROM clinicqueue.follow_up_tasks t " +
                "LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON t.family_member_id = m.id " +
                "WHERE t.asha_worker_phone = :phone AND t.due_date < CURRENT_DATE AND t.status = 'PENDING' " +
                "ORDER BY t.due_date ASC";
        return jdbcTemplate.query(sql, new MapSqlParameterSource("phone", ashaPhone), (rs, rowNum) -> mapTask(rs));
    }

    public List<FollowUpTaskDto> listToday(String ashaPhone) {
        String sql = "SELECT t.*, f.head_name as family_head_name, f.house_number as house_number, m.name as member_name " +
                "FROM clinicqueue.follow_up_tasks t " +
                "LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON t.family_member_id = m.id " +
                "WHERE t.asha_worker_phone = :phone AND t.due_date = CURRENT_DATE AND t.status = 'PENDING' " +
                "ORDER BY t.created_at DESC";
        return jdbcTemplate.query(sql, new MapSqlParameterSource("phone", ashaPhone), (rs, rowNum) -> mapTask(rs));
    }

    @Transactional
    public FollowUpTaskDto completeFollowUp(Integer id, String notes) {
        String sql = "UPDATE clinicqueue.follow_up_tasks SET status = 'COMPLETED', completed_at = NOW(), description = CONCAT(description, '\nNotes: ', :notes) WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", id).addValue("notes", notes == null ? "" : notes));
        return getTask(id);
    }

    @Transactional
    public FollowUpTaskDto cancelFollowUp(Integer id) {
        String sql = "UPDATE clinicqueue.follow_up_tasks SET status = 'CANCELLED' WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", id));
        return getTask(id);
    }

    @Transactional
    public FollowUpTaskDto createFollowUp(Integer familyUnitId, Integer memberId, String ashaPhone, String taskType, String title, String description, LocalDate dueDate, Integer sourceReferralId, String offlineId) {
        String sql = "INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, title, description, due_date, status, source_referral_id, offline_id, created_at) " +
                "VALUES (:familyUnitId, :memberId, :ashaPhone, :taskType, :title, :description, :dueDate, 'PENDING', :sourceReferralId, :offlineId, NOW()) " +
                "ON CONFLICT (offline_id) DO NOTHING RETURNING id";
        
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("familyUnitId", familyUnitId)
                .addValue("memberId", memberId)
                .addValue("ashaPhone", ashaPhone)
                .addValue("taskType", taskType)
                .addValue("title", title)
                .addValue("description", description)
                .addValue("dueDate", dueDate)
                .addValue("sourceReferralId", sourceReferralId)
                .addValue("offlineId", offlineId);

        List<Integer> returnedIds = jdbcTemplate.query(sql, params, (rs, rowNum) -> rs.getInt("id"));
        Integer finalId = returnedIds.isEmpty() ? getTaskIdByOfflineId(offlineId) : returnedIds.get(0);
        
        return getTask(finalId);
    }
    
    private Integer getTaskIdByOfflineId(String offlineId) {
        return jdbcTemplate.queryForObject("SELECT id FROM clinicqueue.follow_up_tasks WHERE offline_id = :oid", 
                new MapSqlParameterSource("oid", offlineId), Integer.class);
    }

    @Transactional
    public Map<String, Object> simulateMissedReferral(String ashaPhone, int daysOverdue, int houseNumber, String referralReason) {
        String famSql = "SELECT id, head_name FROM clinicqueue.family_units WHERE asha_worker_phone = :phone AND house_number = :house LIMIT 1";
        List<Map<String, Object>> fams = jdbcTemplate.queryForList(famSql, Map.of("phone", ashaPhone, "house", String.valueOf(houseNumber)));

        Integer familyUnitId = null;
        String headName = "Beneficiary";
        if (!fams.isEmpty()) {
            familyUnitId = ((Number) fams.get(0).get("id")).intValue();
            headName = (String) fams.get(0).get("head_name");
        } else {
            List<Map<String, Object>> anyFam = jdbcTemplate.queryForList(
                    "SELECT id, head_name FROM clinicqueue.family_units WHERE asha_worker_phone = :phone LIMIT 1",
                    Map.of("phone", ashaPhone));
            if (!anyFam.isEmpty()) {
                familyUnitId = ((Number) anyFam.get(0).get("id")).intValue();
                headName = (String) anyFam.get(0).get("head_name");
            } else {
                familyUnitId = jdbcTemplate.queryForObject(
                        "INSERT INTO clinicqueue.family_units (primary_phone, head_name, house_number, asha_worker_phone, created_at) " +
                        "VALUES (:phone, 'Beneficiary Family', :house, :phone, NOW()) RETURNING id",
                        Map.of("house", String.valueOf(houseNumber), "phone", ashaPhone),
                        Integer.class);
            }
        }

        Integer memberId = null;
        String memberName = headName;
        if (familyUnitId != null) {
            String memSql = "SELECT id, name FROM clinicqueue.family_members WHERE family_unit_id = :fid LIMIT 1";
            List<Map<String, Object>> mems = jdbcTemplate.queryForList(memSql, Map.of("fid", familyUnitId));
            if (!mems.isEmpty()) {
                memberId = ((Number) mems.get(0).get("id")).intValue();
                memberName = (String) mems.get(0).get("name");
            } else {
                memberId = jdbcTemplate.queryForObject(
                        "INSERT INTO clinicqueue.family_members (family_unit_id, name, age, gender, relationship) " +
                        "VALUES (:fid, :name, 28, 'Female', 'Beneficiary') RETURNING id",
                        Map.of("fid", familyUnitId, "name", memberName != null ? memberName : "Beneficiary Member"),
                        Integer.class);
            }

            int interval = daysOverdue <= 7 ? 7 : (daysOverdue <= 15 ? 15 : 30);
            String updateFam = "UPDATE clinicqueue.family_units SET visit_interval_days = :interval, next_visit_date = CURRENT_DATE + CAST(:interval AS integer), updated_at = NOW() WHERE id = :fid";
            jdbcTemplate.update(updateFam, Map.of("interval", interval, "fid", familyUnitId));
        }

        String urgencyLabel = daysOverdue + " days";
        String taskTitle = "[Hospital Referral Missed: " + urgencyLabel + "] " + referralReason + " (" + memberName + ")";
        String offlineId = UUID.randomUUID().toString();

        String insertTask = "INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, title, description, due_date, status, offline_id, created_at) " +
                "VALUES (:familyUnitId, :memberId, :ashaPhone, 'REFERRAL_MISSED', :title, :desc, CURRENT_DATE + CAST(:days AS integer), 'PENDING', :offlineId, NOW()) RETURNING id";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("familyUnitId", familyUnitId)
                .addValue("memberId", memberId)
                .addValue("ashaPhone", ashaPhone)
                .addValue("title", taskTitle)
                .addValue("desc", "Patient missed referral appointment at District Hospital. Priority home visit required within " + urgencyLabel + ".")
                .addValue("days", daysOverdue <= 7 ? 2 : 5)
                .addValue("offlineId", offlineId);

        Integer taskId = jdbcTemplate.queryForObject(insertTask, params, Integer.class);

        return Map.of(
                "taskId", taskId,
                "familyUnitId", familyUnitId != null ? familyUnitId : 0,
                "memberName", memberName,
                "houseNumber", houseNumber,
                "daysOverdue", daysOverdue,
                "urgencyInterval", daysOverdue <= 7 ? 7 : (daysOverdue <= 15 ? 15 : 30),
                "status", "PENDING"
        );
    }

    public FollowUpTaskDto getTask(Integer id) {
        String sql = "SELECT t.*, f.head_name as family_head_name, f.house_number as house_number, m.name as member_name " +
                "FROM clinicqueue.follow_up_tasks t " +
                "LEFT JOIN clinicqueue.family_units f ON t.family_unit_id = f.id " +
                "LEFT JOIN clinicqueue.family_members m ON t.family_member_id = m.id " +
                "WHERE t.id = :id";
        return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", id), (rs, rowNum) -> mapTask(rs));
    }

    private FollowUpTaskDto mapTask(ResultSet rs) throws SQLException {
        FollowUpTaskDto dto = new FollowUpTaskDto();
        dto.setId(rs.getInt("id"));
        dto.setFamilyUnitId(rs.getInt("family_unit_id"));
        dto.setFamilyMemberId(rs.getInt("family_member_id"));
        dto.setAshaWorkerPhone(rs.getString("asha_worker_phone"));
        dto.setTaskType(rs.getString("task_type"));
        dto.setTitle(rs.getString("title"));
        dto.setDescription(rs.getString("description"));
        java.sql.Date due = rs.getDate("due_date");
        if (due != null) dto.setDueDate(due.toLocalDate());
        dto.setStatus(rs.getString("status"));
        dto.setSourceReferralId(rs.getObject("source_referral_id", Integer.class));
        java.sql.Timestamp comp = rs.getTimestamp("completed_at");
        if (comp != null) dto.setCompletedAt(comp.toLocalDateTime());
        dto.setOfflineId(rs.getString("offline_id"));
        java.sql.Timestamp creat = rs.getTimestamp("created_at");
        if (creat != null) dto.setCreatedAt(creat.toLocalDateTime());
        
        try {
            dto.setFamilyHeadName(rs.getString("family_head_name"));
            dto.setMemberName(rs.getString("member_name"));
            dto.setHouseNumber(rs.getString("house_number"));
        } catch(SQLException ignore) {}
        
        return dto;
    }
}
