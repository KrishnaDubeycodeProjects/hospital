package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.WaButton;
import com.qdischarge.clinicqueue.dto.WaListRow;
import com.qdischarge.clinicqueue.dto.WaListSection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for sending WhatsApp notifications exclusively via Evolution API.
 * Converts interactive messages, buttons, and links into clean, formatted text messages.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WhatsAppService {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;

    private String formatPhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    private String extractError(RestClientException e) {
        if (e instanceof HttpStatusCodeException hsce) {
            return hsce.getResponseBodyAsString();
        }
        return e.getMessage();
    }

    // -------------------------------------------------------------
    // Public, async, fire-and-forget entry points
    // -------------------------------------------------------------

    @Async("whatsappExecutor")
    public void sendWhatsAppMessage(String phone, String text) {
        sendWhatsAppMessageSync(phone, text);
    }

    @Async("whatsappExecutor")
    public void sendButtonsMessage(String phone, String title, String description, List<WaButton> buttons, String footer) {
        String effectiveFooter = footer != null ? footer : "qDischarge Smart Queue";
        String formattedText = formatButtonsAsText(title, description, buttons, effectiveFooter);
        sendWhatsAppMessageSync(phone, formattedText);
    }

    @Async("whatsappExecutor")
    public void sendUrlButtonMessage(String phone, String title, String description, String buttonText, String urlTarget, String footer) {
        String text = (title != null && !title.isEmpty() ? title + "\n\n" : "") + description + "\n\n🔗 " + urlTarget;
        sendWhatsAppMessageSync(phone, text);
    }

    @Async("whatsappExecutor")
    public void sendPollMessage(String phone, String question, List<String> options) {
        String text = question + "\n\n" + String.join("\n", options);
        sendWhatsAppMessageSync(phone, text);
    }

    @Async("whatsappExecutor")
    public void sendListMessage(String phone, String title, String description, List<WaListSection> sections, String footer, String buttonText) {
        String text = plainTextFallback(title, description, sections);
        sendWhatsAppMessageSync(phone, text);
    }

    @Async("whatsappExecutor")
    public void sendLocationRequestMessage(String phone, String bodyText) {
        sendWhatsAppMessageSync(phone, bodyText);
    }

    // -------------------------------------------------------------
    // Synchronous implementation via Meta Cloud API or Evolution API
    // -------------------------------------------------------------

    private Map<String, Object> sendWhatsAppMessageSync(String phone, String text) {
        String cleaned = formatPhone(phone);
        if (cleaned.isEmpty()) {
            log.warn("⚠️ Cannot send WhatsApp message: phone number is empty");
            return null;
        }

        String provider = appProperties.getWaProvider();
        if ("meta".equalsIgnoreCase(provider) || (appProperties.getMetaAccessToken() != null && !appProperties.getMetaAccessToken().isBlank())) {
            return sendMetaMessage(cleaned, text);
        }

        return sendEvolutionMessage(cleaned, text);
    }

    private Map<String, Object> sendMetaMessage(String cleanedPhone, String text) {
        String url = String.format("https://graph.facebook.com/%s/%s/messages",
                appProperties.getMetaApiVersion(), appProperties.getMetaPhoneNumberId());
        log.info("\n📤 [META CLOUD API] Sending Text to [{}]:\n{}\n", cleanedPhone, text);

        Map<String, Object> textObj = Map.of("preview_url", false, "body", text);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("recipient_type", "individual");
        body.put("to", cleanedPhone);
        body.put("type", "text");
        body.put("text", textObj);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(appProperties.getMetaAccessToken());

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            log.info("✅ Meta Cloud API text sent successfully to {}", cleanedPhone);
            return response.getBody();
        } catch (RestClientException e) {
            log.error("❌ Meta Cloud API error for {}: {}", cleanedPhone, extractError(e));
            // Fallback to Evolution API if configured
            if (appProperties.getEvolutionApiKey() != null && !appProperties.getEvolutionApiKey().isBlank()) {
                log.info("🔄 Falling back to Evolution API for {}", cleanedPhone);
                return sendEvolutionMessage(cleanedPhone, text);
            }
            return null;
        }
    }

    private Map<String, Object> sendEvolutionMessage(String cleanedPhone, String text) {
        String url = appProperties.getEvolutionApiUrl() + "/message/sendText/" + appProperties.getInstanceName();
        log.info("\n📤 [EVOLUTION API] Sending Text to [{}]:\n{}\n", cleanedPhone, text);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("number", cleanedPhone);
        body.put("text", text);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", appProperties.getEvolutionApiKey());

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            log.info("✅ Evolution API text sent successfully to {}", cleanedPhone);
            return response.getBody();
        } catch (RestClientException e) {
            String errStr = extractError(e);
            if (errStr != null && errStr.contains("Connection Closed")) {
                log.warn("⚠️ Evolution API Notice for [{}]: Cannot send message to the bot's own connected number (Connection Closed). Please test from a separate mobile number.", cleanedPhone);
            } else {
                log.error("❌ Evolution API error for {}: {}", cleanedPhone, errStr);
            }
            return null;
        }
    }

    private String formatButtonsAsText(String title, String description, List<WaButton> buttons, String footer) {
        StringBuilder sb = new StringBuilder();
        if (title != null && !title.isEmpty()) {
            sb.append(title).append("\n\n");
        }
        if (description != null && !description.isEmpty()) {
            sb.append(description);
        }
        if (buttons != null && !buttons.isEmpty()) {
            sb.append("\n\n");
            for (int i = 0; i < buttons.size(); i++) {
                sb.append(i + 1).append("️⃣ ").append(buttons.get(i).displayText()).append("\n");
            }
        }
        if (footer != null && !footer.isEmpty()) {
            sb.append("\n_").append(footer).append("_");
        }
        return sb.toString().trim();
    }

    private String plainTextFallback(String title, String description, List<WaListSection> sections) {
        StringBuilder sb = new StringBuilder();
        if (title != null && !title.isEmpty()) {
            sb.append(title).append("\n\n");
        }
        if (description != null && !description.isEmpty()) {
            sb.append(description).append("\n\n");
        }
        if (sections != null) {
            for (WaListSection section : sections) {
                for (WaListRow row : section.rows()) {
                    sb.append("• ").append(row.title());
                    if (row.description() != null && !row.description().isEmpty()) {
                        sb.append(" -- ").append(row.description());
                    }
                    sb.append('\n');
                }
            }
        }
        return sb.toString().trim();
    }
}
