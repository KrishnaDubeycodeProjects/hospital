package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.AccessRequestDto;
import com.qdischarge.clinicqueue.dto.AccessGrantDto;
import com.qdischarge.clinicqueue.dto.DoctorDto;
import com.qdischarge.clinicqueue.dto.DoctorLoginRequest;
import com.qdischarge.clinicqueue.dto.DoctorPatientGroupDto;
import com.qdischarge.clinicqueue.dto.JoinHospitalRequest;
import com.qdischarge.clinicqueue.dto.PatientDocumentDto;
import com.qdischarge.clinicqueue.dto.RegisterDoctorRequest;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.service.AccessService;
import com.qdischarge.clinicqueue.service.DoctorService;
import com.qdischarge.clinicqueue.service.HospitalService;
import com.qdischarge.clinicqueue.service.PatientDocumentService;
import com.qdischarge.clinicqueue.service.QrCodeService;
import com.qdischarge.clinicqueue.service.TimeSlotService;
import com.qdischarge.clinicqueue.util.PhoneNormalizer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Doctor accounts (phone+OTP, same identity model as patients -- see
 * DoctorService), linking to a hospital via its join code, and the
 * QR/code-based access-request flow: a doctor generates a request here, a
 * patient's device claims it (POST /api/patients/access/{code}/accept), and
 * from then on this doctor can see that patient's uploaded documents,
 * grouped by (name, age) -- see PatientDocumentService#groupByIdentity.
 */
