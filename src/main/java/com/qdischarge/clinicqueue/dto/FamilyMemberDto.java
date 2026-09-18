package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FamilyMemberDto {
    private Integer id;
    private Integer familyUnitId;
    private String name;
    private LocalDate dob;
    private Integer age;
    private String gender;
    private String relationship;
    private String phone;
    private String abhaNumber;
    private String abhaAddress;
    private Boolean isAbhaLinked;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
