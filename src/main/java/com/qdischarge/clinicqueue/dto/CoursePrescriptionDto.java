package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CoursePrescriptionDto {
    private Integer id;
    private Integer courseId;
    private Integer encounterId;
    private Integer doctorId;
    private String doctorName;
    private String medicineName;
    private String snomedCode;
    private String dosage;
    private String frequency;
    private Integer durationDays;
    private String route;
    private String instructions;
    private Boolean isNlem;
    private LocalDateTime createdAt;
}
