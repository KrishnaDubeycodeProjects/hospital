package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.service.DrugRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/drugs")
@RequiredArgsConstructor
public class DrugController {

    private final DrugRegistryService drugRegistryService;

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(required = false) String query) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", drugRegistryService.search(query));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/labs")
    public ResponseEntity<Map<String, Object>> searchLabs(@RequestParam(required = false) String query) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", drugRegistryService.searchLabs(query));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/templates")
    public ResponseEntity<Map<String, Object>> listTemplates() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", drugRegistryService.listTemplates());
        return ResponseEntity.ok(body);
    }
}
