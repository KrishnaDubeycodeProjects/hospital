package com.qdischarge.clinicqueue.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HomeController {

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> root() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status", "UP");
        resp.put("service", "qDischarge Smart Clinic Queue & Healthcare Platform API");
        resp.put("version", "1.0.0");
        resp.put("frontendUrl", "http://localhost:5173");
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/favicon.ico")
    public ResponseEntity<Void> favicon() {
        return ResponseEntity.noContent().build();
    }
}