package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record AbhaLoginInitRequest(
        @NotBlank(message = "abhaAddress is required (e.g. username@abdm or 14-digit ABHA number)")
        String abhaAddress
) {}
