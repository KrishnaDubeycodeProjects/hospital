package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Returning doctor: re-verify OTP for this phone, then call this to get a fresh doctor JWT. */
public record DoctorLoginRequest(
        @NotBlank(message = "Phone number is required.")
        @Pattern(regexp = "^[+0-9][0-9 ()-]{4,20}$", message = "Phone number is invalid.")
        String phone) {
}
