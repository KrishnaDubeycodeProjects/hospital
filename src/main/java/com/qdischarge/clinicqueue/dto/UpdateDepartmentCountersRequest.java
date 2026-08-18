package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.Min;

/** Admin-only: how many counters staff a given (hospital, category) department. */
public record UpdateDepartmentCountersRequest(
        @Min(value = 1, message = "activeCounters must be at least 1.")
        int activeCounters) {
}
