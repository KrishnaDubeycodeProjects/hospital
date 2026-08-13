package com.qdischarge.clinicqueue.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the "app.*" configuration keys defined in application.yml,
 * which in turn resolve from the same environment variables the original
 * Node backend read via dotenv (see backend/.env.example).
 */
@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String frontendUrl;
    private String clinicName;
    private int tokenExpiryHours;
    private int avgServiceMinutes;

    private String adminUsername;
    private String adminPassword;
    private String adminToken;

    private String waProvider;
    private String metaAccessToken;
    private String metaPhoneNumberId;
    private String metaApiVersion;

    private String evolutionApiUrl;
    private String evolutionApiKey;
    private String instanceName;
}
