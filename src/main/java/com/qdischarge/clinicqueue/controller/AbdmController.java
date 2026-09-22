package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.AbhaMedicalRecordDto;
import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FhirBundleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/abdm")
@RequiredArgsConstructor
public class AbdmController {

    private final EkaCareAbdmService abdmService;
    private final FhirBundleService fhirBundleService;

    public record KycInitRequest(String type, String value) {}
    public record KycVerifyRequest(String txnId, String otp) {}
    public record EnrollAadhaarInitRequest(String aadhaar) {}
    public record EnrollAadhaarVerifyRequest(String txnId, String otp, String preferredAddress, String citizenName) {}
    public record CareContextLinkRequest(String patientReference, Object careContexts) {}

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", abdmService.getGatewayStatus());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/courses/{courseId}/encounters/{encounterId}/fhir")
    public ResponseEntity<Map<String, Object>> getEncounterFhirBundle(
            @PathVariable int courseId,
            @PathVariable int encounterId) {
        Map<String, Object> bundle = fhirBundleService.createEncounterBundle(courseId, encounterId);
        return ResponseEntity.ok(bundle);
    }

    @PostMapping("/callback")
    public ResponseEntity<Map<String, Object>> handleGatewayWebhook(
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestHeader Map<String, String> headers) {
        return ResponseEntity.ok(Map.of(
                "status", "acknowledged",
                "timestamp", System.currentTimeMillis()
        ));
    }

    @PostMapping("/care-context/link")
    public ResponseEntity<Map<String, Object>> linkCareContext(@RequestBody CareContextLinkRequest request) {
        EkaCareAbdmService.AbdmResult result = abdmService.linkCareContext(request.patientReference(), request.careContexts());
        return toResponse(result);
    }

    @PostMapping("/kyc/init")
    public ResponseEntity<Map<String, Object>> initKyc(@RequestBody KycInitRequest request) {
        EkaCareAbdmService.AbdmResult result = abdmService.initKyc(request.type(), request.value());
        return toResponse(result);
    }

    @PostMapping("/kyc/verify")
    public ResponseEntity<Map<String, Object>> verifyKyc(@RequestBody KycVerifyRequest request) {
        EkaCareAbdmService.AbdmResult result = abdmService.verifyLoginOtp(request.txnId(), request.otp());
        return toResponse(result);
    }

    @PostMapping("/enroll/aadhaar/init")
    public ResponseEntity<Map<String, Object>> enrollAadhaarInit(@RequestBody EnrollAadhaarInitRequest request) {
        EkaCareAbdmService.AbdmResult result = abdmService.enrollAadhaarInit(request.aadhaar());
        return toResponse(result);
    }

    @PostMapping("/enroll/aadhaar/verify")
    public ResponseEntity<Map<String, Object>> enrollAadhaarVerify(@RequestBody EnrollAadhaarVerifyRequest request) {
        EkaCareAbdmService.AbdmResult result = abdmService.enrollAadhaarVerify(
                request.txnId(), request.otp(), request.preferredAddress(), request.citizenName());
        return toResponse(result);
    }

    @GetMapping("/check-address")
    public ResponseEntity<Map<String, Object>> checkAddress(@RequestParam String abhaAddress) {
        EkaCareAbdmService.AbdmResult result = abdmService.checkAbhaAddress(abhaAddress);
        return toResponse(result);
    }

    @PostMapping("/consent/init")
    public ResponseEntity<Map<String, Object>> initConsent(@RequestBody Object payload) {
        EkaCareAbdmService.AbdmResult result = abdmService.initConsent(payload);
        return toResponse(result);
    }

    @GetMapping("/consent/{consentRequestId}/status")
    public ResponseEntity<Map<String, Object>> getConsentStatus(@PathVariable String consentRequestId) {
        EkaCareAbdmService.AbdmResult result = abdmService.getConsentStatus(consentRequestId);
        return toResponse(result);
    }

    @PostMapping("/consent/{consentRequestId}/test-approve")
    public ResponseEntity<Map<String, Object>> testApproveConsent(@PathVariable String consentRequestId) {
        EkaCareAbdmService.AbdmResult result = abdmService.testApproveConsent(consentRequestId);
        return toResponse(result);
    }

    @GetMapping("/patients/{identifier}/history")
    public ResponseEntity<Map<String, Object>> getPatientMedicalHistory(@PathVariable String identifier) {
        List<AbhaMedicalRecordDto> history = abdmService.fetchPatientMedicalHistory(identifier, null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("count", history.size());
        body.put("data", history);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/consent/{consentArtefactId}/records")
    public ResponseEntity<Map<String, Object>> getConsentRecords(@PathVariable String consentArtefactId) {
        List<AbhaMedicalRecordDto> records = abdmService.fetchConsentRecords(consentArtefactId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("count", records.size());
        body.put("data", records);
        return ResponseEntity.ok(body);
    }


    private ResponseEntity<Map<String, Object>> toResponse(EkaCareAbdmService.AbdmResult result) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", result.success());
        if (result.success()) {
            body.put("data", result.data());
        } else {
            body.put("error", result.error());
        }
        return ResponseEntity.status(result.status()).body(body);
    }
}
