package com.qdischarge.clinicqueue.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.QueueData;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.UpdateStatusResult;
import com.qdischarge.clinicqueue.service.QrCodeService;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Java port of backend/routes/queue.js. Same paths, same request/response
 * shapes, same admin-token auth on /verify and PUT /:id.
 */
@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
@Slf4j
public class QueueController {

    private final QueueManagerService queueManagerService;
    private final QrCodeService qrCodeService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    private boolean isAdminAuthorized(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        String expected = appProperties.getAdminToken();
        return authHeader != null
                && authHeader.startsWith("Bearer ")
                && authHeader.substring(7).equals(expected);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody(required = false) Map<String, String> body) {
        String username = body != null ? body.get("username") : null;
        String password = body != null ? body.get("password") : null;

        if (Objects.equals(username, appProperties.getAdminUsername())
                && Objects.equals(password, appProperties.getAdminPassword())) {
            Map<String, Object> ok = new LinkedHashMap<>();
            ok.put("success", true);
            ok.put("token", appProperties.getAdminToken());
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
    public ResponseEntity<Map<String, Object>> create(@RequestBody(required = false) Map<String, String> body) {
        String name = body != null ? body.get("name") : null;
        String phone = body != null ? body.get("phone") : null;

        if (phone == null || phone.isBlank()) {
            return ResponseEntity.badRequest().body(msg("Phone number is required."));
        }

        try {
            CreateTokenResult result = queueManagerService.createToken(name, phone);
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
    public ResponseEntity<Map<String, Object>> verify(HttpServletRequest request,
                                                        @RequestBody(required = false) Map<String, Object> body) {
        if (!isAdminAuthorized(request)) {
            return ResponseEntity.status(401).body(msg("Unauthorized. Admin token is missing or invalid."));
        }

        Object qrData = body != null ? body.get("qrData") : null;
        Integer targetId = toInt(body != null ? body.get("tokenId") : null);

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
    public ResponseEntity<Map<String, Object>> updateStatus(HttpServletRequest request,
                                                              @PathVariable String id,
                                                              @RequestBody(required = false) Map<String, String> body) {
        if (!isAdminAuthorized(request)) {
            return ResponseEntity.status(401).body(msg("Unauthorized. Admin token is missing or invalid."));
        }

        String status = body != null ? body.get("status") : null;
        List<String> validStatuses = List.of("waiting", "serving", "completed", "missed");
        if (status == null || !validStatuses.contains(status)) {
            return ResponseEntity.badRequest().body(msg("Invalid status."));
        }

        try {
            UpdateStatusResult result = queueManagerService.updateTokenStatus(id, status);
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
