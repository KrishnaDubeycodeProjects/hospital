package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record EnrollAbhaRequest(
        @NotBlank(message = "Transaction ID is required.")
        String txnId,
        @NotBlank(message = "OTP is required.")
        String otp,
        String preferredAddress
) {
}
