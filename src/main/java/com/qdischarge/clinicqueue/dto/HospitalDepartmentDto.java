package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Row/view of "hospital_departments": one (hospital, category) queue's
 * counter count. See catalog.MedicalCategory for valid category values and
 * QueueManagerService for how (hospitalId, category) partitions the queue.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HospitalDepartmentDto {
    private Integer id;
    private Integer hospitalId;
    private String category;
    private Integer activeCounters;
    /** Null = falls back to the hospital's avgServiceMinutes. */
    private Integer avgServiceMinutes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
