package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PatientAbhaProfileDto {
    private String abhaAddress;
    private String abhaNumber;
    private String name;
    private String phone;
    private String gender;
    private String dob;
    private Integer age;
    private String address;
    private String relationship;
    private Boolean verified;
}
