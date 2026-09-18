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

    public String getFrontendUrl() {
        if (frontendUrl == null || frontendUrl.isBlank() || frontendUrl.contains("localhost")) {
            return "https://princete.com";
        }
        return frontendUrl;
    }

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

    // --- Geo / distance-based notification ---
    /** Assumed average travel speed used to turn distance into an ETA (straight-line, no live traffic/routing API) -- fallback only, see tomtomApiKey. */
    private double geoAvgSpeedKmh;

    // --- Treatment-timing: real routing ETA vs. queue wait, anomaly-control, voice call ---
    /** TomTom Routing API key; blank = always use the haversine fallback (see geo.TomTomRoutingService). */
    private String tomtomApiKey;
    /** Caller-id ("From") number for the outbound "head to the hospital now" call (see service.TwilioStudioCallService). */
    private String twilioCallerNumber;
    /** Master on/off switch for placing the actual call -- off by default so a fresh checkout never dials anyone. */
    private boolean twilioCallEnabled;
    /** Extra arrival buffer (minutes) added on top of the travel ETA when deciding it's time to notify+call. */
    private int notifyBufferMinutes;
    /** How often (ms) the treatment-timing scheduler re-evaluates the active queue (see service.TreatmentTimingScheduler). */
    private long timingPollIntervalMs;

    // --- Hospital / counters defaults ---
    private String hospitalUriSlug;
    private String hospitalDigipin;
    private Double hospitalLatitude;
    private Double hospitalLongitude;
    private String hospitalOpenTime;
    private String hospitalCloseTime;
    private int hospitalActiveCounters;

    // --- OTP (Twilio Verify, or a log-only dev fallback) ---
    private String otpProvider;
    private boolean otpRequiredForRegistration;
    private String twilioAccountSid;
    private String twilioAuthToken;
    private String twilioVerifyServiceSid;
    /** Messaging Service SID used by the 'twilio-sms' OTP provider (raw Messages API, not Verify). */
    private String twilioMessagingServiceSid;
    private int otpTtlMinutes;
    private int rateLimitOtpPerMinute;

    // --- Eka Care ABDM API config ---
    private String ekaClientId;
    private String ekaClientSecret;
    private String ekaBaseUrl;
    private int ekaTokenRefreshBufferSeconds = 300;

    // --- Secure Document Storage ---
    private String storageUploadDir = "./storage/documents";
    private int storageMaxFileSizeMb = 10;
    private String storageAllowedTypes = "application/pdf,image/jpeg,image/png";
}

