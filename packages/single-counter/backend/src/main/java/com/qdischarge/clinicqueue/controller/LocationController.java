package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.geo.DigipinService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/** Stateless DIGIPIN encode/decode utility -- no token/hospital side effects. */
@RestController
@RequestMapping("/api/location/digipin")
@RequiredArgsConstructor
public class LocationController {

    private final DigipinService digipinService;

    public record EncodeRequest(double latitude, double longitude) {
    }

    public record DecodeRequest(String digipin) {
    }

    @PostMapping("/encode")
    public ResponseEntity<Map<String, Object>> encode(@RequestBody EncodeRequest request) {
        try {
            String digipin = digipinService.encode(request.latitude(), request.longitude());
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("digipin", digipin);
            data.put("formattedDigipin", digipinService.format(digipin));
            return ResponseEntity.ok(ok(data));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    @PostMapping("/decode")
    public ResponseEntity<Map<String, Object>> decode(@RequestBody DecodeRequest request) {
        try {
            DigipinService.LatLon latLon = digipinService.decode(request.digipin());
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("latitude", latLon.lat());
            data.put("longitude", latLon.lon());
            return ResponseEntity.ok(ok(data));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

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
}
