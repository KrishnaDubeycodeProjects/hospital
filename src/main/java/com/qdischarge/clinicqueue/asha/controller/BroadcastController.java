package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.service.AshaWorkerService;
import com.qdischarge.clinicqueue.asha.service.BroadcastService;
import com.qdischarge.clinicqueue.asha.service.ChoReferralService;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * NHM work broadcasts.
 * <ul>
 *   <li>{@code POST /api/asha/cho/broadcasts} — CHO → her sector, ADMIN → every worker</li>
 *   <li>{@code GET  /api/asha/cho/broadcasts} — what the caller sent, with read / done counts</li>
 *   <li>{@code POST /api/asha/cho/broadcasts/{id}/withdraw} — soft-delete own broadcast</li>
 *   <li>{@code GET  /api/asha/broadcasts/inbox} — ASHA / ANM: messages addressed to me</li>
 *   <li>{@code POST /api/asha/broadcasts/{id}/ack} — ASHA / ANM: mark read ({@code done=false}) or done</li>
 * </ul>
 * /api/asha/cho/** is already CHO/ADMIN-only in SecurityConfig; inbox routes are restricted to ASHA/ANM here.
 */
@RestController
@RequestMapping("/api/asha")
@RequiredArgsConstructor
public class BroadcastController {

    private final BroadcastService broadcastService;
    private final ChoReferralService choReferralService;
    private final AshaWorkerService ashaWorkerService;
    private final CurrentUser currentUser;

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String code) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", code);
        return ResponseEntity.status(status).body(body);
    }

    private static String trimmed(Object o) {
        return o == null ? "" : o.toString().trim();
    }

    @PostMapping("/cho/broadcasts")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        JwtService.DecodedToken caller = currentUser.get();
        if (caller == null) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        boolean admin = JwtService.ADMIN_ROLE.equals(caller.role());

        String title = trimmed(body.get("title"));
        String message = trimmed(body.get("message"));
        String priority = trimmed(body.get("priority")).toUpperCase();
        String audience = trimmed(body.get("audience")).toUpperCase();
        if (priority.isEmpty()) priority = "NORMAL";
        if (audience.isEmpty()) audience = "ALL";
        if (title.isEmpty() || message.isEmpty()) return error(HttpStatus.BAD_REQUEST, "TITLE_AND_MESSAGE_REQUIRED");
        if (title.length() > 120 || message.length() > 2000) return error(HttpStatus.BAD_REQUEST, "TOO_LONG");
        if (!BroadcastService.PRIORITIES.contains(priority) || !BroadcastService.AUDIENCES.contains(audience)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_PRIORITY_OR_AUDIENCE");
        }
        LocalDate due = null;
        String dueRaw = trimmed(body.get("dueDate"));
        if (!dueRaw.isEmpty()) {
            try {
                due = LocalDate.parse(dueRaw);
            } catch (DateTimeParseException e) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_DUE_DATE");
            }
        }

        String senderPhone;
        String senderName = null;
        if (admin) {
            senderPhone = caller.subject();
        } else {
            senderPhone = currentUser.getChoPhone();
            if (senderPhone == null || senderPhone.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
            if (choReferralService.sectorSize(senderPhone) == 0) return error(HttpStatus.FORBIDDEN, "NO_SECTOR");
            senderName = ashaWorkerService.getProfileForMe(senderPhone, JwtService.CHO_ROLE).map(AshaWorkerDto::getName).orElse(null);
        }

        int id = broadcastService.create(senderPhone, admin ? "ADMIN" : "CHO", senderName,
                new BroadcastService.NewBroadcast(title, message, priority, audience, due));
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("id", id);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @GetMapping("/cho/broadcasts")
    public ResponseEntity<?> sent() {
        JwtService.DecodedToken caller = currentUser.get();
        if (caller == null) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        String sender = JwtService.ADMIN_ROLE.equals(caller.role()) ? caller.subject() : currentUser.getChoPhone();
        if (sender == null || sender.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        return ResponseEntity.ok(broadcastService.sent(sender));
    }

    @PostMapping("/cho/broadcasts/{id}/withdraw")
    public ResponseEntity<Map<String, Object>> withdraw(@PathVariable int id) {
        JwtService.DecodedToken caller = currentUser.get();
        if (caller == null) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        String sender = JwtService.ADMIN_ROLE.equals(caller.role()) ? caller.subject() : currentUser.getChoPhone();
        if (sender == null || sender.isBlank()) return error(HttpStatus.UNAUTHORIZED, "UNIDENTIFIED_CALLER");
        if (!broadcastService.withdraw(id, sender)) return error(HttpStatus.NOT_FOUND, "NOT_FOUND");
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** ASHA / ANM caller's phone + role, or null when the caller is not a field worker. */
    private String[] workerIdentity() {
        JwtService.DecodedToken caller = currentUser.get();
        if (caller == null) return null;
        String role = caller.role();
        if (!JwtService.ASHA_ROLE.equals(role) && !JwtService.ANM_ROLE.equals(role)) return null;
        String phone = currentUser.getAshaPhone();
        return phone == null || phone.isBlank() ? null : new String[] {phone, role};
    }

    @GetMapping("/broadcasts/inbox")
    public ResponseEntity<?> inbox() {
        String[] who = workerIdentity();
        if (who == null) return error(HttpStatus.FORBIDDEN, "WORKERS_ONLY");
        return ResponseEntity.ok(broadcastService.inbox(who[0], who[1]));
    }

    @PostMapping("/broadcasts/{id}/ack")
    public ResponseEntity<Map<String, Object>> ack(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body) {
        String[] who = workerIdentity();
        if (who == null) return error(HttpStatus.FORBIDDEN, "WORKERS_ONLY");
        if (!broadcastService.isAddressedTo(id, who[0], who[1])) return error(HttpStatus.NOT_FOUND, "NOT_FOUND");
        boolean done = body != null && Boolean.TRUE.equals(body.get("done"));
        broadcastService.acknowledge(id, who[0], done);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
