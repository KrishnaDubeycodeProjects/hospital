package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.AddFamilyMemberRequest;
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
    public ResponseEntity<Map<String, Object>> listPublicMembers(@RequestParam(defaultValue = "8850934544") String phone) {
        List<FamilyMemberDto> members = familyUnitService.listMembersByCleanPhone(phone);
        return ResponseEntity.ok(ok(members));
    }

    @PostMapping("/members")
    public ResponseEntity<Map<String, Object>> addMember(@Valid @RequestBody AddFamilyMemberRequest request) {
        String phone = currentUser.requirePatientPhone();
        FamilyMemberDto created = familyUnitService.addFamilyMember(phone, request);
        return ResponseEntity.ok(ok(created));
    }

    @PostMapping("/members/{memberId}/link-abha")
    public ResponseEntity<Map<String, Object>> linkAbha(
            @PathVariable int memberId,
            @Valid @RequestBody LinkAbhaRequest request) {
        String phone = currentUser.requirePatientPhone();

        // If txnId & otp supplied, verify via Eka Care ABDM
        if (request.txnId() != null && request.otp() != null) {
            EkaCareAbdmService.AbdmResult verifyRes = ekaCareAbdmService.verifyLoginOtp(request.txnId(), request.otp());
            if (!verifyRes.success()) {
                return ResponseEntity.badRequest().body(msg("ABHA verification failed: " + verifyRes.error()));
            }
        }

        try {
            String identifier = request.abhaIdentifier() != null ? request.abhaIdentifier().trim() : "";
            String abhaNumber = identifier.contains("@") ? null : identifier;
            String abhaAddress = identifier.contains("@") ? identifier : null;
            FamilyMemberDto updated = familyUnitService.linkAbhaToMember(phone, memberId, abhaNumber, abhaAddress);
            return ResponseEntity.ok(ok(updated));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(msg(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
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
