package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CreateReferralRequest(
        @NotNull(message = "Course ID is required.")
        Integer courseId,
        Integer encounterId,
        @NotNull(message = "Target hospital ID is required.")
        Integer toHospitalId,
        @NotBlank(message = "Target department is required.")
        String targetDepartment,
        Integer referredDoctorId,
        @NotBlank(message = "Reason for referral is required.")
        String reason,
        @NotBlank(message = "Priority tier is required (urgent_7d, semi_urgent_14d, routine_30d).")
        @Pattern(regexp = "(?i)^(urgent_7d|semi_urgent_14d|routine_30d)$", message = "priorityTier must be urgent_7d, semi_urgent_14d, or routine_30d.")
        String priorityTier
) {
}
