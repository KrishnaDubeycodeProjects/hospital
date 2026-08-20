package com.qdischarge.clinicqueue.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * location, openTime/closeTime are asked of every hospital at registration.
 * avgServiceMinutes (how long one patient takes) is normally *not* filled in
 * directly -- instead give avgPatientsPerDay (how many patients the hospital
 * treats on an average day) and HospitalService derives it from that plus
 * the open/close hours: (open hours in minutes) / avgPatientsPerDay.
 * avgServiceMinutes, if given, is an explicit override that wins over that
 * calculation. minServiceMinutes is separate and asked for directly -- the
 * floor a hospital commits to per patient, not derived from anything.
 *
 * The five profile fields (ownership onward) are all optional and preserved
 * across re-seeding on every boot (see HospitalService#create) -- a null here
 * leaves whatever's already stored alone rather than wiping it out, same as
 * doctorJoinCode. categories, when given, must each be a valid
 * catalog.MedicalCategory name.
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
        /** The floor a hospital commits to per patient -- purely informational (not derived, unlike avgServiceMinutes); must not exceed avgServiceMinutes when both are given. */
        @Min(value = 1, message = "minServiceMinutes must be at least 1.")
        Integer minServiceMinutes,
        @Min(value = 1, message = "activeCounters must be at least 1.")
        Integer activeCounters,
        /** Free text; "Private" / "Trust" / "Government" / "Chain-affiliated" are the expected values. */
        String ownership,
        @Min(value = 1800, message = "yearEstablished looks invalid.")
        Integer yearEstablished,
        List<String> accreditation,
        /** Null/omitted = general/co-ed. Otherwise must be "male" or "female". */
        String genderSpecific,
        /** Each entry must be a valid catalog.MedicalCategory name (case-insensitive). */
        List<String> categories) {
}
