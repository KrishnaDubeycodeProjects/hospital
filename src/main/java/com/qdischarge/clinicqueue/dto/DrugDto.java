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
public class DrugDto {
    private String name;
    private String genericName;
    private String brandName;
    private String form;
    private String strength;
    private String snomedCode;
    private Boolean isNlem;
    private String defaultDosage;
    private String defaultFrequency;
    private Integer defaultDurationDays;
    private String defaultInstructions;
}
