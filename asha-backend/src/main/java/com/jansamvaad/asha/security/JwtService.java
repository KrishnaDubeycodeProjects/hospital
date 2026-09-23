package com.jansamvaad.asha.security;

import com.jansamvaad.asha.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * JWT service — same signing key derivation as the main backend so tokens
 * issued by either backend are valid on both.
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
            log.warn("⚠️ JWT_SECRET is not set. Generating a random signing key — "
                    + "tokens will be invalidated on restart. Set JWT_SECRET in production.");
            byte[] random = new byte[64];
            new SecureRandom().nextBytes(random);
            signingKey = Keys.hmacShaKeyFor(random);
        } else {
            signingKey = Keys.hmacShaKeyFor(decodeSecret(secret));
        }
    }

    private byte[] decodeSecret(String secret) {
        try {
            byte[] decoded = Base64.getDecoder().decode(secret);
            if (decoded.length >= 32) return decoded;
        } catch (IllegalArgumentException ignored) {
        }
        return secret.getBytes(StandardCharsets.UTF_8);
    }

    public String generatePatientToken(String phone) {
        return generateToken(phone, PATIENT_ROLE, Map.of());
    }

    public String generateAdminToken(String username) {
        return generateToken(username, ADMIN_ROLE, Map.of());
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

    /** Decoded token identity. */
    public record DecodedToken(String subject, String role, Integer doctorId) {}

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
}
