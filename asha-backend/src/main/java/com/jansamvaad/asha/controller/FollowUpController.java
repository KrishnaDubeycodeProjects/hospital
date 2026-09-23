package com.jansamvaad.asha.controller;

import com.jansamvaad.asha.dto.FollowUpTaskDto;
import com.jansamvaad.asha.security.CurrentUser;
import com.jansamvaad.asha.service.FollowUpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/followups")
@RequiredArgsConstructor
@Slf4j
public class FollowUpController {

    private final FollowUpService followUpService;
    private final CurrentUser currentUser;

    @GetMapping("/")
    public ResponseEntity<List<FollowUpTaskDto>> listFollowUps(@RequestParam(required = false) String status) {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(followUpService.listFollowUps(phone, status));
    }

    @GetMapping("/overdue")
    public ResponseEntity<List<FollowUpTaskDto>> listOverdue() {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(followUpService.listOverdue(phone));
    }

    @GetMapping("/today")
    public ResponseEntity<List<FollowUpTaskDto>> listToday() {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(followUpService.listToday(phone));
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<FollowUpTaskDto> completeFollowUp(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        String notes = body != null ? body.get("notes") : null;
        return ResponseEntity.ok(followUpService.completeFollowUp(id, notes));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<FollowUpTaskDto> cancelFollowUp(@PathVariable Integer id) {
        return ResponseEntity.ok(followUpService.cancelFollowUp(id));
    }

    @PostMapping("/simulate-missed-referral")
    public ResponseEntity<Map<String, Object>> simulateMissedReferral(
            @RequestParam(defaultValue = "7") int daysOverdue,
            @RequestParam(defaultValue = "12") int houseNumber,
            @RequestParam(defaultValue = "High-Risk ANC Checkup") String referralReason) {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(followUpService.simulateMissedReferral(phone, daysOverdue, houseNumber, referralReason));
    }
}
