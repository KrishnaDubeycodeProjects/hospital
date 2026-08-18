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
    /** Patient-facing "Token #N" -- resets per (hospital, category, day), unlike `id` which is one global sequence across every hospital/department. See QueueManagerService#nextDailyNumber. */
    private Integer dailyNumber;
    private String phone;
    private String name;
    private Integer age;
    private String gender;
    /** The department (catalog.MedicalCategory) this token is queued in -- see QueueManagerService. */
    private String category;
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

    // --- Geo / real-ETA treatment timing (see geo/TomTomRoutingService,
    // service/TreatmentTimingScheduler) ---
    private Integer hospitalId;
    private String hospitalName;
    private String patientDigipin;
    private Double patientLat;
    private Double patientLon;
    private Double distanceKm;
    /** TomTom-routed one-way ETA to the hospital, minutes -- fetched once at booking/location-set time. */
    private Double travelMinutes;
    /** Last-computed "minutes of queue work still ahead of this patient" -- display only, always recomputed live before any decision (see QueueManagerService#runTreatmentTimingTick). */
    private Double treatmentRemainingMinutes;
    private LocalDateTime notifiedReadyAt;
    /** Non-null while the patient is inside their post-notify grace window (see QueueManagerService#handleNoShowOrMiss). */
    private LocalDateTime anomalyControlUntil;

    // --- Missed-queue / requeue / floating-point positioning (see
    // QueueManagerService#movePatientToPosition) ---
    private Double priorityRank;
    private LocalDateTime rejectedAt;
    /** How many times reception has clicked "not come yet" on this token -- drives the exponential push-back (see QueueManagerService#pushBackNoShow). */
    private Integer noShowCount;

    // --- Multi-counter package only ---
    private Integer counterId;

    // --- Booking-in-progress (hospital search/selection, pre-confirmation) ---
    private Integer searchOffset;
}
