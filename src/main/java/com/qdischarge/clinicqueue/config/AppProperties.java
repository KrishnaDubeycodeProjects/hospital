package com.qdischarge.clinicqueue.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the "app.*" configuration keys defined in application.yml,
 * which in turn resolve from environment variables (see README for the
 * full list, including the security-hardening additions on top of the
 * original Node backend's .env).
 */
@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String frontendUrl;
    private String clinicName;
    private int tokenExpiryHours;
    private int avgServiceMinutes;

    // --- Admin auth ---
    private String adminUsername;
    /** Plaintext dev fallback; hashed in-memory at startup. Prefer adminPasswordHash in production. */
    private String adminPassword;
    /** BCrypt hash of the admin password. Takes precedence over adminPassword when set. */
    private String adminPasswordHash;
    /** HMAC signing key for admin JWTs. Must be set explicitly in production. */
    private String jwtSecret;
    private int jwtExpiryMinutes;

    /** Static secret Meta calls back with during webhook subscription verification (unrelated to admin JWT auth). */
    private String webhookVerifyToken;

    /** Comma-separated list of origins allowed to call this API (CORS). */
    private String allowedOrigins;

    // --- WhatsApp providers ---
    private String waProvider;
    private String metaAccessToken;
    private String metaPhoneNumberId;
    private String metaApiVersion;

    private String evolutionApiUrl;
    private String evolutionApiKey;
    private String instanceName;

    // --- Rate limiting (per client IP, sliding window) ---
    private int rateLimitLoginPerMinute;
    private int rateLimitWebhookPerMinute;
    private int rateLimitCreateTokenPerMinute;

    // --- Async WhatsApp dispatch executor ---
    private int asyncCorePoolSize;
    private int asyncMaxPoolSize;
    private int asyncQueueCapacity;
}
