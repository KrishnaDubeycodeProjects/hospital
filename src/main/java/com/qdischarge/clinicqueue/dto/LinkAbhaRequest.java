package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record LinkAbhaRequest(
        @NotBlank(message = "ABHA number or address is required.")
        String abhaIdentifier,
        String txnId,
        String otp
) {
}
