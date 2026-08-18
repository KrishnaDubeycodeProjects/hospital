package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Row/view of the "tokens" table. Different queueManager.js functions
 * returned different subsets of these fields (e.g. getActiveToken omitted
 * completedAt/isVerified, getCurrentServingToken omitted isVerified/verifiedAt).
 * We replicate that by leaving unused fields null here -- @JsonInclude.NON_NULL
 * means they simply don't appear in the JSON response, matching the shape of
 * the original plain object literals.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TokenDto {

    private Integer id;
    private String phone;
    private String name;
    private Integer age;
    private String status;
    private String sessionStep;
    private LocalDateTime createdAt;
    private LocalDateTime servedAt;
    private LocalDateTime completedAt;
    private LocalDateTime missedAt;
    private Boolean isVerified;
    private LocalDateTime verifiedAt;

    // Extra fields populated only by position-aware lookups
    // (getPatientPosition / getTokenDetails / verifyTokenByAdmin).
    private Integer position;
    private Integer peopleAhead;
    private Integer currentServing;

    // --- Geo / distance-based notification (see geo/GeoDistanceService) ---
    private Integer hospitalId;
    private String patientDigipin;
    private Double patientLat;
    private Double patientLon;
    private Double distanceKm;
    private Integer notifyTokensAhead;
    private Integer priorityWindow;
    private LocalDateTime notifiedReadyAt;

    // --- Missed-queue / requeue ---
    private Long priorityRank;
    private LocalDateTime rejectedAt;

    // --- Multi-counter package only ---
    private Integer counterId;
}
