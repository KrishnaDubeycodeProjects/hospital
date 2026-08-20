package com.qdischarge.clinicqueue.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.Intent;
import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.WaButton;
import com.qdischarge.clinicqueue.service.AccessService;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import com.qdischarge.clinicqueue.service.WhatsAppService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Java port of backend/routes/webhook.js. Handles the Meta Cloud API
 * subscription handshake (GET) and incoming WhatsApp messages (POST), for
 * both the Meta Cloud API and Evolution API payload shapes.
 *
 * Every phone's first message goes through a one-time greeting + language
 * picker (English / Hindi / Marathi, tracked in {@link WaSessionService})
 * before it ever sees the main menu -- see {@link #receive}. On Meta, the
 * picker is real tap buttons (btn_lang_en/hi/mr); on Evolution, which has no
 * button primitive, it's a plain-text prompt asking the patient to type
 * "English" / "Hindi" / "Marathi", matched by {@link Lang#matchInitial}.
 * Once a language is set it applies to every reply, and the menu commands
 * (generate/status/cancel, see {@link Intent}) are recognized typed in any
 * of the three languages regardless of which one is active.
 */
@RestController
@RequestMapping("/webhook")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final QueueManagerService queueManagerService;
    private final WhatsAppService whatsAppService;
    private final AppProperties appProperties;
    private final WaSessionService waSessionService;
    private final BotMessages botMessages;
    private final AccessService accessService;

    /** "revoke <id>" -- deliberately a literal, untranslated English command (see BotMessages#accessGranted) so the WhatsApp notice's instructions always work regardless of the reply's language. */
    private static final Pattern REVOKE_COMMAND = Pattern.compile("^revoke\\s+(\\d+)$", Pattern.CASE_INSENSITIVE);

    // -------------------------------------------------------------
    // WEBHOOK VERIFICATION (GET) for Meta WhatsApp Cloud API
    // -------------------------------------------------------------
    @GetMapping(value = "/whatsapp", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> verify(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String token,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {

        if (mode != null && token != null) {
            if ("subscribe".equals(mode) && token.equals(appProperties.getWebhookVerifyToken())) {
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

            boolean isFromMe = keyData.path("fromMe").asBoolean(false)
                    || data.path("fromMe").asBoolean(false)
                    || body.path("fromMe").asBoolean(false)
                    || body.path("data").path("key").path("fromMe").asBoolean(false);

            if (isFromMe) {
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            String remoteJid = textOrNull(keyData.path("remoteJid"));
            if (isBlank(remoteJid)) {
                remoteJid = textOrNull(body.path("remoteJid"));
            }
            if (remoteJid != null && (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast") || remoteJid.endsWith("@newsletter"))) {
                return ResponseEntity.ok("EVENT_RECEIVED");
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

        String cleanMessage = incomingMessage.trim().toLowerCase();

        if (fromPhone.isEmpty()) {
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        log.info("\n📥 WEBHOOK MSG from [{}] ({}): \"{}\" (ButtonId: \"{}\")",
                fromPhone, pushName, incomingMessage, buttonId);

        try {
            // STEP 0: Greeting + one-time language picker, before anything else.
            WaSessionService.WaSession session = waSessionService.get(fromPhone);
            if (session == null) {
                waSessionService.createAwaitingLanguage(fromPhone);
                sendLanguagePrompt(fromPhone, true);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (session.awaitingLanguage()) {
                Lang chosen = Lang.matchInitial(buttonId, cleanMessage);
                if (chosen == null) {
                    sendLanguagePrompt(fromPhone, false);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                waSessionService.setLanguage(fromPhone, chosen);
                sendWelcomeCard(fromPhone, chosen);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            Lang lang = session.language();

            // "revoke <id>" -- a patient's fast, always-available response to the access-granted
            // WhatsApp notice (see AccessService#notifyPatientOfNewAccess) if it wasn't them.
            // Checked before anything else so it can never be swallowed by a registration step.
            Matcher revokeMatch = REVOKE_COMMAND.matcher(cleanMessage);
            if (revokeMatch.matches()) {
                int grantId = Integer.parseInt(revokeMatch.group(1));
                boolean revoked = accessService.revoke(grantId, fromPhone);
                whatsAppService.sendWhatsAppMessage(fromPhone,
                        revoked ? botMessages.accessRevoked(lang, grantId) : botMessages.accessRevokeNotFound(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            TokenDto activeToken = queueManagerService.getActiveToken(fromPhone);

            // STEP 1a/1b: Mid-registration, every reply is form input -- checked before any
            // command/language matching below, so a numeric age like "1"/"2"/"3" (a common
            // real age!) can never be swallowed by the generate/status/cancel shortcuts.
            if (activeToken != null && "awaiting_name".equals(activeToken.getSessionStep())) {
                if (Intent.isReservedWord(cleanMessage)) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidNameReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                queueManagerService.captureName(activeToken.getId(), incomingMessage);
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.agePrompt(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_age".equals(activeToken.getSessionStep())) {
                Integer age = parseAge(cleanMessage);
                if (age == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidAgeReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                TokenDto details = queueManagerService.captureAge(activeToken.getId(), age);
                sendTokenDashboardCard(fromPhone, details, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Let a patient switch language at any later point by typing/tapping it again.
            Lang switchTo = Lang.match(buttonId, cleanMessage);
            if (switchTo != null && switchTo != lang) {
                waSessionService.setLanguage(fromPhone, switchTo);
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.languageSwitched(switchTo));
                sendWelcomeCard(fromPhone, switchTo);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            Intent intent = Intent.match(buttonId, cleanMessage);

            // STEP 2: Menu commands -- generate/status/cancel, typed or tapped, in any supported language
            if (intent == Intent.GENERATE_TOKEN) {
                if (activeToken == null || "completed".equals(activeToken.getStatus()) || "missed".equals(activeToken.getStatus())) {
                    queueManagerService.createRegisteringToken(fromPhone);
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.nameRegistrationPrompt(lang));
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            botMessages.alreadyActiveToken(lang, activeToken.getId(), activeToken.getStatus()));
                    sendTokenDashboardCard(fromPhone, activeToken, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (intent == Intent.CHECK_STATUS) {
                sendStatusCard(fromPhone, activeToken, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (intent == Intent.CANCEL_TOKEN) {
                if (activeToken != null) {
                    queueManagerService.updateTokenStatus(String.valueOf(activeToken.getId()), "missed");
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.tokenCancelled(lang, activeToken.getId()));
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.noActiveTokenToCancel(lang));
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // STEP 3: Fallback routing
            if (activeToken != null && ("waiting".equals(activeToken.getStatus()) || "serving".equals(activeToken.getStatus()))) {
                sendTokenDashboardCard(fromPhone, activeToken, lang);
            } else {
                sendWelcomeCard(fromPhone, lang);
            }

            return ResponseEntity.ok("EVENT_RECEIVED");
        } catch (Exception e) {
            log.error("Webhook error:", e);
            return ResponseEntity.status(500).body("{\"success\":false,\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    /**
     * Meta has a real interactive-button primitive, so the language picker is
     * three tap buttons there. Evolution API has none for this bot (buttons
     * degrade to a poll, which isn't what was wanted here), so it gets a
     * plain-text prompt asking the patient to type the language name instead
     * -- matched back by {@link Lang#matchInitial}.
     */
    private void sendLanguagePrompt(String phone, boolean firstContact) {
        String text = firstContact
                ? botMessages.greetingAndLanguagePrompt(appProperties.getClinicName())
                : botMessages.languageNotUnderstood();

        whatsAppService.sendWhatsAppMessage(phone, text);
    }

    // -------------------------------------------------------------
    // Interactive message builders
    // -------------------------------------------------------------

    private void sendWelcomeCard(String phone, Lang lang) {
        String title = botMessages.welcomeTitle(lang, appProperties.getClinicName());
        String description = botMessages.welcomeDescription(lang);
        whatsAppService.sendButtonsMessage(phone, title, description, botMessages.welcomeButtons(lang), appProperties.getClinicName());
    }

    private void sendTokenDashboardCard(String phone, TokenDto token, Lang lang) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = getOrdinal(token.getPosition());
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String statusBadge = botMessages.statusBadge(lang, token.getStatus());
        String liveUrl = appProperties.getFrontendUrl() + "/patient?phone=" + cleanPhone;

        String title = botMessages.dashboardTitle(lang, token.getId());
        String description = botMessages.dashboardDescription(lang, token.getName(), token.getAge(), statusBadge, positionText, peopleAhead, estWait);

        whatsAppService.sendUrlButtonMessage(phone, title, description, botMessages.liveTrackerButtonText(lang), liveUrl, appProperties.getClinicName());

        whatsAppService.sendButtonsMessage(phone, "", botMessages.quickActionsFooter(lang), botMessages.quickActionButtons(lang), "Quick Actions");
    }

    private void sendStatusCard(String phone, TokenDto token, Lang lang) {
        if (token == null || "registering_name".equals(token.getStatus())) {
            whatsAppService.sendWhatsAppMessage(phone, botMessages.noActiveTokenFound(lang));
            return;
        }
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = getOrdinal(token.getPosition());
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String liveUrl = appProperties.getFrontendUrl() + "/patient?phone=" + cleanPhone;

        String title = botMessages.statusTitle(lang);
        String description = botMessages.statusDescription(lang, token.getId(), token.getName(), token.getAge(), positionText, peopleAhead, estWait, token.getStatus());

        whatsAppService.sendUrlButtonMessage(phone, title, description, botMessages.liveTrackerButtonText(lang), liveUrl, appProperties.getClinicName());
    }

    /** Accepts a bare number (digits only, after trimming any stray text/punctuation), 0-120. Anything else is rejected. */
    private Integer parseAge(String cleanMessage) {
        String digitsOnly = cleanMessage.replaceAll("[^0-9]", "");
        if (digitsOnly.isEmpty()) {
            return null;
        }
        try {
            int age = Integer.parseInt(digitsOnly);
            return (age >= 0 && age <= 120) ? age : null;
        } catch (NumberFormatException e) {
            return null;
        }
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
