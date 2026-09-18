package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record AddEncounterRequest(
        @NotNull(message = "Course ID is required.")
        Integer courseId,
        String chiefComplaint,
        String clinicalNotes,
        String examinationFindings,
        String plan,
        List<AddPrescriptionRequest> prescriptions
) {
}
