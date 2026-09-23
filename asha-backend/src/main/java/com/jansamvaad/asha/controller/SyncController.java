package com.jansamvaad.asha.controller;

import com.jansamvaad.asha.dto.AnmProfileDto;
import com.jansamvaad.asha.dto.SyncDownloadResponse;
import com.jansamvaad.asha.dto.SyncUploadRequest;
import com.jansamvaad.asha.security.CurrentUser;
import com.jansamvaad.asha.service.AnmService;
import com.jansamvaad.asha.service.SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
@Slf4j
public class SyncController {

    private final SyncService syncService;
    private final AnmService anmService;
    private final CurrentUser currentUser;

    @PostMapping("/upload")
    public ResponseEntity<Void> upload(@RequestBody SyncUploadRequest body) {
        String phone = currentUser.requireAshaPhone();
        syncService.upload(phone, body);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/download")
    public ResponseEntity<SyncDownloadResponse> download(@RequestParam(required = false) String since) {
        String phone = currentUser.requireAshaPhone();
        return ResponseEntity.ok(syncService.download(phone, since));
    }

    @PostMapping("/send-to-anm")
    public ResponseEntity<Void> sendToAnm(@RequestBody Map<String, String> body) {
        String phone = currentUser.requireAshaPhone();
        String section = body.get("section");
        String identifier = body.get("anmIdentifier");

        Optional<AnmProfileDto> anm = anmService.getByQrCode(identifier);
        if (anm.isEmpty()) {
            anm = anmService.getByPhone(identifier);
        }

        if (anm.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        syncService.sendToAnm(phone, section, anm.get().getPhone());
        return ResponseEntity.ok().build();
    }
}
