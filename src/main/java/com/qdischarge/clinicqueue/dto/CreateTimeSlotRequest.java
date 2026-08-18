package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

/**
 * Admin-only: one OPD time window on one day, assigned to a list of doctors
 * in the same call -- a hospital can have several of these on the same
 * date (call this endpoint once per slot) each with its own doctor roster.
 */
public record CreateTimeSlotRequest(
        @NotNull(message = "date is required.")
        LocalDate date,
        @NotBlank(message = "startTime is required (HH:mm).")
        String startTime,
        @NotBlank(message = "endTime is required (HH:mm).")
        String endTime,
        /** Optional; must be a valid catalog.MedicalCategory name (case-insensitive) if given. */
        String category,
        @NotEmpty(message = "doctorIds must list at least one doctor.")
        List<Integer> doctorIds) {
}
