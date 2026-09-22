package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.*;
import com.qdischarge.clinicqueue.event.ConsultationCompletedEvent;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.service.CourseService;
import com.qdischarge.clinicqueue.service.DoctorService;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import com.qdischarge.clinicqueue.service.ReferralService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;
    private final DoctorService doctorService;
    private final ReferralService referralService;
    private final QueueManagerService queueManagerService;
    private final CurrentUser currentUser;
    private final ApplicationEventPublisher eventPublisher;
    private final AppProperties appProperties;

    @PostMapping
    public ResponseEntity<Map<String, Object>> createCourse(@Valid @RequestBody CreateCourseRequest request) {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null || doctor.getHospitalId() == null) {
            return ResponseEntity.badRequest().body(msg("Doctor must be affiliated with a hospital before creating courses."));
        }
        int hospitalId = doctor.getHospitalId();

        CourseDto created = courseService.createCourse(request, doctorId, hospitalId);
        return ResponseEntity.ok(ok(created));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<Map<String, Object>> getCourse(@PathVariable int id) {
        CourseDto course = courseService.getCourseById(id);
        if (course == null) {
            return ResponseEntity.status(404).body(msg("Course not found."));
        }
        return ResponseEntity.ok(ok(course));
    }

    @GetMapping("/{id}/timeline")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<Map<String, Object>> getTimeline(@PathVariable int id) {
        CourseDto course = courseService.getCourseById(id);
        if (course == null) {
            return ResponseEntity.status(404).body(msg("Course not found."));
        }
        CourseTimelineDto timeline = courseService.getCourseTimeline(id);
        return ResponseEntity.ok(ok(timeline));
    }

    @GetMapping("/{id}/consent-bundle")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<Map<String, Object>> getConsentBundle(@PathVariable int id) {
        CourseDto course = courseService.getCourseById(id);
        if (course == null) {
            return ResponseEntity.status(404).body(msg("Course not found."));
        }
        List<String> bundleTypes = courseService.getBundledConsentTypes(course.getCourseType());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("courseId", course.getId());
        data.put("courseTitle", course.getTitle());
        data.put("courseType", course.getCourseType());
        data.put("bundleDocumentTypes", bundleTypes);
        return ResponseEntity.ok(ok(data));
    }

    @PostMapping("/{id}/encounters")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<Map<String, Object>> addEncounter(
            @PathVariable int id,
            @Valid @RequestBody AddEncounterRequest request) {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null || doctor.getHospitalId() == null) {
            return ResponseEntity.badRequest().body(msg("Doctor must be affiliated with a hospital before recording encounters."));
        }
        int hospitalId = doctor.getHospitalId();

        AddEncounterRequest scopedReq = new AddEncounterRequest(id, request.chiefComplaint(), request.clinicalNotes(), request.examinationFindings(), request.plan(), request.prescriptions());
        CourseEncounterDto encounter = courseService.addEncounter(scopedReq, doctorId, hospitalId);
        return ResponseEntity.ok(ok(encounter));
    }

    /**
     * Minimalist UI consultation action: "Complete & Next" (Section 6.4 of specification).
     * Atomically records encounter notes/prescriptions, issues any referral with QR card,
     * marks queue token completed, triggers patient WhatsApp notifications post-commit, and fetches the next token.
     */
    @PostMapping("/{id}/complete-and-next")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> completeAndNext(
            @PathVariable int id,
            @RequestBody CompleteAndNextRequest request) {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null || doctor.getHospitalId() == null) {
            return ResponseEntity.badRequest().body(msg("Doctor must be affiliated with a hospital before completing consultations."));
        }
        int hospitalId = doctor.getHospitalId();

        CourseDto course = courseService.getCourseById(id);
        if (course == null) {
            return ResponseEntity.status(404).body(msg("Course not found: " + id));
        }

        // 1. Record consultation encounter and prescriptions
        AddEncounterRequest encReq = new AddEncounterRequest(
                id,
                request.chiefComplaint(),
                request.clinicalNotes(),
                request.examinationFindings(),
                request.plan(),
                request.prescriptions()
        );
        CourseEncounterDto encounter = courseService.addEncounter(encReq, doctorId, hospitalId);

        // 2. Issue tiered referral if requested
        ReferralDto referral = null;
        if (request.referral() != null) {
            CreateReferralRequest refReq = new CreateReferralRequest(
                    id,
                    encounter != null ? encounter.getId() : null,
                    request.referral().toHospitalId(),
                    request.referral().targetDepartment(),
                    request.referral().referredDoctorId(),
                    request.referral().reason(),
                    request.referral().priorityTier()
            );
            referral = referralService.createReferral(refReq, doctorId, hospitalId);
        }

        // 3. Complete active queue token and advance queue
        TokenDto completedToken = null;
        TokenDto nextServing = null;
        if (request.currentTokenId() != null) {
            com.qdischarge.clinicqueue.dto.UpdateStatusResult res = queueManagerService.updateTokenStatus(String.valueOf(request.currentTokenId()), "completed");
            if (res != null) {
                completedToken = res.token();
            } else {
                throw new IllegalStateException("Failed to complete queue token: " + request.currentTokenId());
            }
            nextServing = queueManagerService.getCurrentServingToken(hospitalId, doctor.getCategory());
        }

        // 4. Publish ConsultationCompletedEvent for decoupled, post-commit async WhatsApp notifications
        eventPublisher.publishEvent(ConsultationCompletedEvent.builder()
                .courseId(id)
                .patientPhone(course.getPatientPhone())
                .patientName(course.getPatientName())
                .encounter(encounter)
                .referral(referral)
                .frontendUrl(appProperties.getFrontendUrl())
                .build());

        CompleteAndNextResult result = CompleteAndNextResult.builder()
                .encounter(encounter)
                .referral(referral)
                .completedToken(completedToken)
                .nextServingToken(nextServing)
                .message("Consultation finalized successfully. Patient notified via WhatsApp.")
                .build();

        return ResponseEntity.ok(ok(result));
    }

    @PostMapping(value = "/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @PathVariable int id,
            @RequestParam(required = false) Integer encounterId,
            @RequestParam String docType,
            @RequestParam(required = false) String notes,
            @RequestParam MultipartFile file) {
        int doctorId = currentUser.requireDoctorId();
        try {
            CourseDocumentDto doc = courseService.uploadDocument(id, encounterId, doctorId, docType, notes, file);
            return ResponseEntity.ok(ok(doc));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(msg("File upload failed: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/documents/{docId}/download")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable int id, @PathVariable int docId) {
        CourseDocumentDto doc = courseService.getDocumentMetadata(docId);
        if (doc == null || doc.getCourseId() != id) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] data = courseService.getDocumentData(docId);
            String contentType = doc.getContentType() != null ? doc.getContentType() : "application/octet-stream";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getFileName() + "\"")
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("@courseSecurity.canAccessCourse(authentication, #id)")
    public ResponseEntity<Map<String, Object>> closeCourse(@PathVariable int id) {
        CourseDto closed = courseService.closeCourse(id);
        if (closed == null) {
            return ResponseEntity.status(404).body(msg("Course not found."));
        }
        return ResponseEntity.ok(ok(closed));
    }

    @GetMapping("/patient")
    public ResponseEntity<Map<String, Object>> listPatientCourses() {
        String phone = currentUser.requirePatientPhone();
        List<CourseDto> courses = courseService.listCoursesForPatient(phone);
        return ResponseEntity.ok(ok(courses));
    }

    @GetMapping("/public/patient")
    public ResponseEntity<Map<String, Object>> listPublicPatientCourses(@RequestParam(name = "phone", required = false) String phone) {
        if (phone == null || phone.trim().isBlank()) {
            return ResponseEntity.badRequest().body(msg("Phone number parameter is required."));
        }
        List<CourseDto> courses = courseService.listCoursesForPatient(phone.trim());
        return ResponseEntity.ok(ok(courses));
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
