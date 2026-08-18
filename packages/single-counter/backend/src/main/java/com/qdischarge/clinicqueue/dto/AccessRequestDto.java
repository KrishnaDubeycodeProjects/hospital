package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A doctor's outstanding "let me view your records" request -- a short code + QR (GET .../qr), not yet tied to any patient until claimed. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AccessRequestDto {
    private Integer id;
    private String code;
    private Integer doctorId;
    /** pending | claimed | expired */
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
