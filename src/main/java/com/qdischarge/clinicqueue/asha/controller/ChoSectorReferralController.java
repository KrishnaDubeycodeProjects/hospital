package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.service.ChoReferralService;
import com.qdischarge.clinicqueue.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sector-level CHO referral validation for the AarogyaFlow app.
 *
 * <ul>
 *   <li>{@code GET  /api/asha/cho/workers} — workers in the CHO's sector with activity counts</li>
 *   <li>{@code GET  /api/asha/cho/workers/{phone}/activity} — daily trend + recent activity of one sector worker</li>
 *   <li>{@code GET  /api/asha/cho/referrals?scope=pending|all} — referrals from every ASHA in the CHO's sector</li>
 *   <li>{@code POST /api/asha/referrals/{id}/approve} — validate a referral (physical triage / transport sign-off)</li>
 * </ul>
 * Unlike the legacy {@code /api/cho/*} admin endpoints, these never fall back to a default phone
 * and only expose referrals inside the caller's own sector.
 */
@RestController
@RequestMapping("/api/asha")
@RequiredArgsConstructor
public class ChoSectorReferralController {

    private final ChoReferralService choReferralService;
    private final CurrentUser currentUser;

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String code) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", code);
        return ResponseEntity.status(status).body(body);
    }

    @GetMapping("/cho/referrals")
    public ResponseEntity<?> sectorReferrals(@RequestParam(defaultValue = "all") String scope) {
        String cho = currentUser.getChoPhone();
        if (cho == null || cho.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        if (choReferralService.sectorSize(cho) == 0) return error(HttpStatus.FORBIDDEN, "NO_SECTOR");
        List<Map<String, Object>> referrals = choReferralService.listSectorReferrals(cho, "pending".equalsIgnoreCase(scope));
        return ResponseEntity.ok(referrals);
    }

    @GetMapping("/cho/workers")
    public ResponseEntity<?> sectorWorkers() {
        String cho = currentUser.getChoPhone();
        if (cho == null || cho.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        if (choReferralService.sectorSize(cho) == 0) return error(HttpStatus.FORBIDDEN, "NO_SECTOR");
        return ResponseEntity.ok(choReferralService.listSectorWorkers(cho));
    }

    @GetMapping("/cho/workers/{phone}/activity")
    public ResponseEntity<?> workerActivity(@PathVariable String phone) {
        String cho = currentUser.getChoPhone();
        if (cho == null || cho.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        Map<String, Object> activity = choReferralService.workerActivity(cho, phone);
        if (activity.isEmpty()) return error(HttpStatus.NOT_FOUND, "NOT_IN_SECTOR");
        return ResponseEntity.ok(activity);
    }

    @PostMapping("/referrals/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(@PathVariable int id,
                                                       @RequestBody(required = false) Map<String, String> body) {
        String cho = currentUser.getChoPhone();
        if (cho == null || cho.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        if (choReferralService.sectorSize(cho) == 0) return error(HttpStatus.FORBIDDEN, "NO_SECTOR");

        String note = body != null ? body.get("note") : null;
        ChoReferralService.ApproveOutcome outcome = choReferralService.approve(cho, id, note);
        if (outcome == ChoReferralService.ApproveOutcome.NOT_IN_SECTOR) {
            return error(HttpStatus.NOT_FOUND, "NOT_IN_SECTOR");
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("id", id);
        resp.put("status", "APPROVED_CHO");
        resp.put("alreadyApproved", outcome == ChoReferralService.ApproveOutcome.ALREADY_APPROVED);
        return ResponseEntity.ok(resp);
    }
}
