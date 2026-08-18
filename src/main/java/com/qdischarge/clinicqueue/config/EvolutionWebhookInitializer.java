package com.qdischarge.clinicqueue.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Automatically configures Evolution API webhook target to point to
 * http://host.docker.internal:8088/webhook/whatsapp on application startup,
 * ensuring incoming WhatsApp messages trigger queue flow seamlessly.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EvolutionWebhookInitializer implements ApplicationRunner {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;

    @Value("${server.port:8088}")
    private int serverPort;

    @Override
    public void run(ApplicationArguments args) {
        if (!"evolution".equalsIgnoreCase(appProperties.getWaProvider())) {
            log.info("WA_PROVIDER is set to '{}', skipping Evolution API webhook registration.", appProperties.getWaProvider());
            return;
        }

        String evolutionUrl = appProperties.getEvolutionApiUrl();
        String instance = appProperties.getInstanceName();
        String apiKey = appProperties.getEvolutionApiKey();

        if (evolutionUrl == null || evolutionUrl.isBlank() || instance == null || instance.isBlank()) {
            log.warn("⚠️ EVOLUTION_API_URL or INSTANCE_NAME not set. Skipping webhook setup.");
            return;
        }

        String targetUrl = "http://host.docker.internal:" + serverPort + "/webhook/whatsapp";
        String endpoint = evolutionUrl + "/webhook/set/" + instance;

        log.info("🔌 Registering Evolution API Webhook for instance '{}' -> {}", instance, targetUrl);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", apiKey);

            Map<String, Object> webhookConfig = new LinkedHashMap<>();
            webhookConfig.put("enabled", true);
            webhookConfig.put("url", targetUrl);
            webhookConfig.put("byEvents", false);
            webhookConfig.put("base64", false);
            webhookConfig.put("events", List.of("MESSAGES_UPSERT", "SEND_MESSAGE"));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("webhook", webhookConfig);

            restTemplate.postForEntity(endpoint, new HttpEntity<>(payload, headers), Map.class);
            log.info("✅ Evolution API Webhook configured successfully at {}", targetUrl);
        } catch (Exception e) {
            log.warn("⚠️ Evolution API Webhook registration notice (Evolution API might not be running locally on port 8086): {}", e.getMessage());
        }
    }
}
