package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.dto.AccessGrantDto;
import com.qdischarge.clinicqueue.dto.AccessRequestDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * The doctor <-> patient consent model: a doctor generates a short-lived
 * access *request* (code + QR), a patient's device claims it, which creates
 * a revocable access *grant* and fires a WhatsApp notice the patient can
 * reply to (see BotMessages#accessGranted / WebhookController's "revoke"
 * command) to undo it immediately if it wasn't them.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccessService {

    private final NamedParameterJdbcTemplate jdbc;
    private final WaSessionService waSessionService;
    private final BotMessages botMessages;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final int REQUEST_EXPIRY_MINUTES = 30;

    public AccessRequestDto createRequest(int doctorId) {
        String code = generateCode();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(REQUEST_EXPIRY_MINUTES);
        Integer id = jdbc.queryForObject(
                "INSERT INTO access_requests (code, doctor_id, expires_at) VALUES (:code, :doctorId, :expiresAt) RETURNING id",
                Map.of("code", code, "doctorId", doctorId, "expiresAt", expiresAt), Integer.class);
        return AccessRequestDto.builder()
                .id(id).code(code).doctorId(doctorId).status("pending")
                .createdAt(LocalDateTime.now()).expiresAt(expiresAt).build();
    }

    /** Looks up a pending request by its code -- used to render the QR PNG without needing the numeric id. */
    public AccessRequestDto getByCode(String code) {
        List<AccessRequestDto> rows = jdbc.query(
                "SELECT id, code, doctor_id, status, created_at, expires_at FROM access_requests WHERE code = :code",
                Map.of("code", code), AccessService::mapRequest);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Patient's device claims a doctor's access code -- creates the grant and notifies the patient over WhatsApp. */
    public AccessGrantDto claim(String code, String patientPhone) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, doctor_id, status, expires_at FROM access_requests WHERE code = :code",
                Map.of("code", code.trim().toUpperCase()));
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Invalid access code.");
        }
        Map<String, Object> req = rows.get(0);
        int requestId = (Integer) req.get("id");
        String status = (String) req.get("status");
        LocalDateTime expiresAt = ((Timestamp) req.get("expires_at")).toLocalDateTime();
        int doctorId = (Integer) req.get("doctor_id");

        if (!"pending".equals(status) || expiresAt.isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("This access code has expired or was already used.");
        }

        jdbc.update("UPDATE access_requests SET status = 'claimed', claimed_by_phone = :phone, claimed_at = NOW() WHERE id = :id",
                Map.of("phone", patientPhone, "id", requestId));

        Integer grantId = jdbc.queryForObject(
                "INSERT INTO access_grants (doctor_id, patient_phone, source_request_id) VALUES (:doctorId, :phone, :requestId) RETURNING id",
                Map.of("doctorId", doctorId, "phone", patientPhone, "requestId", requestId), Integer.class);

        AccessGrantDto grant = getGrant(grantId);
        notifyPatientOfNewAccess(grant);
        return grant;
    }

    /** Only the granting patient can revoke -- ownership is enforced by the WHERE clause, not just the caller. */
    public boolean revoke(int grantId, String patientPhone) {
        int updated = jdbc.update(
                "UPDATE access_grants SET revoked_at = NOW(), revoked_by = 'patient' WHERE id = :id AND patient_phone = :phone AND revoked_at IS NULL",
                Map.of("id", grantId, "phone", patientPhone));
        return updated > 0;
    }

    public List<AccessGrantDto> listActiveForPatient(String phone) {
        return jdbc.query(JOINED_GRANT_SELECT + " WHERE g.patient_phone = :phone AND g.revoked_at IS NULL ORDER BY g.granted_at DESC",
                Map.of("phone", phone), AccessService::mapGrant);
    }

    /** Every grant this phone has ever issued, active or revoked -- "history of accessed doctors". */
    public List<AccessGrantDto> listHistoryForPatient(String phone) {
        return jdbc.query(JOINED_GRANT_SELECT + " WHERE g.patient_phone = :phone ORDER BY g.granted_at DESC",
                Map.of("phone", phone), AccessService::mapGrant);
    }

    /** Phone numbers this doctor currently has active (non-revoked) access to -- feeds PatientDocumentService#groupByIdentity. */
    public List<String> listActivePatientPhonesForDoctor(int doctorId) {
        return jdbc.query(
                "SELECT DISTINCT patient_phone FROM access_grants WHERE doctor_id = :doctorId AND revoked_at IS NULL",
                Map.of("doctorId", doctorId), (rs, i) -> rs.getString("patient_phone"));
    }

    private AccessGrantDto getGrant(int id) {
        List<AccessGrantDto> rows = jdbc.query(JOINED_GRANT_SELECT + " WHERE g.id = :id", Map.of("id", id), AccessService::mapGrant);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void notifyPatientOfNewAccess(AccessGrantDto grant) {
        // Proactive WhatsApp notifications from server removed (only respond when user initiates)
        log.info("Access grant {} created for patient {}. WhatsApp notification skipped (only user-initiated responses permitted).", grant.getId(), grant.getPatientPhone());
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    private static final String JOINED_GRANT_SELECT = """
            SELECT g.id, g.doctor_id, d.name AS doctor_name, h.name AS hospital_name,
                   g.patient_phone, g.granted_at, g.revoked_at, g.revoked_by
            FROM access_grants g
            JOIN doctors d ON d.id = g.doctor_id
            LEFT JOIN hospitals h ON h.id = d.hospital_id
            """;

    private static AccessGrantDto mapGrant(ResultSet rs, int rowNum) throws SQLException {
        Timestamp grantedAt = rs.getTimestamp("granted_at");
        Timestamp revokedAt = rs.getTimestamp("revoked_at");
        return AccessGrantDto.builder()
                .id(rs.getInt("id"))
                .doctorId(rs.getInt("doctor_id"))
                .doctorName(rs.getString("doctor_name"))
                .hospitalName(rs.getString("hospital_name"))
                .patientPhone(rs.getString("patient_phone"))
                .grantedAt(grantedAt != null ? grantedAt.toLocalDateTime() : null)
                .revokedAt(revokedAt != null ? revokedAt.toLocalDateTime() : null)
                .revokedBy(rs.getString("revoked_by"))
                .build();
    }

    private static AccessRequestDto mapRequest(ResultSet rs, int rowNum) throws SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        Timestamp expiresAt = rs.getTimestamp("expires_at");
        return AccessRequestDto.builder()
                .id(rs.getInt("id"))
                .code(rs.getString("code"))
                .doctorId(rs.getInt("doctor_id"))
                .status(rs.getString("status"))
                .createdAt(createdAt != null ? createdAt.toLocalDateTime() : null)
                .expiresAt(expiresAt != null ? expiresAt.toLocalDateTime() : null)
                .build();
    }
}
