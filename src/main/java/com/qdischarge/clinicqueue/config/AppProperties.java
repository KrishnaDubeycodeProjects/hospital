package com.qdischarge.clinicqueue.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.Assert;

/**
 * Typed view of the "app.*" configuration keys defined in application.yml,
 * which in turn resolve from environment variables (see README for the
 * full list, including the security-hardening additions on top of the
 * original Node backend's .env).
 */
@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String frontendUrl = "https://hospital-ten-blond.vercel.app";
    private String clinicName = "AarogyaFlow";
    private int tokenExpiryHours;
    private int avgServiceMinutes;

    public String getClinicName() {
        if (clinicName == null || clinicName.isBlank() || "qdischarge".equalsIgnoreCase(clinicName)) {
            return "AarogyaFlow";
        }
        return clinicName;
    }

    public String getFrontendUrl() {
        if (frontendUrl != null && !frontendUrl.isBlank() && !frontendUrl.contains("localhost") && !frontendUrl.contains("ngrok")) {
            return frontendUrl.replaceAll("/+$", "");
        }
        return "https://hospital-ten-blond.vercel.app";
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
    /** Lifetime of OTP-issued ASHA / ANM / CHO tokens (offline-first field work). */
    private int workerJwtExpiryDays = 30;
    /** Local-dev only: accept X-ASHA-Phone / X-ANM-Phone as identity without a verified JWT. */
    private boolean allowHeaderIdentity = false;
    /** Comma-separated CHO phone numbers recognised at OTP verification. */
    private String choPhones = "";

    /** Static secret Meta calls back with during webhook subscription verification (unrelated to admin JWT auth). */
    private String webhookVerifyToken;

    /** Comma-separated list of origins allowed to call this API (CORS). */
    private String allowedOrigins;

    // --- WhatsApp providers ---
    private String waProvider = "meta";
    private String metaAccessToken;
    private String metaAppSecret;
    private String metaPhoneNumberId;
    private String metaApiVersion = "v25.0";
    /** Phone number of the WhatsApp bot (e.g. 919876543210) used for wa.me redirects in WebViews. */
    private String botPhoneNumber;

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
    /** MapMyIndia (Mappls) REST API key. */
    private String mapplsApiKey;
    /** MapMyIndia (Mappls) Client ID (OAuth2 or account). */
    private String mapplsClientId;
    /** MapMyIndia (Mappls) Client Secret. */
    private String mapplsClientSecret;
    /** MapMyIndia (Mappls) Base API URL (e.g. https://apis.mappls.com/advancedmaps/v1). */
    private String mapplsBaseUrl;
    /** MapMyIndia (Mappls) Server/Client IP for IP-whitelisted keys. */
    private String mapplsServerIp;
    /** TomTom Routing API key (legacy/fallback if configured). */
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
    private boolean abdmMockMode = false;

    // --- Demo / evaluation shortcuts ---
    /** Enables the fixed demo OTP (123456) and the /api/test/** helpers -- for demo numbers only. */
    private boolean demoMode = true;
    /** Comma-separated phone numbers the demo shortcuts may act on. */
    private String demoPhones = "+919100000099,+919888877777,+919876543210,9876543210,+919100000001,9100000001,+919100000002,9100000002,+918850934544,8850934544";

    /** True only when demo mode is on AND the phone is one of the configured demo numbers. */
    public boolean isDemoPhone(String phone) {
        if (!demoMode || phone == null || demoPhones == null) return false;
        String target = com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(phone);
        String target10 = phone.replaceAll("[^0-9]", "");
        if (target10.length() > 10) target10 = target10.substring(target10.length() - 10);

        for (String p : demoPhones.split(",")) {
            String norm = com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(p.trim());
            if (!target.isEmpty() && target.equals(norm)) return true;
            String p10 = p.replaceAll("[^0-9]", "");
            if (p10.length() > 10) p10 = p10.substring(p10.length() - 10);
            if (!target10.isEmpty() && target10.equals(p10)) return true;
        }
        return false;
    }

    // --- Secure Document Storage ---
    private String storageUploadDir = "./storage/documents";
    private int storageMaxFileSizeMb = 10;
    private String storageAllowedTypes = "application/pdf,image/jpeg,image/png";

    @PostConstruct
    public void validateSecrets() {
        String activeProfile = System.getProperty("spring.profiles.active", System.getenv("SPRING_PROFILES_ACTIVE"));
        if (activeProfile != null && (activeProfile.contains("prod") || activeProfile.contains("production"))) {
            Assert.hasText(metaAccessToken, "FATAL: META_ACCESS_TOKEN environment variable must be set in production.");
            Assert.hasText(jwtSecret, "FATAL: JWT_SECRET environment variable must be set in production.");
            Assert.hasText(webhookVerifyToken, "FATAL: WEBHOOK_VERIFY_TOKEN environment variable must be set in production.");
        }
    }
}

