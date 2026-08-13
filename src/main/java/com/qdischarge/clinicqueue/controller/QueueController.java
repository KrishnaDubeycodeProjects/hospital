package com.qdischarge.clinicqueue.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.dto.CreateTokenRequest;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.LoginRequest;
import com.qdischarge.clinicqueue.dto.QueueData;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.UpdateStatusRequest;
import com.qdischarge.clinicqueue.dto.UpdateStatusResult;
import com.qdischarge.clinicqueue.dto.VerifyRequest;
import com.qdischarge.clinicqueue.security.AdminAuthService;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.service.QrCodeService;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Java port of backend/routes/queue.js. Same paths and response shapes as
 * the original; admin auth on /verify and PUT /:id is now enforced
 * declaratively by SecurityConfig (JWT + ROLE_ADMIN) instead of a manual
 * per-route header check.
 */
@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
@Slf4j
public class QueueController {

    private final QueueManagerService queueManagerService;
    private final QrCodeService qrCodeService;
    private final AdminAuthService adminAuthService;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        if (adminAuthService.authenticate(request.username(), request.password())) {
            Map<String, Object> ok = new LinkedHashMap<>();
            ok.put("success", true);
            ok.put("token", jwtService.generateAdminToken(request.username()));
            return ResponseEntity.ok(ok);
        }
        return ResponseEntity.status(401).body(msg("Invalid username or password."));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getQueue() {
        try {
            QueueData data = queueManagerService.getQueue();
            return ResponseEntity.ok(ok(data));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @GetMapping("/current")
    public ResponseEntity<Map<String, Object>> current() {
        try {
            return ResponseEntity.ok(ok(queueManagerService.getCurrentServingToken()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @GetMapping("/position/{phone}")
    public ResponseEntity<Map<String, Object>> position(@PathVariable String phone) {
        try {
            TokenDto data = queueManagerService.getPatientPosition(phone);
            if (data == null) {
                return ResponseEntity.status(404).body(msg("No active token found for this phone number."));
            }
            return ResponseEntity.ok(ok(data));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @GetMapping("/token/{id}")
    public ResponseEntity<Map<String, Object>> tokenDetails(@PathVariable String id) {
        try {
            TokenDto data = queueManagerService.getTokenDetails(id);
            if (data == null) {
                return ResponseEntity.status(404).body(msg("Token not found."));
            }
            return ResponseEntity.ok(ok(data));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateTokenRequest request) {
        try {
            CreateTokenResult result = queueManagerService.createToken(request.name(), request.phone());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", true);
            resp.put("alreadyExists", result.alreadyExists());
            resp.put("data", result.data());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @GetMapping("/qr/{id}")
    public ResponseEntity<?> qr(@PathVariable String id) {
        try {
            int tokenId = Integer.parseInt(id);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("tokenId", tokenId);
            payload.put("type", "CLINIC_QUEUE_TOKEN");
            payload.put("timestamp", System.currentTimeMillis());
            String qrPayload = objectMapper.writeValueAsString(payload);

            byte[] png = qrCodeService.generatePng(qrPayload, 350, 2, "#0f172a", "#ffffff");

            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .body(png);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(@RequestBody(required = false) VerifyRequest request) {
        Object qrData = request != null ? request.qrData() : null;
        Integer targetId = request != null ? request.tokenId() : null;

        if (targetId == null && qrData != null) {
            try {
                if (qrData instanceof Map<?, ?> mapData) {
                    targetId = toInt(mapData.get("tokenId"));
                } else if (qrData instanceof String s) {
                    if (s.startsWith("{")) {
                        JsonNode parsed = objectMapper.readTree(s);
                        JsonNode tid = parsed.has("tokenId") ? parsed.get("tokenId") : parsed.get("id");
                        targetId = tid != null ? tid.asInt() : null;
                    } else {
                        Matcher m = Pattern.compile("\\d+").matcher(s);
                        if (m.find()) {
                            targetId = Integer.parseInt(m.group());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Error parsing QR data: {}", e.getMessage());
            }
        }

        if (targetId == null) {
            return ResponseEntity.badRequest().body(msg("Invalid or missing QR payload / Token ID."));
        }

        try {
            TokenDto result = queueManagerService.verifyTokenByAdmin(targetId);
            if (result == null) {
                return ResponseEntity.status(404).body(msg("Token #" + targetId + " not found in database."));
            }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", true);
            resp.put("message", "🎉 Token #" + targetId + " (" + result.getName()
                    + ") verified successfully! Welcome WhatsApp notification sent to patient.");
            resp.put("data", result);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Error verifying token:", e);
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable String id,
                                                              @Valid @RequestBody UpdateStatusRequest request) {
        List<String> validStatuses = List.of("waiting", "serving", "completed", "missed");
        if (!validStatuses.contains(request.status())) {
            return ResponseEntity.badRequest().body(msg("Invalid status."));
        }

        try {
            UpdateStatusResult result = queueManagerService.updateTokenStatus(id, request.status());
            if (result == null) {
                return ResponseEntity.status(404).body(msg("Token not found."));
            }
            return ResponseEntity.ok(ok(result));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    // ---- response helpers ----

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

    private Map<String, Object> err(Exception e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", e.getMessage());
        return m;
    }

    private Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(o.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
