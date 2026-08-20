package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record OtpVerifyRequest(
        @NotBlank(message = "Phone number is required.")
        @Pattern(regexp = "^[+0-9][0-9 ()-]{4,20}$", message = "Phone number is invalid.")
        String phone,
        @NotBlank(message = "OTP code is required.")
        @Pattern(regexp = "^[0-9]{4,8}$", message = "OTP code must be 4-8 digits.")
        String code) {
}
