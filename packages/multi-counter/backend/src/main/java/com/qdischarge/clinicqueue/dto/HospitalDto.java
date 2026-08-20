package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HospitalDto {
    private Integer id;
    private String uriSlug;
    private String name;
    private String address;
    private String digipin;
    private String formattedDigipin;
    private Double latitude;
    private Double longitude;
    private LocalTime openTime;
    private LocalTime closeTime;
    private Integer avgServiceMinutes;
    private Integer activeCounters;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