@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;
    private final AccessService accessService;
    private final PatientDocumentService patientDocumentService;
    private final QrCodeService qrCodeService;
    private final TimeSlotService timeSlotService;
    private final HospitalService hospitalService;
    private final CurrentUser currentUser;

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterDoctorRequest request) {
        return authResponse(doctorService.register(request.name(), request.phone()));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody DoctorLoginRequest request) {
        return authResponse(doctorService.login(request.phone()));
    }

    private ResponseEntity<Map<String, Object>> authResponse(DoctorService.DoctorAuthResult result) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", result.success());
        body.put("message", result.message());
        if (result.success()) {
            body.put("token", result.token());
            body.put("data", result.doctor());
        }
        return ResponseEntity.status(result.success() ? 200 : 400).body(body);
    }

    @PostMapping("/join-hospital")
    public ResponseEntity<Map<String, Object>> joinHospital(@Valid @RequestBody JoinHospitalRequest request) {
        try {
            DoctorDto doctor = doctorService.joinHospital(currentUser.requireDoctorId(), request.hospitalCode());
            return ResponseEntity.ok(ok(doctor));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me() {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor != null && doctor.getHospitalId() == null) {
            var op = hospitalService.getOperatingHospital();
            int defaultHospId = op != null ? op.getId() : 1;
            doctor = doctorService.linkHospital(doctorId, defaultHospId);
        }
        return ResponseEntity.ok(ok(doctor));
    }

    @PutMapping("/me/counter")
    public ResponseEntity<Map<String, Object>> updateMyCounter(@RequestBody Map<String, Object> body) {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null) {
            return ResponseEntity.badRequest().body(msg("Doctor profile not found."));
        }
        int hospId = doctor.getHospitalId() != null ? doctor.getHospitalId() : 1;
        int counterId = body.get("counterId") instanceof Number n ? n.intValue() : 1;
        String category = body.get("category") != null ? String.valueOf(body.get("category")) : doctor.getCategory();
        if (category == null || category.isBlank()) {
            category = "General Medicine / Internal Medicine";
        }
        DoctorDto updated = doctorService.assignLocation(hospId, doctorId, counterId, category);
        return ResponseEntity.ok(ok(updated));
    }

    /** Generates a fresh 30-minute access-request code; GET .../qr renders it as a scannable PNG. */
    @PostMapping("/access-requests")
    public ResponseEntity<Map<String, Object>> createAccessRequest() {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null) {
            return ResponseEntity.badRequest().body(msg("Doctor profile not found."));
        }
        if (doctor.getHospitalId() == null) {
            var op = hospitalService.getOperatingHospital();
            if (op != null) {
                doctorService.linkHospital(doctorId, op.getId());
            }
        }
        return ResponseEntity.ok(ok(accessService.createRequest(doctorId)));
    }

    @GetMapping("/access-requests/{code}/qr")
    public ResponseEntity<?> accessRequestQr(@PathVariable String code, jakarta.servlet.http.HttpServletRequest req) {
        AccessRequestDto request = accessService.getByCode(code.trim().toUpperCase());
        if (request == null) {
            return ResponseEntity.status(404).body(msg("Access request not found."));
        }
        try {
            String origin = req.getHeader("Origin");
            if (origin == null || origin.isBlank()) {
                String referer = req.getHeader("Referer");
                if (referer != null && !referer.isBlank()) {
                    try {
                        java.net.URI uri = java.net.URI.create(referer);
                        origin = uri.getScheme() + "://" + uri.getAuthority();
                    } catch (Exception ignored) {}
                }
            }
            if (origin == null || origin.isBlank()) {
                origin = req.getScheme() + "://" + req.getServerName() + (req.getServerPort() == 80 || req.getServerPort() == 443 ? "" : ":" + req.getServerPort());
            }
            String consentUrl = origin + "/patient/access?code=" + request.getCode();
            byte[] png = qrCodeService.generatePng(consentUrl, 350, 2, "#0f172a", "#ffffff");
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(png);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
        }
    }

    @PostMapping("/access-requests/{code}/grant-by-phone")
    public ResponseEntity<Map<String, Object>> grantByPhone(
            @PathVariable String code,
            @RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        if (phone == null || phone.isBlank()) {
            return ResponseEntity.badRequest().body(msg("Patient phone number is required."));
        }
        int doctorId = currentUser.requireDoctorId();
        try {
            AccessGrantDto grant = accessService.claimForDoctor(code, doctorId, phone.trim());
            return ResponseEntity.ok(ok(grant));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(msg(e.getMessage()));
        }
    }

    /** The calling doctor's own rostered OPD time slots, soonest first. */
    @GetMapping("/me/time-slots")
    public ResponseEntity<Map<String, Object>> myTimeSlots() {
        return ResponseEntity.ok(ok(timeSlotService.listForDoctor(currentUser.requireDoctorId())));
    }

    /** Every patient currently granting this doctor access, grouped by (name, age) with their documents. */
    @GetMapping("/patients")
    public ResponseEntity<Map<String, Object>> patients() {
        List<String> phones = accessService.listActivePatientPhonesForDoctor(currentUser.requireDoctorId());
        return ResponseEntity.ok(ok(patientDocumentService.groupByIdentity(phones)));
    }

    /** Historical patients who ever granted access to this doctor. */
    @GetMapping("/patients/history")
    public ResponseEntity<Map<String, Object>> patientHistory() {
        int doctorId = currentUser.requireDoctorId();
        List<String> phones = accessService.listAllPatientPhonesForDoctor(doctorId);
        List<DoctorPatientGroupDto> groups = patientDocumentService.groupByIdentity(phones);
        return ResponseEntity.ok(ok(groups));
    }

    /** All access grants issued to this doctor with grant dates and status. */
    @GetMapping("/patients/grants")
    public ResponseEntity<Map<String, Object>> patientGrants() {
        int doctorId = currentUser.requireDoctorId();
        return ResponseEntity.ok(ok(accessService.listGrantsForDoctor(doctorId)));
    }

    /** Download one document's image -- only if this doctor currently has active access to that patient's phone. */
    @GetMapping("/patients/documents/{docId}/file")
    public ResponseEntity<?> patientDocumentFile(@PathVariable int docId) {
        int doctorId = currentUser.requireDoctorId();
        PatientDocumentDto meta = patientDocumentService.getMetadata(docId);
        if (meta == null) {
            return ResponseEntity.status(404).body(msg("Document not found."));
        }
        List<String> allowedPhones = accessService.listActivePatientPhonesForDoctor(doctorId);
        boolean hasAccess = allowedPhones.stream().anyMatch(p -> PhoneNormalizer.matches(p, meta.getPatientPhone()));
        if (!hasAccess) {
            return ResponseEntity.status(403).body(msg("You don't currently have access to this patient's records."));
        }
        PatientDocumentService.FileContent file = patientDocumentService.getFile(docId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, org.springframework.http.ContentDisposition.inline().filename(file.fileName()).build().toString())
                .body(file.data());
    }

    /** Upload a prescription or medical report for a patient (if doctor currently has active access). */
    @PostMapping(value = "/patients/documents/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadPatientDocument(
            @RequestParam("patientPhone") String patientPhone,
            @RequestParam("patientName") String patientName,
            @RequestParam(name = "patientAge", required = false) Integer patientAge,
            @RequestParam("docType") String docType,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        int doctorId = currentUser.requireDoctorId();
        List<String> allowedPhones = accessService.listActivePatientPhonesForDoctor(doctorId);
        boolean hasAccess = allowedPhones.stream().anyMatch(p -> PhoneNormalizer.matches(p, patientPhone));
        if (!hasAccess) {
            return ResponseEntity.status(403).body(msg("You don't currently have active access to this patient's records."));
        }
        try {
            DoctorDto doctor = doctorService.getById(doctorId);
            PatientDocumentDto doc = patientDocumentService.upload(
                    patientPhone, patientName, patientAge, docType,
                    doctor != null ? doctor.getHospitalId() : null, doctorId, file);
            return ResponseEntity.ok(ok(doc));
        } catch (Exception e) {
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

    private Map<String, Object> err(Exception e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", e.getMessage());
        return m;
    }
}
