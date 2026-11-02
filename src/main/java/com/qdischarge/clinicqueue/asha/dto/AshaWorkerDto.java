package com.qdischarge.clinicqueue.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AshaWorkerDto {
    private Integer id;
    private String phone;
    private String name;
    private String villageName;
    private String blockName;
    private String districtName;
    private Integer phcId;
    private String anmPhone;
    /** Cadre assigned at CHO registration: ASHA (default) or ANM. Immutable after registration. */
    private String role;

    /**
     * Response only: 30-day worker JWT, returned when the registering caller proved ownership of
     * this phone (OTP-verified token for the same number), so the app can sync immediately.
     */
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    private String authToken;
    private String preferredLanguage;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
