package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.AddFamilyMemberRequest;
import com.qdischarge.clinicqueue.dto.EnrollAbhaRequest;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;
import com.qdischarge.clinicqueue.dto.FamilyUnitDto;
import com.qdischarge.clinicqueue.dto.LinkAbhaRequest;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FamilyUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/family")
@RequiredArgsConstructor
public class FamilyController {

    private final FamilyUnitService familyUnitService;
    private final EkaCareAbdmService ekaCareAbdmService;
    private final com.qdischarge.clinicqueue.service.QrCodeService qrCodeService;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getFamilyUnit() {
        String phone = currentUser.requirePatientPhone();
        FamilyUnitDto unit = familyUnitService.getOrCreateFamilyUnit(phone, null);
        return ResponseEntity.ok(ok(unit));
    }

    @GetMapping("/members")
    public ResponseEntity<Map<String, Object>> listMembers() {
        String phone = currentUser.requirePatientPhone();
        List<FamilyMemberDto> members = familyUnitService.listMembers(phone);
        return ResponseEntity.ok(ok(members));
    }

    @GetMapping("/public/members")
    public ResponseEntity<Map<String, Object>> listPublicMembers(@RequestParam(name = "phone", required = false) String phone) {
        if (phone == null || phone.trim().isBlank()) {
            return ResponseEntity.badRequest().body(msg("Phone number parameter is required."));
        }
        List<FamilyMemberDto> members = familyUnitService.listMembersByCleanPhone(phone.trim());
        return ResponseEntity.ok(ok(members));
    }

    @PostMapping("/members")
    public ResponseEntity<Map<String, Object>> addMember(@Valid @RequestBody AddFamilyMemberRequest request) {
        String phone = currentUser.requirePatientPhone();
        FamilyMemberDto created = familyUnitService.addFamilyMember(phone, request);
        return ResponseEntity.ok(ok(created));
    }

    @PutMapping("/members/{memberId}")
    public ResponseEntity<Map<String, Object>> updateMember(
            @PathVariable int memberId,
            @RequestBody com.qdischarge.clinicqueue.dto.UpdateFamilyMemberRequest request) {
        String phone = currentUser.requirePatientPhone();
        FamilyMemberDto updated = familyUnitService.updateMember(phone, memberId, request);
        return ResponseEntity.ok(ok(updated));
    }

