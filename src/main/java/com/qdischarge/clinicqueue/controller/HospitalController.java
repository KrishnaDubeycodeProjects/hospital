package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.service.HospitalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Hospital directory: location (DIGIPIN-based), OPD hours, active counter
 * count. Reads are public (patients need this to pick/see a hospital);
 * creating/relocating a hospital is admin-only (see SecurityConfig).
 */
@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalService hospitalService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        List<HospitalDto> hospitals = hospitalService.list();
        return ResponseEntity.ok(ok(hospitals));
    }

    @GetMapping("/{uriSlug}")
    public ResponseEntity<Map<String, Object>> getBySlug(@PathVariable String uriSlug) {
        HospitalDto hospital = hospitalService.getBySlug(uriSlug);
        if (hospital == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        return ResponseEntity.ok(ok(hospital));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateHospitalRequest request) {
        try {
            return ResponseEntity.ok(ok(hospitalService.create(request)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    /** Admin-only: the code to hand a doctor so they can self-link their account to this hospital (POST /api/doctors/join-hospital). */
    @GetMapping("/{uriSlug}/doctor-join-code")
    public ResponseEntity<Map<String, Object>> getDoctorJoinCode(@PathVariable String uriSlug) {
        String code = hospitalService.getDoctorJoinCode(uriSlug);
        if (code == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        return ResponseEntity.ok(ok(Map.of("doctorJoinCode", code)));
    }

    /** Admin-only: rotate the join code (e.g. it leaked). Existing doctor links are unaffected. */
    @PostMapping("/{uriSlug}/doctor-join-code/regenerate")
    public ResponseEntity<Map<String, Object>> regenerateDoctorJoinCode(@PathVariable String uriSlug) {
        String code = hospitalService.regenerateDoctorJoinCode(uriSlug);
        if (code == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        return ResponseEntity.ok(ok(Map.of("doctorJoinCode", code)));
    }

    @PutMapping("/{uriSlug}/location")
    public ResponseEntity<Map<String, Object>> updateLocation(@PathVariable String uriSlug,
                                                                @Valid @RequestBody SetLocationRequest request) {
        try {
            HospitalDto updated = hospitalService.updateLocation(uriSlug, request);
            if (updated == null) {
                return ResponseEntity.status(404).body(msg("Hospital not found."));
            }
            return ResponseEntity.ok(ok(updated));
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
