package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberDto {
    private Integer id;
    private Integer familyUnitId;
    private String name;
    private LocalDate dob;
    private Integer age;
    private String gender;
    private String relationship;
    private String phone;
    private String abhaNumber;
    private Boolean isAbhaLinked;

    // Health flags
    private Boolean isPregnant;
    private LocalDate expectedDeliveryDate;
    private Boolean hasChronicCondition;
    private String chronicConditionType;
    private LocalDateTime lastSurveyDate;
    private LocalDate followUpDueDate;
    private String followUpReason;
}
