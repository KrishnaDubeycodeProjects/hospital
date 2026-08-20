package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Row/view of "time_slots": one OPD time window on one day, for one hospital
 * (and optionally scoped to one department), assigned to whichever doctors
 * are rostered onto it -- see TimeSlotService. A hospital can have any
 * number of these on the same slot_date; each is independent.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TimeSlotDto {
    private Integer id;
    private Integer hospitalId;
    /** Null = hospital-wide slot, not scoped to one department. */
    private String category;
    private LocalDate slotDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private List<Integer> doctorIds;
    private LocalDateTime createdAt;
}
