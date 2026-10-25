package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public record CreateCourseRequest(
        @NotBlank(message = "Patient phone is required.")
        String patientPhone,
        String patientName,
        Integer familyMemberId,
        String courseType,
        String title,
        @JsonAlias({"primaryDiagnosis", "diagnosis"})
        String diagnosis,
        String icd10Code,
        @JsonAlias({"initialNotes", "notes", "summary"})
        String initialNotes
) {
}
