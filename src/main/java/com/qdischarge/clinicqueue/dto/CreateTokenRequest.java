package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateTokenRequest(
        String name,
        @Min(value = 0, message = "age must be at least 0.")
        @Max(value = 120, message = "age must be at most 120.")
        Integer age,
        @Pattern(regexp = "(?i)^(male|female|other)$", message = "gender must be male, female, or other.")
        String gender,
        // Which department (catalog.MedicalCategory) this token is queued in -- every
        // queue-shaping read/write is now scoped by (hospital, category), see QueueManagerService.
        @NotBlank(message = "category is required.")
        String category,
        @NotBlank(message = "Phone number is required.")
        @Pattern(regexp = "^[+0-9][0-9 ()-]{4,20}$", message = "Phone number is invalid.")
        String phone,
        // Optional: patient's current (or manually entered) location, as a DIGIPIN or lat/lon.
        // When given, the distance-based "get ready" notification window is computed right away.
        String digipin,
        Double latitude,
        Double longitude,
        // Optional: which hospital (see GET /api/hospitals/nearby) this token books into --
        // omit to fall back to this deployment's single operating hospital (app.hospital-uri-slug).
        Integer hospitalId) {

    public SetLocationRequest toLocationOrNull() {
        if ((digipin == null || digipin.isBlank()) && (latitude == null || longitude == null)) {
            return null;
        }
        return new SetLocationRequest(digipin, latitude, longitude);
    }
}
