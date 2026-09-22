package com.qdischarge.clinicqueue.event;

import com.qdischarge.clinicqueue.service.DocumentStorageService;
import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FhirBundleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AbdmSyncReconcilerTest {

    private NamedParameterJdbcTemplate jdbc;
    private EkaCareAbdmService ekaCareAbdmService;
    private FhirBundleService fhirBundleService;
    private DocumentStorageService documentStorageService;
    private AbdmSyncReconciler reconciler;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        ekaCareAbdmService = mock(EkaCareAbdmService.class);
        fhirBundleService = mock(FhirBundleService.class);
        documentStorageService = mock(DocumentStorageService.class);
        reconciler = new AbdmSyncReconciler(jdbc, ekaCareAbdmService, fhirBundleService, documentStorageService);
    }

    @Test
    void testReconcile_WhenEkaNotConfigured_SkipsExecution() {
        when(ekaCareAbdmService.isConfigured()).thenReturn(false);
        reconciler.reconcilePendingAndFailedRecords();
        verifyNoInteractions(jdbc);
    }

    @Test
    void testReconcile_WhenConfigured_ProcessesFailedEncounters() {
        when(ekaCareAbdmService.isConfigured()).thenReturn(true);
        Map<String, Object> encounterRow = Map.of(
                "id", 101,
                "course_id", 5,
                "patient_phone", "+919876543210",
                "patient_name", "Aarav",
                "abha_address", "aarav@abdm"
        );
        when(jdbc.queryForList(contains("FROM course_encounters"), anyMap()))
                .thenReturn(List.of(encounterRow));
        when(jdbc.queryForList(contains("FROM course_documents"), anyMap()))
                .thenReturn(Collections.emptyList());

        Map<String, Object> mockBundle = Map.of("resourceType", "Bundle");
        when(fhirBundleService.createEncounterBundle(5, 101)).thenReturn(mockBundle);
        when(ekaCareAbdmService.postFhirBundleToEka(mockBundle, "aarav@abdm")).thenReturn("EKA-ENC-101");

        reconciler.reconcilePendingAndFailedRecords();

        verify(fhirBundleService, times(1)).createEncounterBundle(5, 101);
        verify(ekaCareAbdmService, times(1)).postFhirBundleToEka(mockBundle, "aarav@abdm");
        verify(jdbc, times(1)).update(contains("UPDATE course_encounters"), anyMap());
    }
}
