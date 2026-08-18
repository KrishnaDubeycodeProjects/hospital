package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.catalog.MedicalCategory;
import com.qdischarge.clinicqueue.service.CounterAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Multi-counter package (Advanced): the live counter board (GET, for the
 * display board / admin dashboard, public read) and the two admin actions
 * that free a counter -- complete or miss -- each of which pulls the next
 * eligible waiting token into that counter, look-ahead style. Every
 * endpoint is scoped to one (hospital, category) department -- see
 * HospitalDepartmentService -- since each department runs its own counters;
 * only relevant once that department's active_counters > 1, with a single
 * counter this is equivalent to (and layers on top of) the plain
 * PUT /api/queue/{id} flow.
 */
@RestController
@RequestMapping("/api/counters")
@RequiredArgsConstructor
public class CounterController {

    private final CounterAssignmentService counterAssignmentService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> board(@RequestParam int hospitalId, @RequestParam String category) {
        String canonical = canonicalOrNull(category);
        if (canonical == null) {
            return ResponseEntity.badRequest().body(msg("Unknown category: \"" + category + "\"."));
        }
        return ResponseEntity.ok(ok(counterAssignmentService.getBoard(hospitalId, canonical)));
    }

    @PostMapping("/{counterId}/complete")
    public ResponseEntity<Map<String, Object>> complete(@PathVariable int counterId,
                                                          @RequestParam int hospitalId, @RequestParam String category) {
        String canonical = canonicalOrNull(category);
        if (canonical == null) {
            return ResponseEntity.badRequest().body(msg("Unknown category: \"" + category + "\"."));
        }
        return ResponseEntity.ok(ok(counterAssignmentService.completeAtCounter(hospitalId, canonical, counterId)));
    }

    @PostMapping("/{counterId}/miss")
    public ResponseEntity<Map<String, Object>> miss(@PathVariable int counterId,
                                                      @RequestParam int hospitalId, @RequestParam String category) {
        String canonical = canonicalOrNull(category);
        if (canonical == null) {
            return ResponseEntity.badRequest().body(msg("Unknown category: \"" + category + "\"."));
        }
        return ResponseEntity.ok(ok(counterAssignmentService.missAtCounter(hospitalId, canonical, counterId)));
    }

    private String canonicalOrNull(String category) {
        return MedicalCategory.canonicalize(category);
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
