package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Admin-only: assigns one of a hospital's doctors to a physical location in
 * its queue system -- a counter number (like every other counter, see
 * CounterAssignmentService) within a given department. Both fields are
 * required together; a hospital either gives a doctor a seat or it doesn't.
 */
public record AssignDoctorLocationRequest(
        @Min(value = 1, message = "counterId must be at least 1.")
        int counterId,
        /** Must be a valid catalog.MedicalCategory name (case-insensitive). */
        @NotBlank(message = "category is required.")
        String category) {
}
