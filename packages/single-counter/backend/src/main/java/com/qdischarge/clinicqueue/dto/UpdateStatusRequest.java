package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateStatusRequest(@NotBlank(message = "Invalid status.") String status) {
}
