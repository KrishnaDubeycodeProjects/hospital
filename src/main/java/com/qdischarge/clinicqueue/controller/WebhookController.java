package com.qdischarge.clinicqueue.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.WaButton;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import com.qdischarge.clinicqueue.service.WhatsAppService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Java port of backend/routes/webhook.js. Handles the Meta Cloud API
 * subscription handshake (GET) and incoming WhatsApp messages (POST), for
 * both the Meta Cloud API and Evolution API payload shapes.
 */
@RestController
@RequestMapping("/webhook")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final QueueManagerService queueManagerService;
    private final WhatsAppService whatsAppService;
    private final AppProperties appProperties;

    // -------------------------------------------------------------
    // WEBHOOK VERIFICATION (GET) for Meta WhatsApp Cloud API
    // -------------------------------------------------------------
    @GetMapping(value = "/whatsapp", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> verify(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String token,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {

        if (mode != null && token != null) {
            if ("subscribe".equals(mode)
                    && ("clinic_queue_token".equals(token) || token.equals(appProperties.getAdminToken()))) {
                log.info("✅ META WEBHOOK VERIFIED!");
                return ResponseEntity.ok(challenge);
            }
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.badRequest().build();
    }

    // -------------------------------------------------------------
    // WEBHOOK RECEIVER (POST) - handles both Meta API and Evolution API
    // -------------------------------------------------------------
    @PostMapping(value = "/whatsapp", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> receive(@RequestBody(required = false) JsonNode requestBody) {
        JsonNode body = requestBody != null ? requestBody : MissingNode.getInstance();

        String fromPhone;
        String pushName;
        String incomingMessage;
        String buttonId;

        if ("whatsapp_business_account".equals(body.path("object").asText())) {
            JsonNode entry = body.path("entry").path(0);
            JsonNode changes = entry.path("changes").path(0);
            JsonNode value = changes.path("value");
            JsonNode message = value.path("messages").path(0);

            if (message.isMissingNode()) {
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            String rawFrom = message.path("from").asText("");
            fromPhone = rawFrom.startsWith("+") ? rawFrom : "+" + rawFrom;
            pushName = value.path("contacts").path(0).path("profile").path("name").asText("Patient");

            String tmpMessage = "";
            String tmpButtonId = "";
            String msgType = message.path("type").asText("");
            if ("text".equals(msgType)) {
                tmpMessage = message.path("text").path("body").asText("");
            } else if ("interactive".equals(msgType)
                    && "button_reply".equals(message.path("interactive").path("type").asText(""))) {
                tmpButtonId = message.path("interactive").path("button_reply").path("id").asText("");
                tmpMessage = message.path("interactive").path("button_reply").path("title").asText("");
            }
            incomingMessage = tmpMessage;
            buttonId = tmpButtonId;
        } else {
            JsonNode data = body.has("data") ? body.path("data") : body;

            JsonNode messageData = data.path("message");
            if (messageData.isMissingNode() || messageData.isNull()) {
                messageData = data.path("messages").path(0).path("message");
            }
            JsonNode keyData = data.path("key");
            if (keyData.isMissingNode() || keyData.isNull()) {
                keyData = data.path("messages").path(0).path("key");
            }

            String remoteJid = textOrNull(keyData.path("remoteJid"));
            if (isBlank(remoteJid)) {
                remoteJid = textOrNull(body.path("remoteJid"));
            }
            fromPhone = isBlank(remoteJid) ? "" : remoteJid.split("@")[0];
            if (!fromPhone.isEmpty() && !fromPhone.startsWith("+")) {
                fromPhone = "+" + fromPhone;
            }

            String pn = textOrNull(data.path("pushName"));
            if (isBlank(pn)) {
                pn = textOrNull(body.path("pushName"));
            }
            pushName = isBlank(pn) ? "Patient" : pn;

            incomingMessage = firstNonBlank(
                    textOrNull(messageData.path("conversation")),
                    textOrNull(messageData.path("extendedTextMessage").path("text")),
                    textOrNull(messageData.path("buttonsResponseMessage").path("selectedDisplayText"))
            ).trim();

            buttonId = messageData.path("buttonsResponseMessage").path("selectedButtonId").asText("");
        }

        String cleanMessage = incomingMessage.toLowerCase();

        if (fromPhone.isEmpty()) {
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        log.info("\n📥 WEBHOOK MSG from [{}] ({}): \"{}\" (ButtonId: \"{}\")",
                fromPhone, pushName, incomingMessage, buttonId);

        try {
            TokenDto activeToken = queueManagerService.getActiveToken(fromPhone);

            // STEP 1: Interactive button reply clicks
            if ("btn_generate_token".equals(buttonId) || "generate token".equals(cleanMessage) || "1".equals(cleanMessage)) {
                if (activeToken == null || "completed".equals(activeToken.getStatus()) || "missed".equals(activeToken.getStatus())) {
                    queueManagerService.createRegisteringToken(fromPhone);
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            "✍️ *PATIENT REGISTRATION*\n\nPlease reply with your *Full Name* to generate your queue token.\n\n_Example: Yash Dubey_");
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            "⚠️ You already have active Token #" + activeToken.getId() + " (" + activeToken.getStatus().toUpperCase() + ").");
                    sendTokenDashboardCard(fromPhone, activeToken);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if ("btn_check_status".equals(buttonId) || "check status".equals(cleanMessage) || "2".equals(cleanMessage)) {
                sendStatusCard(fromPhone, activeToken);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if ("btn_cancel_token".equals(buttonId) || "cancel token".equals(cleanMessage) || "3".equals(cleanMessage)) {
                if (activeToken != null) {
                    queueManagerService.updateTokenStatus(String.valueOf(activeToken.getId()), "missed");
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            "❌ *TOKEN CANCELLED*\n\nYour Token *#" + activeToken.getId() + "* has been cancelled.\n\nSend *Hi* anytime to generate a new token.");
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone, "❌ No active token to cancel.");
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // STEP 2: Name registration flow
            if (activeToken != null && "awaiting_name".equals(activeToken.getSessionStep())) {
                List<String> invalidNames = List.of("hi", "hello", "hey", "status", "cancel");
                if (invalidNames.contains(cleanMessage)) {
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            "✍️ *NAME REQUIRED*\n\nPlease reply with your actual *Full Name* (e.g. John Doe) to generate your token.");
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                TokenDto details = queueManagerService.completeRegistration(activeToken.getId(), incomingMessage);
                sendTokenDashboardCard(fromPhone, details);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // STEP 3: Fallback routing
            if (activeToken != null && ("waiting".equals(activeToken.getStatus()) || "serving".equals(activeToken.getStatus()))) {
                sendTokenDashboardCard(fromPhone, activeToken);
            } else {
                sendWelcomeCard(fromPhone);
            }

            return ResponseEntity.ok("EVENT_RECEIVED");
        } catch (Exception e) {
            log.error("Webhook error:", e);
            return ResponseEntity.status(500).body("{\"success\":false,\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    // -------------------------------------------------------------
    // Interactive message builders
    // -------------------------------------------------------------

    private void sendWelcomeCard(String phone) {
        String title = "🏥 WELCOME TO " + appProperties.getClinicName().toUpperCase();
        String description = "Welcome to our Smart Queue Management System.\n\nPlease tap an option below to continue:";
        List<WaButton> buttons = List.of(
                new WaButton("btn_generate_token", "🎫 Generate Token"),
                new WaButton("btn_check_status", "🔍 Check Status"));
        whatsAppService.sendButtonsMessage(phone, title, description, buttons, "qDischarge Smart Queue");
    }

    private void sendTokenDashboardCard(String phone, TokenDto token) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = getOrdinal(token.getPosition());
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String statusBadge = "serving".equals(token.getStatus()) ? "🔔 NOW SERVING!" : "⏳ WAITING IN QUEUE";
        String liveUrl = appProperties.getFrontendUrl() + "/patient?phone=" + cleanPhone;

        String title = "🎫 TOKEN #" + token.getId() + " GENERATED!";
        String description = """
                Hello %s,

                Your queue token has been generated successfully!

                📌 *Status:* %s
                📍 *Queue Position:* %s
                👥 *Patients Ahead:* %d
                ⏱️ *Estimated Wait:* ~%d mins

                Tap below to open your interactive live queue dashboard!"""
                .formatted(token.getName(), statusBadge, positionText, peopleAhead, estWait);

        whatsAppService.sendUrlButtonMessage(phone, title, description, "🌐 Live Tracker Link", liveUrl, "qDischarge Live Tracking");

        List<WaButton> menuButtons = List.of(
                new WaButton("btn_check_status", "📊 Refresh Status"),
                new WaButton("btn_cancel_token", "❌ Cancel Token"));
        whatsAppService.sendButtonsMessage(phone, "", "Need to manage your queue ticket?", menuButtons, "Quick Actions");
    }

    private void sendStatusCard(String phone, TokenDto token) {
        if (token == null || "registering_name".equals(token.getStatus())) {
            whatsAppService.sendWhatsAppMessage(phone, "❌ *No Active Token Found*\n\nSend *Hi* to generate a token.");
            return;
        }
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = getOrdinal(token.getPosition());
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String liveUrl = appProperties.getFrontendUrl() + "/patient?phone=" + cleanPhone;

        String title = "📊 CURRENT QUEUE STATUS";
        String description = """
                🎫 Token: #%d
                👤 Patient: %s
                📍 Position: %s
                👥 People Ahead: %d
                ⏱️ Estimated Wait: ~%d mins
                ⚡ Status: %s"""
                .formatted(token.getId(), token.getName(), positionText, peopleAhead, estWait, token.getStatus().toUpperCase());

        whatsAppService.sendUrlButtonMessage(phone, title, description, "🌐 Live Tracker Link", liveUrl, "qDischarge Live Tracking");
    }

    private String getOrdinal(Integer n) {
        if (n == null || n <= 0) {
            return "0th";
        }
        String[] s = {"th", "st", "nd", "rd"};
        int v = n % 100;
        String suffix = arrAt(s, (v - 20) % 10);
        if (suffix == null) {
            suffix = arrAt(s, v);
        }
        if (suffix == null) {
            suffix = s[0];
        }
        return n + suffix;
    }

    private String arrAt(String[] arr, int idx) {
        return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
    }

    // ---- JSON helpers ----

    private String textOrNull(JsonNode node) {
        return (node == null || node.isMissingNode() || node.isNull()) ? null : node.asText();
    }

    private boolean isBlank(String s) {
        return s == null || s.isEmpty();
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (!isBlank(v)) {
                return v;
            }
        }
        return "";
    }
}
