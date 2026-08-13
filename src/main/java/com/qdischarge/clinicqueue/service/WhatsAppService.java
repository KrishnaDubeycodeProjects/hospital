package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.WaButton;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of backend/utils/whatsappSender.js. Talks to either the Meta
 * WhatsApp Cloud API or an Evolution API instance depending on app.wa-provider,
 * exactly like the original module chose between the two via WA_PROVIDER.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WhatsAppService {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;

    private boolean isMeta() {
        return "meta".equals(appProperties.getWaProvider());
    }

    private String formatPhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    private String metaMessagesUrl() {
        return "https://graph.facebook.com/%s/%s/messages"
                .formatted(appProperties.getMetaApiVersion(), appProperties.getMetaPhoneNumberId());
    }

    private HttpHeaders metaHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(appProperties.getMetaAccessToken() == null ? "" : appProperties.getMetaAccessToken());
        return headers;
    }

    private String extractError(RestClientException e) {
        if (e instanceof HttpStatusCodeException hsce) {
            return hsce.getResponseBodyAsString();
        }
        return e.getMessage();
    }

    /** Send simple text message. */
    public Map<String, Object> sendWhatsAppMessage(String phone, String text) {
        String cleaned = formatPhone(phone);

        if (isMeta()) {
            try {
                log.info("\n📤 [META API] Sending Text to [{}]:\n{}\n", cleaned, text);

                Map<String, Object> body = new LinkedHashMap<>();
                body.put("messaging_product", "whatsapp");
                body.put("recipient_type", "individual");
                body.put("to", cleaned);
                body.put("type", "text");
                body.put("text", Map.of("body", text));

                ResponseEntity<Map> response = restTemplate.postForEntity(
                        metaMessagesUrl(), new HttpEntity<>(body, metaHeaders()), Map.class);
                log.info("✅ Meta API text sent successfully to {}", cleaned);
                return response.getBody();
            } catch (RestClientException e) {
                log.error("❌ Meta API text error for {}: {}", cleaned, extractError(e));
                return null;
            }
        } else {
            try {
                String url = appProperties.getEvolutionApiUrl() + "/message/sendText/" + appProperties.getInstanceName();
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("number", cleaned);
                body.put("options", Map.of("delay", 500));
                body.put("text", text);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("apikey", appProperties.getEvolutionApiKey());

                ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
                return response.getBody();
            } catch (RestClientException e) {
                log.error("❌ Evolution API error for {}: {}", cleaned, extractError(e));
                return null;
            }
        }
    }

    /** Send interactive quick reply buttons message. */
    public Map<String, Object> sendButtonsMessage(String phone, String title, String description,
                                                    List<WaButton> buttons, String footer) {
        String cleaned = formatPhone(phone);
        String effectiveFooter = footer != null ? footer : "qDischarge Smart Queue";

        if (isMeta()) {
            try {
                log.info("\n📤 [META API] Sending Interactive Buttons to [{}]", cleaned);

                List<Map<String, Object>> formattedButtons = buttons.stream()
                        .map(btn -> Map.<String, Object>of(
                                "type", "reply",
                                "reply", Map.of(
                                        "id", btn.id(),
                                        "title", btn.displayText().length() > 20
                                                ? btn.displayText().substring(0, 20)
                                                : btn.displayText())))
                        .toList();

                Map<String, Object> interactive = new LinkedHashMap<>();
                interactive.put("type", "button");
                if (title != null && !title.isEmpty()) {
                    interactive.put("header", Map.of("type", "text", "text", title));
                }
                interactive.put("body", Map.of("text", description));
                if (effectiveFooter != null && !effectiveFooter.isEmpty()) {
                    interactive.put("footer", Map.of("text", effectiveFooter));
                }
                interactive.put("action", Map.of("buttons", formattedButtons));

                Map<String, Object> body = new LinkedHashMap<>();
                body.put("messaging_product", "whatsapp");
                body.put("recipient_type", "individual");
                body.put("to", cleaned);
                body.put("type", "interactive");
                body.put("interactive", interactive);

                ResponseEntity<Map> response = restTemplate.postForEntity(
                        metaMessagesUrl(), new HttpEntity<>(body, metaHeaders()), Map.class);
                log.info("✅ Meta API Buttons sent successfully to {}", cleaned);
                return response.getBody();
            } catch (RestClientException e) {
                log.error("❌ Meta API Buttons error for {}: {}", cleaned, extractError(e));
                return sendWhatsAppMessage(phone, title + "\n\n" + description);
            }
        } else {
            String fullQuestion = ((title != null ? title : "") + "\n" + description).trim();
            List<String> optionLabels = buttons.stream().map(WaButton::displayText).toList();
            return sendPollMessage(phone, fullQuestion, optionLabels);
        }
    }

    /** Send interactive CTA URL redirect button message (direct link button in WhatsApp). */
    public Map<String, Object> sendUrlButtonMessage(String phone, String title, String description,
                                                      String buttonText, String urlTarget, String footer) {
        String cleaned = formatPhone(phone);
        String effectiveFooter = footer != null ? footer : "qDischarge Smart Queue";

        if (isMeta()) {
            try {
                log.info("\n📤 [META API] Sending CTA Redirect URL Button to [{}]", cleaned);

                Map<String, Object> interactive = new LinkedHashMap<>();
                interactive.put("type", "cta_url");
                if (title != null && !title.isEmpty()) {
                    interactive.put("header", Map.of("type", "text", "text", title));
                }
                interactive.put("body", Map.of("text", description));
                if (effectiveFooter != null && !effectiveFooter.isEmpty()) {
                    interactive.put("footer", Map.of("text", effectiveFooter));
                }
                interactive.put("action", Map.of(
                        "name", "cta_url",
                        "parameters", Map.of("display_text", buttonText, "url", urlTarget)));

                Map<String, Object> body = new LinkedHashMap<>();
                body.put("messaging_product", "whatsapp");
                body.put("recipient_type", "individual");
                body.put("to", cleaned);
                body.put("type", "interactive");
                body.put("interactive", interactive);

                ResponseEntity<Map> response = restTemplate.postForEntity(
                        metaMessagesUrl(), new HttpEntity<>(body, metaHeaders()), Map.class);
                log.info("✅ Meta API CTA Link Button sent successfully to {}", cleaned);
                return response.getBody();
            } catch (RestClientException e) {
                log.error("❌ Meta API CTA URL error for {}: {}", cleaned, extractError(e));
                return sendWhatsAppMessage(phone, title + "\n\n" + description + "\n\n🔗 " + urlTarget);
            }
        } else {
            return sendWhatsAppMessage(phone, title + "\n\n" + description + "\n\n🔗 " + urlTarget);
        }
    }

    /** Send interactive poll card menu (Evolution API only). */
    public Map<String, Object> sendPollMessage(String phone, String question, List<String> options) {
        String cleaned = formatPhone(phone);
        try {
            String url = appProperties.getEvolutionApiUrl() + "/message/sendPoll/" + appProperties.getInstanceName();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("number", cleaned);
            body.put("name", question);
            body.put("selectableCount", 1);
            body.put("values", options);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", appProperties.getEvolutionApiKey());

            ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            return response.getBody();
        } catch (RestClientException e) {
            log.error("❌ Failed to send poll: {}", e.getMessage());
            return null;
        }
    }

    /** Send list/menu message (Evolution API only). */
    public Map<String, Object> sendListMessage(String phone, String title, String description,
                                                 Object sections, String footer) {
        String cleaned = formatPhone(phone);
        try {
            String url = appProperties.getEvolutionApiUrl() + "/message/sendList/" + appProperties.getInstanceName();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("number", cleaned);
            body.put("title", title);
            body.put("description", description);
            body.put("footer", footer != null ? footer : "");
            body.put("buttonText", "View Options");
            body.put("sections", sections);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", appProperties.getEvolutionApiKey());

            ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            return response.getBody();
        } catch (RestClientException e) {
            log.error("❌ Failed to send list: {}", e.getMessage());
            return null;
        }
    }
}
