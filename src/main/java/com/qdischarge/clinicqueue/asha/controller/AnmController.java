package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.dto.AnmProfileDto;
import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.dto.SurveyResponseDto;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.asha.service.AnmService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/anm")
@RequiredArgsConstructor
@Slf4j
public class AnmController {

    private final AnmService anmService;
    private final CurrentUser currentUser;

    @PostMapping("/register")
    public ResponseEntity<AnmProfileDto> register(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String name = body.get("name");
        String phcName = body.get("phcName");
        return ResponseEntity.status(HttpStatus.CREATED).body(anmService.register(phone, name, phcName));
    }

    @GetMapping("/me")
    public ResponseEntity<AnmProfileDto> getMe() {
        String phone = currentUser.getAshaPhone();
        Optional<AnmProfileDto> anm = anmService.getByPhone(phone);
        if (anm.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AnmProfileDto dto = anm.get();
        dto.setQrCodeImage(anmService.generateQrCodeImage(dto.getQrCodeData()));
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/data")
    public ResponseEntity<List<Map<String, Object>>> getIncomingData(@RequestParam(required = false, defaultValue = "ALL") String section) {
        String phone = currentUser.getAshaPhone();
        return ResponseEntity.ok(anmService.getIncomingData(phone, section));
    }

    @GetMapping("/ashas")
    public ResponseEntity<List<AshaWorkerDto>> listAshaWorkers() {
        String phone = currentUser.getAshaPhone();
        return ResponseEntity.ok(anmService.listAshaWorkers(phone));
    }

    @GetMapping("/data/{ashaPhone}/members/{memberId}/forms")
    public ResponseEntity<List<SurveyResponseDto>> getMemberForms(
            @PathVariable String ashaPhone,
            @PathVariable Integer memberId,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(anmService.getMemberForms(ashaPhone, memberId, category));
    }
}
