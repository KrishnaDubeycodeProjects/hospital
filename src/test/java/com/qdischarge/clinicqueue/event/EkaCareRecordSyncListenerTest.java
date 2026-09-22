package com.qdischarge.clinicqueue.event;

import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FhirBundleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EkaCareRecordSyncListenerTest {

    private EkaCareAbdmService ekaCareAbdmService;
    private NamedParameterJdbcTemplate jdbc;
    private FhirBundleService fhirBundleService;
    private EkaCareRecordSyncListener listener;

    @BeforeEach
    void setUp() {
        ekaCareAbdmService = mock(EkaCareAbdmService.class);
        jdbc = mock(NamedParameterJdbcTemplate.class);
        fhirBundleService = mock(FhirBundleService.class);
        listener = new EkaCareRecordSyncListener(ekaCareAbdmService, jdbc, fhirBundleService);
    }

    @Test
    void testOnRecordCreated_WithoutAbha_SetsPendingAbha() {
        PatientRecordCreatedEvent event = PatientRecordCreatedEvent.builder()
                .recordType(PatientRecordCreatedEvent.RecordType.ENCOUNTER)
                .recordId(101L)
                .courseId(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .abhaIdentifier(null)
                .build();

        listener.onRecordCreated(event);

        verify(ekaCareAbdmService, never()).postFhirBundleToEka(anyMap(), anyString());
        verify(ekaCareAbdmService, never()).postDocumentToEka(any(), anyString(), anyString(), anyString(), anyString());

        ArgumentCaptor<Map<String, Object>> paramsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).update(contains("UPDATE course_encounters SET eka_sync_status = :status"), paramsCaptor.capture());

        Map<String, Object> params = paramsCaptor.getValue();
        assertEquals("PENDING_ABHA", params.get("status"));
        assertEquals(101L, params.get("id"));
    }

    @Test
    void testOnRecordCreated_EncounterWithAbha_SyncsBundle() {
        PatientRecordCreatedEvent event = PatientRecordCreatedEvent.builder()
                .recordType(PatientRecordCreatedEvent.RecordType.ENCOUNTER)
                .recordId(202L)
                .courseId(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .abhaIdentifier("ramesh@abdm")
                .build();

        Map<String, Object> mockBundle = Map.of("resourceType", "Bundle", "id", "bundle-1");
        when(fhirBundleService.createEncounterBundle(10, 202)).thenReturn(mockBundle);
        when(ekaCareAbdmService.postFhirBundleToEka(mockBundle, "ramesh@abdm")).thenReturn("EKA-REC-202");

        listener.onRecordCreated(event);

        verify(fhirBundleService).createEncounterBundle(10, 202);
        verify(ekaCareAbdmService).postFhirBundleToEka(mockBundle, "ramesh@abdm");

        ArgumentCaptor<Map<String, Object>> paramsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).update(contains("UPDATE course_encounters SET eka_sync_status = :status"), paramsCaptor.capture());

        Map<String, Object> params = paramsCaptor.getValue();
        assertEquals("SYNCED", params.get("status"));
        assertEquals("EKA-REC-202", params.get("ekaId"));
        assertEquals(202L, params.get("id"));
    }

    @Test
    void testOnRecordCreated_DocumentWithAbha_UploadsDocAndSetsSynced() {
        byte[] content = "test pdf content".getBytes();
        PatientRecordCreatedEvent event = PatientRecordCreatedEvent.builder()
                .recordType(PatientRecordCreatedEvent.RecordType.COURSE_DOCUMENT)
                .recordId(303L)
                .courseId(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .abhaIdentifier("ramesh@abdm")
                .fileBytes(content)
                .fileName("xray.pdf")
                .contentType("application/pdf")
                .docType("report")
                .build();

        when(ekaCareAbdmService.postDocumentToEka(content, "xray.pdf", "application/pdf", "ramesh@abdm", "report"))
                .thenReturn("EKA-DOC-303");

        listener.onRecordCreated(event);

        verify(ekaCareAbdmService).postDocumentToEka(content, "xray.pdf", "application/pdf", "ramesh@abdm", "report");

        ArgumentCaptor<Map<String, Object>> paramsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).update(contains("UPDATE course_documents SET eka_sync_status = :status"), paramsCaptor.capture());

        Map<String, Object> params = paramsCaptor.getValue();
        assertEquals("SYNCED", params.get("status"));
        assertEquals("EKA-DOC-303", params.get("ekaId"));
        assertEquals(303L, params.get("id"));
    }

    @Test
    void testOnRecordCreated_WhenEkaServiceFails_SetsFailedStatus() {
        PatientRecordCreatedEvent event = PatientRecordCreatedEvent.builder()
                .recordType(PatientRecordCreatedEvent.RecordType.PATIENT_DOCUMENT)
                .recordId(404L)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .abhaIdentifier("ramesh@abdm")
                .fileBytes("dummy".getBytes())
                .fileName("prescription.jpg")
                .contentType("image/jpeg")
                .docType("prescription")
                .build();

        when(ekaCareAbdmService.postDocumentToEka(any(), anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Eka Care Gateway connection timeout"));

        listener.onRecordCreated(event);

        ArgumentCaptor<Map<String, Object>> paramsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).update(contains("UPDATE patient_documents SET eka_sync_status = :status"), paramsCaptor.capture());

        Map<String, Object> params = paramsCaptor.getValue();
        assertEquals("FAILED", params.get("status"));
        assertTrue(params.get("error").toString().contains("connection timeout"));
        assertEquals(404L, params.get("id"));
    }
}
