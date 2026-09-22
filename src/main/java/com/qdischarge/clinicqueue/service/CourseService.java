package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.*;
import com.qdischarge.clinicqueue.event.PatientRecordCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CourseService {

    private final NamedParameterJdbcTemplate jdbc;
    private final DocumentStorageService documentStorageService;
    private final EkaCareAbdmService ekaCareAbdmService;
    private final ApplicationEventPublisher eventPublisher;

    private static final RowMapper<CourseDto> COURSE_MAPPER = (rs, rowNum) -> {
        Timestamp ca = rs.getTimestamp("created_at");
        Timestamp ua = rs.getTimestamp("updated_at");
        Timestamp cl = rs.getTimestamp("closed_at");
        return CourseDto.builder()
                .id(rs.getInt("id"))
                .patientPhone(rs.getString("patient_phone"))
                .patientName(rs.getString("patient_name"))
                .familyMemberId((Integer) rs.getObject("family_member_id"))
                .courseType(rs.getString("course_type"))
                .title(rs.getString("title"))
                .diagnosis(rs.getString("diagnosis"))
                .icd10Code(rs.getString("icd10_code"))
                .status(rs.getString("status"))
                .startedByDoctorId((Integer) rs.getObject("started_by_doctor_id"))
                .startedAtHospitalId((Integer) rs.getObject("started_at_hospital_id"))
                .currentSummary(rs.getString("current_summary"))
                .createdAt(ca != null ? ca.toLocalDateTime() : null)
                .updatedAt(ua != null ? ua.toLocalDateTime() : null)
                .closedAt(cl != null ? cl.toLocalDateTime() : null)
                .build();
    };

    @Transactional(rollbackFor = Exception.class)
    public CourseDto createCourse(CreateCourseRequest req, int doctorId, int hospitalId) {
        Map<String, Object> params = new HashMap<>();
        params.put("phone", req.patientPhone().trim());
        params.put("name", req.patientName().trim());
        params.put("memberId", req.familyMemberId());
        params.put("courseType", req.courseType().trim().toLowerCase());
        params.put("title", req.title().trim());
        params.put("diagnosis", req.diagnosis().trim());
        params.put("icd10", req.icd10Code());
        params.put("doctorId", doctorId);
        params.put("hospitalId", hospitalId);
        params.put("summary", req.initialNotes());

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO courses (patient_phone, patient_name, family_member_id, course_type, title, diagnosis,
                                     icd10_code, status, started_by_doctor_id, started_at_hospital_id, current_summary)
                VALUES (:phone, :name, :memberId, :courseType, :title, :diagnosis, :icd10, 'active', :doctorId, :hospitalId, :summary)
                RETURNING id
                """,
                params, Integer.class);

        // Auto-create initial encounter if initial notes were provided
        if (req.initialNotes() != null && !req.initialNotes().isBlank()) {
            addEncounter(new AddEncounterRequest(id, req.diagnosis(), req.initialNotes(), null, null, null), doctorId, hospitalId);
        }

        return getCourseById(id);
    }

    public CourseDto getCourseById(int courseId) {
        List<CourseDto> rows = jdbc.query(
                """
                SELECT c.*, d.name AS started_by_doctor_name, h.name AS started_at_hospital_name,
                       (SELECT COUNT(*) FROM course_documents WHERE course_id = c.id)::int AS doc_count,
                       (SELECT COUNT(*) FROM course_prescriptions WHERE course_id = c.id)::int AS rx_count,
                       (SELECT COUNT(*) FROM course_referrals WHERE course_id = c.id)::int AS ref_count
                FROM courses c
                LEFT JOIN doctors d ON c.started_by_doctor_id = d.id
                LEFT JOIN hospitals h ON c.started_at_hospital_id = h.id
                WHERE c.id = :id
                """,
                Map.of("id", courseId),
                (rs, rowNum) -> {
                    CourseDto dto = COURSE_MAPPER.mapRow(rs, rowNum);
                    if (dto != null) {
                        dto.setStartedByDoctorName(rs.getString("started_by_doctor_name"));
                        dto.setStartedAtHospitalName(rs.getString("started_at_hospital_name"));
                        dto.setDocumentCount(rs.getInt("doc_count"));
                        dto.setPrescriptionCount(rs.getInt("rx_count"));
                        dto.setReferralCount(rs.getInt("ref_count"));
                    }
                    return dto;
                });
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<CourseDto> listCoursesForPatient(String phone) {
        List<String> phones = getPhoneVariants(phone);
        return jdbc.query(
                """
                SELECT c.*, d.name AS started_by_doctor_name, h.name AS started_at_hospital_name,
                       (SELECT COUNT(*) FROM course_documents WHERE course_id = c.id)::int AS doc_count,
                       (SELECT COUNT(*) FROM course_prescriptions WHERE course_id = c.id)::int AS rx_count,
                       (SELECT COUNT(*) FROM course_referrals WHERE course_id = c.id)::int AS ref_count
                FROM courses c
                LEFT JOIN doctors d ON c.started_by_doctor_id = d.id
                LEFT JOIN hospitals h ON c.started_at_hospital_id = h.id
                WHERE c.patient_phone IN (:phones)
                ORDER BY c.status = 'active' DESC, c.updated_at DESC
                """,
                Map.of("phones", phones),
                (rs, rowNum) -> {
                    CourseDto dto = COURSE_MAPPER.mapRow(rs, rowNum);
                    if (dto != null) {
                        dto.setStartedByDoctorName(rs.getString("started_by_doctor_name"));
                        dto.setStartedAtHospitalName(rs.getString("started_at_hospital_name"));
                        dto.setDocumentCount(rs.getInt("doc_count"));
                        dto.setPrescriptionCount(rs.getInt("rx_count"));
                        dto.setReferralCount(rs.getInt("ref_count"));
                    }
                    return dto;
                });
    }

    @Transactional(rollbackFor = Exception.class)
    public CourseEncounterDto addEncounter(AddEncounterRequest req, int doctorId, int hospitalId) {
        Map<String, Object> params = new HashMap<>();
        params.put("courseId", req.courseId());
        params.put("doctorId", doctorId);
        params.put("hospitalId", hospitalId);
        params.put("chiefComplaint", req.chiefComplaint());
        params.put("clinicalNotes", req.clinicalNotes());
        params.put("examinationFindings", req.examinationFindings());
        params.put("plan", req.plan());

        Integer encId = jdbc.queryForObject(
                """
                INSERT INTO course_encounters (course_id, doctor_id, hospital_id, visit_date, chief_complaint, clinical_notes, examination_findings, plan)
                VALUES (:courseId, :doctorId, :hospitalId, NOW(), :chiefComplaint, :clinicalNotes, :examinationFindings, :plan)
                RETURNING id
                """,
                params, Integer.class);

        // Update Course timestamp and latest summary
        if (req.clinicalNotes() != null && !req.clinicalNotes().isBlank()) {
            jdbc.update("UPDATE courses SET current_summary = :notes, updated_at = NOW() WHERE id = :id",
                    Map.of("notes", req.clinicalNotes(), "id", req.courseId()));
        }

        // Add any batch prescriptions
        if (req.prescriptions() != null) {
            for (AddPrescriptionRequest rx : req.prescriptions()) {
                addPrescription(req.courseId(), encId, doctorId, rx);
            }
        }

        // ABDM Milestone 2: Asynchronously link consultation encounter as ABDM care context
        tryLinkAbdmCareContext(req.courseId(), encId, req.chiefComplaint());

        // Publish dual-write sync event for Eka Care ABDM
        if (eventPublisher != null) {
            Map<String, Object> patientInfo = getCoursePatientInfo(req.courseId());
            String abha = (String) patientInfo.get("abha_address");
            if (abha == null || abha.isBlank()) {
                abha = (String) patientInfo.get("abha_number");
            }
            String phone = (String) patientInfo.get("patient_phone");
            String name = (String) patientInfo.get("patient_name");

            eventPublisher.publishEvent(PatientRecordCreatedEvent.builder()
                    .recordType(PatientRecordCreatedEvent.RecordType.ENCOUNTER)
                    .recordId((long) encId)
                    .courseId(req.courseId())
                    .encounterId(encId)
                    .patientPhone(phone)
                    .patientName(name)
                    .abhaIdentifier(abha)
                    .idempotencyKey("ENC-" + encId)
                    .build());
        }

        return getEncounterById(encId);
    }

    private Map<String, Object> getCoursePatientInfo(int courseId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    """
                    SELECT fm.abha_number, fm.abha_address, c.patient_name, c.patient_phone
                    FROM courses c
                    LEFT JOIN family_members fm ON c.family_member_id = fm.id
                    WHERE c.id = :courseId
                    """,
                    Map.of("courseId", courseId));
            if (!rows.isEmpty()) {
                Map<String, Object> info = new HashMap<>(rows.get(0));
                String abha = (String) info.get("abha_address");
                if (abha == null || abha.isBlank()) {
                    abha = (String) info.get("abha_number");
                }
                // Fallback to family parent/head ABHA if member has none
                if ((abha == null || abha.isBlank()) && info.get("patient_phone") != null) {
                    String ptPhone = (String) info.get("patient_phone");
                    List<String> pPhones = getPhoneVariants(ptPhone);
                    List<Map<String, Object>> parentRows = jdbc.queryForList(
                            """
                            SELECT m.abha_address, m.abha_number FROM family_members m
                            JOIN family_units u ON m.family_unit_id = u.id
                            WHERE u.primary_phone IN (:phones)
                              AND (m.is_abha_linked = TRUE OR m.abha_address IS NOT NULL OR m.abha_number IS NOT NULL)
                            ORDER BY 
                              CASE WHEN LOWER(m.relationship) IN ('self', 'head', 'myself') THEN 0
                                   WHEN LOWER(m.relationship) IN ('father', 'mother', 'parent') THEN 1
                                   ELSE 2 END,
                              m.id ASC
                            LIMIT 1
                            """,
                            Map.of("phones", pPhones));
                    if (!parentRows.isEmpty()) {
                        info.put("abha_address", parentRows.get(0).get("abha_address"));
                        info.put("abha_number", parentRows.get(0).get("abha_number"));
                    }
                }
                return info;
            }
        } catch (Exception e) {
            log.warn("ABDM patient info lookup non-blocking fallback: {}", e.getMessage());
        }
        return Collections.emptyMap();
    }

    private void tryLinkAbdmCareContext(int courseId, int encounterId, String chiefComplaint) {
        try {
            Map<String, Object> r = getCoursePatientInfo(courseId);
            if (!r.isEmpty()) {
                String abha = (String) r.get("abha_address");
                if (abha == null || abha.isBlank()) {
                    abha = (String) r.get("abha_number");
                }
                if (abha != null && !abha.isBlank()) {
                    String patientRef = (String) r.get("patient_phone");
                    Map<String, Object> careContext = Map.of(
                            "referenceNumber", "ENC-" + encounterId,
                            "display", (chiefComplaint != null && !chiefComplaint.isBlank()) ? chiefComplaint : "Consultation Encounter #" + encounterId
                    );
                    log.info("Linking care context to Eka Care ABDM Gateway for patient: {}, careContext: {}", abha, careContext);
                    ekaCareAbdmService.linkCareContext(patientRef, List.of(careContext));
                }
            }
        } catch (Exception e) {
            log.warn("ABDM care context link non-blocking fallback: {}", e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public CoursePrescriptionDto addPrescription(int courseId, Integer encounterId, int doctorId, AddPrescriptionRequest req) {
        if (req.dosage() == null || req.dosage().isBlank()) {
            throw new IllegalArgumentException("Dosage instructions cannot be blank.");
        }

        Map<String, Object> params = new HashMap<>();
        params.put("courseId", courseId);
        params.put("encounterId", encounterId);
        params.put("doctorId", doctorId);
        params.put("medicineName", req.medicineName().trim());
        params.put("snomedCode", req.snomedCode());
        params.put("dosage", req.dosage().trim());
        params.put("frequency", req.frequency().trim());
        params.put("durationDays", req.durationDays());
        params.put("route", req.route() != null ? req.route().trim() : "Oral");
        params.put("instructions", req.instructions());
        params.put("isNlem", Boolean.TRUE.equals(req.isNlem()));

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO course_prescriptions (course_id, encounter_id, doctor_id, medicine_name, snomed_code, dosage, frequency, duration_days, route, instructions, is_nlem)
                VALUES (:courseId, :encounterId, :doctorId, :medicineName, :snomedCode, :dosage, :frequency, :durationDays, :route, :instructions, :isNlem)
                RETURNING id
                """,
                params, Integer.class);

        CoursePrescriptionDto dto = getPrescriptionById(id);

        if (eventPublisher != null) {
            Map<String, Object> patientInfo = getCoursePatientInfo(courseId);
            String abha = (String) patientInfo.get("abha_address");
            if (abha == null || abha.isBlank()) {
                abha = (String) patientInfo.get("abha_number");
            }
            String phone = (String) patientInfo.get("patient_phone");
            String name = (String) patientInfo.get("patient_name");

            eventPublisher.publishEvent(PatientRecordCreatedEvent.builder()
                    .recordType(PatientRecordCreatedEvent.RecordType.PRESCRIPTION)
                    .recordId((long) id)
                    .courseId(courseId)
                    .encounterId(encounterId)
                    .patientPhone(phone)
                    .patientName(name)
                    .abhaIdentifier(abha)
                    .idempotencyKey("RX-" + id)
                    .build());
        }

        return dto;
    }

    @Transactional(rollbackFor = Exception.class)
    public CourseDocumentDto uploadDocument(int courseId, Integer encounterId, int doctorId, String docType, String notes, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A file is required.");
        }

        DocumentStorageService.StoredFile stored = documentStorageService.storeFile(file, "course-" + courseId);

        Map<String, Object> params = new HashMap<>();
        params.put("courseId", courseId);
        params.put("encounterId", encounterId);
        params.put("docType", docType != null ? docType.trim() : "Other");
        params.put("fileName", stored.fileName());
        params.put("contentType", stored.contentType());
        params.put("fileSize", (int) stored.fileSize());
        params.put("storagePath", stored.storagePath());
        params.put("fileHash", stored.fileHash());
        params.put("doctorId", doctorId);
        params.put("notes", notes);

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO course_documents (course_id, encounter_id, doc_type, file_name, content_type, file_size, storage_path, file_hash, uploaded_by_doctor_id, notes)
                VALUES (:courseId, :encounterId, :docType, :fileName, :contentType, :fileSize, :storagePath, :fileHash, :doctorId, :notes)
                RETURNING id
                """,
                params, Integer.class);

        CourseDocumentDto doc = getDocumentMetadata(id);

        if (eventPublisher != null) {
            try {
                Map<String, Object> patientInfo = getCoursePatientInfo(courseId);
                String abha = (String) patientInfo.get("abha_address");
                if (abha == null || abha.isBlank()) {
                    abha = (String) patientInfo.get("abha_number");
                }
                String phone = (String) patientInfo.get("patient_phone");
                String name = (String) patientInfo.get("patient_name");

                eventPublisher.publishEvent(PatientRecordCreatedEvent.builder()
                        .recordType(PatientRecordCreatedEvent.RecordType.COURSE_DOCUMENT)
                        .recordId((long) id)
                        .courseId(courseId)
                        .encounterId(encounterId)
                        .patientPhone(phone)
                        .patientName(name)
                        .abhaIdentifier(abha)
                        .fileBytes(file.getBytes())
                        .fileName(file.getOriginalFilename() != null ? file.getOriginalFilename() : stored.fileName())
                        .contentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                        .docType(docType != null ? docType.trim() : "Other")
                        .idempotencyKey("DOC-" + id)
                        .build());
            } catch (Exception e) {
                log.warn("Failed to publish PatientRecordCreatedEvent for course document #{}: {}", id, e.getMessage());
            }
        }

        return doc;
    }

    public CourseTimelineDto getCourseTimeline(int courseId) {
        CourseDto course = getCourseById(courseId);
        if (course == null) {
            return null;
        }

        List<CourseEncounterDto> encounters = jdbc.query(
                """
                SELECT e.*, d.name AS doctor_name, h.name AS hospital_name
                FROM course_encounters e
                LEFT JOIN doctors d ON e.doctor_id = d.id
                LEFT JOIN hospitals h ON e.hospital_id = h.id
                WHERE e.course_id = :courseId
                ORDER BY e.visit_date DESC, e.id DESC
                """,
                Map.of("courseId", courseId),
                (rs, rowNum) -> CourseEncounterDto.builder()
                        .id(rs.getInt("id"))
                        .courseId(rs.getInt("course_id"))
                        .doctorId(rs.getInt("doctor_id"))
                        .doctorName(rs.getString("doctor_name"))
                        .hospitalId(rs.getInt("hospital_id"))
                        .hospitalName(rs.getString("hospital_name"))
                        .visitDate(rs.getTimestamp("visit_date").toLocalDateTime())
                        .chiefComplaint(rs.getString("chief_complaint"))
                        .clinicalNotes(rs.getString("clinical_notes"))
                        .examinationFindings(rs.getString("examination_findings"))
                        .plan(rs.getString("plan"))
                        .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                        .build()
        );

        for (CourseEncounterDto enc : encounters) {
            enc.setPrescriptions(listPrescriptionsForEncounter(enc.getId()));
            enc.setReferrals(listReferralsForEncounter(enc.getId()));
            enc.setDocuments(listDocumentsForEncounter(enc.getId()));
        }

        List<CourseDocumentDto> standaloneDocs = listStandaloneDocuments(courseId);

        return CourseTimelineDto.builder()
                .course(course)
                .encounters(encounters)
                .standaloneDocuments(standaloneDocs)
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public CourseDto closeCourse(int courseId) {
        jdbc.update("UPDATE courses SET status = 'completed', closed_at = NOW(), updated_at = NOW() WHERE id = :id",
                Map.of("id", courseId));
        return getCourseById(courseId);
    }

    public List<String> getBundledConsentTypes(String courseType) {
        if (courseType == null) return List.of("All Records");
        return switch (courseType.toLowerCase()) {
            case "tb_treatment", "tb" -> List.of("Sputum AFB Reports", "Chest X-Ray", "Liver Function Test (LFT)", "Treatment Prescriptions", "Clinical Notes");
            case "anc_pregnancy", "anc" -> List.of("Hb & Blood Reports", "Urine Routine", "Ultrasound Scans", "BP Trend Records", "IFA & Calcium Prescriptions");
            case "hypertension" -> List.of("BP Readings", "ECG", "Renal Function Test (RFT)", "Lipid Profile", "Antihypertensive Prescriptions");
            case "diabetes" -> List.of("Fasting Blood Sugar", "HbA1c", "Renal Function", "Eye Screening", "Antidiabetic Prescriptions");
            default -> List.of("Prescriptions", "Diagnostic Reports", "Clinical Notes");
        };
    }

    private CourseEncounterDto getEncounterById(int id) {
        List<CourseEncounterDto> rows = jdbc.query(
                """
                SELECT e.*, d.name AS doctor_name, h.name AS hospital_name
                FROM course_encounters e
                LEFT JOIN doctors d ON e.doctor_id = d.id
                LEFT JOIN hospitals h ON e.hospital_id = h.id
                WHERE e.id = :id
                """,
                Map.of("id", id),
                (rs, rowNum) -> CourseEncounterDto.builder()
                        .id(rs.getInt("id"))
                        .courseId(rs.getInt("course_id"))
                        .doctorId(rs.getInt("doctor_id"))
                        .doctorName(rs.getString("doctor_name"))
                        .hospitalId(rs.getInt("hospital_id"))
                        .hospitalName(rs.getString("hospital_name"))
                        .visitDate(rs.getTimestamp("visit_date").toLocalDateTime())
                        .chiefComplaint(rs.getString("chief_complaint"))
                        .clinicalNotes(rs.getString("clinical_notes"))
                        .examinationFindings(rs.getString("examination_findings"))
                        .plan(rs.getString("plan"))
                        .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                        .build());
        return rows.isEmpty() ? null : rows.get(0);
    }

    private CoursePrescriptionDto getPrescriptionById(int id) {
        List<CoursePrescriptionDto> rows = jdbc.query(
                """
                SELECT p.*, d.name AS doctor_name
                FROM course_prescriptions p
                LEFT JOIN doctors d ON p.doctor_id = d.id
                WHERE p.id = :id
                """,
                Map.of("id", id),
                (rs, rowNum) -> CoursePrescriptionDto.builder()
                        .id(rs.getInt("id"))
                        .courseId(rs.getInt("course_id"))
                        .encounterId((Integer) rs.getObject("encounter_id"))
                        .doctorId(rs.getInt("doctor_id"))
                        .doctorName(rs.getString("doctor_name"))
                        .medicineName(rs.getString("medicine_name"))
                        .snomedCode(rs.getString("snomed_code"))
                        .dosage(rs.getString("dosage"))
                        .frequency(rs.getString("frequency"))
                        .durationDays(rs.getInt("duration_days"))
                        .route(rs.getString("route"))
                        .instructions(rs.getString("instructions"))
                        .isNlem(rs.getBoolean("is_nlem"))
                        .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                        .build());
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<CoursePrescriptionDto> listPrescriptionsForEncounter(int encounterId) {
        return jdbc.query(
                """
                SELECT p.*, d.name AS doctor_name
                FROM course_prescriptions p
                LEFT JOIN doctors d ON p.doctor_id = d.id
                WHERE p.encounter_id = :encId
                ORDER BY p.id ASC
                """,
                Map.of("encId", encounterId),
                (rs, rowNum) -> CoursePrescriptionDto.builder()
                        .id(rs.getInt("id"))
                        .courseId(rs.getInt("course_id"))
                        .encounterId(rs.getInt("encounter_id"))
                        .doctorId(rs.getInt("doctor_id"))
                        .doctorName(rs.getString("doctor_name"))
                        .medicineName(rs.getString("medicine_name"))
                        .snomedCode(rs.getString("snomed_code"))
                        .dosage(rs.getString("dosage"))
                        .frequency(rs.getString("frequency"))
                        .durationDays(rs.getInt("duration_days"))
                        .route(rs.getString("route"))
                        .instructions(rs.getString("instructions"))
                        .isNlem(rs.getBoolean("is_nlem"))
                        .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                        .build());
    }

    private List<CourseReferralDto> listReferralsForEncounter(int encounterId) {
        return jdbc.query(
                """
                SELECT r.*, d.name AS referring_doctor_name, fh.name AS from_hospital_name,
                       th.name AS to_hospital_name, rd.name AS referred_doctor_name
                FROM course_referrals r
                LEFT JOIN doctors d ON r.referring_doctor_id = d.id
                LEFT JOIN hospitals fh ON r.from_hospital_id = fh.id
                LEFT JOIN hospitals th ON r.to_hospital_id = th.id
                LEFT JOIN doctors rd ON r.referred_doctor_id = rd.id
                WHERE r.encounter_id = :encId
                ORDER BY r.id ASC
                """,
                Map.of("encId", encounterId),
                (rs, rowNum) -> CourseReferralDto.builder()
                        .id(rs.getInt("id"))
                        .courseId(rs.getInt("course_id"))
                        .encounterId(rs.getInt("encounter_id"))
                        .referringDoctorId(rs.getInt("referring_doctor_id"))
                        .referringDoctorName(rs.getString("referring_doctor_name"))
                        .fromHospitalId(rs.getInt("from_hospital_id"))
                        .fromHospitalName(rs.getString("from_hospital_name"))
                        .toHospitalId(rs.getInt("to_hospital_id"))
                        .toHospitalName(rs.getString("to_hospital_name"))
                        .targetDepartment(rs.getString("target_department"))
                        .referredDoctorId((Integer) rs.getObject("referred_doctor_id"))
                        .referredDoctorName(rs.getString("referred_doctor_name"))
                        .reason(rs.getString("reason"))
                        .priorityTier(rs.getString("priority_tier"))
                        .validUntil(rs.getDate("valid_until").toLocalDate())
                        .status(rs.getString("status"))
                        .qrPayload(rs.getString("qr_payload"))
                        .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                        .build());
    }

    private List<CourseDocumentDto> listDocumentsForEncounter(int encounterId) {
        return jdbc.query(
                """
                SELECT id, course_id, encounter_id, doc_type, file_name, content_type, file_size, storage_path, file_hash, uploaded_by_doctor_id, notes, created_at
                FROM course_documents
                WHERE encounter_id = :encId
                ORDER BY id ASC
                """,
                Map.of("encId", encounterId),
                CourseService::mapDocMetadata);
    }

    private List<CourseDocumentDto> listStandaloneDocuments(int courseId) {
        return jdbc.query(
                """
                SELECT id, course_id, encounter_id, doc_type, file_name, content_type, file_size, storage_path, file_hash, uploaded_by_doctor_id, notes, created_at
                FROM course_documents
                WHERE course_id = :courseId AND encounter_id IS NULL
                ORDER BY id ASC
                """,
                Map.of("courseId", courseId),
                CourseService::mapDocMetadata);
    }

    public CourseDocumentDto getDocumentMetadata(int id) {
        List<CourseDocumentDto> rows = jdbc.query(
                """
                SELECT id, course_id, encounter_id, doc_type, file_name, content_type, file_size, storage_path, file_hash, uploaded_by_doctor_id, notes, created_at
                FROM course_documents
                WHERE id = :id
                """,
                Map.of("id", id),
                CourseService::mapDocMetadata);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public byte[] getDocumentData(int id) throws IOException {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT storage_path, file_data FROM course_documents WHERE id = :id",
                Map.of("id", id));
        if (rows.isEmpty()) {
            throw new FileNotFoundException("Document not found with ID: " + id);
        }
        Map<String, Object> row = rows.get(0);
        String storagePath = (String) row.get("storage_path");
        if (storagePath != null && !storagePath.isBlank()) {
            return documentStorageService.loadFile(storagePath);
        }
        byte[] legacyData = (byte[]) row.get("file_data");
        if (legacyData != null) {
            return legacyData;
        }
        throw new FileNotFoundException("No file content found for document ID: " + id);
    }

    private static CourseDocumentDto mapDocMetadata(ResultSet rs, int rowNum) throws SQLException {
        Timestamp ca = rs.getTimestamp("created_at");
        return CourseDocumentDto.builder()
                .id(rs.getInt("id"))
                .courseId(rs.getInt("course_id"))
                .encounterId((Integer) rs.getObject("encounter_id"))
                .docType(rs.getString("doc_type"))
                .fileName(rs.getString("file_name"))
                .contentType(rs.getString("content_type"))
                .fileSize(rs.getInt("file_size"))
                .storagePath(rs.getString("storage_path"))
                .fileHash(rs.getString("file_hash"))
                .uploadedByDoctorId((Integer) rs.getObject("uploaded_by_doctor_id"))
                .notes(rs.getString("notes"))
                .createdAt(ca != null ? ca.toLocalDateTime() : null)
                .build();
    }

    private static List<String> getPhoneVariants(String phone) {
        if (phone == null || phone.isBlank()) return List.of();
        String p = phone.trim();
        String digits = p.replaceAll("[^0-9]", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        return List.of(p, digits, "+91" + digits, "91" + digits);
    }
}
