package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.dto.DashboardDto;
import com.qdischarge.clinicqueue.asha.dto.FamilyDetailDto;
import com.qdischarge.clinicqueue.asha.dto.FamilyGridDto;
import com.qdischarge.clinicqueue.asha.dto.MemberDto;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.asha.service.AshaWorkerService;
import com.qdischarge.clinicqueue.asha.service.ChoReferralService;
import com.qdischarge.clinicqueue.util.PhoneNormalizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/asha")
@RequiredArgsConstructor
@Slf4j
public class AshaWorkerController {

    private final AshaWorkerService ashaWorkerService;
    private final CurrentUser currentUser;

    /**
     * Worker onboarding — CHO-managed only (no self-registration on mobile).
     * A CHO registers ASHA / ANM workers of their sector; the worker then simply logs in with
     * phone + OTP and their profile loads from this record. ADMIN may also register.
     */
    @PostMapping("/register")
    public ResponseEntity<AshaWorkerDto> register(@RequestBody AshaWorkerDto body) {
        JwtService.DecodedToken caller = currentUser.get();
        String callerRole = caller != null ? caller.role() : null;
        if (!JwtService.CHO_ROLE.equals(callerRole) && !JwtService.ADMIN_ROLE.equals(callerRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String phone10 = ChoReferralService.lastTenDigits(body.getPhone());
        if (phone10.length() != 10) return ResponseEntity.badRequest().build();

        body.setRole("ANM".equalsIgnoreCase(body.getRole()) ? "ANM" : "ASHA");
        if (JwtService.CHO_ROLE.equals(callerRole) && (body.getAnmPhone() == null || body.getAnmPhone().isBlank())) {
            body.setAnmPhone(currentUser.getChoPhone()); // worker joins the registering CHO's sector
        }
        if (ashaWorkerService.getByPhone(body.getPhone()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        AshaWorkerDto saved = ashaWorkerService.register(body);
        log.info("Worker {} registered as {} by {}", PhoneNormalizer.mask(body.getPhone()), body.getRole(), callerRole);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/me")
    public ResponseEntity<AshaWorkerDto> getByPhone() {
        String phone = currentUser.requireAshaPhone();
        log.info("Fetching ASHA worker profile for phone: {}", phone);
        JwtService.DecodedToken caller = currentUser.get();
        Optional<AshaWorkerDto> worker = ashaWorkerService.getProfileForMe(phone, caller != null ? caller.role() : null);
        return worker.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardDto> getDashboard() {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(ashaWorkerService.getDashboard(phone));
    }

    @GetMapping("/families")
    public ResponseEntity<List<FamilyDetailDto>> listFamilies(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort) {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(ashaWorkerService.listFamilies(phone, search, sort));
    }

    @GetMapping("/families/{id}")
    public ResponseEntity<FamilyDetailDto> getFamilyDetail(@PathVariable Integer id) {
        return ResponseEntity.ok(ashaWorkerService.getFamilyDetail(id));
    }

    @GetMapping("/families/{id}/members")
    public ResponseEntity<List<MemberDto>> getFamilyMembers(@PathVariable Integer id) {
        return ResponseEntity.ok(ashaWorkerService.getFamilyDetail(id).getMembers());
    }

    @PostMapping("/families")
    public ResponseEntity<FamilyDetailDto> createFamily(@RequestBody FamilyGridDto body) {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ashaWorkerService.createFamily(phone, body));
    }

    @PostMapping("/families/{id}/members")
    public ResponseEntity<MemberDto> addMember(@PathVariable Integer id, @RequestBody MemberDto body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ashaWorkerService.addMember(id, body));
    }

    @PutMapping("/families/{familyId}/members/{memberId}")
    public ResponseEntity<MemberDto> updateMember(@PathVariable Integer familyId, @PathVariable Integer memberId, @RequestBody MemberDto body) {
        return ResponseEntity.ok(ashaWorkerService.updateMember(memberId, body));
    }

    @DeleteMapping("/families/{familyId}/members/{memberId}")
    public ResponseEntity<Void> deleteMember(@PathVariable Integer familyId, @PathVariable Integer memberId) {
        ashaWorkerService.deleteMember(memberId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/families/{id}/visit-interval")
    public ResponseEntity<Void> setVisitInterval(@PathVariable Integer id, @RequestBody Map<String, Integer> body) {
        Integer intervalDays = body != null ? body.get("intervalDays") : null;
        ashaWorkerService.setVisitInterval(id, intervalDays);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/grid")
    public ResponseEntity<List<FamilyGridDto>> getGridData(@RequestParam(required = false) String section) {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(ashaWorkerService.getGridData(phone, section));
    }
}
