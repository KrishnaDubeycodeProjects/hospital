package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.HospitalDepartmentDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * hospital_departments: one row per (hospital, category) queue the
 * "multi-counter package" and QueueManagerService's department-scoped
 * queries key off of -- how many counters staff that department. A missing
 * row just means "not configured yet", defaulting to 1 counter; rows are
 * created on demand (see {@link #ensure}) rather than requiring an explicit
 * admin setup step before a department can be booked into.
 */
@Service
@RequiredArgsConstructor
public class HospitalDepartmentService {

    private final NamedParameterJdbcTemplate jdbc;

    private static final RowMapper<HospitalDepartmentDto> ROW_MAPPER = new BeanPropertyRowMapper<>(HospitalDepartmentDto.class);

    /** Idempotent: creates the (hospital, category) row with default active_counters=1 if it doesn't exist yet. */
    public void ensure(int hospitalId, String category) {
        jdbc.update(
                "INSERT INTO hospital_departments (hospital_id, category) VALUES (:hospitalId, :category) " +
                        "ON CONFLICT (hospital_id, category) DO NOTHING",
                Map.of("hospitalId", hospitalId, "category", category));
    }

    /** Called whenever a hospital's offered categories are set/updated (HospitalService#create). */
    public void syncFromHospital(int hospitalId, List<String> categories) {
        if (categories == null) {
            return;
        }
        for (String category : categories) {
            ensure(hospitalId, category);
        }
    }

    public HospitalDepartmentDto get(int hospitalId, String category) {
        List<HospitalDepartmentDto> rows = jdbc.query(
                "SELECT * FROM hospital_departments WHERE hospital_id = :hospitalId AND category = :category",
                Map.of("hospitalId", hospitalId, "category", category), ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Active counters for this department, defaulting to 1 if it hasn't been configured yet. */
    public int activeCounters(int hospitalId, String category) {
        HospitalDepartmentDto dept = get(hospitalId, category);
        return dept != null ? Math.max(1, dept.getActiveCounters()) : 1;
    }

    public List<HospitalDepartmentDto> list(int hospitalId) {
        return jdbc.query("SELECT * FROM hospital_departments WHERE hospital_id = :hospitalId ORDER BY category ASC",
                Map.of("hospitalId", hospitalId), ROW_MAPPER);
    }

    public HospitalDepartmentDto updateCounters(int hospitalId, String category, int activeCounters) {
        ensure(hospitalId, category);
        List<HospitalDepartmentDto> rows = jdbc.query(
                """
                UPDATE hospital_departments SET active_counters = :activeCounters, updated_at = NOW()
                WHERE hospital_id = :hospitalId AND category = :category
                RETURNING *
                """,
                Map.of("activeCounters", Math.max(1, activeCounters), "hospitalId", hospitalId, "category", category),
                ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
