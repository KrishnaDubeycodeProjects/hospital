package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AddPrescriptionRequest(
        @NotBlank(message = "Medicine name is required.")
        String medicineName,
        String snomedCode,
        @NotBlank(message = "Dosage is required (e.g. 1-0-1).")
        String dosage,
        @NotBlank(message = "Frequency is required.")
        String frequency,
        @NotNull(message = "Duration in days is required.")
        Integer durationDays,
        String route,
        String instructions,
        Boolean isNlem
) {
}
