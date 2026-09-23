package com.qdischarge.clinicqueue.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.dto.CreateTokenRequest;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.LoginRequest;
import com.qdischarge.clinicqueue.dto.QueueData;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.dto.Stats;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.TravelRangeDto;
import com.qdischarge.clinicqueue.dto.UpdateStatusRequest;
import com.qdischarge.clinicqueue.dto.UpdateStatusResult;
import com.qdischarge.clinicqueue.dto.VerifyRequest;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
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

    /** hospitalId/category are optional -- omit both for the hospital-wide view, or pass both to see one department's queue. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getQueue(@RequestParam(required = false) Integer hospitalId,
                                                          @RequestParam(required = false) String category) {
        try {
            QueueData data = queueManagerService.getQueue(hospitalId, category);
            return ResponseEntity.ok(ok(data));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @GetMapping("/current")
    public ResponseEntity<Map<String, Object>> current(@RequestParam(required = false) Integer hospitalId,
                                                         @RequestParam(required = false) String category) {
        try {
            return ResponseEntity.ok(ok(queueManagerService.getCurrentServingToken(hospitalId, category)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @GetMapping({"/position", "/position/{phone}"})
    public ResponseEntity<Map<String, Object>> position(
            @PathVariable(name = "phone", required = false) String pathPhone,
            @RequestParam(name = "phone", required = false) String queryPhone) {
        String effectivePhone = (pathPhone != null && !pathPhone.isBlank()) ? pathPhone : queryPhone;
        if (effectivePhone == null || effectivePhone.isBlank()) {
            return ResponseEntity.badRequest().body(msg("Phone number is required"));
        }
        try {
            TokenDto data = queueManagerService.getPatientPosition(effectivePhone);
            if (data == null) {
                TokenDto active = queueManagerService.getActiveToken(effectivePhone);
                if (active != null) {
                    data = queueManagerService.getTokenDetails(String.valueOf(active.getId()));
                }
            }
            if (data == null) {
                return ResponseEntity.status(404).body(msg("No active token found for this phone number."));
            }
            return ResponseEntity.ok(ok(data));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /**
     * Every past completed visit under this phone number (potentially for
     * different patients -- see QueueManagerService#archiveToHistory).
     * Admin-only: unlike /position/{phone}, this can surface more than one
     * patient's name/age history under a shared number.
     */
    @GetMapping("/history/{phone}")
    public ResponseEntity<Map<String, Object>> history(@PathVariable String phone) {
        try {
            return ResponseEntity.ok(ok(queueManagerService.getPatientHistory(phone)));
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
            CreateTokenResult result = queueManagerService.createToken(
                    request.name(), request.age(), request.gender(), request.category(), request.phone(),
                    request.toLocationOrNull(), request.hospitalId(), request.selectedTravelMinutes());
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("success", true);
            resp.put("alreadyExists", result.alreadyExists());
            resp.put("data", result.data());
            return ResponseEntity.ok(resp);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /** Pre-booking calculation of travel time range (-10% to +50%) via MapMyIndia (Mappls). */
    @GetMapping("/travel-range")
    public ResponseEntity<Map<String, Object>> getTravelRange(
            @RequestParam(required = false) String digipin,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Integer hospitalId) {
        try {
            SetLocationRequest loc = new SetLocationRequest(digipin, latitude, longitude);
            TravelRangeDto range = queueManagerService.getTravelRange(loc, hospitalId);
            return ResponseEntity.ok(ok(range));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /** View tokens currently in frozen / travel-pending state. */
    @GetMapping("/frozen")
    public ResponseEntity<Map<String, Object>> getFrozenQueue(
            @RequestParam(required = false) Integer hospitalId,
            @RequestParam(required = false) String category) {
        try {
            List<TokenDto> frozen = queueManagerService.getFrozenQueue(hospitalId, category);
            return ResponseEntity.ok(ok(frozen));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /** Patient shares their current GPS location or manually enters one (DIGIPIN or lat/lon). */
    @PostMapping("/{id}/location")
    public ResponseEntity<Map<String, Object>> setLocation(@PathVariable String id,
                                                             @Valid @RequestBody SetLocationRequest request) {
        try {
            TokenDto updated = queueManagerService.updateTokenLocation(Integer.parseInt(id), request);
            if (updated == null) {
                return ResponseEntity.status(404).body(msg("Token not found."));
            }
            return ResponseEntity.ok(ok(updated));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /** Pre-registration check: "Hospital is 15 km away, only 30 minutes remain before OPD closes. Continue?" */
    @GetMapping("/closing-time-check")
    public ResponseEntity<Map<String, Object>> closingTimeCheck(@RequestParam double lat, @RequestParam double lon) {
        try {
            GeoDistanceService.ArrivalFeasibility feasibility = queueManagerService.checkClosingTimeFeasibility(lat, lon);
            return ResponseEntity.ok(ok(feasibility));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    /**
     * Admin clicks "not come yet" on a called-but-absent waiting patient:
     * instead of marking them missed outright, push them back within their
     * own queue by an exponentially growing number of positions (1, 2, 4,
     * 8, 16, ... then straight to the back) -- see
     * QueueManagerService#pushBackNoShow.
     */
    @PostMapping("/{id}/no-show")
    public ResponseEntity<Map<String, Object>> noShow(@PathVariable int id) {
        try {
            TokenDto token = queueManagerService.pushBackNoShow(id);
            return ResponseEntity.ok(ok(token));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    /**
     * Patients already notified+called and still inside their travel-time
     * grace window (see QueueManagerService#runTreatmentTimingTick) --
     * resolves itself automatically (push-back or missed) once the window
     * elapses, this is just a read-only view for the admin dashboard.
     */
    @GetMapping("/anomaly-control")
    public ResponseEntity<Map<String, Object>> anomalyControlQueue(@RequestParam(required = false) Integer hospitalId,
                                                                     @RequestParam(required = false) String category) {
        return ResponseEntity.ok(ok(queueManagerService.getAnomalyControlQueue(hospitalId, category)));
    }

    /** Reserved buffer queue: patients en route with active travel buffer time. */
    @GetMapping("/reserved")
    public ResponseEntity<Map<String, Object>> reservedQueue(@RequestParam(required = false) Integer hospitalId,
                                                             @RequestParam(required = false) String category) {
        return ResponseEntity.ok(ok(queueManagerService.getReservedQueue(hospitalId, category)));
    }

    /** Manually releases/unfreezes a frozen token into the main waiting queue. */
    @PostMapping("/unfreeze/{id}")
    public ResponseEntity<Map<String, Object>> unfreezeToken(@PathVariable int id) {
        try {
            TokenDto token = queueManagerService.manualUnfreezeToken(id);
            if (token == null) {
                return ResponseEntity.status(404).body(msg("Token not found or not in frozen state."));
            }
            return ResponseEntity.ok(ok(token));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    // ---- Missed queue: admin search / requeue-to-front / reject ----

    @GetMapping("/missed")
    public ResponseEntity<Map<String, Object>> missedQueue(@RequestParam(required = false) Integer hospitalId,
                                                             @RequestParam(required = false) String category) {
        return ResponseEntity.ok(ok(queueManagerService.getMissedQueue(hospitalId, category)));
    }

    @GetMapping("/missed/search")
    public ResponseEntity<Map<String, Object>> searchMissedQueue(@RequestParam(required = false) String query,
                                                                   @RequestParam(required = false) Integer hospitalId,
                                                                   @RequestParam(required = false) String category) {
        return ResponseEntity.ok(ok(queueManagerService.searchMissedQueue(query, hospitalId, category)));
    }

    @PostMapping("/missed/{id}/requeue")
    public ResponseEntity<Map<String, Object>> requeueMissed(@PathVariable int id) {
        TokenDto token = queueManagerService.requeueMissedToFront(id);
        if (token == null) {
            return ResponseEntity.status(404).body(msg("Token not found in the missed queue."));
        }
        return ResponseEntity.ok(ok(token));
    }

    @PostMapping("/missed/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectMissed(@PathVariable int id) {
        TokenDto token = queueManagerService.rejectMissedToken(id);
        if (token == null) {
            return ResponseEntity.status(404).body(msg("Token not found in the missed queue."));
        }
        return ResponseEntity.ok(ok(token));
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
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable String id,
                                                              @Valid @RequestBody UpdateStatusRequest request) {
        List<String> validStatuses = List.of("waiting", "serving", "completed", "missed");
        if (!validStatuses.contains(request.status())) {
            return ResponseEntity.badRequest().body(msg("Invalid status."));
        }

        UpdateStatusResult result = queueManagerService.updateTokenStatus(id, request.status());
        if (result == null) {
            return ResponseEntity.status(404).body(msg("Token not found."));
        }
        return ResponseEntity.ok(ok(result));
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
