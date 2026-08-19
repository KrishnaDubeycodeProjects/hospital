package com.qdischarge.clinicqueue.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.ConfirmationChoice;
import com.qdischarge.clinicqueue.bot.Gender;
import com.qdischarge.clinicqueue.bot.Intent;
import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.catalog.MedicalCategory;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.WaButton;
import com.qdischarge.clinicqueue.dto.WaListRow;
import com.qdischarge.clinicqueue.dto.WaListSection;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import com.qdischarge.clinicqueue.service.AccessService;
import com.qdischarge.clinicqueue.service.HospitalService;
import com.qdischarge.clinicqueue.service.QueueManagerService;
import com.qdischarge.clinicqueue.service.WhatsAppService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.ArrayList;
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
 *
 * "Generate Token" walks a returning-or-new patient through registration
 * (name -> gender -> age, skipped straight to department if this phone's
 * identity is already known -- see QueueManagerService#createRegisteringToken)
 * then a department -> location -> hospital search+select+confirm booking
 * flow: hospitals offering the chosen department, open to the patient's
 * gender, are ranked by distance and shown 5 at a time (a "Show more" row
 * for the next 5) as an interactive list; tapping one shows a confirmation
 * card before the token actually joins that hospital's department queue.
 */
@RestController
@RequestMapping("/webhook")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final QueueManagerService queueManagerService;
    private final HospitalService hospitalService;
    private final GeoDistanceService geoDistanceService;
    private final WhatsAppService whatsAppService;
    private final AppProperties appProperties;
    private final WaSessionService waSessionService;
    private final BotMessages botMessages;
    private final AccessService accessService;

    /** "revoke <id>" -- deliberately a literal, untranslated English command (see BotMessages#accessGranted) so the WhatsApp notice's instructions always work regardless of the reply's language. */
    private static final Pattern REVOKE_COMMAND = Pattern.compile("^revoke\\s+(\\d+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIGIPIN_PATTERN = Pattern.compile("^[A-Z0-9]{10}$");
    private static final String SHOW_MORE_ROW_ID = "show_more";
    private static final String HOSPITAL_ROW_PREFIX = "hosp_";

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
        log.info("📩 INCOMING WEBHOOK PAYLOAD: {}", body);

        String fromPhone;
        String pushName;
        String incomingMessage;
        String buttonId;
        Double incomingLat = null;
        Double incomingLon = null;

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
            } else if ("interactive".equals(msgType)) {
                String interactiveType = message.path("interactive").path("type").asText("");
                if ("button_reply".equals(interactiveType)) {
                    tmpButtonId = message.path("interactive").path("button_reply").path("id").asText("");
                    tmpMessage = message.path("interactive").path("button_reply").path("title").asText("");
                } else if ("list_reply".equals(interactiveType)) {
                    tmpButtonId = message.path("interactive").path("list_reply").path("id").asText("");
                    tmpMessage = message.path("interactive").path("list_reply").path("title").asText("");
                }
            } else if ("location".equals(msgType)) {
                JsonNode loc = message.path("location");
                if (!loc.isMissingNode()) {
                    incomingLat = loc.path("latitude").isMissingNode() ? null : loc.path("latitude").asDouble();
                    incomingLon = loc.path("longitude").isMissingNode() ? null : loc.path("longitude").asDouble();
                }
            }
            incomingMessage = tmpMessage;
            buttonId = tmpButtonId;
        } else {
            JsonNode data = body.has("data") ? body.path("data") : body;

            JsonNode messageData = data.path("message");
            if (messageData.isMissingNode() || messageData.isNull()) {
                messageData = data.path("messages").path(0).path("message");
            }
            if (messageData.isMissingNode() || messageData.isNull()) {
                // Evolution/Baileys fires live-location pings (every update after the initial
                // share) as a "messages.update" event, which nests the patched content one
                // level deeper under "update" instead of directly under "message" -- without
                // this fallback those pings are silently dropped and a live-shared location
                // never resolves.
                messageData = data.path("update").path("message");
            }
            if (messageData.isMissingNode() || messageData.isNull()) {
                messageData = data.path("messages").path(0).path("update").path("message");
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

            String listRowId = textOrNull(messageData.path("listResponseMessage").path("singleSelectReply").path("selectedRowId"));

            incomingMessage = firstNonBlank(
                    textOrNull(messageData.path("conversation")),
                    textOrNull(messageData.path("extendedTextMessage").path("text")),
                    textOrNull(messageData.path("buttonsResponseMessage").path("selectedDisplayText")),
                    textOrNull(messageData.path("listResponseMessage").path("title"))
            ).trim();

            buttonId = !isBlank(listRowId) ? listRowId : messageData.path("buttonsResponseMessage").path("selectedButtonId").asText("");

            Double[] coords = extractLocationFromPayload(data, messageData, body);
            incomingLat = coords[0];
            incomingLon = coords[1];
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

            // STEP 1: Mid-registration/booking, every reply is form input -- checked before any
            // command/language matching below, so e.g. a numeric age or department number like
            // "1"/"2"/"3" can never be swallowed by the generate/status/cancel shortcuts.
            if (activeToken != null && "awaiting_name".equals(activeToken.getSessionStep())) {
                if (Intent.isReservedWord(cleanMessage)) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidNameReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                queueManagerService.captureName(activeToken.getId(), incomingMessage);
                sendGenderPrompt(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_gender".equals(activeToken.getSessionStep())) {
                Gender gender = Gender.match(buttonId, cleanMessage);
                if (gender == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidGenderReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                queueManagerService.captureGender(activeToken.getId(), gender.code());
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.agePrompt(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_age".equals(activeToken.getSessionStep())) {
                Integer age = parseAge(cleanMessage);
                if (age == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidAgeReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                queueManagerService.captureAge(activeToken.getId(), age);
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.categoryPrompt(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_category".equals(activeToken.getSessionStep())) {
                String category = MedicalCategory.match(incomingMessage);
                if (category == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidCategoryReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                queueManagerService.captureCategory(activeToken.getId(), category);
                sendLocationPrompt(fromPhone, lang, category);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_location".equals(activeToken.getSessionStep())) {
                SetLocationRequest location = resolveIncomingLocation(incomingLat, incomingLon, cleanMessage);
                if (location == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidLocationReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                QueueManagerService.HospitalSearchOutcome outcome;
                try {
                    outcome = queueManagerService.searchAndOfferHospitals(activeToken.getId(), location);
                } catch (IllegalArgumentException e) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidLocationReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                if (outcome == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidLocationReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                if (outcome.page().results().isEmpty()) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.noHospitalsFound(lang, activeToken.getCategory()));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                sendHospitalResultsList(fromPhone, outcome.draft(), outcome.page(), lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_hospital_selection".equals(activeToken.getSessionStep())) {
                int offset = Math.max(0, (activeToken.getSearchOffset() != null ? activeToken.getSearchOffset() : QueueManagerService.HOSPITAL_PAGE_SIZE) - QueueManagerService.HOSPITAL_PAGE_SIZE);
                HospitalService.HospitalSearchPage page = hospitalService.searchHospitals(
                        activeToken.getCategory(), activeToken.getGender(), activeToken.getPatientLat(), activeToken.getPatientLon(), offset, QueueManagerService.HOSPITAL_PAGE_SIZE);

                if (SHOW_MORE_ROW_ID.equals(buttonId) || isShowMoreCommand(cleanMessage)) {
                    QueueManagerService.HospitalSearchOutcome outcome = queueManagerService.showMoreHospitals(activeToken.getId());
                    if (outcome == null || outcome.page().results().isEmpty()) {
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidHospitalSelectionReminder(lang));
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                    sendHospitalResultsList(fromPhone, outcome.draft(), outcome.page(), lang);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                if (buttonId != null && buttonId.startsWith(HOSPITAL_ROW_PREFIX)) {
                    Integer hospitalId = parseInt(buttonId.substring(HOSPITAL_ROW_PREFIX.length()));
                    TokenDto selected = hospitalId == null ? null : queueManagerService.selectHospital(activeToken.getId(), hospitalId);
                    if (selected != null) {
                        sendConfirmationCard(fromPhone, selected, lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }

                String cleanMsg = incomingMessage.trim().toLowerCase();

                // Check for "profile N" or "info N" or "details N"
                if (cleanMsg.startsWith("profile ") || cleanMsg.startsWith("info ") || cleanMsg.startsWith("details ") || cleanMsg.endsWith(" profile")) {
                    String numStr = cleanMsg.replaceAll("[^0-9]", "");
                    Integer idx = parseInt(numStr);
                    if (idx != null && page != null && idx >= 1 && idx <= page.results().size()) {
                        HospitalService.HospitalMatch match = page.results().get(idx - 1);
                        sendHospitalProfile(fromPhone, match.hospital(), match.distanceKm(), lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }

                // Check for bare number choice "1", "2", ... "20"
                Integer selectedIdx = parseInt(cleanMsg);
                if (selectedIdx != null && page != null && selectedIdx >= 1 && selectedIdx <= page.results().size()) {
                    HospitalDto chosen = page.results().get(selectedIdx - 1).hospital();
                    TokenDto selected = queueManagerService.selectHospital(activeToken.getId(), chosen.getId());
                    if (selected != null) {
                        sendConfirmationCard(fromPhone, selected, lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }

                int totalCount = (page != null && page.results() != null) ? page.results().size() : 20;
                whatsAppService.sendWhatsAppMessage(fromPhone, "⚠️ Invalid selection. Please reply with a hospital number (*1* to *" + totalCount + "*) or type *profile 1* to view hospital details.");
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_confirmation".equals(activeToken.getSessionStep())) {
                // Evolution renders "buttons" as a plain numbered list (no tappable primitive), so the
                // patient's choice is matched from typed text -- see ConfirmationChoice.
                ConfirmationChoice choice = ConfirmationChoice.match(buttonId, cleanMessage);

                if (choice == ConfirmationChoice.CONFIRM) {
                    try {
                        TokenDto booked = queueManagerService.confirmBooking(activeToken.getId());
                        sendTokenDashboardCard(fromPhone, booked, lang);
                    } catch (IllegalStateException e) {
                        // Tell the patient why it actually failed (OPD closing soon, hospital
                        // gone, ...) instead of the generic "type 1 or Confirm" reminder --
                        // retrying Confirm can never fix these, so looping that text was a
                        // dead end. See BotMessages#bookingFailed.
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.bookingFailed(lang, e.getMessage()));
                    }
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                if (choice == ConfirmationChoice.CHOOSE_AGAIN) {
                    QueueManagerService.HospitalSearchOutcome outcome = queueManagerService.restartHospitalSelection(activeToken.getId());
                    if (outcome == null || outcome.page().results().isEmpty()) {
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidHospitalSelectionReminder(lang));
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                    sendHospitalResultsList(fromPhone, outcome.draft(), outcome.page(), lang);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }

                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidConfirmationReminder(lang));
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
                    TokenDto draft = queueManagerService.createRegisteringToken(fromPhone);
                    if (draft != null && "awaiting_category".equals(draft.getSessionStep())) {
                        // A returning phone whose identity (name/gender/age) is already known --
                        // skip straight to picking a department instead of re-asking from scratch.
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.categoryPrompt(lang));
                    } else {
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.nameRegistrationPrompt(lang));
                    }
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            botMessages.alreadyActiveToken(lang, activeToken.displayNumber(), activeToken.getStatus()));
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
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.tokenCancelled(lang, activeToken.displayNumber()));
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

    private void sendGenderPrompt(String phone, Lang lang) {
        whatsAppService.sendButtonsMessage(phone, "", botMessages.genderPrompt(lang), botMessages.genderButtons(lang), appProperties.getClinicName());
    }

    /**
     * Native WhatsApp location sharing (and especially live location on
     * Evolution API, which pings via separate "messages.update" events -- see
     * {@code extractLocationFromPayload}) doesn't always land reliably, so
     * alongside the native prompt this also sends a "just tap this link"
     * fallback: a web page that asks the browser for location permission and
     * shows the same nearest-first hospital list the bot would.
     */
    private void sendLocationPrompt(String phone, Lang lang, String category) {
        whatsAppService.sendLocationRequestMessage(phone, botMessages.locationPrompt(lang));

        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String encodedCategory = java.net.URLEncoder.encode(category, java.nio.charset.StandardCharsets.UTF_8);
        String findHospitalUrl = appProperties.getFrontendUrl() + "/find-hospital?phone=" + cleanPhone + "&category=" + encodedCategory;

        whatsAppService.sendUrlButtonMessage(phone, "", botMessages.findHospitalLinkPrompt(lang),
                botMessages.findHospitalLinkButtonText(lang), findHospitalUrl, appProperties.getClinicName());
    }

    /** "Which hospital?" -- up to 20 results as numbered text list + interactive list rows. */
    private void sendHospitalResultsList(String phone, TokenDto draft, HospitalService.HospitalSearchPage page, Lang lang) {
        StringBuilder sb = new StringBuilder();
        sb.append("🏥 *Top Registered Hospitals for ").append(draft.getCategory()).append("*:\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");

        int index = 1;
        for (HospitalService.HospitalMatch match : page.results()) {
            HospitalDto h = match.hospital();
            boolean openNow = isOpdOpen(h);
            String statusIcon = openNow ? "🟢 Open" : "🔴 Closed";

            sb.append(index).append("️⃣ *").append(h.getName()).append("*\n");
            if (h.getAddress() != null && !h.getAddress().isBlank()) {
                sb.append("📍 ").append(h.getAddress()).append("\n");
            }
            sb.append("⏰ OPD: ").append(formatTime(h.getOpenTime())).append(" - ").append(formatTime(h.getCloseTime()))
              .append(" (").append(statusIcon).append(")\n");
            sb.append("📏 Distance: ~%.1f km\n\n".formatted(match.distanceKm()));
            index++;
        }

        sb.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        sb.append("👉 *Reply with a number (1 to ").append(page.results().size()).append(") to select a hospital for booking.*\n");
        sb.append("💡 *Type \"profile 1\" to view full hospital info & doctor roster.*");
        if (page.hasMore()) {
            sb.append("\n").append(botMessages.showMoreHint(lang));
        }

        whatsAppService.sendWhatsAppMessage(phone, sb.toString());
    }

    /** Evolution has no tappable "Show more" button, so the next page is also requested by typing it, in any supported language. */
    private boolean isShowMoreCommand(String cleanMessage) {
        if (cleanMessage == null) {
            return false;
        }
        return switch (cleanMessage.trim()) {
            case "more", "show more", "next", "और दिखाएं", "आणखी दाखवा" -> true;
            default -> false;
        };
    }

    private void sendHospitalProfile(String phone, HospitalDto h, double distanceKm, Lang lang) {
        StringBuilder sb = new StringBuilder();
        sb.append("🏥 *HOSPITAL PROFILE: ").append(h.getName().toUpperCase()).append("*\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        if (h.getOwnership() != null) {
            sb.append("🏛️ *Ownership:* ").append(h.getOwnership()).append("\n");
        }
        if (h.getYearEstablished() != null) {
            sb.append("📅 *Established:* ").append(h.getYearEstablished()).append("\n");
        }
        if (h.getAddress() != null && !h.getAddress().isBlank()) {
            sb.append("📍 *Address:* ").append(h.getAddress()).append("\n");
        }
        if (h.getDigipin() != null) {
            sb.append("📌 *DIGIPIN:* ").append(h.getDigipin()).append("\n");
        }
        sb.append("⏰ *OPD Hours:* ").append(formatTime(h.getOpenTime())).append(" - ").append(formatTime(h.getCloseTime())).append("\n");
        sb.append("📏 *Distance:* ~%.1f km\n".formatted(distanceKm));
        sb.append("⏱️ *Avg Service Time:* ").append(h.getAvgServiceMinutes()).append(" mins per patient\n");
        sb.append("👨‍⚕️ *Active Counters:* ").append(h.getActiveCounters()).append("\n");

        if (h.getCategories() != null && !h.getCategories().isEmpty()) {
            sb.append("\n🩺 *Offered Departments:*\n");
            for (String cat : h.getCategories()) {
                sb.append("  • ").append(cat).append("\n");
            }
        }

        if (h.getAccreditation() != null && !h.getAccreditation().isEmpty()) {
            sb.append("\n🏆 *Accreditations:* ").append(String.join(", ", h.getAccreditation())).append("\n");
        }

        sb.append("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        sb.append("👉 Reply with hospital number to book a token, or type *menu* to return.");

        whatsAppService.sendWhatsAppMessage(phone, sb.toString());
    }

    private boolean isOpdOpen(HospitalDto h) {
        if (h == null || h.getOpenTime() == null || h.getCloseTime() == null) return true;
        LocalTime now = LocalTime.now();
        return !now.isBefore(h.getOpenTime()) && now.isBefore(h.getCloseTime());
    }

    private String formatTime(LocalTime time) {
        if (time == null) return "N/A";
        return time.format(java.time.format.DateTimeFormatter.ofPattern("hh:mm a"));
    }

    /** "Book here?" -- shown right after a hospital row is tapped, before the token actually joins that hospital's queue. */
    private void sendConfirmationCard(String phone, TokenDto selected, Lang lang) {
        HospitalDto hospital = hospitalService.getById(selected.getHospitalId());
        String name = hospital != null ? hospital.getName() : "Hospital";
        String address = hospital != null ? hospital.getAddress() : null;
        double distanceKm = (hospital != null && selected.getPatientLat() != null && selected.getPatientLon() != null)
                ? geoDistanceService.distanceKm(hospital.getLatitude(), hospital.getLongitude(), selected.getPatientLat(), selected.getPatientLon())
                : 0;
        whatsAppService.sendWhatsAppMessage(phone, botMessages.hospitalConfirmationPrompt(lang, name, address, distanceKm));
    }

    private void sendTokenDashboardCard(String phone, TokenDto token, Lang lang) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = getOrdinal(token.getPosition());
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String statusBadge = botMessages.statusBadge(lang, token.getStatus());
        // /patient requires a logged-in patient JWT session and ignores any ?phone= query
        // string, so a link built that way just bounces an unauthenticated WhatsApp user to
        // the login screen. /track/{phone} is the public, no-auth lookup route -- it reads
        // the phone straight from the URL and redirects to /token/{id} (see Track.jsx).
        String liveUrl = appProperties.getFrontendUrl() + "/track/" + cleanPhone;

        String title = botMessages.dashboardTitle(lang, token.displayNumber());
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
        // See sendTokenDashboardCard above -- /track/{phone} is the public route, /patient is not.
        String liveUrl = appProperties.getFrontendUrl() + "/track/" + cleanPhone;

        String title = botMessages.statusTitle(lang);
        String description = botMessages.statusDescription(lang, token.displayNumber(), token.getName(), token.getAge(), positionText, peopleAhead, estWait, token.getStatus());

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

    private Integer parseInt(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** A native location share (lat/lon) wins; otherwise raw lat/lon or Google Maps link; otherwise 10-char DIGIPIN; otherwise unresolved. */
    private SetLocationRequest resolveIncomingLocation(Double lat, Double lon, String cleanMessage) {
        if (lat != null && lon != null) {
            return new SetLocationRequest(null, lat, lon);
        }
        if (cleanMessage != null && !cleanMessage.isBlank()) {
            java.util.regex.Pattern latLonPattern = java.util.regex.Pattern.compile("(-?\\d{1,2}\\.\\d+)\\s*,\\s*(-?\\d{1,3}\\.\\d+)");
            java.util.regex.Matcher matcher = latLonPattern.matcher(cleanMessage);
            if (matcher.find()) {
                try {
                    double parsedLat = Double.parseDouble(matcher.group(1));
                    double parsedLon = Double.parseDouble(matcher.group(2));
                    return new SetLocationRequest(null, parsedLat, parsedLon);
                } catch (NumberFormatException ignored) {}
            }
        }
        String candidate = cleanMessage == null ? "" : cleanMessage.trim().toUpperCase();
        if (DIGIPIN_PATTERN.matcher(candidate).matches()) {
            return new SetLocationRequest(candidate, null, null);
        }
        return null;
    }

    private Double[] extractLocationFromPayload(JsonNode data, JsonNode messageData, JsonNode body) {
        List<JsonNode> candidates = List.of(
                messageData.path("locationMessage"),
                messageData.path("liveLocationMessage"),
                messageData.path("viewOnceMessage").path("message").path("locationMessage"),
                messageData.path("viewOnceMessage").path("message").path("liveLocationMessage"),
                messageData.path("ephemeralMessage").path("message").path("locationMessage"),
                messageData.path("ephemeralMessage").path("message").path("liveLocationMessage"),
                data.path("locationMessage"),
                data.path("liveLocationMessage"),
                data.path("location"),
                body.path("locationMessage"),
                body.path("liveLocationMessage"),
                body.path("location")
        );

        for (JsonNode node : candidates) {
            if (node == null || node.isMissingNode() || node.isNull()) {
                continue;
            }

            Double lat = parseCoord(node, "degreesLatitude", "latitude", "lat", "degLatitude");
            Double lon = parseCoord(node, "degreesLongitude", "longitude", "lon", "lng", "degLongitude");

            if (lat != null && lon != null) {
                log.info("📍 Location successfully extracted from WhatsApp payload: lat={}, lon={}", lat, lon);
                return new Double[]{lat, lon};
            }
        }
        return new Double[]{null, null};
    }

    private Double parseCoord(JsonNode node, String... fieldNames) {
        for (String field : fieldNames) {
            JsonNode f = node.path(field);
            if (!f.isMissingNode() && !f.isNull()) {
                if (f.isNumber()) {
                    return f.asDouble();
                } else if (f.isTextual()) {
                    try {
                        return Double.parseDouble(f.asText().trim());
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        return null;
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
