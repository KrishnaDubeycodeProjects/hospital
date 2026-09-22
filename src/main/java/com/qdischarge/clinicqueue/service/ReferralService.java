package com.qdischarge.clinicqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CourseDto;
import com.qdischarge.clinicqueue.dto.CreateReferralRequest;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.ReferralDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import com.qdischarge.clinicqueue.exception.ReferralQuotaExceededException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.stereotype.Service;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReferralService {

    private final NamedParameterJdbcTemplate jdbc;
    private final CourseService courseService;
    private final HospitalService hospitalService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    private static final RowMapper<ReferralDto> REFERRAL_MAPPER = (rs, rowNum) -> {
        Date vu = rs.getDate("valid_until");
        Timestamp ca = rs.getTimestamp("created_at");
        Timestamp va = rs.getTimestamp("visited_at");
        return ReferralDto.builder()
                .id(rs.getInt("id"))
                .courseId(rs.getInt("course_id"))
                .courseTitle(rs.getString("course_title"))
                .encounterId((Integer) rs.getObject("encounter_id"))
                .patientPhone(rs.getString("patient_phone"))
                .patientName(rs.getString("patient_name"))
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
                .validUntil(vu != null ? vu.toLocalDate() : null)
                .status(rs.getString("status"))
                .qrPayload(rs.getString("qr_payload"))
                .createdAt(ca != null ? ca.toLocalDateTime() : null)
                .visitedAt(va != null ? va.toLocalDateTime() : null)
                .build();
    };

    @Transactional(rollbackFor = Exception.class)
    public ReferralDto createReferral(CreateReferralRequest req, int referringDoctorId, int fromHospitalId) {
        CourseDto course = courseService.getCourseById(req.courseId());
        if (course == null) {
            throw new IllegalArgumentException("Course not found: " + req.courseId());
        }

        ZoneId zoneId = ZoneId.of("Asia/Kolkata");
        LocalDate now = LocalDate.now(zoneId);
        String tier = req.priorityTier().toLowerCase();
        LocalDate validUntil = switch (tier) {
            case "urgent_7d" -> now.plusDays(7);
            case "semi_urgent_14d" -> now.plusDays(14);
            default -> now.plusDays(30);
        };

        // Check referral quotas at target hospital with pessimistic row-locking FOR UPDATE
        List<Map<String, Object>> hospRows = jdbc.queryForList(
                "SELECT id, name, urgent_referral_quota, standard_referral_quota FROM hospitals WHERE id = :toHospId FOR UPDATE",
                Map.of("toHospId", req.toHospitalId()));
        if (hospRows.isEmpty()) {
            throw new IllegalArgumentException("Target hospital not found: " + req.toHospitalId());
        }

        Map<String, Object> hospRow = hospRows.get(0);
        String hospName = (String) hospRow.get("name");
        int urgentQuota = hospRow.get("urgent_referral_quota") != null ? ((Number) hospRow.get("urgent_referral_quota")).intValue() : 5;
        int standardQuota = hospRow.get("standard_referral_quota") != null ? ((Number) hospRow.get("standard_referral_quota")).intValue() : 15;
        int maxQuota = "urgent_7d".equalsIgnoreCase(tier) ? urgentQuota : standardQuota;

        Integer activeReferralsCount = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM course_referrals
                WHERE to_hospital_id = :toHospId
                  AND status IN ('issued', 'booked')
                  AND priority_tier = :tier
                  AND valid_until >= :currentDate
                """,
                Map.of("toHospId", req.toHospitalId(), "tier", tier, "currentDate", Date.valueOf(now)),
                Integer.class);

        if (activeReferralsCount != null && activeReferralsCount >= maxQuota) {
            throw new ReferralQuotaExceededException(tier, hospName, activeReferralsCount, maxQuota);
        }

        Map<String, Object> qrMap = new LinkedHashMap<>();
        qrMap.put("type", "REFERRAL_PASS");
        qrMap.put("patientPhone", course.getPatientPhone());
        qrMap.put("courseId", course.getId());
        qrMap.put("priority", tier);
        qrMap.put("validUntil", validUntil.toString());

        String qrPayload;
        try {
            qrPayload = objectMapper.writeValueAsString(qrMap);
        } catch (Exception e) {
            qrPayload = "REFERRAL:" + course.getId() + ":" + tier;
        }

        Map<String, Object> params = new HashMap<>();
        params.put("courseId", req.courseId());
        params.put("encounterId", req.encounterId());
        params.put("referringDoctorId", referringDoctorId);
        params.put("fromHospitalId", fromHospitalId);
        params.put("toHospitalId", req.toHospitalId());
        params.put("targetDepartment", req.targetDepartment());
        params.put("referredDoctorId", req.referredDoctorId());
        params.put("reason", req.reason());
        params.put("priorityTier", tier);
        params.put("validUntil", Date.valueOf(validUntil));
        params.put("qrPayload", qrPayload);

        Integer referralId = jdbc.queryForObject(
                """
                INSERT INTO course_referrals (course_id, encounter_id, referring_doctor_id, from_hospital_id,
                                              to_hospital_id, target_department, referred_doctor_id, reason,
                                              priority_tier, valid_until, status, qr_payload)
                VALUES (:courseId, :encounterId, :referringDoctorId, :fromHospitalId,
                        :toHospitalId, :targetDepartment, :referredDoctorId, :reason,
                        :priorityTier, :validUntil, 'issued', :qrPayload)
                RETURNING id
                """,
                params, Integer.class);

        ReferralDto referral = getReferralById(referralId);

        // Send WhatsApp referral card to patient only after transaction successfully commits
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendReferralCardNotification(referral);
                }
            });
        } else {
            sendReferralCardNotification(referral);
        }

        return referral;
    }

    @Transactional(rollbackFor = Exception.class)
    public ReferralDto cancelReferral(int referralId, int doctorId) {
        int rows = jdbc.update(
                """
                UPDATE course_referrals
                SET status = 'cancelled'
                WHERE id = :id AND (referring_doctor_id = :docId OR referred_doctor_id = :docId)
                """,
                Map.of("id", referralId, "docId", doctorId));
        if (rows == 0) {
            throw new IllegalArgumentException("Referral not found or caller is not authorized to cancel this referral.");
        }
        return getReferralById(referralId);
    }

    public ReferralDto getReferralById(int id) {
        List<ReferralDto> rows = jdbc.query(
                """
                SELECT r.*, c.title AS course_title, c.patient_phone, c.patient_name,
                       d.name AS referring_doctor_name, fh.name AS from_hospital_name,
                       th.name AS to_hospital_name, rd.name AS referred_doctor_name
                FROM course_referrals r
                JOIN courses c ON r.course_id = c.id
                LEFT JOIN doctors d ON r.referring_doctor_id = d.id
                LEFT JOIN hospitals fh ON r.from_hospital_id = fh.id
                LEFT JOIN hospitals th ON r.to_hospital_id = th.id
                LEFT JOIN doctors rd ON r.referred_doctor_id = rd.id
                WHERE r.id = :id
                """,
                Map.of("id", id), REFERRAL_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<ReferralDto> listReferralsForPatient(String phone) {
        List<String> phones = getPhoneVariants(phone);
        return jdbc.query(
                """
                SELECT r.*, c.title AS course_title, c.patient_phone, c.patient_name,
                       d.name AS referring_doctor_name, fh.name AS from_hospital_name,
                       th.name AS to_hospital_name, rd.name AS referred_doctor_name
                FROM course_referrals r
                JOIN courses c ON r.course_id = c.id
                LEFT JOIN doctors d ON r.referring_doctor_id = d.id
                LEFT JOIN hospitals fh ON r.from_hospital_id = fh.id
                LEFT JOIN hospitals th ON r.to_hospital_id = th.id
                LEFT JOIN doctors rd ON r.referred_doctor_id = rd.id
                WHERE c.patient_phone IN (:phones)
                ORDER BY r.created_at DESC
                """,
                Map.of("phones", phones), REFERRAL_MAPPER);
    }

    public ReferralDto findPriorReferralContext(int courseId, int toHospitalId) {
        List<ReferralDto> rows = jdbc.query(
                """
                SELECT r.*, c.title AS course_title, c.patient_phone, c.patient_name,
                       d.name AS referring_doctor_name, fh.name AS from_hospital_name,
                       th.name AS to_hospital_name, rd.name AS referred_doctor_name
                FROM course_referrals r
                JOIN courses c ON r.course_id = c.id
                LEFT JOIN doctors d ON r.referring_doctor_id = d.id
                LEFT JOIN hospitals fh ON r.from_hospital_id = fh.id
                LEFT JOIN hospitals th ON r.to_hospital_id = th.id
                LEFT JOIN doctors rd ON r.referred_doctor_id = rd.id
                WHERE r.course_id = :courseId AND (r.to_hospital_id = :toHospitalId OR r.from_hospital_id = :toHospitalId)
                ORDER BY r.created_at DESC
                LIMIT 1
                """,
                Map.of("courseId", courseId, "toHospitalId", toHospitalId), REFERRAL_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public ReferralDto completeReferral(int referralId) {
        jdbc.update("UPDATE course_referrals SET status = 'completed', visited_at = NOW() WHERE id = :id",
                Map.of("id", referralId));
        return getReferralById(referralId);
    }

    private void sendReferralCardNotification(ReferralDto r) {
        // Proactive WhatsApp notifications from server removed (only respond when user initiates)
        log.info("Referral {} issued for {}. WhatsApp notification skipped (only user-initiated responses permitted).", r.getId(), r.getPatientPhone());
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
