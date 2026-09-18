package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LabTestDto {
    private String id;
    private String name;
    private String commonName;
    private String category;
    private String sampleType;
    private Boolean isStandard;
    private Boolean isLive;
    private Integer defaultTurnaroundHours;
    private String instructions;
}
