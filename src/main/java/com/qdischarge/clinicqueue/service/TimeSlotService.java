package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.CreateTimeSlotRequest;
import com.qdischarge.clinicqueue.dto.TimeSlotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * time_slots / time_slot_doctors: OPD time windows within a day, each
 * assigned to a list of doctors in one call (see CreateTimeSlotRequest). A
 * hospital can hold any number of slots on the same day -- there's no
 * uniqueness constraint beyond the primary key, so overlapping/duplicate
 * slots are the caller's responsibility to avoid.
 */
@Service
@RequiredArgsConstructor
public class TimeSlotService {

    private final NamedParameterJdbcTemplate jdbc;

    public TimeSlotDto create(int hospitalId, CreateTimeSlotRequest req) {
        LocalTime start = LocalTime.parse(req.startTime());
        LocalTime end = LocalTime.parse(req.endTime());
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("endTime must be after startTime.");
        }

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("hospitalId", hospitalId)
                .addValue("category", req.category())
                .addValue("date", req.date())
                .addValue("start", start)
                .addValue("end", end);
        Integer slotId = jdbc.queryForObject(
                """
                INSERT INTO time_slots (hospital_id, category, slot_date, start_time, end_time)
                VALUES (:hospitalId, :category, :date, :start, :end)
                RETURNING id
                """, params, Integer.class);

        for (Integer doctorId : new java.util.LinkedHashSet<>(req.doctorIds())) {
            jdbc.update(
                    "INSERT INTO time_slot_doctors (time_slot_id, doctor_id) VALUES (:slotId, :doctorId)",
                    Map.of("slotId", slotId, "doctorId", doctorId));
        }
        return getById(slotId);
    }

    public TimeSlotDto getById(int id) {
        List<TimeSlotDto> rows = query("WHERE ts.id = :id", Map.of("id", id));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** All of a hospital's slots, optionally filtered to one day; soonest first. */
    public List<TimeSlotDto> listForHospital(int hospitalId, LocalDate date) {
        if (date != null) {
            return query("WHERE ts.hospital_id = :hospitalId AND ts.slot_date = :date",
                    Map.of("hospitalId", hospitalId, "date", date));
        }
        return query("WHERE ts.hospital_id = :hospitalId", Map.of("hospitalId", hospitalId));
    }

    /** Every slot this doctor has been rostered onto, soonest first. */
    public List<TimeSlotDto> listForDoctor(int doctorId) {
        return query(
                "WHERE ts.id IN (SELECT time_slot_id FROM time_slot_doctors WHERE doctor_id = :doctorId)",
                Map.of("doctorId", doctorId));
    }

    private List<TimeSlotDto> query(String whereClause, Map<String, Object> params) {
        List<TimeSlotDto> slots = jdbc.query(
                """
                SELECT ts.* FROM time_slots ts %s
                ORDER BY ts.slot_date ASC, ts.start_time ASC, ts.id ASC
                """.formatted(whereClause),
                params, (rs, rowNum) -> TimeSlotDto.builder()
                        .id(rs.getInt("id"))
                        .hospitalId(rs.getInt("hospital_id"))
                        .category(rs.getString("category"))
                        .slotDate(rs.getObject("slot_date", LocalDate.class))
                        .startTime(rs.getObject("start_time", LocalTime.class))
                        .endTime(rs.getObject("end_time", LocalTime.class))
                        .createdAt(rs.getObject("created_at", java.time.LocalDateTime.class))
                        .build());

        for (TimeSlotDto slot : slots) {
            List<Integer> doctorIds = jdbc.queryForList(
                    "SELECT doctor_id FROM time_slot_doctors WHERE time_slot_id = :id ORDER BY doctor_id ASC",
                    Map.of("id", slot.getId()), Integer.class);
            slot.setDoctorIds(new ArrayList<>(doctorIds));
        }
        return slots;
    }
}
