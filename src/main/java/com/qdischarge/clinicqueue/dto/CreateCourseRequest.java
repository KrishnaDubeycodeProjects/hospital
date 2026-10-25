package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateCourseRequest(
        @NotBlank(message = "Patient phone is required.")
        String patientPhone,
        String patientName,
        Integer familyMemberId,
        String courseType,
        String title,
        String diagnosis,
        String icd10Code,
        String initialNotes
) {
}
