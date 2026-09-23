package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.WaButton;
import com.qdischarge.clinicqueue.dto.WaListRow;
import com.qdischarge.clinicqueue.dto.WaListSection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

/**
 * Service for sending WhatsApp notifications exclusively via Meta WhatsApp Cloud API.
 * Dispatches native interactive messages (buttons, lists, CTA URLs) and standard text.
 * Outbound messages per recipient are sequenced in strict FIFO order to prevent race conditions.
 */
@Service
@Slf4j
public class WhatsAppService {

    private final RestTemplate restTemplate;
    private final AppProperties appProperties;
    private final Executor whatsappExecutor;
    private final ConcurrentHashMap<String, CompletableFuture<Void>> phonePipelines = new ConcurrentHashMap<>();

    public WhatsAppService(
            RestTemplate restTemplate,
            AppProperties appProperties,
            @Qualifier("whatsappExecutor") Executor whatsappExecutor) {
        this.restTemplate = restTemplate;
        this.appProperties = appProperties;
        this.whatsappExecutor = whatsappExecutor;
    }

    private String formatPhone(String phone) {
        if (phone == null) return "";
        String cleaned = phone.replaceAll("[^0-9]", "");
        if (cleaned.length() == 10) {
            cleaned = "91" + cleaned;
        }
        return cleaned;
    }

    private String extractError(RestClientException e) {
        if (e instanceof HttpStatusCodeException hsce) {
            String body = hsce.getResponseBodyAsString();
            return hsce.getStatusCode() + (body != null && !body.isBlank() ? " - " + body : " - " + hsce.getStatusText());
        }
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }

    /**
     * Chains async execution per phone number so outbound messages arrive in strict FIFO order.
     */
    private void runSequenced(String phone, Runnable task) {
        String key = formatPhone(phone);
        if (key.isEmpty()) {
            log.warn("Cannot send WhatsApp message: phone number is empty");
            return;
        }
        phonePipelines.compute(key, (k, prev) -> {
            if (prev == null || prev.isDone()) {
                return CompletableFuture.runAsync(task, whatsappExecutor);
            } else {
                return prev.handle((res, ex) -> null).thenRunAsync(task, whatsappExecutor);
            }
        });
    }

    // -------------------------------------------------------------
    // Public, sequenced async, fire-and-forget entry points
    // -------------------------------------------------------------

    public void sendWhatsAppMessage(String phone, String text) {
        runSequenced(phone, () -> sendTextMessageSync(phone, text));
    }

    private String resolveFooter(String footer) {
        String effective = (footer != null && !footer.isBlank()) ? footer : appProperties.getClinicName();
        if (effective == null || effective.isBlank() || "qdischarge".equalsIgnoreCase(effective.trim())) {
            return "AarogyaFlow";
        }
        return effective.trim();
    }

