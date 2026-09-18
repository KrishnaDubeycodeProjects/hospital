package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record AddFamilyMemberRequest(
        @NotBlank(message = "Member name is required.")
        String name,
        LocalDate dob,
        Integer age,
        String gender,
        @NotBlank(message = "Relationship is required.")
        String relationship,
        String phone,
        String abhaNumber,
        String abhaAddress
) {
}
