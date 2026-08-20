package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Metadata for one uploaded prescription/report photo -- deliberately never
 * carries the file bytes themselves (see PatientDocumentService.FileContent
 * for that), so listing a patient's documents never pulls BYTEA payloads
 * across the wire. Fetch the actual image via the dedicated .../file route.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PatientDocumentDto {
    private Integer id;
    private String patientPhone;
    private String patientName;
    private Integer patientAge;
    /** 'prescription' or 'report'. */
    private String docType;
    private Integer hospitalId;
    private Integer uploadedByDoctorId;
    private String fileName;
    private String contentType;
    private Integer fileSize;
    private LocalDateTime createdAt;
}
