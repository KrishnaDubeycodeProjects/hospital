package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HospitalDto {
    private Integer id;
    private String uriSlug;
    private String name;
    private String address;
    private String digipin;
    private String formattedDigipin;
    private Double latitude;
    private Double longitude;
    private LocalTime openTime;
    private LocalTime closeTime;
    private Integer avgServiceMinutes;
    /** The floor this hospital commits to per patient (asked directly at registration, not derived). */
    private Integer minServiceMinutes;
    private Integer activeCounters;

    // --- Hospital profile (see catalog.MedicalCategory for valid categories) ---
    /** Free text; "Private" / "Trust" / "Government" / "Chain-affiliated" are the expected values. */
    private String ownership;
    private Integer yearEstablished;
    private List<String> accreditation;
    /** Null = general/co-ed; "male" or "female" = this hospital only serves that gender. */
    private String genderSpecific;
    private List<String> categories;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
