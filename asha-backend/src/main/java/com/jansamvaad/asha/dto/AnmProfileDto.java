package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnmProfileDto {
    private Integer id;
    private String phone;
    private String name;
    private String phcName;

    /** Unique string encoded in the QR code — ASHAs scan this to link */
    private String qrCodeData;

    /** Base64-encoded QR code PNG image */
    private String qrCodeImage;

    private LocalDateTime createdAt;
}
