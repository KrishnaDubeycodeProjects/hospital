package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReferralDto {
    private Integer id;
    private Integer courseId;
    private String courseTitle;
    private Integer encounterId;
    private String patientPhone;
    private String patientName;
    private Integer referringDoctorId;
    private String referringDoctorName;
    private Integer fromHospitalId;
    private String fromHospitalName;
    private Integer toHospitalId;
    private String toHospitalName;
    private String targetDepartment;
    private Integer referredDoctorId;
    private String referredDoctorName;
    private String reason;
    private String priorityTier; // 'urgent_7d', 'semi_urgent_14d', 'routine_30d'
    private LocalDate validUntil;
    private String status; // 'issued', 'booked', 'completed', 'expired', 'cancelled'
    private String qrPayload;
    private LocalDateTime createdAt;
    private LocalDateTime visitedAt;
}
