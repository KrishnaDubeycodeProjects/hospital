package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record OtpVerifyRequest(
        @NotBlank(message = "Phone number is required.")
        @Pattern(regexp = "^[+0-9][0-9 ()-]{4,20}$", message = "Phone number is invalid.")
        String phone,
        @NotBlank(message = "OTP code is required.")
        @Pattern(regexp = "^[0-9]{4,8}$", message = "OTP code must be 4-8 digits.")
        String code,
        /**
         * Optional. "WORKER" from the AarogyaFlow field app: if the verified phone belongs to a
         * registered ASHA / ANM / CHO, a worker token is issued instead of a patient token.
         * Omitted (patient portal) keeps the existing ROLE_PATIENT behaviour.
         */
        String purpose) {
}