    /**
     * Sends native Meta interactive buttons (up to 3 buttons).
     */
    public void sendButtonsMessage(String phone, String title, String description, List<WaButton> buttons, String footer) {
        runSequenced(phone, () -> {
            String cleaned = formatPhone(phone);
            if (cleaned.isEmpty()) {
                log.warn("⚠️ Cannot send WhatsApp message: phone number is empty");
                return;
            }

            if (buttons == null || buttons.isEmpty()) {
                sendTextMessageSync(cleaned, description != null ? description : title);
                return;
            }

            // Meta limits reply buttons to max 3
            List<WaButton> limitedButtons = buttons.size() > 3 ? buttons.subList(0, 3) : buttons;

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "button");

            if (title != null && !title.isBlank()) {
                interactiveObj.put("header", Map.of("type", "text", "text", title));
            }

            interactiveObj.put("body", Map.of("text", description != null && !description.isBlank() ? description : "Please select:"));

            String effectiveFooter = resolveFooter(footer);
            if (effectiveFooter != null && !effectiveFooter.isBlank()) {
                interactiveObj.put("footer", Map.of("text", effectiveFooter));
            }

            List<Map<String, Object>> buttonList = new ArrayList<>();
            for (WaButton btn : limitedButtons) {
                // Button title has a maximum of 20 characters in Meta API
                String display = btn.displayText() != null ? btn.displayText() : btn.id();
                if (display.length() > 20) {
                    display = display.substring(0, 20);
                }
                Map<String, Object> replyObj = Map.of(
                        "id", btn.id(),
                        "title", display
                );
                buttonList.add(Map.of("type", "reply", "reply", replyObj));
            }

            interactiveObj.put("action", Map.of("buttons", buttonList));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("messaging_product", "whatsapp");
            body.put("recipient_type", "individual");
            body.put("to", cleaned);
            body.put("type", "interactive");
            body.put("interactive", interactiveObj);

            try {
                sendMetaPayload(cleaned, body);
            } catch (RestClientException e) {
                log.warn("⚠️ Interactive buttons failed for {}: {}. Falling back to formatted text.", cleaned, extractError(e));
                // Fallback to text if interactive template is rejected
                StringBuilder sb = new StringBuilder();
                if (title != null) sb.append(title).append("\n\n");
                if (description != null) sb.append(description).append("\n\n");
                for (int i = 0; i < buttons.size(); i++) {
                    sb.append(i + 1).append("️⃣ ").append(buttons.get(i).displayText()).append("\n");
                }
                if (effectiveFooter != null && !effectiveFooter.isBlank()) sb.append("\n_").append(effectiveFooter).append("_");
                sendTextMessageSync(cleaned, sb.toString().trim());
            }
        });
    }

    /**
     * Sends native Meta interactive CTA URL button (opens WhatsApp in-app browser).
     */
    public void sendUrlButtonMessage(String phone, String title, String description, String buttonText, String urlTarget, String footer) {
        runSequenced(phone, () -> {
            String cleaned = formatPhone(phone);
            if (cleaned.isEmpty()) return;

            // Truncate button label to 20 chars if required by Meta API
            String btnText = buttonText != null && !buttonText.isBlank() ? buttonText : "Open";
            if (btnText.length() > 20) {
                btnText = btnText.substring(0, 20);
            }

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "cta_url");

            if (title != null && !title.isBlank()) {
                interactiveObj.put("header", Map.of("type", "text", "text", title));
            }

            interactiveObj.put("body", Map.of("text", description != null && !description.isBlank() ? description : "Tap below to proceed:"));

            String effectiveFooter = resolveFooter(footer);
            if (effectiveFooter != null && !effectiveFooter.isBlank()) {
                interactiveObj.put("footer", Map.of("text", effectiveFooter));
            }

            Map<String, Object> parameters = Map.of(
                    "display_text", btnText,
                    "url", urlTarget
            );

            interactiveObj.put("action", Map.of(
                    "name", "cta_url",
                    "parameters", parameters
            ));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("messaging_product", "whatsapp");
            body.put("recipient_type", "individual");
            body.put("to", cleaned);
            body.put("type", "interactive");
            body.put("interactive", interactiveObj);

            try {
                sendMetaPayload(cleaned, body);
            } catch (RestClientException e) {
                log.warn("⚠️ CTA URL interactive message failed for {}: {}. Sending text fallback with direct link.", cleaned, extractError(e));
                String text = (title != null && !title.isEmpty() ? title + "\n\n" : "")
                        + (description != null ? description : "")
                        + "\n\n🔗 " + urlTarget;
                sendTextMessageSync(cleaned, text);
            }
        });
    }

    public void sendPollMessage(String phone, String question, List<String> options) {
        runSequenced(phone, () -> {
            String text = question + "\n\n" + String.join("\n", options);
            sendTextMessageSync(phone, text);
        });
    }

    /**
     * Sends native Meta interactive list message.
     */
    public void sendListMessage(String phone, String title, String description, List<WaListSection> sections, String footer, String buttonText) {
        runSequenced(phone, () -> {
            String cleaned = formatPhone(phone);
            if (cleaned.isEmpty()) return;

            if (sections == null || sections.isEmpty()) {
                sendTextMessageSync(cleaned, description != null ? description : title);
                return;
            }

            String btnLabel = buttonText != null && !buttonText.isBlank() ? buttonText : "Select";
            if (btnLabel.length() > 20) {
                btnLabel = btnLabel.substring(0, 20);
            }

            List<Map<String, Object>> sectionList = new ArrayList<>();
            for (WaListSection section : sections) {
                List<Map<String, Object>> rowList = new ArrayList<>();
                for (WaListRow row : section.rows()) {
                    String rowTitle = row.title();
                    if (rowTitle.length() > 24) rowTitle = rowTitle.substring(0, 24);

                    Map<String, Object> rowMap = new LinkedHashMap<>();
                    rowMap.put("id", row.id());
                    rowMap.put("title", rowTitle);
                    if (row.description() != null && !row.description().isBlank()) {
                        String desc = row.description();
                        if (desc.length() > 72) desc = desc.substring(0, 72);
                        rowMap.put("description", desc);
                    }
                    rowList.add(rowMap);
                }
                sectionList.add(Map.of(
                        "title", section.title() != null ? section.title() : "Options",
                        "rows", rowList
                ));
            }

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "list");
            if (title != null && !title.isBlank()) {
                interactiveObj.put("header", Map.of("type", "text", "text", title));
            }
            interactiveObj.put("body", Map.of("text", description != null && !description.isBlank() ? description : "Please choose an option:"));
            String effectiveFooter = resolveFooter(footer);
            if (effectiveFooter != null && !effectiveFooter.isBlank()) {
                interactiveObj.put("footer", Map.of("text", effectiveFooter));
            }
            interactiveObj.put("action", Map.of(
                    "button", btnLabel,
                    "sections", sectionList
            ));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("messaging_product", "whatsapp");
            body.put("recipient_type", "individual");
            body.put("to", cleaned);
            body.put("type", "interactive");
            body.put("interactive", interactiveObj);

            try {
                sendMetaPayload(cleaned, body);
            } catch (RestClientException e) {
                log.warn("⚠️ Interactive list failed for {}: {}. Sending text fallback.", cleaned, extractError(e));
                StringBuilder sb = new StringBuilder();
                if (title != null) sb.append(title).append("\n\n");
                if (description != null) sb.append(description).append("\n\n");
                for (WaListSection sec : sections) {
                    for (WaListRow row : sec.rows()) {
                        sb.append("• ").append(row.title());
                        if (row.description() != null && !row.description().isBlank()) {
                            sb.append(" -- ").append(row.description());
                        }
                        sb.append("\n");
                    }
                }
                sendTextMessageSync(cleaned, sb.toString().trim());
            }
        });
    }

    public void sendLocationRequestMessage(String phone, String bodyText) {
        runSequenced(phone, () -> {
            String cleaned = formatPhone(phone);
            if (cleaned.isEmpty()) return;

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "location_request_message");
            interactiveObj.put("body", Map.of("text", bodyText != null ? bodyText : "Please share your location to find nearby hospitals:"));
            interactiveObj.put("action", Map.of("name", "send_location"));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("messaging_product", "whatsapp");
            body.put("recipient_type", "individual");
            body.put("to", cleaned);
            body.put("type", "interactive");
            body.put("interactive", interactiveObj);

            try {
                sendMetaPayload(cleaned, body);
            } catch (RestClientException e) {
                log.info("ℹ️ Native location_request_message not supported or failed for {}: {}. Sending text instruction.", cleaned, extractError(e));
                sendTextMessageSync(cleaned, bodyText != null ? bodyText : "📍 Please send your location using the WhatsApp attachment (+) icon -> Location.");
            }
        });
    }

    // -------------------------------------------------------------
    // Meta Cloud API HTTP dispatch
    // -------------------------------------------------------------

    private Map<String, Object> sendTextMessageSync(String phone, String text) {
        String cleaned = formatPhone(phone);
        if (cleaned.isEmpty()) {
            log.warn("⚠️ Cannot send WhatsApp message: phone number is empty");
            return null;
        }

        Map<String, Object> textObj = Map.of("preview_url", false, "body", text != null ? text : "");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("recipient_type", "individual");
        body.put("to", cleaned);
        body.put("type", "text");
        body.put("text", textObj);

        try {
            return sendMetaPayload(cleaned, body);
        } catch (RestClientException e) {
            log.error("❌ Meta Cloud API text error for {}: {}", cleaned, extractError(e));
            return null;
        }
    }

    private Map<String, Object> sendMetaPayload(String cleanedPhone, Map<String, Object> body) {
        String url = String.format("https://graph.facebook.com/%s/%s/messages",
                appProperties.getMetaApiVersion(), appProperties.getMetaPhoneNumberId());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(appProperties.getMetaAccessToken());

        ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
        log.info("✅ Meta Cloud API message sent successfully to {}", cleanedPhone);
        return response.getBody();
    }
}
