package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.DoctorPatientGroupDto;
import com.qdischarge.clinicqueue.dto.PatientDocumentDto;
import com.qdischarge.clinicqueue.event.PatientRecordCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Prescription/report photo uploads, stored as Postgres BYTEA (this project
 * has no cloud storage configured -- see patient_documents in schema.sql). Listing
 * always projects metadata-only columns; only #getFile touches file_data, so
 * a patient's document list never drags BYTEA payloads across the wire.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PatientDocumentService {

    private final NamedParameterJdbcTemplate jdbc;
    private final ApplicationEventPublisher eventPublisher;
    private final DocumentStorageService documentStorageService;

    private static final Set<String> VALID_DOC_TYPES = Set.of("prescription", "report", "lab_report", "discharge_summary", "lab", "diagnostic");
    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024; // 10MB aligned with AppProperties

    private static final String METADATA_COLUMNS =
            "id, patient_phone, patient_name, patient_age, doc_type, hospital_id, uploaded_by_doctor_id, file_name, content_type, file_size, storage_path, file_hash, created_at";

    public PatientDocumentDto upload(String patientPhone, String patientName, Integer patientAge, String docType,
                                      Integer hospitalId, Integer uploadedByDoctorId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A file is required.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("File too large -- max 10MB.");
        }
        String inputType = docType == null ? "prescription" : docType.trim().toLowerCase();
        String normalizedType = "prescription";
        if (inputType.contains("report") || inputType.contains("lab") || inputType.contains("diagnostic") || inputType.contains("summary")) {
            normalizedType = "report";
        }
        if (patientName == null || patientName.isBlank()) {
            patientName = "Self";
        }

        // Store off-database with Apache Tika magic-bytes validation and hash computation
        DocumentStorageService.StoredFile storedFile = documentStorageService.storeFile(file, "patient-docs");

        Map<String, Object> params = new HashMap<>();
        params.put("phone", patientPhone);
        params.put("name", patientName);
        params.put("age", patientAge);
        params.put("docType", normalizedType);
        params.put("hospitalId", hospitalId);
        params.put("uploadedByDoctorId", uploadedByDoctorId);
        params.put("fileName", storedFile.fileName());
        params.put("contentType", storedFile.contentType());
        params.put("fileSize", (int) storedFile.fileSize());
        params.put("storagePath", storedFile.storagePath());
        params.put("fileHash", storedFile.fileHash());

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO patient_documents (patient_phone, patient_name, patient_age, doc_type, hospital_id,
                                              uploaded_by_doctor_id, file_name, content_type, file_size,
                                              storage_path, file_hash)
                VALUES (:phone, :name, :age, :docType, :hospitalId, :uploadedByDoctorId,
                        :fileName, :contentType, :fileSize, :storagePath, :fileHash)
                RETURNING id
                """, params, Integer.class);

        // Lookup ABHA identifier:
        // 1. Direct match for the specific patient name being uploaded for
        // 2. Fallback to Parent/Head/Self member in family unit (for children, elders, or unlinked members)
        String abha = null;
        try {
            if (patientName != null && !patientName.isBlank()) {
                List<Map<String, Object>> specificMember = jdbc.queryForList(
                        """
                        SELECT m.abha_address, m.abha_number FROM family_members m
                        JOIN family_units u ON m.family_unit_id = u.id
                        WHERE u.primary_phone = :phone AND LOWER(TRIM(m.name)) = LOWER(TRIM(:name))
                          AND (m.is_abha_linked = TRUE OR m.abha_address IS NOT NULL OR m.abha_number IS NOT NULL)
                        LIMIT 1
                        """,
                        Map.of("phone", patientPhone, "name", patientName.trim()));
                if (!specificMember.isEmpty()) {
                    abha = (String) specificMember.get(0).get("abha_address");
                    if (abha == null || abha.isBlank()) {
                        abha = (String) specificMember.get(0).get("abha_number");
                    }
                }
            }

            // Fallback: If this member does not have their own ABHA, inherit from parent/self/head of the family unit
            if (abha == null || abha.isBlank()) {
                List<Map<String, Object>> familyFallback = jdbc.queryForList(
                        """
                        SELECT m.name, m.relationship, m.abha_address, m.abha_number FROM family_members m
                        JOIN family_units u ON m.family_unit_id = u.id
                        WHERE u.primary_phone = :phone
                          AND (m.is_abha_linked = TRUE OR m.abha_address IS NOT NULL OR m.abha_number IS NOT NULL)
                        ORDER BY 
                          CASE WHEN LOWER(m.relationship) IN ('self', 'head', 'myself') THEN 0
                               WHEN LOWER(m.relationship) IN ('father', 'mother', 'parent') THEN 1
                               ELSE 2 END,
                          m.id ASC
                        LIMIT 1
                        """,
                        Map.of("phone", patientPhone));
                if (!familyFallback.isEmpty()) {
                    abha = (String) familyFallback.get(0).get("abha_address");
                    if (abha == null || abha.isBlank()) {
                        abha = (String) familyFallback.get(0).get("abha_number");
                    }
                    if (abha != null && !abha.isBlank()) {
                        log.info("ℹ️ Patient '{}' has no direct ABHA. Using family head/parent ({}: {}) ABHA: {} for Eka Care sync",
                                patientName, familyFallback.get(0).get("relationship"), familyFallback.get(0).get("name"), abha);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Non-fatal error resolving ABHA for document upload: {}", e.getMessage());
        }

        if (eventPublisher != null) {
            byte[] fileBytes;
            try {
                fileBytes = documentStorageService.loadFile(storedFile.storagePath());
            } catch (Exception e) {
                fileBytes = file.getBytes();
            }

            eventPublisher.publishEvent(PatientRecordCreatedEvent.builder()
                    .recordType(PatientRecordCreatedEvent.RecordType.PATIENT_DOCUMENT)
                    .recordId((long) id)
                    .patientPhone(patientPhone)
                    .patientName(patientName)
                    .abhaIdentifier(abha)
                    .fileBytes(fileBytes)
                    .fileName(storedFile.fileName())
                    .contentType(storedFile.contentType())
                    .docType(normalizedType)
                    .build());
        }

        return getMetadata(id);
    }

    public List<PatientDocumentDto> listForPatient(String phone) {
        String p = phone != null ? phone.trim() : "";
        String digits = p.replaceAll("[^0-9]", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        List<String> phones = List.of(p, digits, "+91" + digits, "91" + digits);
        return jdbc.query(
                "SELECT " + METADATA_COLUMNS + " FROM patient_documents WHERE patient_phone IN (:phones) ORDER BY created_at DESC",
                Map.of("phones", phones), PatientDocumentService::mapMetadata);
    }

    public PatientDocumentDto getMetadata(int id) {
        List<PatientDocumentDto> rows = jdbc.query(
                "SELECT " + METADATA_COLUMNS + " FROM patient_documents WHERE id = :id",
                Map.of("id", id), PatientDocumentService::mapMetadata);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public record FileContent(byte[] data, String contentType, String fileName) {
    }

    public FileContent getFile(int id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT storage_path, file_data, content_type, file_name FROM patient_documents WHERE id = :id", Map.of("id", id));
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> r = rows.get(0);
        String storagePath = (String) r.get("storage_path");
        String contentType = (String) r.get("content_type");
        String fileName = (String) r.get("file_name");

        byte[] data;
        if (storagePath != null && !storagePath.isBlank()) {
            try {
                data = documentStorageService.loadFile(storagePath);
            } catch (IOException e) {
                // Fallback to legacy file_data BYTEA if file missing on disk
                data = (byte[]) r.get("file_data");
            }
        } else {
            data = (byte[]) r.get("file_data");
        }

        return new FileContent(data, contentType, fileName);
    }

    /**
     * A doctor's full accessible record set: every document under any of the
     * given phone numbers, grouped by (phone, name, age) rather than phone
     * alone -- see DoctorPatientGroupDto. A phone with zero documents still
     * appears (empty group) so "I was just granted access" is visible even
     * before any record exists.
     */
    public List<DoctorPatientGroupDto> groupByIdentity(List<String> accessiblePhones) {
        if (accessiblePhones.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT " + METADATA_COLUMNS + " FROM patient_documents WHERE patient_phone IN (:phones) " +
                        "ORDER BY patient_phone, patient_name, patient_age, created_at DESC",
                Map.of("phones", accessiblePhones));

        Map<String, DoctorPatientGroupDto> groups = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String phone = (String) row.get("patient_phone");
            String name = (String) row.get("patient_name");
            Integer age = (Integer) row.get("patient_age");
            String key = phone + "|" + name + "|" + age;
            DoctorPatientGroupDto group = groups.computeIfAbsent(key, k -> DoctorPatientGroupDto.builder()
                    .patientPhone(phone).name(name).age(age).documents(new ArrayList<>()).build());
            group.getDocuments().add(mapMetadataRow(row));
        }

        for (String phone : accessiblePhones) {
            boolean hasAnyGroup = groups.keySet().stream().anyMatch(k -> k.startsWith(phone + "|"));
            if (!hasAnyGroup) {
                groups.put(phone + "|", DoctorPatientGroupDto.builder()
                        .patientPhone(phone).documents(List.of()).build());
            }
        }
        return new ArrayList<>(groups.values());
    }

    private static PatientDocumentDto mapMetadata(ResultSet rs, int rowNum) throws SQLException {
        return mapMetadataRow(toRowMap(rs));
    }

    private static Map<String, Object> toRowMap(ResultSet rs) throws SQLException {
        Map<String, Object> row = new HashMap<>();
        row.put("id", rs.getInt("id"));
        row.put("patient_phone", rs.getString("patient_phone"));
        row.put("patient_name", rs.getString("patient_name"));
        row.put("patient_age", (Integer) rs.getObject("patient_age"));
        row.put("doc_type", rs.getString("doc_type"));
        row.put("hospital_id", (Integer) rs.getObject("hospital_id"));
        row.put("uploaded_by_doctor_id", (Integer) rs.getObject("uploaded_by_doctor_id"));
        row.put("file_name", rs.getString("file_name"));
        row.put("content_type", rs.getString("content_type"));
        row.put("file_size", (Integer) rs.getObject("file_size"));
        row.put("storage_path", rs.getString("storage_path"));
        row.put("file_hash", rs.getString("file_hash"));
        row.put("created_at", rs.getTimestamp("created_at"));
        return row;
    }

    private static PatientDocumentDto mapMetadataRow(Map<String, Object> row) {
        Timestamp createdAt = (Timestamp) row.get("created_at");
        return PatientDocumentDto.builder()
                .id((Integer) row.get("id"))
                .patientPhone((String) row.get("patient_phone"))
                .patientName((String) row.get("patient_name"))
                .patientAge((Integer) row.get("patient_age"))
                .docType((String) row.get("doc_type"))
                .hospitalId((Integer) row.get("hospital_id"))
                .uploadedByDoctorId((Integer) row.get("uploaded_by_doctor_id"))
                .fileName((String) row.get("file_name"))
                .contentType((String) row.get("content_type"))
                .fileSize((Integer) row.get("file_size"))
                .storagePath((String) row.get("storage_path"))
                .fileHash((String) row.get("file_hash"))
                .createdAt(createdAt != null ? createdAt.toLocalDateTime() : null)
                .build();
    }

    /**
     * Downloads a WhatsApp media file using its Meta media ID and saves it as a
     * patient document in the health vault.
     *
     * @param phone      patient phone number (used to find family unit)
     * @param memberId   family member ID to attach the document to
     * @param mediaId    Meta WhatsApp media ID (from message payload)
     * @param mediaType  "document" or "image" from the message type field
     * @param label      patient-supplied document name/label
     * @param accessToken Meta API access token for downloading
     * @param apiVersion  Meta API version string (e.g. "v19.0")
     * @return saved PatientDocumentDto or null on failure
     */
    public PatientDocumentDto saveFromWhatsAppMedia(
            String phone, Integer memberId, String mediaId,
            String mediaType, String label,
            String accessToken, String apiVersion) {
        try {
            // Step 1: Get media URL from Meta API
            org.springframework.web.client.RestTemplate rt = new org.springframework.web.client.RestTemplate();
            String metaUrl = "https://graph.facebook.com/" + apiVersion + "/" + mediaId;
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setBearerAuth(accessToken);
            org.springframework.http.ResponseEntity<Map> metaResp = rt.exchange(
                    metaUrl, org.springframework.http.HttpMethod.GET,
                    new org.springframework.http.HttpEntity<>(headers), Map.class);
            if (metaResp.getBody() == null) return null;
            String downloadUrl = (String) metaResp.getBody().get("url");
            String mimeType = (String) metaResp.getBody().getOrDefault("mime_type", "application/octet-stream");
            if (downloadUrl == null) return null;

            // Step 2: Download the actual file bytes
            org.springframework.http.HttpHeaders dlHeaders = new org.springframework.http.HttpHeaders();
            dlHeaders.setBearerAuth(accessToken);
            org.springframework.http.ResponseEntity<byte[]> dlResp = rt.exchange(
                    downloadUrl, org.springframework.http.HttpMethod.GET,
                    new org.springframework.http.HttpEntity<>(dlHeaders), byte[].class);
            if (dlResp.getBody() == null) return null;
            byte[] fileBytes = dlResp.getBody();

            // Step 3: Determine file extension
            String ext = ".bin";
            if (mimeType.contains("pdf")) ext = ".pdf";
            else if (mimeType.contains("jpeg") || mimeType.contains("jpg")) ext = ".jpg";
            else if (mimeType.contains("png")) ext = ".png";

            String safeLabel = label != null && !label.isBlank() ? label : "WhatsApp Document";
            String fileName = safeLabel.replaceAll("[^a-zA-Z0-9\\\\-_ ]", "_") + ext;

            // Step 4: Lookup member details to map correctly
            String pName = safeLabel;
            Integer pAge = null;
            if (memberId != null) {
                List<Map<String, Object>> mems = jdbc.queryForList(
                        "SELECT name, age FROM family_members WHERE id = :id", Map.of("id", memberId));
                if (!mems.isEmpty()) {
                    pName = (String) mems.get(0).get("name");
                    Object ageObj = mems.get(0).get("age");
                    if (ageObj instanceof Integer) pAge = (Integer) ageObj;
                }
            }

            // Save directly to DB as file_data since we don't have a MultipartFile
            Map<String, Object> params = new HashMap<>();
            params.put("phone", phone);
            params.put("name", pName);
            params.put("age", pAge);
            params.put("docType", "report"); // default to report for WA media
            params.put("fileName", fileName);
            params.put("contentType", mimeType);
            params.put("fileSize", fileBytes.length);
            params.put("fileData", fileBytes);

            Integer id = jdbc.queryForObject(
                    """
                    INSERT INTO patient_documents (patient_phone, patient_name, patient_age, doc_type,
                                                  file_name, content_type, file_size, file_data)
                    VALUES (:phone, :name, :age, :docType, :fileName, :contentType, :fileSize, :fileData)
                    RETURNING id
                    """, params, Integer.class);

            log.info("WhatsApp media document saved: {} for member {}", safeLabel, memberId);
            return getMetadata(id);
        } catch (Exception e) {
            log.error("Failed to save WhatsApp media document: {}", e.getMessage());
            return null;
        }
    }
}
