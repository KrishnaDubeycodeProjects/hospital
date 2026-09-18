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
public class CourseDto {
    private Integer id;
    private String patientPhone;
    private String patientName;
    private Integer familyMemberId;
    private String courseType;
    private String title;
    private String diagnosis;
    private String icd10Code;
    private String status; // 'active', 'completed', 'cancelled'
    private Integer startedByDoctorId;
    private String startedByDoctorName;
    private Integer startedAtHospitalId;
    private String startedAtHospitalName;
    private String currentSummary;
    private Integer documentCount;
    private Integer prescriptionCount;
    private Integer referralCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime closedAt;
}
