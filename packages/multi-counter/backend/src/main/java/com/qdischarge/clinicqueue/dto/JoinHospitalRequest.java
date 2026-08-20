package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinHospitalRequest(
        @NotBlank(message = "hospitalCode is required.")
        String hospitalCode) {
}
