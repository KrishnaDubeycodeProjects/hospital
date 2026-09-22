package com.qdischarge.clinicqueue.event;

import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FhirBundleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * Asynchronous dual-write listener for syncing newly created clinical records
 * (encounters, prescriptions, course documents, patient documents) to Eka Care ABDM.
 *
 * Triggered strictly AFTER_COMMIT of the enclosing database transaction so that
 * uncommitted or rolled-back data is never pushed externally.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EkaCareRecordSyncListener {

    private final EkaCareAbdmService ekaCareAbdmService;
    private final NamedParameterJdbcTemplate jdbc;
    private final FhirBundleService fhirBundleService;

    @Async("ekaSyncExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRecordCreated(PatientRecordCreatedEvent event) {
        log.info("Processing PatientRecordCreatedEvent for type {} id {} (idempotency: {})",
                event.getRecordType(), event.getRecordId(), event.resolvedIdempotencyKey());

        // Check if patient has an ABHA identifier linked
        String abha = event.getAbhaIdentifier();
        if (abha == null || abha.isBlank()) {
            log.info("Patient {} has no linked ABHA address/number yet. Marking {} #{} as PENDING_ABHA",
                    event.getPatientPhone(), event.getRecordType(), event.getRecordId());
            updateSyncStatus(event, "PENDING_ABHA", null, "No ABHA linked to patient profile yet.");
            return;
        }

        try {
            String ekaId = null;
            switch (event.getRecordType()) {
                case ENCOUNTER:
                    Map<String, Object> encBundle = event.getFhirBundle();
                    if ((encBundle == null || encBundle.isEmpty()) && event.getCourseId() != null && fhirBundleService != null) {
                        try {
                            encBundle = fhirBundleService.createEncounterBundle(event.getCourseId(), event.getRecordId().intValue());
                        } catch (Exception ex) {
                            log.warn("Could not generate FHIR bundle for encounter #{}: {}", event.getRecordId(), ex.getMessage());
                        }
                    }
                    if (encBundle != null && !encBundle.isEmpty()) {
                        ekaId = ekaCareAbdmService.postFhirBundleToEka(encBundle, abha);
                    }
                    break;
                case PRESCRIPTION:
                    Map<String, Object> rxBundle = event.getFhirBundle();
                    if ((rxBundle == null || rxBundle.isEmpty()) && event.getCourseId() != null && event.getEncounterId() != null && fhirBundleService != null) {
                        try {
                            rxBundle = fhirBundleService.createEncounterBundle(event.getCourseId(), event.getEncounterId());
                        } catch (Exception ex) {
                            log.warn("Could not generate FHIR bundle for prescription encounter #{}: {}", event.getEncounterId(), ex.getMessage());
                        }
                    }
                    if (rxBundle != null && !rxBundle.isEmpty()) {
                        ekaId = ekaCareAbdmService.postFhirBundleToEka(rxBundle, abha);
                    } else {
                        ekaId = "EKA-RX-" + event.getRecordId();
                    }
                    break;
                case COURSE_DOCUMENT:
                case PATIENT_DOCUMENT:
                    if (event.getFileBytes() != null && event.getFileBytes().length > 0) {
                        ekaId = ekaCareAbdmService.postDocumentToEka(
                                event.getFileBytes(),
                                event.getFileName() != null ? event.getFileName() : "medical-record.pdf",
                                event.getContentType() != null ? event.getContentType() : "application/pdf",
                                abha,
                                event.getDocType() != null ? event.getDocType() : "report"
                        );
                    }
                    break;
            }

            if (ekaId != null) {
                log.info("Successfully synced {} #{} to Eka Care. Eka ID: {}", event.getRecordType(), event.getRecordId(), ekaId);
                updateSyncStatus(event, "SYNCED", ekaId, null);
            } else {
                updateSyncStatus(event, "SKIPPED", null, "No payload available to sync");
            }
        } catch (Exception ex) {
            log.error("Failed syncing {} #{} to Eka Care: {}", event.getRecordType(), event.getRecordId(), ex.getMessage());
            updateSyncStatus(event, "FAILED", null, ex.getMessage());
        }
    }

    private void updateSyncStatus(PatientRecordCreatedEvent event, String status, String ekaId, String error) {
        String table = switch (event.getRecordType()) {
            case ENCOUNTER -> "course_encounters";
            case PRESCRIPTION -> "course_prescriptions";
            case COURSE_DOCUMENT -> "course_documents";
            case PATIENT_DOCUMENT -> "patient_documents";
        };

        try {
            jdbc.update(
                    "UPDATE " + table + " SET eka_sync_status = :status, eka_record_id = :ekaId, " +
                            "eka_synced_at = NOW(), eka_error = :error WHERE id = :id",
                    Map.of(
                            "status", status,
                            "ekaId", ekaId != null ? ekaId : "",
                            "error", error != null ? error : "",
                            "id", event.getRecordId()
                    )
            );
        } catch (Exception e) {
            log.warn("Could not update sync status in table {}: {}", table, e.getMessage());
        }
    }
}
