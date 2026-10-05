package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.service.TestEnvironmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestEnvironmentController {

    private final TestEnvironmentService testEnvironmentService;

    @PostMapping("/patient/seed")
    public ResponseEntity<?> seedPatient(@RequestParam(required = false, defaultValue = "+919100000099") String phone) {
        TestEnvironmentService.TestPatientProfile profile = testEnvironmentService.seedPatientTestEnvironment(phone);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Test environment successfully seeded for " + phone,
                "phone", profile.phone(),
                "headName", profile.headName(),
                "familyUnitId", profile.familyUnitId(),
                "membersCount", profile.members().size(),
                "token", profile.jwtToken()
        ));
    }

    @PostMapping("/queue/inject")
    public ResponseEntity<?> injectToken(@RequestBody Map<String, Object> req) {
        String name = (String) req.get("name");
        Integer age = req.get("age") instanceof Number n ? n.intValue() : 28;
        String gender = (String) req.get("gender");
        String phone = (String) req.get("phone");
        String category = (String) req.get("category");
        Integer hospitalId = req.get("hospitalId") instanceof Number n ? n.intValue() : 1;
        String status = (String) req.get("status");
        Double dist = req.get("distanceKm") instanceof Number n ? n.doubleValue() : null;
        Integer travelMins = req.get("travelMinutes") instanceof Number n ? n.intValue() : null;

        Map<String, Object> result = testEnvironmentService.injectTestToken(
                name, age, gender, phone, category, hospitalId, status, dist, travelMins);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Test token injected successfully with status " + result.get("status"),
                "data", result
        ));
    }

    @GetMapping("/credentials")
    public ResponseEntity<?> getDemoCredentials() {
        return ResponseEntity.ok(Map.of(
                "doctor", Map.of(
                        "phone", "+919888877777",
                        "otp", "123456",
                        "name", "Dr. Rajesh Sharma",
                        "department", "General Medicine"
                ),
                "patient", Map.of(
                        "phone", "+919100000099",
                        "otp", "123456",
                        "name", "Ramesh Kumar (Demo Patient)",
                        "abha", "91-2345-6789-1011"
                )
        ));
    }
}
