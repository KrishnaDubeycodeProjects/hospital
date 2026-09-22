package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AbhaLoginVerifyRequest(
        @NotBlank(message = "txnId is required")
        String txnId,

        @NotBlank(message = "otp is required")
        @Pattern(regexp = "^[0-9]{4,8}$", message = "otp must be 4 to 8 digits")
        String otp,

        String relationship
) {
    public String resolvedRelationship() {
        if (relationship == null || relationship.isBlank()) {
            return "SELF";
        }
        return relationship.trim().toUpperCase();
    }
}
