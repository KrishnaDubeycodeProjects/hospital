package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.CreateReferralRequest;
import com.qdischarge.clinicqueue.dto.DoctorDto;
import com.qdischarge.clinicqueue.dto.ReferralDto;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.service.DoctorService;
import com.qdischarge.clinicqueue.service.QrCodeService;
import com.qdischarge.clinicqueue.service.ReferralService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/referrals")
@RequiredArgsConstructor
public class ReferralController {

    private final ReferralService referralService;
    private final DoctorService doctorService;
    private final QrCodeService qrCodeService;
    private final CurrentUser currentUser;

    @PostMapping
    public ResponseEntity<Map<String, Object>> createReferral(@Valid @RequestBody CreateReferralRequest request) {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null || doctor.getHospitalId() == null) {
            return ResponseEntity.badRequest().body(msg("Doctor must be affiliated with a hospital before creating referrals."));
        }
        int fromHospitalId = doctor.getHospitalId();

        try {
            ReferralDto referral = referralService.createReferral(request, doctorId, fromHospitalId);
            return ResponseEntity.ok(ok(referral));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(msg(e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("@courseSecurity.canAccessReferral(authentication, #id)")
    public ResponseEntity<Map<String, Object>> getReferral(@PathVariable int id) {
        ReferralDto referral = referralService.getReferralById(id);
        if (referral == null) {
            return ResponseEntity.status(404).body(msg("Referral not found."));
        }
        return ResponseEntity.ok(ok(referral));
    }

    @GetMapping("/{id}/qr")
    public ResponseEntity<?> getReferralQr(@PathVariable int id) {
        ReferralDto referral = referralService.getReferralById(id);
        if (referral == null) {
            return ResponseEntity.status(404).body(msg("Referral not found."));
        }
        try {
            byte[] png = qrCodeService.generatePng(referral.getQrPayload(), 350, 2, "#0f172a", "#ffffff");
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .body(png);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(msg("Error generating QR: " + e.getMessage()));
        }
    }

    @GetMapping("/prior-context")
    public ResponseEntity<Map<String, Object>> getPriorContext(
            @RequestParam int courseId,
            @RequestParam int toHospitalId) {
        ReferralDto prior = referralService.findPriorReferralContext(courseId, toHospitalId);
        return ResponseEntity.ok(ok(prior));
    }

    @GetMapping("/patient")
    public ResponseEntity<Map<String, Object>> listPatientReferrals() {
        String phone = currentUser.requirePatientPhone();
        List<ReferralDto> referrals = referralService.listReferralsForPatient(phone);
        return ResponseEntity.ok(ok(referrals));
    }

    @GetMapping("/public/patient")
    public ResponseEntity<Map<String, Object>> listPublicPatientReferrals(@RequestParam(name = "phone", required = false) String phone) {
        if (phone == null || phone.trim().isBlank()) {
            return ResponseEntity.badRequest().body(msg("Phone number parameter is required."));
        }
        List<ReferralDto> referrals = referralService.listReferralsForPatient(phone.trim());
        return ResponseEntity.ok(ok(referrals));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<Map<String, Object>> completeReferral(@PathVariable int id) {
        ReferralDto updated = referralService.completeReferral(id);
        return ResponseEntity.ok(ok(updated));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancelReferral(@PathVariable int id) {
        int doctorId = currentUser.requireDoctorId();
        ReferralDto updated = referralService.cancelReferral(id, doctorId);
        return ResponseEntity.ok(ok(updated));
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
