package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
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
    private String prevSessionStep;
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
    /** MapMyIndia-routed or estimated one-way travel minutes selected by patient. */
    private Double travelMinutes;
    private Integer selectedTravelMinutes;
    private LocalDateTime targetArrivalTime;
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
    private Integer reservedCounterId;

    // --- Booking-in-progress (hospital search/selection, pre-confirmation) ---
    private Integer searchOffset;

    // --- Dynamic Alphanumeric Token & Integer Queue Ordering ---
    private String tokenCode;
    private Integer queuePosition;

    /**
     * The number to actually show a patient in any "Token #N" message --
     * {@link #dailyNumber} when it's known, or 0 for the rare legacy/edge-case
     * row where it isn't, rather than falling back to {@link #id} (a global
     * sequence across every hospital/department, which is what caused
     * patients to see e.g. "#17" for the 1st booking of the day in their
     * department).
     */
    public int displayNumber() {
        return dailyNumber != null ? dailyNumber : 0;
    }

    /**
     * Dynamic alphanumeric token code (e.g. "AF-GM01", "AF-CA05").
     * Never returns bare numeric ID like "210".
     */
    @JsonProperty("tokenCode")
    public String getTokenCode() {
        if (tokenCode != null && !tokenCode.isBlank()) {
            return tokenCode;
        }
        return computeDynamicTokenCode();
    }

    @JsonProperty("displayTokenCode")
    public String displayTokenCode() {
        return getTokenCode();
    }

    private String computeDynamicTokenCode() {
        String deptPrefix = "AF";
        if (category != null && !category.isBlank()) {
            String clean = category.replaceAll("[^a-zA-Z]", " ").trim();
            String[] parts = clean.split("\\s+");
            if (parts.length >= 2) {
                deptPrefix = "AF-" + ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
            } else if (parts.length == 1 && parts[0].length() >= 2) {
                deptPrefix = "AF-" + parts[0].substring(0, 2).toUpperCase();
            } else if (parts.length == 1 && parts[0].length() == 1) {
                deptPrefix = "AF-" + parts[0].toUpperCase();
            }
        }
        int num = (dailyNumber != null && dailyNumber > 0)
                ? dailyNumber
                : (id != null && id > 0 ? ((id - 1) % 99) + 1 : 1);
        return String.format("%s%02d", deptPrefix.contains("-") ? deptPrefix : deptPrefix + "-", num);
    }
}
