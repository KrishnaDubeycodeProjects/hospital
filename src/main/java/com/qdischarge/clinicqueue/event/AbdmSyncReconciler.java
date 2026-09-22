package com.qdischarge.clinicqueue.event;

import com.qdischarge.clinicqueue.service.DocumentStorageService;
import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FhirBundleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Scheduled background reconciler that picks up clinical records with
 * eka_sync_status = 'FAILED' or 'PENDING' (older than 5 minutes) and re-attempts
 * synchronization with the Eka Care ABDM Gateway.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AbdmSyncReconciler {

    private final NamedParameterJdbcTemplate jdbc;
    private final EkaCareAbdmService ekaCareAbdmService;
    private final FhirBundleService fhirBundleService;
    private final DocumentStorageService documentStorageService;

    @Scheduled(fixedDelayString = "${app.abdm.reconcile-interval-ms:600000}", initialDelay = 120000)
    public void reconcilePendingAndFailedRecords() {
        if (!ekaCareAbdmService.isConfigured()) {
            return;
        }

        log.debug("🔄 Running ABDM sync reconciler for failed/pending clinical records...");
        reconcileEncounters();
        reconcileDocuments();
    }

    private void reconcileEncounters() {
        try {
            String sql = """
                    SELECT e.id, e.course_id, c.patient_phone, c.patient_name,
                           fm.abha_address, fm.abha_number
                    FROM course_encounters e
                    JOIN courses c ON e.course_id = c.id
                    LEFT JOIN family_members fm ON c.family_member_id = fm.id
                    WHERE e.eka_sync_status IN ('FAILED', 'PENDING')
                      AND e.created_at < NOW() - INTERVAL '5 minutes'
                    LIMIT 10
                    """;

            List<Map<String, Object>> rows = jdbc.queryForList(sql, Collections.emptyMap());
            for (Map<String, Object> r : rows) {
                int encounterId = (Integer) r.get("id");
                int courseId = (Integer) r.get("course_id");
                String abha = (String) r.get("abha_address");
                if (abha == null || abha.isBlank()) {
                    abha = (String) r.get("abha_number");
                }
                if (abha == null || abha.isBlank()) {
                    continue; // cannot sync to ABDM without ABHA identifier
                }

                try {
                    Map<String, Object> bundle = fhirBundleService.createEncounterBundle(courseId, encounterId);
                    String ekaId = ekaCareAbdmService.postFhirBundleToEka(bundle, abha);
                    if (ekaId != null) {
                        jdbc.update(
                                "UPDATE course_encounters SET eka_sync_status = 'SYNCED', eka_record_id = :ekaId, " +
                                        "eka_synced_at = NOW(), eka_error = NULL WHERE id = :id",
                                Map.of("ekaId", ekaId, "id", encounterId));
                        log.info("✅ Reconciled encounter #{} to Eka Care ABDM (Eka ID: {})", encounterId, ekaId);
                    }
                } catch (Exception ex) {
                    log.warn("Reconciliation attempt failed for encounter #{}: {}", encounterId, ex.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Encounter reconciliation query error: {}", e.getMessage());
        }
    }

    private void reconcileDocuments() {
        try {
            String sql = """
                    SELECT d.id, d.course_id, d.file_name, d.content_type, d.storage_path, d.doc_type,
                           fm.abha_address, fm.abha_number
                    FROM course_documents d
                    JOIN courses c ON d.course_id = c.id
                    LEFT JOIN family_members fm ON c.family_member_id = fm.id
                    WHERE d.eka_sync_status IN ('FAILED', 'PENDING')
                      AND d.created_at < NOW() - INTERVAL '5 minutes'
                    LIMIT 10
                    """;

            List<Map<String, Object>> rows = jdbc.queryForList(sql, Collections.emptyMap());
            for (Map<String, Object> r : rows) {
                int docId = (Integer) r.get("id");
                String storagePath = (String) r.get("storage_path");
                String abha = (String) r.get("abha_address");
                if (abha == null || abha.isBlank()) {
                    abha = (String) r.get("abha_number");
                }
                if (abha == null || abha.isBlank() || storagePath == null) {
                    continue;
                }

                try {
                    byte[] bytes = documentStorageService.loadFile(storagePath);
                    String ekaId = ekaCareAbdmService.postDocumentToEka(
                            bytes,
                            (String) r.get("file_name"),
                            (String) r.get("content_type"),
                            abha,
                            (String) r.get("doc_type"));

                    if (ekaId != null) {
                        jdbc.update(
                                "UPDATE course_documents SET eka_sync_status = 'SYNCED', eka_record_id = :ekaId, " +
                                        "eka_synced_at = NOW(), eka_error = NULL WHERE id = :id",
                                Map.of("ekaId", ekaId, "id", docId));
                        log.info("✅ Reconciled course document #{} to Eka Care ABDM (Eka ID: {})", docId, ekaId);
                    }
                } catch (Exception ex) {
                    log.warn("Reconciliation attempt failed for document #{}: {}", docId, ex.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Document reconciliation query error: {}", e.getMessage());
        }
    }
}
