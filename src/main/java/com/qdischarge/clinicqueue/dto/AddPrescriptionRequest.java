package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AddPrescriptionRequest(
        @JsonAlias({"drugName", "name"})
        String medicineName,
        String snomedCode,
        @JsonAlias({"dose"})
        String dosage,
        String frequency,
        Integer durationDays,
        String route,
        String instructions,
        Boolean isNlem
) {
    public AddPrescriptionRequest {
        if (medicineName == null || medicineName.isBlank()) {
            medicineName = "Standard Medicine";
        }
        if (dosage == null || dosage.isBlank()) {
            dosage = "1 tablet";
        }
        if (frequency == null || frequency.isBlank()) {
            frequency = "BD (Twice daily)";
        }
        if (durationDays == null || durationDays <= 0) {
            durationDays = 5;
        }
        if (route == null || route.isBlank()) {
            route = "Oral";
        }
        if (instructions == null) {
            instructions = "After meals";
        }
    }
}
