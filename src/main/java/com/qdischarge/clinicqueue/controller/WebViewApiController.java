package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;
import com.qdischarge.clinicqueue.dto.FamilyUnitDto;
import com.qdischarge.clinicqueue.dto.PatientDocumentDto;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.service.FamilyUnitService;
import com.qdischarge.clinicqueue.service.PatientDocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Public and JWT-assisted controller for WhatsApp in-app WebViews.
 * Provides system configuration (e.g. bot phone for wa.me redirects),
 * token validation, and patient document uploads.
 */
@RestController
@RequestMapping("/api/wa")
@RequiredArgsConstructor
@Slf4j
public class WebViewApiController {

    private final AppProperties appProperties;
    private final JwtService jwtService;
    private final PatientDocumentService patientDocumentService;
    private final FamilyUnitService familyUnitService;

    /**
     * Public config used by WebViews to establish wa.me redirect URLs and system defaults.
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("botPhoneNumber", appProperties.getBotPhoneNumber() != null ? appProperties.getBotPhoneNumber() : "919120123877");
        config.put("frontendUrl", appProperties.getFrontendUrl());
        config.put("clinicName", appProperties.getClinicName() != null ? appProperties.getClinicName() : "Ayushman Smart Clinic");
        return ResponseEntity.ok(config);
    }

    public record RegisterPatientRequest(String phone, String name, Integer age, String gender) {}

    /**
     * In-app registration endpoint for new patients and families from register.html WebView.
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerPatient(@RequestBody RegisterPatientRequest body) {
        String phone = body.phone();
        String name = body.name();
        Integer age = body.age();
        String gender = body.gender();

        if (phone == null || phone.isBlank() || name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Phone number and name are required"));
        }

        try {
            FamilyUnitDto unit = familyUnitService.getOrCreateFamilyUnit(phone, name);
            List<FamilyMemberDto> members = familyUnitService.listMembersByCleanPhone(phone);
            if (members.isEmpty()) {
                familyUnitService.addFamilyMember(phone, new com.qdischarge.clinicqueue.dto.AddFamilyMemberRequest(
                        name.trim(), null, age, gender != null ? gender.toUpperCase() : "OTHER", "HEAD", phone.trim(), null, null));
            } else {
                FamilyMemberDto head = members.get(0);
                if (head != null) {
                    familyUnitService.linkAbhaToMember(phone, head.getId(), null, null, name, age, gender, null);
                }
            }
            log.info("✅ Registered patient from WebView: phone={}, name={}, age={}, gender={}", phone, name, age, gender);
            return ResponseEntity.ok(Map.of("success", true, "message", "Registration successful", "data", unit));
        } catch (Exception e) {
            log.error("❌ Failed to register patient {}: {}", phone, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Validates JWT passed via URL parameter (?token=...) or Authorization header.
     * Returns decoded patient identity (phone number) and family unit status.
     */
    @GetMapping("/verify-token")
    public ResponseEntity<?> verifyToken(
            @RequestParam(value = "token", required = false) String paramToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String token = paramToken;
        if ((token == null || token.isBlank()) && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }

        if (token == null || token.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "valid", false,
                    "error", "Missing authentication token"
            ));
        }

        JwtService.DecodedToken decoded = jwtService.decode(token);
        if (decoded == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "valid", false,
                    "error", "Invalid or expired token"
            ));
        }

        String phone = decoded.subject();
        List<FamilyMemberDto> members = familyUnitService.listMembers(phone);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("valid", true);
        resp.put("phone", phone);
        resp.put("role", decoded.role());
        resp.put("familyMembers", members);
        return ResponseEntity.ok(resp);
    }

    /**
     * Uploads patient document (prescription / lab report) from WhatsApp WebView.
     */
    @PostMapping(value = "/documents/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocument(
            @RequestParam("phone") String phone,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "patientName", required = false) String patientName,
            @RequestParam(value = "age", required = false) Integer age,
            @RequestParam(value = "docType", required = false) String docType,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "hospitalId", required = false) Integer hospitalId,
            @RequestParam("file") MultipartFile file) {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "File is required"));
        }

        String effectiveName = (name != null && !name.isBlank()) ? name : patientName;
        if (effectiveName == null || effectiveName.isBlank()) {
            List<FamilyMemberDto> members = familyUnitService.listMembers(phone);
            if (members != null && !members.isEmpty()) {
                effectiveName = members.get(0).getName();
            } else {
                effectiveName = "Self";
            }
        }

        String effectiveType = (docType != null && !docType.isBlank()) ? docType : type;
        if (effectiveType == null || effectiveType.isBlank()) {
            effectiveType = "prescription";
        }

        try {
            PatientDocumentDto doc = patientDocumentService.upload(
                    phone,
                    effectiveName,
                    age != null ? age : 30,
                    effectiveType,
                    hospitalId != null ? hospitalId : 1,
                    null,
                    file
            );
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Document uploaded successfully",
                    "data", doc
            ));
        } catch (Exception e) {
            log.error("Failed to upload document for {}: {}", phone, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Public documents list endpoint for WhatsApp WebViews.
     */
    @GetMapping("/documents")
    public ResponseEntity<?> getPublicDocuments(@RequestParam("phone") String phone) {
        if (phone == null || phone.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Phone is required"));
        }
        List<PatientDocumentDto> docs = patientDocumentService.listForPatient(phone.trim());
        return ResponseEntity.ok(Map.of("success", true, "data", docs));
    }

    /**
     * File streaming endpoint for WhatsApp WebViews.
     */
    @GetMapping("/documents/{id}/file")
    public ResponseEntity<?> getDocumentFile(@PathVariable int id) {
        try {
            PatientDocumentService.FileContent file = patientDocumentService.getFile(id);
            if (file == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Document not found"));
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(file.contentType()))
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
                    .body(file.data());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }
}
