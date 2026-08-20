package com.qdischarge.clinicqueue.controller;

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
 * eligible waiting token into that counter, look-ahead style. Only relevant
 * once a hospital's active_counters > 1; with a single counter this is
 * equivalent to (and layers on top of) the plain PUT /api/queue/{id} flow.
 */
@RestController
@RequestMapping("/api/counters")
@RequiredArgsConstructor
public class CounterController {

    private final CounterAssignmentService counterAssignmentService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> board() {
        return ResponseEntity.ok(ok(counterAssignmentService.getBoard()));
    }

    @PostMapping("/{counterId}/complete")
    public ResponseEntity<Map<String, Object>> complete(@PathVariable int counterId) {
        return ResponseEntity.ok(ok(counterAssignmentService.completeAtCounter(counterId)));
    }

    @PostMapping("/{counterId}/miss")
    public ResponseEntity<Map<String, Object>> miss(@PathVariable int counterId) {
        return ResponseEntity.ok(ok(counterAssignmentService.missAtCounter(counterId)));
    }

    private Map<String, Object> ok(Object data) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("data", data);
        return m;
    }
}
