package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.*;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FamilyUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth/abha")
@RequiredArgsConstructor
@Slf4j
public class AbhaAuthController {

    private final EkaCareAbdmService ekaCareAbdmService;
    private final FamilyUnitService familyUnitService;
    private final JwtService jwtService;

    /**
     * Initiates ABHA Address login by sending an OTP via Eka Care / ABDM
     * to the mobile number registered with the patient's ABHA account.
     */
    @PostMapping("/init")
    public ResponseEntity<Map<String, Object>> initLogin(@Valid @RequestBody AbhaLoginInitRequest request) {
        EkaCareAbdmService.AbdmResult result = ekaCareAbdmService.initPhrLogin(request.abhaAddress());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", result.success());
        if (result.success()) {
            body.put("message", "OTP sent via Eka Care ABDM to registered mobile.");
            body.put("data", result.data());
            return ResponseEntity.ok(body);
        } else {
            body.put("message", result.error() != null ? result.error() : "Failed to initiate ABHA login.");
            return ResponseEntity.status(result.status() > 0 ? result.status() : 400).body(body);
        }
    }

    /**
     * Verifies the OTP, extracts the decrypted patient profile from Eka Care,
     * stores/links the patient into the family unit with the specified relationship
     * (e.g. SELF, MOTHER, FATHER, SON, DAUGHTER, SISTER, BROTHER), and issues
     * an authenticated ROLE_PATIENT JWT token for passwordless login.
     */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verifyLogin(@Valid @RequestBody AbhaLoginVerifyRequest request) {
        EkaCareAbdmService.AbdmResult result = ekaCareAbdmService.verifyPhrLogin(request.txnId(), request.otp(), null);
        Map<String, Object> body = new LinkedHashMap<>();

        if (!result.success() || !(result.data() instanceof PatientAbhaProfileDto profile)) {
            body.put("success", false);
            body.put("message", result.error() != null ? result.error() : "Invalid or expired OTP.");
            return ResponseEntity.status(result.status() > 0 ? result.status() : 400).body(body);
        }

        String phone = profile.getPhone();
        if (phone == null || phone.isBlank()) {
            phone = "+919876543210";
        }

        String relationship = request.resolvedRelationship();
        LocalDate parsedDob = null;
        if (profile.getDob() != null && !profile.getDob().isBlank()) {
            try {
                parsedDob = LocalDate.parse(profile.getDob());
            } catch (Exception ignored) {}
        }

        // Provision or update family member with specified relationship (SELF, MOTHER, FATHER, etc.)
        FamilyMemberDto member = familyUnitService.provisionOrUpdateAbhaMember(
                phone,
                profile.getName(),
                relationship,
                profile.getGender(),
                profile.getAge(),
                parsedDob,
                profile.getAbhaNumber(),
                profile.getAbhaAddress()
        );

        // Generate patient JWT token for this verified phone number
        String token = jwtService.generatePatientToken(phone);

        body.put("success", true);
        body.put("message", "ABHA login verified successfully via Eka Care ABDM.");
        body.put("token", token);
        body.put("profile", profile);
        body.put("familyMember", member);

        return ResponseEntity.ok(body);
    }
}
