package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Called right after the phone's OTP is verified (see OtpService#isPhoneVerifiedRecently) -- that's the doctor's proof of identity, same as patient registration. */
public record RegisterDoctorRequest(
        @NotBlank(message = "Name is required.")
        String name,
        @NotBlank(message = "Phone number is required.")
        @Pattern(regexp = "^[+0-9][0-9 ()-]{4,20}$", message = "Phone number is invalid.")
        String phone) {
}
