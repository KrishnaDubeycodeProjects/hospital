package com.jansamvaad.asha.service;

import com.jansamvaad.asha.dto.AshaWorkerDto;
import com.jansamvaad.asha.dto.DashboardDto;
import com.jansamvaad.asha.dto.FamilyDetailDto;
import com.jansamvaad.asha.dto.FamilyGridDto;
import com.jansamvaad.asha.dto.MemberDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AshaWorkerService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Transactional
    public AshaWorkerDto register(AshaWorkerDto body) {
        String sql = "INSERT INTO clinicqueue.asha_workers (phone, name, village_name, block_name, district_name, phc_id, anm_phone, is_active, created_at, updated_at) " +
                "VALUES (:phone, :name, :villageName, :blockName, :districtName, :phcId, :anmPhone, true, NOW(), NOW())";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("phone", body.getPhone())
                .addValue("name", body.getName())
                .addValue("villageName", body.getVillageName())
                .addValue("blockName", body.getBlockName())
                .addValue("districtName", body.getDistrictName())
                .addValue("phcId", body.getPhcId())
                .addValue("anmPhone", body.getAnmPhone());

        jdbcTemplate.update(sql, params);
        log.info("Registered ASHA worker: {}", body.getPhone());
        return getByPhone(body.getPhone()).orElseThrow();
    }

    public Optional<AshaWorkerDto> getByPhone(String phone) {
        String sql = "SELECT * FROM clinicqueue.asha_workers WHERE phone = :phone";
        try {
            AshaWorkerDto dto = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("phone", phone), (rs, rowNum) -> mapAshaWorker(rs));
            return Optional.ofNullable(dto);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public DashboardDto getDashboard(String ashaPhone) {
        String ashaSql = "SELECT * FROM clinicqueue.asha_workers WHERE phone = :phone";
        AshaWorkerDto tempWorker;
        try {
            tempWorker = jdbcTemplate.queryForObject(ashaSql, new MapSqlParameterSource("phone", ashaPhone), (rs, rowNum) -> {
                AshaWorkerDto dto = new AshaWorkerDto();
                dto.setName(rs.getString("name"));
                dto.setVillageName(rs.getString("village_name"));
                return dto;
            });
        } catch (EmptyResultDataAccessException e) {
            tempWorker = new AshaWorkerDto();
        }
        final AshaWorkerDto worker = tempWorker;

        String statsSql = "SELECT " +
                "(SELECT COUNT(*) FROM clinicqueue.family_units WHERE asha_worker_phone = :phone) as total_families, " +
                "(SELECT COUNT(m.id) FROM clinicqueue.family_members m JOIN clinicqueue.family_units f ON m.family_unit_id = f.id WHERE f.asha_worker_phone = :phone) as total_members, " +
                "(SELECT COUNT(*) FROM clinicqueue.survey_responses WHERE asha_worker_phone = :phone AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)) as surveys_this_month, " +
                "(SELECT COUNT(*) FROM clinicqueue.follow_up_tasks WHERE asha_worker_phone = :phone AND due_date < CURRENT_DATE AND status = 'PENDING') as overdue_follow_ups, " +
                "(SELECT COUNT(*) FROM clinicqueue.follow_up_tasks WHERE asha_worker_phone = :phone AND due_date >= CURRENT_DATE AND status = 'PENDING') as upcoming_follow_ups, " +
                "(SELECT COUNT(*) FROM clinicqueue.survey_responses WHERE asha_worker_phone = :phone AND synced_to_anm = FALSE) as pending_sync_count";

        return jdbcTemplate.queryForObject(statsSql, new MapSqlParameterSource("phone", ashaPhone), (rs, rowNum) -> {
            DashboardDto dto = new DashboardDto();
            dto.setTotalFamilies(rs.getInt("total_families"));
            dto.setTotalMembers(rs.getInt("total_members"));
            dto.setSurveysThisMonth(rs.getInt("surveys_this_month"));
            dto.setOverdueFollowUps(rs.getInt("overdue_follow_ups"));
            dto.setUpcomingFollowUps(rs.getInt("upcoming_follow_ups"));
            dto.setPendingSyncCount(rs.getInt("pending_sync_count"));
            dto.setAshaName(worker != null ? worker.getName() : null);
            dto.setVillageName(worker != null ? worker.getVillageName() : null);
            return dto;
        });
    }

    public List<FamilyDetailDto> listFamilies(String ashaPhone, String search, String sort) {
        StringBuilder sql = new StringBuilder("SELECT * FROM clinicqueue.family_units WHERE asha_worker_phone = :phone ");
        MapSqlParameterSource params = new MapSqlParameterSource("phone", ashaPhone);
        if (search != null && !search.trim().isEmpty()) {
            sql.append("AND (head_name ILIKE :search OR house_number ILIKE :search) ");
            params.addValue("search", "%" + search + "%");
        }
        if ("headName".equals(sort)) {
            sql.append("ORDER BY head_name ASC");
        } else {
            sql.append("ORDER BY created_at DESC");
        }

        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> mapFamilyDetail(rs));
    }

    public FamilyDetailDto getFamilyDetail(Integer familyId) {
        String sql = "SELECT * FROM clinicqueue.family_units WHERE id = :id";
        FamilyDetailDto family = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", familyId), (rs, rowNum) -> mapFamilyDetail(rs));
        
        if (family != null) {
            String membersSql = "SELECT * FROM clinicqueue.family_members WHERE family_unit_id = :id ORDER BY created_at ASC";
            List<MemberDto> members = jdbcTemplate.query(membersSql, new MapSqlParameterSource("id", familyId), (rs, rowNum) -> mapMember(rs));
            family.setMembers(members);
        }
        return family;
    }

    public List<FamilyGridDto> getGridData(String ashaPhone, String sectionFilter) {
        StringBuilder sql = new StringBuilder("SELECT f.*, " +
                "(SELECT COUNT(*) FROM clinicqueue.family_members WHERE family_unit_id = f.id) as member_count, " +
                "EXISTS(SELECT 1 FROM clinicqueue.survey_responses sr WHERE sr.family_unit_id = f.id AND sr.category_code = 'PREGNANCY') as has_pregnancy_data, " +
                "EXISTS(SELECT 1 FROM clinicqueue.survey_responses sr WHERE sr.family_unit_id = f.id AND sr.category_code = 'DISEASE') as has_disease_data, " +
                "EXISTS(SELECT 1 FROM clinicqueue.survey_responses sr WHERE sr.family_unit_id = f.id AND sr.category_code = 'CHILD') as has_child_data " +
                "FROM clinicqueue.family_units f WHERE f.asha_worker_phone = :phone ");
        
        if (sectionFilter != null && !sectionFilter.trim().isEmpty() && !sectionFilter.equals("ALL")) {
            sql.append("AND EXISTS(SELECT 1 FROM clinicqueue.survey_responses sr WHERE sr.family_unit_id = f.id AND sr.category_code = :sectionFilter) ");
        }
        sql.append("ORDER BY f.sequential_number ASC");

        MapSqlParameterSource params = new MapSqlParameterSource("phone", ashaPhone)
                .addValue("sectionFilter", sectionFilter);

        return jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> {
            FamilyGridDto dto = new FamilyGridDto();
            dto.setId(rs.getInt("id"));
            dto.setSequentialNumber(rs.getObject("sequential_number", Integer.class));
            dto.setHeadName(rs.getString("head_name"));
            dto.setHouseNumber(rs.getString("house_number"));
            Integer interval = rs.getObject("visit_interval_days", Integer.class);
            dto.setVisitIntervalDays(interval);
            java.sql.Date nextVisitDate = rs.getDate("next_visit_date");
            if (nextVisitDate != null) dto.setNextVisitDate(nextVisitDate.toString());
            
            String gridColor = "#D1D5DB"; // GRAY
            if (interval != null) {
                if (interval == 7) gridColor = "#DC2626"; // RED
                else if (interval == 15) gridColor = "#F472B6"; // PINK
                else if (interval == 30) gridColor = "#FBBF24"; // YELLOW
            }
            dto.setGridColor(gridColor);
            
            java.sql.Timestamp lastVisited = rs.getTimestamp("last_visited_at");
            if (lastVisited != null) dto.setLastVisitedAt(lastVisited.toString());
            dto.setMemberCount(rs.getInt("member_count"));
            dto.setHasPregnancyData(rs.getBoolean("has_pregnancy_data"));
            dto.setHasDiseaseData(rs.getBoolean("has_disease_data"));
            dto.setHasChildData(rs.getBoolean("has_child_data"));
            return dto;
        });
    }

    @Transactional
    public FamilyDetailDto createFamily(String ashaPhone, FamilyGridDto body) {
        String sql = "INSERT INTO clinicqueue.family_units (head_name, house_number, sequential_number, asha_worker_phone, created_at, updated_at) " +
                "VALUES (:headName, :houseNumber, :sequentialNumber, :ashaPhone, NOW(), NOW()) RETURNING id";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("headName", body.getHeadName())
                .addValue("houseNumber", body.getHouseNumber())
                .addValue("sequentialNumber", body.getSequentialNumber())
                .addValue("ashaPhone", ashaPhone);
        Integer id = jdbcTemplate.queryForObject(sql, params, Integer.class);
        return getFamilyDetail(id);
    }

    @Transactional
    public MemberDto addMember(Integer familyId, MemberDto body) {
        String sql = "INSERT INTO clinicqueue.family_members (family_unit_id, name, dob, age, gender, relationship, phone, created_at, updated_at) " +
                "VALUES (:familyId, :name, :dob, :age, :gender, :relationship, :phone, NOW(), NOW()) RETURNING id";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("familyId", familyId)
                .addValue("name", body.getName())
                .addValue("dob", body.getDob())
                .addValue("age", body.getAge())
                .addValue("gender", body.getGender())
                .addValue("relationship", body.getRelationship())
                .addValue("phone", body.getPhone());
        Integer id = jdbcTemplate.queryForObject(sql, params, Integer.class);
        return getMember(id);
    }

    @Transactional
    public MemberDto updateMember(Integer memberId, MemberDto body) {
        String sql = "UPDATE clinicqueue.family_members SET name = :name, dob = :dob, age = :age, gender = :gender, " +
                "relationship = :relationship, phone = :phone, updated_at = NOW() WHERE id = :id";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", memberId)
                .addValue("name", body.getName())
                .addValue("dob", body.getDob())
                .addValue("age", body.getAge())
                .addValue("gender", body.getGender())
                .addValue("relationship", body.getRelationship())
                .addValue("phone", body.getPhone());
        jdbcTemplate.update(sql, params);
        return getMember(memberId);
    }

    @Transactional
    public void deleteMember(Integer memberId) {
        String sql = "DELETE FROM clinicqueue.family_members WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", memberId));
    }

    @Transactional
    public void setVisitInterval(Integer familyId, Integer intervalDays) {
        String sql = "UPDATE clinicqueue.family_units SET visit_interval_days = :interval, " +
                "next_visit_date = CURRENT_DATE + CAST(:interval || ' days' as interval), updated_at = NOW() WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", familyId).addValue("interval", intervalDays));
    }

    private MemberDto getMember(Integer memberId) {
        String sql = "SELECT * FROM clinicqueue.family_members WHERE id = :id";
        return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", memberId), (rs, rowNum) -> mapMember(rs));
    }

    private AshaWorkerDto mapAshaWorker(ResultSet rs) throws SQLException {
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
    }

    private FamilyDetailDto mapFamilyDetail(ResultSet rs) throws SQLException {
        FamilyDetailDto dto = new FamilyDetailDto();
        dto.setId(rs.getInt("id"));
        dto.setPrimaryPhone(rs.getString("primary_phone"));
        dto.setHeadName(rs.getString("head_name"));
        dto.setVillageName(rs.getString("village_name"));
        dto.setHouseNumber(rs.getString("house_number"));
        dto.setSequentialNumber(rs.getObject("sequential_number", Integer.class));
        dto.setVisitIntervalDays(rs.getObject("visit_interval_days", Integer.class));
        java.sql.Date nextVisit = rs.getDate("next_visit_date");
        if (nextVisit != null) dto.setNextVisitDate(nextVisit.toLocalDate());
        java.sql.Timestamp lastVisited = rs.getTimestamp("last_visited_at");
        if (lastVisited != null) dto.setLastVisitedAt(lastVisited.toLocalDateTime());
        java.sql.Timestamp created = rs.getTimestamp("created_at");
        if (created != null) dto.setCreatedAt(created.toLocalDateTime());
        return dto;
    }

    private MemberDto mapMember(ResultSet rs) throws SQLException {
        MemberDto dto = new MemberDto();
        dto.setId(rs.getInt("id"));
        dto.setFamilyUnitId(rs.getInt("family_unit_id"));
        dto.setName(rs.getString("name"));
        java.sql.Date dob = rs.getDate("dob");
        if (dob != null) dto.setDob(dob.toLocalDate());
        dto.setAge(rs.getObject("age", Integer.class));
        dto.setGender(rs.getString("gender"));
        dto.setRelationship(rs.getString("relationship"));
        dto.setPhone(rs.getString("phone"));
        dto.setAbhaNumber(rs.getString("abha_number"));
        dto.setIsAbhaLinked(rs.getBoolean("is_abha_linked"));
        dto.setIsPregnant(rs.getBoolean("is_pregnant"));
        java.sql.Date edd = rs.getDate("expected_delivery_date");
        if (edd != null) dto.setExpectedDeliveryDate(edd.toLocalDate());
        dto.setHasChronicCondition(rs.getBoolean("has_chronic_condition"));
        dto.setChronicConditionType(rs.getString("chronic_condition_type"));
        java.sql.Timestamp lsd = rs.getTimestamp("last_survey_date");
        if (lsd != null) dto.setLastSurveyDate(lsd.toLocalDateTime());
        java.sql.Date fud = rs.getDate("follow_up_due_date");
        if (fud != null) dto.setFollowUpDueDate(fud.toLocalDate());
        dto.setFollowUpReason(rs.getString("follow_up_reason"));
        return dto;
    }
}
