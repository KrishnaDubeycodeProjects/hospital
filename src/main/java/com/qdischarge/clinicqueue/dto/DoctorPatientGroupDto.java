package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One person's complete accessible record, as a doctor sees it: every
 * document under a phone number the doctor has active access to, grouped by
 * (name, age) rather than by phone alone -- since one WhatsApp number can be
 * used to book/upload for different family members (see tokens.age in schema.sql).
 * A phone the doctor was just granted access to but that has no documents
 * yet still shows up here (name/age null, empty documents) so the doctor
 * can see *that* they have access even before any record exists.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DoctorPatientGroupDto {
    private String patientPhone;
    private String name;
    private Integer age;
    private List<PatientDocumentDto> documents;
}
