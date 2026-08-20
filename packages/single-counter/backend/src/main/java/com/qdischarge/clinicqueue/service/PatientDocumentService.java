package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.DoctorPatientGroupDto;
import com.qdischarge.clinicqueue.dto.PatientDocumentDto;
import lombok.RequiredArgsConstructor;
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
 * has no cloud storage configured -- see patient_documents in V5). Listing
 * always projects metadata-only columns; only #getFile touches file_data, so
 * a patient's document list never drags BYTEA payloads across the wire.
 */
@Service
@RequiredArgsConstructor
public class PatientDocumentService {

    private final NamedParameterJdbcTemplate jdbc;

    private static final Set<String> VALID_DOC_TYPES = Set.of("prescription", "report");
    private static final long MAX_FILE_SIZE_BYTES = 8L * 1024 * 1024; // 8MB -- see BYTEA-in-Postgres storage decision

    private static final String METADATA_COLUMNS =
            "id, patient_phone, patient_name, patient_age, doc_type, hospital_id, uploaded_by_doctor_id, file_name, content_type, file_size, created_at";

    public PatientDocumentDto upload(String patientPhone, String patientName, Integer patientAge, String docType,
                                      Integer hospitalId, Integer uploadedByDoctorId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A file is required.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("File too large -- max 8MB.");
        }
        String normalizedType = docType == null ? "" : docType.trim().toLowerCase();
        if (!VALID_DOC_TYPES.contains(normalizedType)) {
            throw new IllegalArgumentException("docType must be 'prescription' or 'report'.");
        }
        if (patientName == null || patientName.isBlank()) {
            throw new IllegalArgumentException("patientName is required.");
        }

        Map<String, Object> params = new HashMap<>();
        params.put("phone", patientPhone);
        params.put("name", patientName);
        params.put("age", patientAge);
        params.put("docType", normalizedType);
        params.put("hospitalId", hospitalId);
        params.put("uploadedByDoctorId", uploadedByDoctorId);
        params.put("fileName", file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload");
        params.put("contentType", file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        params.put("fileSize", (int) file.getSize());
        params.put("fileData", file.getBytes());

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO patient_documents (patient_phone, patient_name, patient_age, doc_type, hospital_id, uploaded_by_doctor_id, file_name, content_type, file_size, file_data)
                VALUES (:phone, :name, :age, :docType, :hospitalId, :uploadedByDoctorId, :fileName, :contentType, :fileSize, :fileData)
                RETURNING id
                """, params, Integer.class);
        return getMetadata(id);
    }

    public List<PatientDocumentDto> listForPatient(String phone) {
        return jdbc.query(
                "SELECT " + METADATA_COLUMNS + " FROM patient_documents WHERE patient_phone = :phone ORDER BY created_at DESC",
                Map.of("phone", phone), PatientDocumentService::mapMetadata);
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
                "SELECT file_data, content_type, file_name FROM patient_documents WHERE id = :id", Map.of("id", id));
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> r = rows.get(0);
        return new FileContent((byte[]) r.get("file_data"), (String) r.get("content_type"), (String) r.get("file_name"));
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
                .createdAt(createdAt != null ? createdAt.toLocalDateTime() : null)
                .build();
    }
}
