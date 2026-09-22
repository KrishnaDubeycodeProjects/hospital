package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record LinkAbhaRequest(
        @NotBlank(message = "ABHA number or address is required.")
        String abhaIdentifier,
        String txnId,
        String otp,
        String verifiedName,
        Integer verifiedAge,
        String verifiedGender,
        String verifiedDob,
        Boolean applyVerifiedDetails
) {
}
