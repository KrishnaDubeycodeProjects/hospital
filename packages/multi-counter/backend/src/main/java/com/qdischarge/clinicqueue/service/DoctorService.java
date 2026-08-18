package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.DoctorDto;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

/**
 * Doctor accounts: phone+OTP identity, exactly like patient registration
 * (see OtpService#isPhoneVerifiedRecently) -- "doctor is also a user".
 * Registration alone doesn't link a doctor to a hospital; joinHospital()
 * does that via the hospital's own join code (HospitalService).
 */
@Service
@RequiredArgsConstructor
public class DoctorService {

    private final NamedParameterJdbcTemplate jdbc;
    private final OtpService otpService;
    private final HospitalService hospitalService;
    private final JwtService jwtService;

    public record DoctorAuthResult(boolean success, String message, String token, DoctorDto doctor) {
    }

    public DoctorAuthResult register(String name, String phone) {
        if (!otpService.isPhoneVerifiedRecently(phone)) {
            return new DoctorAuthResult(false, "Please verify your phone number with the OTP sent via SMS before registering.", null, null);
        }
        if (findByPhone(phone) != null) {
            return new DoctorAuthResult(false, "This phone number is already registered as a doctor -- use /api/doctors/login instead.", null, null);
        }

        Integer id = jdbc.queryForObject(
                "INSERT INTO doctors (phone, name) VALUES (:phone, :name) RETURNING id",
                Map.of("phone", phone, "name", name), Integer.class);

        String token = jwtService.generateDoctorToken(phone, id);
        return new DoctorAuthResult(true, "Registered.", token, getById(id));
    }

    public DoctorAuthResult login(String phone) {
        if (!otpService.isPhoneVerifiedRecently(phone)) {
            return new DoctorAuthResult(false, "Please verify your phone number with the OTP sent via SMS first.", null, null);
        }
        DoctorDto doctor = findByPhone(phone);
        if (doctor == null) {
            return new DoctorAuthResult(false, "No doctor account for this phone number -- register first.", null, null);
        }
        String token = jwtService.generateDoctorToken(phone, doctor.getId());
        return new DoctorAuthResult(true, "Logged in.", token, doctor);
    }

    /** Links this doctor to whichever hospital owns the given join code (see HospitalService#getDoctorJoinCode). */
    public DoctorDto joinHospital(int doctorId, String hospitalCode) {
        HospitalDto hospital = hospitalService.findByDoctorJoinCode(hospitalCode.trim().toUpperCase());
        if (hospital == null) {
            throw new IllegalArgumentException("Invalid hospital code.");
        }
        jdbc.update("UPDATE doctors SET hospital_id = :hospitalId, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
                Map.of("hospitalId", hospital.getId(), "id", doctorId));
        return getById(doctorId);
    }

    public DoctorDto getById(int id) {
        List<DoctorDto> rows = jdbc.query(JOINED_SELECT + " WHERE d.id = :id", Map.of("id", id), DoctorService::mapRow);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private DoctorDto findByPhone(String phone) {
        List<DoctorDto> rows = jdbc.query(JOINED_SELECT + " WHERE d.phone = :phone", Map.of("phone", phone), DoctorService::mapRow);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static final String JOINED_SELECT = """
            SELECT d.id, d.phone, d.name, d.hospital_id, h.name AS hospital_name, d.created_at
            FROM doctors d LEFT JOIN hospitals h ON h.id = d.hospital_id
            """;

    private static DoctorDto mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        return DoctorDto.builder()
                .id(rs.getInt("id"))
                .phone(rs.getString("phone"))
                .name(rs.getString("name"))
                .hospitalId((Integer) rs.getObject("hospital_id"))
                .hospitalName(rs.getString("hospital_name"))
                .createdAt(createdAt != null ? createdAt.toLocalDateTime() : null)
                .build();
    }
}
