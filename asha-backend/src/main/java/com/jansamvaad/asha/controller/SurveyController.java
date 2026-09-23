package com.jansamvaad.asha.controller;

import com.jansamvaad.asha.dto.SurveyResponseDto;
import com.jansamvaad.asha.dto.SurveyTemplateDto;
import com.jansamvaad.asha.security.CurrentUser;
import com.jansamvaad.asha.service.SurveyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
@Slf4j
public class SurveyController {

    private final SurveyService surveyService;
    private final CurrentUser currentUser;

    @GetMapping("/categories")
    public ResponseEntity<List<Map<String, Object>>> listCategories() {
        return ResponseEntity.ok(surveyService.listCategories());
    }

    @GetMapping("/templates")
    public ResponseEntity<List<SurveyTemplateDto>> getTemplates(@RequestParam(required = false) String category) {
        return ResponseEntity.ok(surveyService.getTemplate(category));
    }

    @GetMapping("/templates/{id}")
    public ResponseEntity<SurveyTemplateDto> getTemplateById(@PathVariable Integer id) {
        return ResponseEntity.ok(surveyService.getTemplateById(id));
    }

    @PostMapping("/responses")
    public ResponseEntity<SurveyResponseDto> submitResponse(@RequestBody SurveyResponseDto body) {
        String phone = currentUser.requireAshaPhone();
        body.setAshaWorkerPhone(phone);
        return ResponseEntity.status(HttpStatus.CREATED).body(surveyService.submitResponse(body));
    }

    @GetMapping("/responses")
    public ResponseEntity<List<SurveyResponseDto>> listResponses(
            @RequestParam(required = false) Integer familyUnitId,
            @RequestParam(required = false) Integer memberId,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(surveyService.listResponses(familyUnitId, memberId, category));
    }

    @GetMapping("/responses/{id}")
    public ResponseEntity<SurveyResponseDto> getResponse(@PathVariable Integer id) {
        return ResponseEntity.ok(surveyService.getResponse(id));
    }
}
