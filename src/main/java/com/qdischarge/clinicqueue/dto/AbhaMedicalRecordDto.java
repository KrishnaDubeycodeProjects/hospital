package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AbhaMedicalRecordDto {
    private String recordId;
    private String careContextReference;
    private String type;
    private String title;
    private String date;
    private String providerHospital;
    private String doctorName;
    private String summary;
    private String documentUrl;
    private String source;
    private Map<String, Object> fhirBundle;
}
