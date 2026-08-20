package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.AccessRequestDto;
import com.qdischarge.clinicqueue.dto.DoctorDto;
import com.qdischarge.clinicqueue.dto.DoctorLoginRequest;
import com.qdischarge.clinicqueue.dto.JoinHospitalRequest;
import com.qdischarge.clinicqueue.dto.PatientDocumentDto;
import com.qdischarge.clinicqueue.dto.RegisterDoctorRequest;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.service.AccessService;
import com.qdischarge.clinicqueue.service.DoctorService;
import com.qdischarge.clinicqueue.service.PatientDocumentService;
import com.qdischarge.clinicqueue.service.QrCodeService;
import com.qdischarge.clinicqueue.service.TimeSlotService;
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
        return ResponseEntity.ok(ok(doctorService.getById(currentUser.requireDoctorId())));
    }

    /** Generates a fresh 30-minute access-request code; GET .../qr renders it as a scannable PNG. */
    @PostMapping("/access-requests")
    public ResponseEntity<Map<String, Object>> createAccessRequest() {
        int doctorId = currentUser.requireDoctorId();
        DoctorDto doctor = doctorService.getById(doctorId);
        if (doctor == null || doctor.getHospitalId() == null) {
            return ResponseEntity.badRequest().body(msg("Join a hospital (POST /api/doctors/join-hospital) before requesting patient access."));
        }
        return ResponseEntity.ok(ok(accessService.createRequest(doctorId)));
    }

    @GetMapping("/access-requests/{code}/qr")
    public ResponseEntity<?> accessRequestQr(@PathVariable String code) {
        AccessRequestDto request = accessService.getByCode(code.trim().toUpperCase());
        if (request == null) {
            return ResponseEntity.status(404).body(msg("Access request not found."));
        }
        try {
            byte[] png = qrCodeService.generatePng(request.getCode(), 350, 2, "#0f172a", "#ffffff");
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(png);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e));
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

    /** Download one document's image -- only if this doctor currently has active access to that patient's phone. */
    @GetMapping("/patients/documents/{docId}/file")
    public ResponseEntity<?> patientDocumentFile(@PathVariable int docId) {
        int doctorId = currentUser.requireDoctorId();
        PatientDocumentDto meta = patientDocumentService.getMetadata(docId);
        if (meta == null) {
            return ResponseEntity.status(404).body(msg("Document not found."));
        }
        List<String> allowedPhones = accessService.listActivePatientPhonesForDoctor(doctorId);
        if (!allowedPhones.contains(meta.getPatientPhone())) {
            return ResponseEntity.status(403).body(msg("You don't currently have access to this patient's records."));
        }
        PatientDocumentService.FileContent file = patientDocumentService.getFile(docId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.fileName() + "\"")
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
        if (!allowedPhones.contains(patientPhone)) {
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
