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

/**
 * Issues and validates the signed, short-lived admin session tokens that
 * replace the original Node backend's single static ADMIN_TOKEN. The token
 * itself is opaque to the frontend, which just stores whatever string
 * /api/queue/login returns and replays it as a Bearer header -- so this is a
 * drop-in swap from the client's point of view.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    private static final String ROLE_CLAIM = "role";
    public static final String ADMIN_ROLE = "ADMIN";

    private final AppProperties appProperties;
    private SecretKey signingKey;

    @PostConstruct
    void init() {
        String secret = appProperties.getJwtSecret();
        if (secret == null || secret.isBlank()) {
            log.warn("⚠️ JWT_SECRET is not set. Generating a random signing key for this process only -- "
                    + "all admin sessions will be invalidated on restart, and this is NOT safe for a "
                    + "multi-instance deployment. Set JWT_SECRET explicitly in production.");
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
        Instant now = Instant.now();
        Instant expiry = now.plus(Duration.ofMinutes(appProperties.getJwtExpiryMinutes()));
        return Jwts.builder()
                .subject(username)
                .claim(ROLE_CLAIM, ADMIN_ROLE)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    /** Returns the token's subject (username) if valid, or null if invalid/expired/wrong role. */
    public String validateAndGetSubject(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Object role = claims.get(ROLE_CLAIM);
            if (!ADMIN_ROLE.equals(role)) {
                return null;
            }
            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
