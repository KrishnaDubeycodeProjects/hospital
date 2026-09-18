package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateCourseRequest(
        @NotBlank(message = "Patient phone is required.")
        String patientPhone,
        @NotBlank(message = "Patient name is required.")
        String patientName,
        Integer familyMemberId,
        @NotBlank(message = "Course type is required.")
        String courseType,
        @NotBlank(message = "Title is required.")
        String title,
        @NotBlank(message = "Diagnosis is required.")
        String diagnosis,
        String icd10Code,
        String initialNotes
) {
}
