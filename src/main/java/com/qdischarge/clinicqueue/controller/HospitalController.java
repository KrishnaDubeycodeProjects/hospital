package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.catalog.MedicalCategory;
import com.qdischarge.clinicqueue.dto.AssignDoctorLocationRequest;
import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.CreateTimeSlotRequest;
import com.qdischarge.clinicqueue.dto.DoctorDto;
import com.qdischarge.clinicqueue.dto.HospitalDepartmentDto;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.dto.TimeSlotDto;
import com.qdischarge.clinicqueue.dto.UpdateDepartmentCountersRequest;
import com.qdischarge.clinicqueue.service.DoctorService;
import com.qdischarge.clinicqueue.service.HospitalDepartmentService;
import com.qdischarge.clinicqueue.service.HospitalService;
import com.qdischarge.clinicqueue.service.TimeSlotService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Hospital directory: location (DIGIPIN-based), OPD hours, active counter
 * count, and profile (ownership/year established/accreditation/gender-
 * specific/offered categories). Reads are public (patients need this to
 * pick/see a hospital); creating/relocating a hospital, or reconfiguring a
 * department's counter count, is admin-only (see SecurityConfig).
 */
@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalService hospitalService;
    private final HospitalDepartmentService hospitalDepartmentService;
    private final DoctorService doctorService;
    private final TimeSlotService timeSlotService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        List<HospitalDto> hospitals = hospitalService.list();
        return ResponseEntity.ok(ok(hospitals));
    }

    /** The fixed picklist every hospital's "categories" and every token's "category" is validated against. */
    @GetMapping("/categories")
    public ResponseEntity<Map<String, Object>> categories() {
        return ResponseEntity.ok(ok(MedicalCategory.ALL));
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

    /** Public: which departments this hospital has configured and how many counters each has (defaults to 1 if never set). */
    @GetMapping("/{uriSlug}/departments")
    public ResponseEntity<Map<String, Object>> departments(@PathVariable String uriSlug) {
        HospitalDto hospital = hospitalService.getBySlug(uriSlug);
        if (hospital == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        return ResponseEntity.ok(ok(hospitalDepartmentService.list(hospital.getId())));
    }

    /** Admin-only: how many counters staff this hospital's (category) department. */
    @PutMapping("/{uriSlug}/departments/{category}/counters")
    public ResponseEntity<Map<String, Object>> updateDepartmentCounters(@PathVariable String uriSlug, @PathVariable String category,
                                                                          @Valid @RequestBody UpdateDepartmentCountersRequest request) {
        HospitalDto hospital = hospitalService.getBySlug(uriSlug);
        if (hospital == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        String canonical = MedicalCategory.canonicalize(category);
        if (canonical == null) {
            return ResponseEntity.badRequest().body(msg("Unknown category: \"" + category + "\"."));
        }
        HospitalDepartmentDto updated = hospitalDepartmentService.updateCounters(hospital.getId(), canonical, request.activeCounters());
        return ResponseEntity.ok(ok(updated));
    }

    /** Admin-only: assigns one of this hospital's doctors to a counter/department location -- see AssignDoctorLocationRequest. */
    @PutMapping("/{uriSlug}/doctors/{doctorId}/location")
    public ResponseEntity<Map<String, Object>> assignDoctorLocation(@PathVariable String uriSlug, @PathVariable int doctorId,
                                                                       @Valid @RequestBody AssignDoctorLocationRequest request) {
        HospitalDto hospital = hospitalService.getBySlug(uriSlug);
        if (hospital == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        String canonical = MedicalCategory.canonicalize(request.category());
        if (canonical == null) {
            return ResponseEntity.badRequest().body(msg("Unknown category: \"" + request.category() + "\"."));
        }
        try {
            DoctorDto doctor = doctorService.assignLocation(hospital.getId(), doctorId, request.counterId(), canonical);
            return ResponseEntity.ok(ok(doctor));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    /** Public: this hospital's OPD time slots, optionally filtered to one day (?date=yyyy-MM-dd), soonest first. */
    @GetMapping("/{uriSlug}/time-slots")
    public ResponseEntity<Map<String, Object>> timeSlots(@PathVariable String uriSlug,
                                                            @RequestParam(required = false) String date) {
        HospitalDto hospital = hospitalService.getBySlug(uriSlug);
        if (hospital == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        LocalDate parsed;
        try {
            parsed = date == null ? null : LocalDate.parse(date);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(msg("date must be yyyy-MM-dd."));
        }
        return ResponseEntity.ok(ok(timeSlotService.listForHospital(hospital.getId(), parsed)));
    }

    /** Admin-only: opens one OPD time window on one day and rosters a list of doctors onto it in the same call. */
    @PostMapping("/{uriSlug}/time-slots")
    public ResponseEntity<Map<String, Object>> createTimeSlot(@PathVariable String uriSlug,
                                                                 @Valid @RequestBody CreateTimeSlotRequest request) {
        HospitalDto hospital = hospitalService.getBySlug(uriSlug);
        if (hospital == null) {
            return ResponseEntity.status(404).body(msg("Hospital not found."));
        }
        String canonicalCategory = null;
        if (request.category() != null && !request.category().isBlank()) {
            canonicalCategory = MedicalCategory.canonicalize(request.category());
            if (canonicalCategory == null) {
                return ResponseEntity.badRequest().body(msg("Unknown category: \"" + request.category() + "\"."));
            }
        }
        try {
            CreateTimeSlotRequest canonicalRequest = new CreateTimeSlotRequest(
                    request.date(), request.startTime(), request.endTime(), canonicalCategory, request.doctorIds());
            TimeSlotDto slot = timeSlotService.create(hospital.getId(), canonicalRequest);
            return ResponseEntity.ok(ok(slot));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
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
