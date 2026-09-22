package com.qdischarge.clinicqueue.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PatientRecordCreatedEvent {

    public enum RecordType {
        ENCOUNTER,
        PRESCRIPTION,
        COURSE_DOCUMENT,
        PATIENT_DOCUMENT
    }

    private RecordType recordType;
    private Long recordId;
    private Integer courseId;
    private Integer encounterId;
    private String patientPhone;
    private String patientName;
    private String abhaIdentifier; // ABHA Address or ABHA Number
    private byte[] fileBytes;
    private String fileName;
    private String contentType;
    private String docType;
    private Map<String, Object> fhirBundle;
    private String idempotencyKey;

    public String resolvedIdempotencyKey() {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            return idempotencyKey;
        }
        return recordType.name() + "-" + recordId + "-v1";
    }
}
