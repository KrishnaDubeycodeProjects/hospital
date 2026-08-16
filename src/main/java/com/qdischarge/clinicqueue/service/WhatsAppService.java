package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.WaButton;
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
 * Java port of backend/utils/whatsappSender.js. Talks to either the Meta
 * WhatsApp Cloud API or an Evolution API instance depending on app.wa-provider,
 * exactly like the original module chose between the two via WA_PROVIDER --
 * app.wa-provider just picks which one goes *first*.
 *
 * Cross-provider failover: every send ultimately funnels through
 * {@link #sendWhatsAppMessageSync}, which tries the configured provider and,
 * if that call throws, automatically retries the *other* provider before
 * giving up -- so a Meta outage doesn't silently drop messages when an
 * Evolution instance is also configured, and vice versa. Interactive sends
 * (buttons/CTA/poll/list) that fail on their primary provider degrade to
 * this same failover-aware plain-text send rather than to a single
 * provider's text API, so they get the same two-provider safety net.
 *
 * The public send* methods are @Async and fire-and-forget (matching how the
 * original's callers never actually used the awaited response value for
 * anything besides logging), dispatched on the bounded "whatsappExecutor"
 * pool defined in AsyncConfig -- so a slow/unreachable WhatsApp provider
 * never blocks an HTTP request thread. Internal fallback calls (e.g. a
 * failed interactive-buttons send falling back to plain text) call the
 * private *Sync methods directly, since Spring AOP proxies can't intercept
 * same-class ("this.") method calls to apply @Async.
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

    // -------------------------------------------------------------
    // Public, async, fire-and-forget entry points
    // -------------------------------------------------------------

    @Async("whatsappExecutor")
    public void sendWhatsAppMessage(String phone, String text) {
        sendWhatsAppMessageSync(phone, text);
    }

    @Async("whatsappExecutor")
    public void sendButtonsMessage(String phone, String title, String description, List<WaButton> buttons, String footer) {
        sendButtonsMessageSync(phone, title, description, buttons, footer);
    }

    @Async("whatsappExecutor")
    public void sendUrlButtonMessage(String phone, String title, String description, String buttonText, String urlTarget, String footer) {
        sendUrlButtonMessageSync(phone, title, description, buttonText, urlTarget, footer);
    }

    @Async("whatsappExecutor")
    public void sendPollMessage(String phone, String question, List<String> options) {
        try {
            sendPollMessageSync(phone, question, options);
        } catch (RestClientException e) {
            log.error("❌ Evolution API poll error for {}: {} -- falling back to plain text.", formatPhone(phone), extractError(e));
            sendWhatsAppMessageSync(phone, question + "\n\n" + String.join("\n", options));
        }
    }

    @Async("whatsappExecutor")
    public void sendListMessage(String phone, String title, String description, Object sections, String footer) {
        sendListMessageSync(phone, title, description, sections, footer);
    }

    // -------------------------------------------------------------
    // Synchronous implementations
    // -------------------------------------------------------------

    /**
     * Send simple text message. Tries the configured provider (app.wa-provider)
     * first; if that call fails, automatically retries the *other* provider
     * before giving up. This is the failover-aware building block every other
     * send method (buttons/CTA/poll/list) degrades to on its own primary
     * provider's failure, so any message that can be reduced to plain text
     * gets the same two-provider safety net.
     */
    private Map<String, Object> sendWhatsAppMessageSync(String phone, String text) {
        if (isMeta()) {
            try {
                return sendViaMetaText(phone, text);
            } catch (RestClientException e) {
                log.error("❌ Meta API text error for {}: {} -- falling back to Evolution API.", formatPhone(phone), extractError(e));
                return tryEvolutionFallbackText(phone, text);
            }
        } else {
            try {
                return sendViaEvolutionText(phone, text);
            } catch (RestClientException e) {
                log.error("❌ Evolution API error for {}: {} -- falling back to Meta API.", formatPhone(phone), extractError(e));
                return tryMetaFallbackText(phone, text);
            }
        }
    }

    private Map<String, Object> tryEvolutionFallbackText(String phone, String text) {
        try {
            Map<String, Object> result = sendViaEvolutionText(phone, text);
            log.info("✅ Evolution API fallback succeeded for {}", formatPhone(phone));
            return result;
        } catch (RestClientException e) {
            log.error("❌ Evolution API fallback also failed for {}: {}", formatPhone(phone), extractError(e));
            return null;
        }
    }

    private Map<String, Object> tryMetaFallbackText(String phone, String text) {
        try {
            Map<String, Object> result = sendViaMetaText(phone, text);
            log.info("✅ Meta API fallback succeeded for {}", formatPhone(phone));
            return result;
        } catch (RestClientException e) {
            log.error("❌ Meta API fallback also failed for {}: {}", formatPhone(phone), extractError(e));
            return null;
        }
    }

    /** Raw Meta Cloud API text send -- throws on failure instead of swallowing, so callers can fall back. */
    private Map<String, Object> sendViaMetaText(String phone, String text) {
        String cleaned = formatPhone(phone);
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
    }

    /** Raw Evolution API text send -- throws on failure instead of swallowing, so callers can fall back. */
    private Map<String, Object> sendViaEvolutionText(String phone, String text) {
        String cleaned = formatPhone(phone);
        String url = appProperties.getEvolutionApiUrl() + "/message/sendText/" + appProperties.getInstanceName();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("number", cleaned);
        body.put("options", Map.of("delay", 500));
        body.put("text", text);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", appProperties.getEvolutionApiKey());

        ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
        log.info("✅ Evolution API text sent successfully to {}", cleaned);
        return response.getBody();
    }

    /** Send interactive quick reply buttons message. */
    private Map<String, Object> sendButtonsMessageSync(String phone, String title, String description,
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
                return sendWhatsAppMessageSync(phone, title + "\n\n" + description);
            }
        } else {
            String fullQuestion = ((title != null ? title : "") + "\n" + description).trim();
            List<String> optionLabels = buttons.stream().map(WaButton::displayText).toList();
            try {
                return sendPollMessageSync(phone, fullQuestion, optionLabels);
            } catch (RestClientException e) {
                log.error("❌ Evolution API poll error for {}: {} -- falling back to plain text.", cleaned, extractError(e));
                return sendWhatsAppMessageSync(phone, fullQuestion + "\n\n" + String.join("\n", optionLabels));
            }
        }
    }

    /** Send interactive CTA URL redirect button message (direct link button in WhatsApp). */
    private Map<String, Object> sendUrlButtonMessageSync(String phone, String title, String description,
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
                return sendWhatsAppMessageSync(phone, title + "\n\n" + description + "\n\n🔗 " + urlTarget);
            }
        } else {
            return sendWhatsAppMessageSync(phone, title + "\n\n" + description + "\n\n🔗 " + urlTarget);
        }
    }

    /**
     * Send interactive poll card menu (Evolution API only -- Meta has no poll
     * primitive). Throws on failure instead of swallowing, so callers
     * (sendButtonsMessageSync's Evolution branch, and this class's own async
     * entry point below) can fall back to plain text.
     */
    private Map<String, Object> sendPollMessageSync(String phone, String question, List<String> options) {
        String cleaned = formatPhone(phone);
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
    }

    /**
     * Send list/menu message (Evolution API only -- Meta has no list
     * primitive). Falls back to a failover-aware plain-text rendition of the
     * same title/description/footer on failure, same as the buttons/CTA/poll
     * sends above.
     */
    private Map<String, Object> sendListMessageSync(String phone, String title, String description,
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
            log.error("❌ Evolution API list error for {}: {} -- falling back to plain text.", cleaned, extractError(e));
            String fallbackText = ((title != null ? title : "") + "\n\n" + (description != null ? description : "")).trim();
            return sendWhatsAppMessageSync(phone, fallbackText);
        }
    }
}
