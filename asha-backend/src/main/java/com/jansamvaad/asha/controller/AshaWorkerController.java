package com.jansamvaad.asha.controller;

import com.jansamvaad.asha.dto.AshaWorkerDto;
import com.jansamvaad.asha.dto.DashboardDto;
import com.jansamvaad.asha.dto.FamilyDetailDto;
import com.jansamvaad.asha.dto.FamilyGridDto;
import com.jansamvaad.asha.dto.MemberDto;
import com.jansamvaad.asha.security.CurrentUser;
import com.jansamvaad.asha.service.AshaWorkerService;
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

    @PostMapping("/register")
    public ResponseEntity<AshaWorkerDto> register(@RequestBody AshaWorkerDto body) {
        log.info("Registering ASHA worker");
        return ResponseEntity.status(HttpStatus.CREATED).body(ashaWorkerService.register(body));
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
