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
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;


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
    private final com.qdischarge.clinicqueue.service.FamilyUnitService familyUnitService;
    private final com.qdischarge.clinicqueue.security.JwtService jwtService;

    /** "revoke <id>" -- deliberately a literal, untranslated English command (see BotMessages#accessGranted) so the WhatsApp notice's instructions always work regardless of the reply's language. */
    private static final Pattern REVOKE_COMMAND = Pattern.compile("^revoke\\s+(\\d+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIGIPIN_PATTERN = Pattern.compile("^[A-Z0-9]{10}$");
    private static final String SHOW_MORE_ROW_ID = "show_more";
    private static final String HOSPITAL_ROW_PREFIX = "hosp_";

    /**
     * Builds a secure WebView URL carrying a signed patient JWT and phone number.
     */
    private String buildAuthWebviewUrl(String relativePath, String phone, java.util.Map<String, String> extraParams) {
        String token = jwtService.generatePatientToken(phone);
        String base = appProperties.getFrontendUrl() + relativePath;
        StringBuilder sb = new StringBuilder(base);
        sb.append("?token=").append(java.net.URLEncoder.encode(token, java.nio.charset.StandardCharsets.UTF_8));
        sb.append("&phone=").append(java.net.URLEncoder.encode(phone, java.nio.charset.StandardCharsets.UTF_8));
        if (extraParams != null) {
            for (java.util.Map.Entry<String, String> entry : extraParams.entrySet()) {
                if (entry.getValue() != null && !entry.getValue().isBlank()) {
                    sb.append("&").append(java.net.URLEncoder.encode(entry.getKey(), java.nio.charset.StandardCharsets.UTF_8))
                            .append("=").append(java.net.URLEncoder.encode(entry.getValue(), java.nio.charset.StandardCharsets.UTF_8));
                }
            }
        }
        return sb.toString();
    }

    // -------------------------------------------------------------
    // WEBHOOK VERIFICATION (GET) for Meta WhatsApp Cloud API
    // -------------------------------------------------------------
    @GetMapping(value = {"", "/", "/whatsapp"}, produces = MediaType.TEXT_PLAIN_VALUE)
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
    // WEBHOOK RECEIVER (POST) - handles Meta API payloads
    // -------------------------------------------------------------
    @PostMapping(value = {"", "/", "/whatsapp"}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> receive(@RequestBody(required = false) JsonNode requestBody) {
        JsonNode body = requestBody != null ? requestBody : MissingNode.getInstance();
        log.info("📩 INCOMING WEBHOOK PAYLOAD: {}", body);

        String fromPhone = "";
        String pushName = "Patient";
        String incomingMessage = "";
        String buttonId = "";
        Double incomingLat = null;
        Double incomingLon = null;

        if (!"whatsapp_business_account".equals(body.path("object").asText())) {
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

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

        String cleanMessage = incomingMessage.trim().toLowerCase();

        if (fromPhone.isEmpty()) {
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        log.info("\n📥 META WEBHOOK MSG from [{}] ({}): \"{}\" (ButtonId: \"{}\")",
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

            // Registration callback from register.html
            if (incomingMessage.startsWith("#REGISTERED:")) {
                String registeredName = incomingMessage.substring(12).trim();
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.registrationSuccessMessage(lang, registeredName));
                sendServicesMenu(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Check if user is registered in database
            List<FamilyMemberDto> registeredMembers = familyUnitService.listMembersByCleanPhone(fromPhone);
            if (registeredMembers == null || registeredMembers.isEmpty()) {
                String regUrl = buildAuthWebviewUrl("/wa/register.html", fromPhone, Map.of());
                whatsAppService.sendUrlButtonMessage(fromPhone, "📝 Patient Registration",
                        botMessages.unregisteredPrompt(lang, appProperties.getClinicName()),
                        "📝 Register Now", regUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

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

            // -------------------------------------------------------------
            // WEBVIEW RETURN CALLBACK HANDLERS (#MEMBER, #DEPT, #HOSP, #TRAVEL)
            // -------------------------------------------------------------
            if (incomingMessage.startsWith("#MEMBER:")) {
                String memberVal = incomingMessage.substring(8).trim();
                if (activeToken == null || "completed".equals(activeToken.getStatus()) || "missed".equals(activeToken.getStatus())) {
                    activeToken = queueManagerService.createFamilyRegisteringToken(fromPhone);
                }

                if ("new".equalsIgnoreCase(memberVal) || "add".equalsIgnoreCase(memberVal)) {
                    queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_name");
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.newMemberNamePrompt(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                } else {
                    Integer memberId = parseInt(memberVal);
                    String selectedPatientName = "Patient";
                    if (memberId != null) {
                        FamilyMemberDto member = familyUnitService.getMemberById(memberId);
                        if (member != null) {
                            selectedPatientName = member.getName();
                            queueManagerService.selectFamilyMember(activeToken.getId(), member.getId(), member.getName(), member.getAge(), member.getGender());
                        }
                    }
                    queueManagerService.setSessionStep(activeToken.getId(), "awaiting_category");
                    String deptUrl = buildAuthWebviewUrl("/wa/departments.html", fromPhone, Map.of("lang", lang.name().toLowerCase()));
                    whatsAppService.sendUrlButtonMessage(fromPhone, "🏥 Choose Department",
                            "Patient selected: *" + selectedPatientName + "*! Please choose the medical department for your visit:",
                            "🩺 Select Dept", deptUrl, appProperties.getClinicName());
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }

            if (incomingMessage.startsWith("#DEPT:")) {
                String cat = incomingMessage.substring(6).trim();
                if (activeToken == null || "completed".equals(activeToken.getStatus()) || "missed".equals(activeToken.getStatus())) {
                    activeToken = queueManagerService.createRegisteringToken(fromPhone);
                }
                queueManagerService.captureCategory(activeToken.getId(), cat);
                queueManagerService.setSessionStep(activeToken.getId(), "awaiting_hospital_selection");
                String hospUrl = buildAuthWebviewUrl("/wa/hospitals.html", fromPhone, Map.of("category", cat));
                whatsAppService.sendUrlButtonMessage(fromPhone, "🏥 Choose Hospital",
                        "Department chosen: *" + cat + "*. Tap below to view and select from verified nearby hospitals with live OPD status:",
                        "🏥 Select Hospital", hospUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (incomingMessage.startsWith("#HOSP:")) {
                String hospVal = incomingMessage.substring(6).trim();
                Integer hospId = parseInt(hospVal);
                if (activeToken != null && hospId != null) {
                    TokenDto selected = queueManagerService.selectHospital(activeToken.getId(), hospId);
                    queueManagerService.setSessionStep(activeToken.getId(), "awaiting_travel_time");
                    String travelUrl = buildAuthWebviewUrl("/wa/travel-duration.html", fromPhone, Map.of(
                            "hospitalId", String.valueOf(hospId),
                            "lat", selected.getPatientLat() != null ? String.valueOf(selected.getPatientLat()) : "",
                            "lon", selected.getPatientLon() != null ? String.valueOf(selected.getPatientLon()) : ""
                    ));
                    whatsAppService.sendUrlButtonMessage(fromPhone, "⏱️ Set Travel Duration",
                            "Hospital selected! Drag the slider to set your travel time to ensure optimal queue scheduling:",
                            "⏱️ Set Travel Time", travelUrl, appProperties.getClinicName());
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }

            if (incomingMessage.startsWith("#TRAVEL:")) {
                String minsVal = incomingMessage.substring(8).replaceAll("[^0-9]", "");
                Integer mins = parseInt(minsVal);
                if (activeToken != null && mins != null) {
                    queueManagerService.setSelectedTravelMinutes(activeToken.getId(), mins);
                    TokenDto booked = queueManagerService.confirmBooking(activeToken.getId());
                    sendTokenDashboardCard(fromPhone, booked, lang);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }

            // STEP 1: Mid-registration/booking, every reply is form input -- checked before any
            // command/language matching below, so e.g. a numeric age or department number like
            // "1"/"2"/"3" can never be swallowed by the generate/status/cancel shortcuts.
            if (activeToken != null && "awaiting_family_selection".equals(activeToken.getSessionStep())) {
                List<com.qdischarge.clinicqueue.dto.FamilyMemberDto> members = familyUnitService.listMembers(fromPhone);
                int choice = -1;
                try {
                    choice = Integer.parseInt(cleanMessage.trim());
                } catch (NumberFormatException ignored) {}

                int addChoice = (members != null ? members.size() : 0) + 1;
                if (choice == addChoice || cleanMessage.toLowerCase().contains("add")) {
                    queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_name");
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.newMemberNamePrompt(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                } else if (members != null && choice >= 1 && choice <= members.size()) {
                    com.qdischarge.clinicqueue.dto.FamilyMemberDto chosen = members.get(choice - 1);
                    queueManagerService.selectFamilyMember(activeToken.getId(), chosen.getId(), chosen.getName(), chosen.getAge(), chosen.getGender());
                    String deptUrl = buildAuthWebviewUrl("/wa/departments.html", fromPhone, Map.of("lang", lang.name().toLowerCase()));
                    whatsAppService.sendUrlButtonMessage(fromPhone, "🏥 Choose Department",
                            "Patient selected: *" + chosen.getName() + "*! Please choose the medical department for your visit:",
                            "🩺 Select Dept", deptUrl, appProperties.getClinicName());
                    return ResponseEntity.ok("EVENT_RECEIVED");
                } else {
                    StringBuilder sb = new StringBuilder();
                    if (members != null) {
                        for (int i = 0; i < members.size(); i++) {
                            com.qdischarge.clinicqueue.dto.FamilyMemberDto m = members.get(i);
                            String ageStr = m.getAge() != null ? " (" + m.getAge() + " yrs)" : "";
                            String relStr = m.getRelationship() != null && !m.getRelationship().equalsIgnoreCase("HEAD") ? " - " + m.getRelationship() : " (Self)";
                            sb.append(String.format("%d️⃣ %s%s%s\n", i + 1, m.getName(), relStr, ageStr));
                        }
                    }
                    sb.append(String.format("%d️⃣ ➕ Add Family Member", addChoice));
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.familySelectionPrompt(lang, sb.toString()));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }

            if (activeToken != null && "awaiting_new_member_name".equals(activeToken.getSessionStep())) {
                if (Intent.isReservedWord(cleanMessage)) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidNameReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                queueManagerService.captureName(activeToken.getId(), incomingMessage.trim());
                queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_rel");
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.newMemberRelationPrompt(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_new_member_rel".equals(activeToken.getSessionStep())) {
                String rel = incomingMessage.trim();
                queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_age:" + rel);
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.newMemberAgePrompt(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && activeToken.getSessionStep() != null && activeToken.getSessionStep().startsWith("awaiting_new_member_age")) {
                Integer age = parseAge(cleanMessage);
                if (age == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidAgeReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                String rel = "Family";
                if (activeToken.getSessionStep().contains(":")) {
                    rel = activeToken.getSessionStep().substring(activeToken.getSessionStep().indexOf(":") + 1);
                }
                com.qdischarge.clinicqueue.dto.FamilyMemberDto newMember = familyUnitService.addFamilyMember(fromPhone,
                        new com.qdischarge.clinicqueue.dto.AddFamilyMemberRequest(
                                activeToken.getName(), null, age, null, rel, null, null, null));
                queueManagerService.selectFamilyMember(activeToken.getId(), newMember.getId(), newMember.getName(), newMember.getAge(), newMember.getGender());
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.categoryPrompt(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

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

            // STEP 2: Menu commands -- generate/status/services/cancel, typed or tapped, in any supported language
            if (intent == Intent.GENERATE_TOKEN) {
                if (activeToken == null || "completed".equals(activeToken.getStatus()) || "missed".equals(activeToken.getStatus())) {
                    List<com.qdischarge.clinicqueue.dto.FamilyMemberDto> members = familyUnitService.listMembersByCleanPhone(fromPhone);
                    if (members != null && members.size() > 1) {
                        queueManagerService.createFamilyRegisteringToken(fromPhone);
                        String familyUrl = buildAuthWebviewUrl("/wa/family.html", fromPhone, Map.of("action", "select"));
                        whatsAppService.sendUrlButtonMessage(fromPhone, "👨‍👩‍👧 Select Family Member",
                                "Who needs the appointment today? Tap below to choose a family member:",
                                "👥 Choose Member", familyUrl, appProperties.getClinicName());
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    } else if (members != null && members.size() == 1) {
                        TokenDto draft = queueManagerService.createRegisteringToken(fromPhone);
                        com.qdischarge.clinicqueue.dto.FamilyMemberDto head = members.get(0);
                        queueManagerService.selectFamilyMember(draft.getId(), head.getId(), head.getName(), head.getAge(), head.getGender());
                        String deptUrl = buildAuthWebviewUrl("/wa/departments.html", fromPhone, Map.of("lang", lang.name().toLowerCase()));
                        whatsAppService.sendUrlButtonMessage(fromPhone, "🏥 Choose Department",
                                "Appointment for *" + head.getName() + "*. Please select the medical department:",
                                "🩺 Select Dept", deptUrl, appProperties.getClinicName());
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                    TokenDto draft = queueManagerService.createRegisteringToken(fromPhone);
                    String deptUrl = buildAuthWebviewUrl("/wa/departments.html", fromPhone, Map.of("lang", lang.name().toLowerCase()));
                    whatsAppService.sendUrlButtonMessage(fromPhone, "🏥 Choose Department",
                            "Please select the clinical department for your visit:",
                            "🩺 Select Dept", deptUrl, appProperties.getClinicName());
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone,
                            botMessages.alreadyActiveToken(lang, activeToken.displayNumber(), activeToken.getStatus()));
                    sendTokenDashboardCard(fromPhone, activeToken, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (intent == Intent.CHECK_STATUS) {
                if (activeToken == null || "completed".equals(activeToken.getStatus()) || "missed".equals(activeToken.getStatus())) {
                    String liveUrl = buildAuthWebviewUrl("/wa/track.html", fromPhone, Map.of("key", fromPhone.replaceAll("[^0-9]", "")));
                    whatsAppService.sendUrlButtonMessage(fromPhone, "📊 Live Queue Tracker",
                            "You do not have an active OPD token right now. You can view the live queue tracker below or book a new token:",
                            "📊 View Tracker", liveUrl, appProperties.getClinicName());
                } else {
                    sendStatusCard(fromPhone, activeToken, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (intent == Intent.DOCUMENTS) {
                String docUrl = buildAuthWebviewUrl("/wa/documents.html", fromPhone, Map.of());
                String refUrl = buildAuthWebviewUrl("/wa/referrals.html", fromPhone, Map.of());
                whatsAppService.sendUrlButtonMessage(fromPhone, "💊 Medical Vault & Referrals",
                        "View and upload doctor prescriptions, lab test reports, and referral passes:\n\n📋 *Referrals:* " + refUrl,
                        "💊 Open Vault", docUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (intent == Intent.FAMILY) {
                String famUrl = buildAuthWebviewUrl("/wa/family.html", fromPhone, Map.of("action", "manage"));
                whatsAppService.sendUrlButtonMessage(fromPhone, "👨‍👩‍👧 Family Unit",
                        "Manage your linked family members, view age/gender, and link ABHA health ID cards:",
                        "👨‍👩‍👧 Open Family", famUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (intent == Intent.SERVICES) {
                sendServicesMenu(fromPhone, lang);
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
        sendServicesMenu(phone, lang);
    }

    private void sendServicesMenu(String phone, Lang lang) {
        String title = botMessages.welcomeTitle(lang, appProperties.getClinicName());
        String description = botMessages.welcomeDescription(lang);
        whatsAppService.sendListMessage(phone, title, description,
                botMessages.servicesListSections(lang),
                appProperties.getClinicName(), "📋 Choose Service");
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
        String hospUrl = buildAuthWebviewUrl("/wa/hospitals.html", phone, java.util.Map.of(
                "category", category != null ? category : "General OPD"
        ));
        whatsAppService.sendLocationRequestMessage(phone, botMessages.locationPrompt(lang));
        whatsAppService.sendUrlButtonMessage(phone, "🏥 Or Browse Hospitals",
                "You can also browse nearby hospitals with live OPD timings and real-time distance directly:",
                "🏥 Open Hospitals", hospUrl, appProperties.getClinicName());
    }

    /** Sends interactive CTA button opening the Hospital Selection WebView. */
    private void sendHospitalResultsList(String phone, TokenDto draft, HospitalService.HospitalSearchPage page, Lang lang) {
        String webviewUrl = buildAuthWebviewUrl("/wa/hospitals.html", phone, java.util.Map.of(
                "category", draft.getCategory() != null ? draft.getCategory() : "General OPD",
                "lat", draft.getPatientLat() != null ? String.valueOf(draft.getPatientLat()) : "",
                "lon", draft.getPatientLon() != null ? String.valueOf(draft.getPatientLon()) : ""
        ));

        whatsAppService.sendUrlButtonMessage(phone,
                "🏥 Choose Your Hospital",
                "We found hospitals near you for *" + draft.getCategory() + "*. Tap below to view live OPD timings, distance, and choose your hospital:",
                "🏥 Select Hospital",
                webviewUrl,
                appProperties.getClinicName());
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

    /** "Book here?" -- interactive confirmation with Confirm and Choose Again buttons. */
    private void sendConfirmationCard(String phone, TokenDto selected, Lang lang) {
        HospitalDto hospital = hospitalService.getById(selected.getHospitalId());
        String name = hospital != null ? hospital.getName() : "Hospital";
        String address = hospital != null ? hospital.getAddress() : null;
        double distanceKm = (hospital != null && selected.getPatientLat() != null && selected.getPatientLon() != null)
                ? geoDistanceService.distanceKm(hospital.getLatitude(), hospital.getLongitude(), selected.getPatientLat(), selected.getPatientLon())
                : 0;

        StringBuilder sb = new StringBuilder();
        sb.append(botMessages.hospitalConfirmationPrompt(lang, name, address, distanceKm));
        if (selected.getSelectedTravelMinutes() != null && selected.getSelectedTravelMinutes() > 0) {
            sb.append("\n⏱️ *Selected Travel Duration:* ~").append(selected.getSelectedTravelMinutes()).append(" mins");
        }

        List<WaButton> confirmButtons = switch (lang) {
            case EN -> List.of(new WaButton("btn_confirm_booking", "✅ Confirm Booking"), new WaButton("btn_choose_again", "🔄 Choose Again"));
            case HI -> List.of(new WaButton("btn_confirm_booking", "✅ बुकिंग पुष्टि करें"), new WaButton("btn_choose_again", "🔄 फिर से चुनें"));
            case MR -> List.of(new WaButton("btn_confirm_booking", "✅ पुष्टी करा"), new WaButton("btn_choose_again", "🔄 पुन्हा निवडा"));
        };

        whatsAppService.sendButtonsMessage(phone, "🏥 Booking Confirmation", sb.toString(), confirmButtons, appProperties.getClinicName());
    }

    private void sendTokenDashboardCard(String phone, TokenDto token, Lang lang) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = getOrdinal(token.getPosition());
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String statusBadge = botMessages.statusBadge(lang, token.getStatus());

        String liveUrl = buildAuthWebviewUrl("/wa/track.html", phone, java.util.Map.of("key", cleanPhone, "tokenId", String.valueOf(token.getId())));
        String slipUrl = buildAuthWebviewUrl("/wa/response.html", phone, java.util.Map.of("key", cleanPhone));

        String title = botMessages.dashboardTitle(lang, token.displayNumber());
        String currentServing = token.getCurrentServing() != null ? String.valueOf(token.getCurrentServing()) : "--";
        String description = botMessages.dashboardDescription(lang, token.getName(), token.getAge(), statusBadge, positionText, peopleAhead, estWait, currentServing, token.displayNumber())
                + "\n\n📄 *Digital Booking Slip:* " + slipUrl;

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

        String liveUrl = buildAuthWebviewUrl("/wa/track.html", phone, java.util.Map.of("key", cleanPhone, "tokenId", String.valueOf(token.getId())));

        String title = botMessages.statusTitle(lang);
        String currentServing = token.getCurrentServing() != null ? String.valueOf(token.getCurrentServing()) : "--";
        String description = botMessages.statusDescription(lang, token.displayNumber(), token.getName(), token.getAge(), positionText, peopleAhead, estWait, token.getStatus(), currentServing);

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
