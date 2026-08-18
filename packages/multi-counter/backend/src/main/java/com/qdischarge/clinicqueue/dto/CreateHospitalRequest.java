package com.qdischarge.clinicqueue.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * location, openTime/closeTime are asked of every hospital at registration.
 * avgServiceMinutes (how long one patient takes) is normally *not* filled in
 * directly -- instead give avgPatientsPerDay (how many patients the hospital
 * treats on an average day) and HospitalService derives it from that plus
 * the open/close hours: (open hours in minutes) / avgPatientsPerDay.
 * avgServiceMinutes, if given, is an explicit override that wins over that
 * calculation.
 */
public record CreateHospitalRequest(
        @NotBlank(message = "uriSlug is required.")
        @jakarta.validation.constraints.Pattern(regexp = "^[a-z0-9-]{2,100}$",
                message = "uriSlug must be lowercase letters, digits, and hyphens only.")
        String uriSlug,
        @NotBlank(message = "name is required.")
        String name,
        String address,
        @NotNull(message = "location is required.")
        @Valid
        SetLocationRequest location,
        String openTime,
        String closeTime,
        @Min(value = 1, message = "avgPatientsPerDay must be at least 1.")
        Integer avgPatientsPerDay,
        @Min(value = 1, message = "avgServiceMinutes must be at least 1.")
        Integer avgServiceMinutes,
        @Min(value = 1, message = "activeCounters must be at least 1.")
        Integer activeCounters) {
}
