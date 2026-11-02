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
import com.qdischarge.clinicqueue.asha.service.WorkerIdentityService;
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
    private final WorkerIdentityService workerIdentityService;
    private final JwtService jwtService;

    /**
     * Worker onboarding (open endpoint).
     * <ul>
     *   <li>CHO / ADMIN caller: registers another worker; the requested cadre (ASHA / ANM) is
     *       honoured and the worker joins the CHO's sector (anm_phone defaults to the CHO).</li>
     *   <li>Self-registration: always cadre ASHA. If the caller presents an OTP-verified token for
     *       the SAME phone, the response carries a 30-day worker JWT (no second OTP needed).</li>
     *   <li>Anonymous: registered as ASHA, but no token is issued — a worker token always
     *       requires proof of phone ownership.</li>
     * </ul>
     */
    @PostMapping("/register")
    public ResponseEntity<AshaWorkerDto> register(@RequestBody AshaWorkerDto body) {
        String phone10 = ChoReferralService.lastTenDigits(body.getPhone());
        if (phone10.length() != 10) return ResponseEntity.badRequest().build();

        JwtService.DecodedToken caller = currentUser.get();
        String callerRole = caller != null ? caller.role() : null;
        boolean byOfficer = JwtService.CHO_ROLE.equals(callerRole) || JwtService.ADMIN_ROLE.equals(callerRole);
        boolean selfProven = !byOfficer && caller != null && caller.subject() != null
                && (JwtService.PATIENT_ROLE.equals(callerRole) || JwtService.isWorkerRole(callerRole))
                && ChoReferralService.lastTenDigits(caller.subject()).equals(phone10);

        if (!byOfficer) {
            body.setRole("ASHA"); // self / anonymous onboarding never chooses its own cadre
        } else if (JwtService.CHO_ROLE.equals(callerRole) && (body.getAnmPhone() == null || body.getAnmPhone().isBlank())) {
            body.setAnmPhone(currentUser.getChoPhone());
        }

        Optional<AshaWorkerDto> existing = ashaWorkerService.getByPhone(body.getPhone());
        AshaWorkerDto saved;
        HttpStatus status;
        if (existing.isPresent()) {
            if (!selfProven) return ResponseEntity.status(HttpStatus.CONFLICT).build();
            saved = existing.get(); // already registered: just hand the proven owner their token
            status = HttpStatus.OK;
        } else {
            saved = ashaWorkerService.register(body);
            status = HttpStatus.CREATED;
        }
        log.info("Worker registration {} (by {})", PhoneNormalizer.mask(body.getPhone()),
                byOfficer ? callerRole : selfProven ? "self-verified" : "anonymous");

        if (selfProven) {
            workerIdentityService.resolveWorkerRole(body.getPhone()).ifPresent(role ->
                    saved.setAuthToken(jwtService.generateWorkerToken(PhoneNormalizer.normalize(body.getPhone()), role)));
        }
        return ResponseEntity.status(status).body(saved);
    }

    @GetMapping("/me")
    public ResponseEntity<AshaWorkerDto> getByPhone() {
        String phone = currentUser.requireAshaPhone();
        log.info("Fetching ASHA worker profile for phone: {}", phone);
        Optional<AshaWorkerDto> worker = ashaWorkerService.getByPhone(phone);
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
