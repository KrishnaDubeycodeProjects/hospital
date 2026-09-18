package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DosageTemplateDto {
    private String id;
    private String title;
    private String conditionName;
    private String icd10Code;
    private String description;
    private List<DrugDto> items;
}
