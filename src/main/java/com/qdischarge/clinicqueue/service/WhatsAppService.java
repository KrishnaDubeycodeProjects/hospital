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
     * In serverless environments like AWS Lambda, background threads are frozen when the HTTP handler
     * returns, so tasks are executed synchronously before Lambda pauses the container.
     */
    private void runSequenced(String phone, Runnable task) {
        String key = formatPhone(phone);
        if (key.isEmpty()) {
            log.warn("Cannot send WhatsApp message: phone number is empty");
            return;
        }

        if (System.getenv("AWS_LAMBDA_FUNCTION_NAME") != null) {
            try {
                task.run();
            } catch (Exception e) {
                log.error("Error executing WhatsApp message in Lambda: {}", e.getMessage(), e);
            }
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

    // Meta Cloud API interactive-message limits. Exceeding any of these makes Meta reject the whole
    // payload (HTTP 400), which previously dropped the user to a plain-text fallback with no buttons.
    static final int MAX_HEADER = 60;
    static final int MAX_BODY = 1024;
    static final int MAX_FOOTER = 60;
    static final int MAX_BUTTON_TITLE = 20;
    static final int MAX_REPLY_BUTTONS = 3;
    static final int MAX_ROW_TITLE = 24;
    static final int MAX_ROW_DESC = 72;
    static final int MAX_SECTION_TITLE = 24;
    static final int MAX_LIST_ROWS = 10;
    static final int MAX_ID = 200;

    /** Truncates to at most {@code max} code points so emoji / Devanagari surrogate pairs are never split. */
    static String clip(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.codePointCount(0, t.length()) <= max) return t;
        return t.substring(0, t.offsetByCodePoints(0, max)).trim();
    }

    private String resolveFooter(String footer) {
        String effective = (footer != null && !footer.isBlank()) ? footer : appProperties.getClinicName();
        if (effective == null || effective.isBlank() || "qdischarge".equalsIgnoreCase(effective.trim())) {
            return "AarogyaFlow";
        }
        return clip(effective, MAX_FOOTER);
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

            if (buttons.size() > MAX_REPLY_BUTTONS) {
                log.warn("⚠️ {} reply buttons requested; Meta allows {}. Extra buttons dropped.", buttons.size(), MAX_REPLY_BUTTONS);
            }

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "button");

            if (title != null && !title.isBlank()) {
                interactiveObj.put("header", Map.of("type", "text", "text", clip(title, MAX_HEADER)));
            }

            interactiveObj.put("body", Map.of("text", clip(description != null && !description.isBlank() ? description : "Please select:", MAX_BODY)));

            String effectiveFooter = resolveFooter(footer);
            if (effectiveFooter != null && !effectiveFooter.isBlank()) {
                interactiveObj.put("footer", Map.of("text", effectiveFooter));
            }

            // Meta rejects the message if button ids or titles repeat, or are blank.
            List<Map<String, Object>> buttonList = new ArrayList<>();
            java.util.Set<String> seenIds = new java.util.HashSet<>();
            java.util.Set<String> seenTitles = new java.util.HashSet<>();
            for (WaButton btn : buttons) {
                if (buttonList.size() >= MAX_REPLY_BUTTONS) break;
                if (btn == null || btn.id() == null || btn.id().isBlank()) continue;
                String id = clip(btn.id(), MAX_ID);
                String display = clip(btn.displayText() != null && !btn.displayText().isBlank() ? btn.displayText() : btn.id(), MAX_BUTTON_TITLE);
                if (!seenIds.add(id) || !seenTitles.add(display)) continue;
                buttonList.add(Map.of("type", "reply", "reply", Map.of("id", id, "title", display)));
            }
            if (buttonList.isEmpty()) {
                sendTextMessageSync(cleaned, description != null ? description : title);
                return;
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

            if (urlTarget == null || urlTarget.isBlank()) {
                sendTextMessageSync(cleaned, description != null ? description : title);
                return;
            }
            String btnText = clip(buttonText != null && !buttonText.isBlank() ? buttonText : "Open", MAX_BUTTON_TITLE);

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "cta_url");

            if (title != null && !title.isBlank()) {
                interactiveObj.put("header", Map.of("type", "text", "text", clip(title, MAX_HEADER)));
            }

            interactiveObj.put("body", Map.of("text", clip(description != null && !description.isBlank() ? description : "Tap below to proceed:", MAX_BODY)));

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

    /**
     * Sends native Meta OTP interactive message with a copy-code button, or a quick-reply button with the OTP code.
     */
    public void sendCopyCodeOtpMessage(String phone, String code, int ttlMinutes) {
        // sendButtonsMessage is already sequenced and falls back to text on rejection, so no extra
        // wrapping is needed (the old nested runSequenced queued the message twice per phone).
        List<WaButton> buttons = List.of(new WaButton("otp_" + code, code));
        sendButtonsMessage(phone, "AarogyaFlow",
                "Your OTP is: *" + code + "*\n\nValid for " + ttlMinutes + " minutes. Do not share it with anyone.",
                buttons, "AarogyaFlow");
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

            String btnLabel = clip(buttonText != null && !buttonText.isBlank() ? buttonText : "Select", MAX_BUTTON_TITLE);

            // Meta: max 10 rows across ALL sections, unique row ids, non-empty sections,
            // and a section title is mandatory whenever more than one section is sent.
            List<Map<String, Object>> sectionList = new ArrayList<>();
            java.util.Set<String> seenIds = new java.util.HashSet<>();
            int totalRows = 0;
            for (WaListSection section : sections) {
                if (section == null || section.rows() == null) continue;
                List<Map<String, Object>> rowList = new ArrayList<>();
                for (WaListRow row : section.rows()) {
                    if (totalRows >= MAX_LIST_ROWS) break;
                    if (row == null || row.id() == null || row.id().isBlank()) continue;
                    String id = clip(row.id(), MAX_ID);
                    if (!seenIds.add(id)) continue;
                    String rowTitle = clip(row.title() != null && !row.title().isBlank() ? row.title() : row.id(), MAX_ROW_TITLE);

                    Map<String, Object> rowMap = new LinkedHashMap<>();
                    rowMap.put("id", id);
                    rowMap.put("title", rowTitle);
                    if (row.description() != null && !row.description().isBlank()) {
                        rowMap.put("description", clip(row.description(), MAX_ROW_DESC));
                    }
                    rowList.add(rowMap);
                    totalRows++;
                }
                if (rowList.isEmpty()) continue;
                String secTitle = section.title() != null && !section.title().isBlank() ? section.title() : "Options";
                sectionList.add(Map.of(
                        "title", clip(secTitle, MAX_SECTION_TITLE),
                        "rows", rowList
                ));
            }
            if (sectionList.isEmpty()) {
                sendTextMessageSync(cleaned, description != null ? description : title);
                return;
            }

            Map<String, Object> interactiveObj = new LinkedHashMap<>();
            interactiveObj.put("type", "list");
            if (title != null && !title.isBlank()) {
                interactiveObj.put("header", Map.of("type", "text", "text", clip(title, MAX_HEADER)));
            }
            interactiveObj.put("body", Map.of("text", clip(description != null && !description.isBlank() ? description : "Please choose an option:", MAX_BODY)));
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

        // Retry with exponential backoff for transient errors (including 429)
        int attempts = 0;
        int maxAttempts = 3;
        long backoffMs = 500;
        while (true) {
            try {
                ResponseEntity<Map> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
                log.info("✅ Meta Cloud API message sent successfully to {}", cleanedPhone);
                return response.getBody();
            } catch (HttpStatusCodeException e) {
                attempts++;
                int status = e.getRawStatusCode();
                String error = extractError(e);
                log.warn("⚠️ Meta API request failed (status {}): {}. Attempt {}/{}", status, error, attempts, maxAttempts);
                boolean retryable = status == 429 || status >= 500;
                if (!retryable) {
                    throw e;
                }
                if (attempts >= maxAttempts) {
                    log.error("❌ All retry attempts exhausted for phone {}", cleanedPhone);
                    throw e;
                }
                // Respect Retry-After header if present
                String retryAfter = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst("Retry-After") : null;
                long wait = backoffMs;
                if (retryAfter != null) {
                    try {
                        wait = Long.parseLong(retryAfter) * 1000L;
                    } catch (NumberFormatException ignored) {}
                }
                try { Thread.sleep(wait); } catch (InterruptedException ignored) {}
                backoffMs *= 2;
            } catch (RestClientException e) {
                attempts++;
                String error = extractError(e);
                log.warn("⚠️ Meta API request error: {}. Attempt {}/{}", error, attempts, maxAttempts);
                if (attempts >= maxAttempts) {
                    log.error("❌ All retry attempts exhausted for phone {}", cleanedPhone);
                    throw e;
                }
                try { Thread.sleep(backoffMs); } catch (InterruptedException ignored) {}
                backoffMs *= 2;
            }
        }
    }
}
