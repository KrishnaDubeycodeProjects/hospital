package com.qdischarge.clinicqueue.security;

import com.qdischarge.clinicqueue.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * Issues and validates signed, short-lived session tokens for all three
 * kinds of caller this API has: ROLE_ADMIN (reception/staff, unchanged from
 * the original single static ADMIN_TOKEN), ROLE_PATIENT (issued to a phone
 * number the moment its OTP is verified -- see OtpController), and
 * ROLE_DOCTOR (issued on doctor registration/login, carries a doctorId claim
 * so doctor-scoped endpoints know which doctor is calling without a second
 * DB lookup). The token itself is opaque to callers, which just store
 * whatever string comes back and replay it as a Bearer header.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    private static final String ROLE_CLAIM = "role";
    private static final String DOCTOR_ID_CLAIM = "doctorId";

    public static final String ADMIN_ROLE = "ADMIN";
    public static final String PATIENT_ROLE = "PATIENT";
    public static final String DOCTOR_ROLE = "DOCTOR";

    private final AppProperties appProperties;
    private SecretKey signingKey;

    @PostConstruct
    void init() {
        String secret = appProperties.getJwtSecret();
        if (secret == null || secret.isBlank()) {
            log.warn("⚠️ JWT_SECRET is not set. Generating a random signing key for this process only -- "
                    + "all sessions (admin/patient/doctor) will be invalidated on restart, and this is NOT safe "
                    + "for a multi-instance deployment. Set JWT_SECRET explicitly in production.");
            byte[] random = new byte[64];
            new SecureRandom().nextBytes(random);
            signingKey = Keys.hmacShaKeyFor(random);
        } else {
            byte[] keyBytes = decodeSecret(secret);
            signingKey = Keys.hmacShaKeyFor(keyBytes);
        }
    }

    private byte[] decodeSecret(String secret) {
        try {
            byte[] decoded = Base64.getDecoder().decode(secret);
            if (decoded.length >= 32) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            // not base64 -- fall through and use raw UTF-8 bytes
        }
        return secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    public String generateAdminToken(String username) {
        return generateToken(username, ADMIN_ROLE, Map.of());
    }

    /** Issued the moment a phone number's OTP is verified (see OtpController#verify). */
    public String generatePatientToken(String phone) {
        return generateToken(phone, PATIENT_ROLE, Map.of());
    }

    /** Carries doctorId so doctor-scoped endpoints (e.g. GET /api/doctors/patients) don't need a phone->id lookup on every call. */
    public String generateDoctorToken(String phone, int doctorId) {
        return generateToken(phone, DOCTOR_ROLE, Map.of(DOCTOR_ID_CLAIM, doctorId));
    }

    private String generateToken(String subject, String role, Map<String, Object> extraClaims) {
        Instant now = Instant.now();
        Instant expiry = now.plus(Duration.ofMinutes(appProperties.getJwtExpiryMinutes()));
        var builder = Jwts.builder()
                .subject(subject)
                .claim(ROLE_CLAIM, role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry));
        extraClaims.forEach(builder::claim);
        return builder.signWith(signingKey).compact();
    }

    /** Decoded token identity: subject (username for admin, phone for patient/doctor), role, and doctorId (doctor tokens only). */
    public record DecodedToken(String subject, String role, Integer doctorId) {
    }

    /** Null if the token is missing, malformed, expired, or has an unrecognized role. */
    public DecodedToken decode(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String role = String.valueOf(claims.get(ROLE_CLAIM));
            if (!ADMIN_ROLE.equals(role) && !PATIENT_ROLE.equals(role) && !DOCTOR_ROLE.equals(role)) {
                return null;
            }
            Integer doctorId = claims.get(DOCTOR_ID_CLAIM, Integer.class);
            return new DecodedToken(claims.getSubject(), role, doctorId);
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /** Back-compat convenience for existing admin-only call sites: subject if valid and ROLE_ADMIN, else null. */
    public String validateAndGetSubject(String token) {
        DecodedToken decoded = decode(token);
        return (decoded != null && ADMIN_ROLE.equals(decoded.role())) ? decoded.subject() : null;
    }
}