    @PostMapping("/members/{memberId}/link-abha")
    public ResponseEntity<Map<String, Object>> linkAbha(
            @PathVariable int memberId,
            @Valid @RequestBody LinkAbhaRequest request) {
        String phone = currentUser.requirePatientPhone();

        Map<String, Object> verifiedMap = null;
        // If txnId & otp supplied, verify via Eka Care ABDM
        if (request.txnId() != null && request.otp() != null) {
            EkaCareAbdmService.AbdmResult verifyRes = ekaCareAbdmService.verifyLoginOtp(request.txnId(), request.otp());
            if (!verifyRes.success()) {
                return ResponseEntity.badRequest().body(msg("ABHA verification failed: " + verifyRes.error()));
            }
            if (verifyRes.data() instanceof Map<?, ?> d) {
                @SuppressWarnings("unchecked")
                Map<String, Object> casted = (Map<String, Object>) d;
                verifiedMap = casted;
            }
        }

        try {
            String identifier = request.abhaIdentifier() != null ? request.abhaIdentifier().trim() : "";
            String abhaNumber = identifier.contains("@") ? null : identifier;
            String abhaAddress = identifier.contains("@") ? identifier : null;

            if (verifiedMap != null) {
                if (abhaNumber == null && verifiedMap.get("abhaNumber") != null) {
                    abhaNumber = String.valueOf(verifiedMap.get("abhaNumber"));
                }
                if (abhaAddress == null && verifiedMap.get("abhaAddress") != null) {
                    abhaAddress = String.valueOf(verifiedMap.get("abhaAddress"));
                }
            }

            String updatedName = Boolean.TRUE.equals(request.applyVerifiedDetails()) ? request.verifiedName() : null;
            Integer updatedAge = Boolean.TRUE.equals(request.applyVerifiedDetails()) ? request.verifiedAge() : null;
            String updatedGender = Boolean.TRUE.equals(request.applyVerifiedDetails()) ? request.verifiedGender() : null;
            java.time.LocalDate updatedDob = null;
            if (Boolean.TRUE.equals(request.applyVerifiedDetails()) && request.verifiedDob() != null) {
                try {
                    updatedDob = java.time.LocalDate.parse(request.verifiedDob());
                } catch (Exception ignored) {}
            }

            FamilyMemberDto updated = familyUnitService.linkAbhaToMember(
                    phone, memberId, abhaNumber, abhaAddress, updatedName, updatedAge, updatedGender, updatedDob);
            return ResponseEntity.ok(ok(updated));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(msg(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    @PostMapping("/members/{memberId}/enroll-abha")
    public ResponseEntity<Map<String, Object>> enrollAbha(
            @PathVariable int memberId,
            @Valid @RequestBody EnrollAbhaRequest request) {
        String phone = currentUser.requirePatientPhone();
        FamilyMemberDto member = familyUnitService.getMemberById(memberId);
        if (member == null) {
            return ResponseEntity.status(404).body(msg("Family member not found."));
        }

        EkaCareAbdmService.AbdmResult result = ekaCareAbdmService.enrollAadhaarVerify(
                request.txnId(), request.otp(), request.preferredAddress(), member.getName());
        if (!result.success()) {
            return ResponseEntity.badRequest().body(msg("Aadhaar enrollment failed: " + result.error()));
        }

        if (result.data() instanceof Map<?, ?> data) {
            String abhaNumber = (String) data.get("abhaNumber");
            String abhaAddress = (String) data.get("abhaAddress");
            String name = (String) data.get("name");
            Integer age = (Integer) data.get("age");
            String gender = (String) data.get("gender");

            FamilyMemberDto updated = familyUnitService.linkAbhaToMember(
                    phone, memberId, abhaNumber, abhaAddress, name, age, gender, null);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", true);
            resp.put("data", updated);
            resp.put("enrollmentDetails", data);
            return ResponseEntity.ok(resp);
        }
        return ResponseEntity.badRequest().body(msg("Invalid enrollment response."));
    }

    @GetMapping("/members/{memberId}/abha-qr")
    public ResponseEntity<?> getMemberAbhaQr(@PathVariable int memberId) {
        String phone = currentUser.requirePatientPhone();
        FamilyMemberDto member = familyUnitService.getMemberById(memberId);
        if (member == null) {
            return ResponseEntity.status(404).body(msg("Family member not found."));
        }
        // Verify ownership
        FamilyUnitDto unit = familyUnitService.getFamilyUnit(phone);
        if (unit == null || member.getFamilyUnitId() != unit.getId()) {
            return ResponseEntity.status(403).body(msg("Member does not belong to your family unit."));
        }

        try {
            Map<String, Object> qrPayloadMap = new LinkedHashMap<>();
            qrPayloadMap.put("hidn", member.getAbhaNumber() != null ? member.getAbhaNumber() : "");
            qrPayloadMap.put("hid", member.getAbhaAddress() != null ? member.getAbhaAddress() : "");
            qrPayloadMap.put("name", member.getName());
            qrPayloadMap.put("gender", member.getGender() != null ? member.getGender().toUpperCase() : "M");
            qrPayloadMap.put("dob", member.getDob() != null ? member.getDob().toString() : "");
            qrPayloadMap.put("dist_name", "Mumbai");
            qrPayloadMap.put("state_name", "Maharashtra");
            qrPayloadMap.put("type", "ABDM_HEALTH_CARD");

            String qrString = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(qrPayloadMap);
            byte[] qrPng = qrCodeService.generatePng(qrString, 350, 2, "#064E3B", "#FFFFFF");

            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.IMAGE_PNG)
                    .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .body(qrPng);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(msg("Failed generating ABHA QR code: " + e.getMessage()));
        }
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
}
