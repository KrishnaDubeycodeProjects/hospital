package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.AccessGrantDto;
import com.qdischarge.clinicqueue.dto.PatientDocumentDto;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.service.AccessService;
import com.qdischarge.clinicqueue.service.PatientDocumentService;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Patient self-service: everything here acts on the caller's own phone
 * number, taken from their JWT (see CurrentUser) -- there's no separate
 * "which patient" parameter anywhere, since login *is* proving you own that
 * phone via OTP (OtpController#verify).
 */
@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
public class PatientController {

    private final QueueManagerService queueManagerService;
    private final PatientDocumentService patientDocumentService;
    private final AccessService accessService;
    private final CurrentUser currentUser;

    /** This phone's token-booking history (see QueueManagerService#archiveToHistory). */
    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> history() {
        return ResponseEntity.ok(ok(queueManagerService.getPatientHistory(currentUser.requirePatientPhone())));
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @RequestParam MultipartFile file,
            @RequestParam String docType,
            @RequestParam String patientName,
            @RequestParam(required = false) Integer patientAge,
            @RequestParam(required = false) Integer hospitalId) {
        try {
            PatientDocumentDto doc = patientDocumentService.upload(
                    currentUser.requirePatientPhone(), patientName, patientAge, docType, hospitalId, null, file);
            return ResponseEntity.ok(ok(doc));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /** Every prescription/report this phone has uploaded (for itself or any family member -- see tokens.age in schema.sql). */
    @GetMapping("/documents")
    public ResponseEntity<Map<String, Object>> documents() {
        return ResponseEntity.ok(ok(patientDocumentService.listForPatient(currentUser.requirePatientPhone())));
    }

    @GetMapping("/documents/{id}/file")
    public ResponseEntity<?> documentFile(@PathVariable int id) {
        String phone = currentUser.requirePatientPhone();
        PatientDocumentDto meta = patientDocumentService.getMetadata(id);
        if (meta == null || !phone.equals(meta.getPatientPhone())) {
            return ResponseEntity.status(404).body(msg("Document not found."));
        }
        PatientDocumentService.FileContent file = patientDocumentService.getFile(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                .body(file.data());
    }

    /** Claims a doctor's access-request code (from their QR) -- grants that doctor access and fires the WhatsApp notice. */
    @PostMapping("/access/{code}/accept")
    public ResponseEntity<Map<String, Object>> acceptAccess(@PathVariable String code) {
        try {
            AccessGrantDto grant = accessService.claim(code, currentUser.requirePatientPhone());
            return ResponseEntity.ok(ok(grant));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    /** Doctors who currently have access -- their name + hospital (see AccessGrantDto). */
    @GetMapping("/access")
    public ResponseEntity<Map<String, Object>> activeAccess() {
        return ResponseEntity.ok(ok(accessService.listActiveForPatient(currentUser.requirePatientPhone())));
    }

    /** Every grant ever issued from this phone, active or revoked -- "history of accessed doctors". */
    @GetMapping("/access/history")
    public ResponseEntity<Map<String, Object>> accessHistory() {
        return ResponseEntity.ok(ok(accessService.listHistoryForPatient(currentUser.requirePatientPhone())));
    }

    @PostMapping("/access/{grantId}/revoke")
    public ResponseEntity<Map<String, Object>> revokeAccess(@PathVariable int grantId) {
        boolean revoked = accessService.revoke(grantId, currentUser.requirePatientPhone());
        if (!revoked) {
            return ResponseEntity.status(404).body(msg("No active access grant found with that id for your phone."));
        }
        return ResponseEntity.ok(ok(Map.of("revoked", true)));
    }

    private Map<String, Object> ok(Object data) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("data", data);
        return m;
    }

    private Map<String, Object> msg(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("message", message);
        return m;
    }

    private Map<String, Object> err(Exception e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", e.getMessage());
        return m;
    }
}
