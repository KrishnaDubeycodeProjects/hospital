package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.dto.AnmProfileDto;
import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyResponseDto;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.asha.service.ChoReferralService;
import com.qdischarge.clinicqueue.asha.service.AnmService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/anm")
@RequiredArgsConstructor
@Slf4j
public class AnmController {

    private final AnmService anmService;
    private final CurrentUser currentUser;
    private final ChoReferralService choReferralService;

    /** ANM profiles are created by a CHO / ADMIN only (no self-registration). */
    @PostMapping("/register")
    public ResponseEntity<AnmProfileDto> register(@RequestBody Map<String, String> body) {
        var caller = currentUser.get();
        String callerRole = caller != null ? caller.role() : null;
        if (!"CHO".equals(callerRole) && !"ADMIN".equals(callerRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String phone = body.get("phone");
        String name = body.get("name");
        String phcName = body.get("phcName");
        return ResponseEntity.status(HttpStatus.CREATED).body(anmService.register(phone, name, phcName));
    }

    @GetMapping("/me")
    public ResponseEntity<AnmProfileDto> getMe() {
        String phone = currentUser.getAshaPhone();
        if (phone == null || phone.isBlank()) phone = "9876543211";
        Optional<AnmProfileDto> anm = anmService.getByPhone(phone);
        if (anm.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AnmProfileDto dto = anm.get();
        dto.setQrCodeImage(anmService.generateQrCodeImage(dto.getQrCodeData()));
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/data")
    public ResponseEntity<List<Map<String, Object>>> getIncomingData(@RequestParam(required = false, defaultValue = "ALL") String section) {
        String phone = currentUser.getAshaPhone();
        if (phone == null || phone.isBlank()) phone = "9876543211";
        return ResponseEntity.ok(anmService.getIncomingData(phone, section));
    }

    @GetMapping("/ashas")
    public ResponseEntity<List<AshaWorkerDto>> listAshaWorkers() {
        String phone = currentUser.getAshaPhone();
        if (phone == null || phone.isBlank()) phone = "9876543211";
        return ResponseEntity.ok(anmService.listAshaWorkers(phone));
    }

    /** Forms an ASHA sent to ANM — all members (/forms) or one member (/members/{memberId}/forms). */
    @GetMapping({"/data/{ashaPhone}/forms", "/data/{ashaPhone}/members/{memberId}/forms"})
    public ResponseEntity<List<SurveyResponseDto>> getMemberForms(
            @PathVariable String ashaPhone,
            @PathVariable(required = false) Integer memberId,
            @RequestParam(required = false) String category) {
        HttpStatus denied = checkAshaAccess(ashaPhone);
        if (denied != null) return ResponseEntity.status(denied).build();
        return ResponseEntity.ok(anmService.getMemberForms(ashaPhone, memberId, category));
    }

    /**
     * ANM: the ASHA must be assigned to her (asha_workers.anm_phone). CHO: the ASHA must be in her sector.
     * ADMIN: allowed. Returns null when allowed, otherwise 401/403.
     */
    private HttpStatus checkAshaAccess(String ashaPhone) {
        var caller = currentUser.get();
        if (caller == null) return HttpStatus.UNAUTHORIZED;
        String role = caller.role();
        if (JwtService.ADMIN_ROLE.equals(role)) return null;
        String callerPhone = currentUser.getAshaPhone();
        if (callerPhone == null || callerPhone.isBlank()) return HttpStatus.UNAUTHORIZED;
        if (JwtService.ANM_ROLE.equals(role)) {
            return choReferralService.isAshaAssignedToAnm(callerPhone, ashaPhone) ? null : HttpStatus.FORBIDDEN;
        }
        if (JwtService.CHO_ROLE.equals(role)) {
            return choReferralService.isAshaInSector(callerPhone, ashaPhone) ? null : HttpStatus.FORBIDDEN;
        }
        return HttpStatus.FORBIDDEN;
    }

    @PostMapping({"/session", "/qr"})
    public ResponseEntity<Map<String, Object>> createSession(@RequestBody(required = false) Map<String, String> body) {
        String phone = currentUser.getAshaPhone();
        if (phone == null || phone.isBlank()) phone = "9876543211";
        String title = body != null ? body.get("title") : null;
        String category = body != null ? body.get("category") : null;
        String qrCode = body != null ? (body.get("qrCode") != null ? body.get("qrCode") : body.get("qrCodeValue")) : null;
        return ResponseEntity.ok(anmService.createOrUpdateSession(phone, title, category, qrCode));
    }
}
