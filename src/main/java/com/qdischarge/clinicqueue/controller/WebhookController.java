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
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;

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
    private final com.qdischarge.clinicqueue.service.PatientDocumentService patientDocumentService;
    private final com.qdischarge.clinicqueue.service.WebhookDeduplicationService webhookDeduplicationService;

    private static final Pattern REVOKE_COMMAND = Pattern.compile("^revoke\\s+(\\d+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIGIPIN_PATTERN = Pattern.compile("^[A-Z0-9]{10}$");
    private static final String SHOW_MORE_ROW_ID = "show_more";
    private static final String HOSPITAL_ROW_PREFIX = "hosp_";

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
        String finalUrl = sb.toString();
        log.info("🌐 Built Webview URL: {}", finalUrl);
        return finalUrl;
    }

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
        String msgType = "";

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

        String messageId = message.path("id").asText("");
        if (webhookDeduplicationService.isDuplicate(messageId)) {
            log.info("⏩ Duplicate Meta message ID [{}] ignored.", messageId);
            return ResponseEntity.ok("EVENT_RECEIVED");
        }

        String rawFrom = message.path("from").asText("");
        fromPhone = rawFrom.startsWith("+") ? rawFrom : "+" + rawFrom;
        pushName = value.path("contacts").path(0).path("profile").path("name").asText("Patient");

        String tmpMessage = "";
        String tmpButtonId = "";
        msgType = message.path("type").asText("");
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
            // STEP 1: Session & Language
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
                sendServicesMenu(fromPhone, chosen);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            Lang lang = session.language();
            
            // Check if user is registered in database (Registration guard)
            List<FamilyMemberDto> members = familyUnitService.listMembersByCleanPhone(fromPhone);
            if (members == null || members.isEmpty()) {
                if (incomingMessage.startsWith("#REGISTERED:")) {
                    String registeredName = incomingMessage.substring(12).trim();
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.registrationSuccessMessage(lang, registeredName));
                    sendServicesMenu(fromPhone, lang);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                String regUrl = buildAuthWebviewUrl("/wa/register.html", fromPhone, Map.of());
                whatsAppService.sendUrlButtonMessage(fromPhone, "📝 Patient Registration",
                        botMessages.unregisteredPrompt(lang, appProperties.getClinicName()),
                        "📝 Register Now", regUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (incomingMessage.startsWith("#REGISTERED:")) {
                String registeredName = incomingMessage.substring(12).trim();
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.registrationSuccessMessage(lang, registeredName));
                sendServicesMenu(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Revoke command
            Matcher revokeMatch = REVOKE_COMMAND.matcher(cleanMessage);
            if (revokeMatch.matches()) {
                int grantId = Integer.parseInt(revokeMatch.group(1));
                boolean revoked = accessService.revoke(grantId, fromPhone);
                whatsAppService.sendWhatsAppMessage(fromPhone,
                        revoked ? botMessages.accessRevoked(lang, grantId) : botMessages.accessRevokeNotFound(lang));
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            TokenDto activeToken = queueManagerService.getActiveToken(fromPhone);

            // CALLBACKS: #MEMBER, #DEPT, #HOSP, #TRAVEL, #SERVICE
            if (incomingMessage.startsWith("#MEMBER:")) {
                String memberVal = incomingMessage.substring(8).trim();
                if (activeToken == null || isTerminal(activeToken)) {
                    activeToken = queueManagerService.createFamilyRegisteringToken(fromPhone);
                }

                if ("new".equalsIgnoreCase(memberVal) || "add".equalsIgnoreCase(memberVal)) {
                    queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_name");
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.newMemberNamePrompt(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                } else {
                    Integer memberId = parseInt(memberVal);
                    if (memberId != null) {
                        FamilyMemberDto member = familyUnitService.getMemberById(memberId);
                        if (member != null) {
                            queueManagerService.selectFamilyMember(activeToken.getId(), member.getId(), member.getName(), member.getAge(), member.getGender());
                            sendDepartmentSelectionList(fromPhone, lang, activeToken, member.getName());
                        }
                    }
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }

            if (incomingMessage.startsWith("#DEPT:")) {
                String cat = incomingMessage.substring(6).trim();
                if (activeToken == null || isTerminal(activeToken)) {
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
                if (hospId != null) {
                    if (activeToken == null || isTerminal(activeToken)) {
                        activeToken = queueManagerService.createRegisteringToken(fromPhone);
                    }
                    TokenDto selected = queueManagerService.selectHospital(activeToken.getId(), hospId);
                    if (selected != null) {
                        sendConfirmationCard(fromPhone, selected, lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }
            }

            if (incomingMessage.startsWith("#TRAVEL:")) {
                String minsVal = incomingMessage.substring(8).replaceAll("[^0-9]", "");
                Integer mins = parseInt(minsVal);
                if (activeToken != null && mins != null) {
                    queueManagerService.setSelectedTravelMinutes(activeToken.getId(), mins);
                    TokenDto booked = queueManagerService.confirmBooking(activeToken.getId());
                    sendBookingConfirmedCard(fromPhone, booked, lang);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }
            
            if (incomingMessage.startsWith("#SERVICE:")) {
                String srv = incomingMessage.substring(9).trim().toLowerCase();
                switch (srv) {
                    case "srv_appointment", "appointment", "book" -> handleAppointmentService(fromPhone, lang, activeToken, members);
                    case "srv_family_abha", "family_abha" -> handleFamilyAbhaService(fromPhone, lang, members);
                    case "srv_health_records", "health_records", "rec_upload" -> handleHealthRecordsService(fromPhone, lang);
                    case "srv_referrals", "referrals" -> handleReferralsService(fromPhone, lang);
                    case "srv_lang_change", "lang_change" -> {
                        waSessionService.resetToLanguagePicker(fromPhone);
                        sendLanguagePrompt(fromPhone, false);
                    }
                    default -> sendServicesMenu(fromPhone, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            
            // Media upload handler (Instant Prescription Vault + in_records_media_wait)
            if ("document".equals(msgType) || "image".equals(msgType)) {
                String mediaId = message.path(msgType).path("id").asText("");
                if (!mediaId.isEmpty()) {
                    if ("in_records_media_wait".equals(session.stage())) {
                        WaSessionService.PendingMedia pending = waSessionService.getPendingMedia(fromPhone);
                        Integer memberId = pending != null ? pending.memberId() : null;
                        waSessionService.setPendingMedia(fromPhone, mediaId, msgType, memberId);
                        waSessionService.setStage(fromPhone, "awaiting_doc_name");
                        String docNamePrompt = switch(lang) {
                            case EN -> "🏷️  *NAME YOUR DOCUMENT*\n\nDocument received! ✅\n\nPlease type a short label for this document:\n\n💡 *Examples:*\n  • Blood Test – Sep 2026\n  • Dr. Mehta Prescription\n  • Chest X-Ray Report\n\n_Type *back* to cancel upload._";
                            case HI -> "🏷️  *दस्तावेज़ का नाम*\n\nदस्तावेज़ प्राप्त हुआ! ✅\n\nकृपया इस दस्तावेज़ के लिए एक लेबल टाइप करें:\n\n💡 *उदाहरण:*\n  • रक्त परीक्षण – सित॰ 2026\n  • डॉ. मेहता पर्चा\n  • छाती एक्स-रे\n\n_अपलोड रद्द करने के लिए *back* लिखें।_";
                            case MR -> "🏷️  *कागदपत्राचे नाव*\n\nकागदपत्र मिळाले! ✅\n\nकृपया या कागदपत्रासाठी एक लेबल टाइप करा:\n\n💡 *उदाहरण:*\n  • रक्त चाचणी – सप्टें 2026\n  • डॉ. मेहता प्रिस्क्रिप्शन\n  • छाती क्ष-किरण\n\n_अपलोड रद्द करण्यासाठी *back* लिहा._";
                        };
                        whatsAppService.sendWhatsAppMessage(fromPhone, docNamePrompt);
                    } else {
                        // Instant Prescription Vault (Reverse spontaneous upload)
                        if (members != null && members.size() == 1) {
                            FamilyMemberDto single = members.get(0);
                            waSessionService.setPendingMedia(fromPhone, mediaId, msgType, single.getId());
                            waSessionService.setStage(fromPhone, "awaiting_instant_doc_confirm");
                            whatsAppService.sendButtonsMessage(fromPhone, "", 
                                    botMessages.instantPrescriptionPrompt(lang, single.getName()),
                                    botMessages.instantPrescriptionButtons(lang),
                                    appProperties.getClinicName());
                        } else if (members != null && !members.isEmpty()) {
                            waSessionService.setPendingMedia(fromPhone, mediaId, msgType, null);
                            waSessionService.setStage(fromPhone, "in_records_member_select_upload");
                            sendRecordsMemberSelectionList(fromPhone, lang, members, "upload");
                        } else {
                            String regUrl = buildAuthWebviewUrl("/wa/register.html", fromPhone, Map.of());
                            whatsAppService.sendUrlButtonMessage(fromPhone, "📝 Patient Registration",
                                    botMessages.unregisteredPrompt(lang, appProperties.getClinicName()),
                                    "📝 Register Now", regUrl, appProperties.getClinicName());
                        }
                    }
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Universal Go Back / Main Menu / Greetings
            Intent navIntent = Intent.match(buttonId, cleanMessage);
            if (navIntent == Intent.MAIN_MENU || Intent.GREETING_WORDS.contains(cleanMessage)) {
                waSessionService.setStage(fromPhone, "ready");
                sendServicesMenu(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (navIntent == Intent.GO_BACK) {
                if (activeToken != null && activeToken.getSessionStep() != null 
                        && !isTerminal(activeToken)) {
                    TokenDto prev = queueManagerService.goBackOneStep(activeToken.getId());
                    if (prev != null) {
                        redispatchStep(fromPhone, prev, lang, members);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }
                String prevStage = waSessionService.getPrevStage(fromPhone);
                if (prevStage != null && !prevStage.isBlank()) {
                    waSessionService.setStage(fromPhone, prevStage);
                    redispatchStage(fromPhone, prevStage, lang);
                } else {
                    sendServicesMenu(fromPhone, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Instant prescription vault confirmations
            if ("btn_save_doc_yes".equals(buttonId)) {
                WaSessionService.PendingMedia pending = waSessionService.getPendingMedia(fromPhone);
                if (pending != null && pending.mediaId() != null) {
                    String todayStr = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));
                    String defaultLabel = "Prescription – " + todayStr;
                    String accessToken = appProperties.getMetaAccessToken();
                    String apiVersion = appProperties.getMetaApiVersion();
                    patientDocumentService.saveFromWhatsAppMedia(fromPhone, pending.memberId(), pending.mediaId(), pending.mediaType(), defaultLabel, accessToken, apiVersion);
                    waSessionService.clearPendingMedia(fromPhone);
                    waSessionService.setStage(fromPhone, "ready");
                    String savedMsg = switch(lang) {
                        case EN -> "✅  *PRESCRIPTION SAVED TO HEALTH VAULT!*\n\n📄  *" + defaultLabel + "*\n📅  " + todayStr + "\n\nYour doctor will be able to view this during your next OPD consultation.";
                        case HI -> "✅  *पर्चा हेल्थ वॉल्ट में सहेजा गया!*\n\n📄  *" + defaultLabel + "*\n📅  " + todayStr + "\n\nआपके अगले ओपीडी परामर्श के दौरान डॉक्टर इसे देख सकेंगे।";
                        case MR -> "✅  *प्रिस्क्रिप्शन Health Vault मध्ये जतन केले!*\n\n📄  *" + defaultLabel + "*\n📅  " + todayStr + "\n\nतुमच्या पुढील ओपीडी तपासणी दरम्यान डॉक्टर हे पाहू शकतील.";
                    };
                    whatsAppService.sendWhatsAppMessage(fromPhone, savedMsg);
                    String docUrl = buildAuthWebviewUrl("/wa/documents.html", fromPhone, Map.of());
                    whatsAppService.sendUrlButtonMessage(fromPhone, switch(lang){case EN->"💊 Health Vault";case HI->"💊 हेल्थ वॉल्ट";case MR->"💊 Health Vault";},
                            switch(lang){case EN->"View all your saved prescriptions & reports:";case HI->"अपने सभी सहेजे गए पर्चे व रिपोर्ट देखें:";case MR->"सर्व जतन केलेले प्रिस्क्रिप्शन व रिपोर्ट पहा:";},
                            switch(lang){case EN->"💊 Open Health Vault";case HI->"💊 वॉल्ट खोलें";case MR->"💊 Vault उघडा";}, docUrl, appProperties.getClinicName());
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }
            if ("btn_save_doc_other".equals(buttonId)) {
                waSessionService.setStage(fromPhone, "in_records_member_select_upload");
                sendRecordsMemberSelectionList(fromPhone, lang, members, "upload");
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Family member management handlers
            if (buttonId != null && buttonId.startsWith("fam_manage_")) {
                String sub = buttonId.substring("fam_manage_".length());
                if ("new".equalsIgnoreCase(sub)) {
                    String regUrl = buildAuthWebviewUrl("/wa/family.html", fromPhone, Map.of("mode", "add"));
                    whatsAppService.sendUrlButtonMessage(fromPhone, "➕ Add Family Member",
                            "Tap below to add a new family member with Ayushman (ABHA) details:",
                            "➕ Add Member", regUrl, appProperties.getClinicName());
                } else {
                    Integer memberId = parseInt(sub);
                    if (memberId != null) {
                        FamilyMemberDto member = familyUnitService.getMemberById(memberId);
                        if (member != null) {
                            String card = botMessages.familyMemberManageCard(lang, member);
                            whatsAppService.sendButtonsMessage(fromPhone, "👨‍👩‍👧 Family Member", card,
                                    botMessages.familyMemberManageButtons(lang, member.getId()), appProperties.getClinicName());
                        }
                    }
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (buttonId != null && buttonId.startsWith("fam_book_")) {
                Integer memberId = parseInt(buttonId.substring("fam_book_".length()));
                if (memberId != null) {
                    FamilyMemberDto member = familyUnitService.getMemberById(memberId);
                    if (member != null) {
                        if (activeToken == null || isTerminal(activeToken)) {
                            activeToken = queueManagerService.createRegisteringToken(fromPhone);
                        }
                        queueManagerService.selectFamilyMember(activeToken.getId(), member.getId(), member.getName(), member.getAge(), member.getGender());
                        sendDepartmentSelectionList(fromPhone, lang, activeToken, member.getName());
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }
            }

            if (buttonId != null && buttonId.startsWith("fam_records_")) {
                Integer memberId = parseInt(buttonId.substring("fam_records_".length()));
                String docUrl = buildAuthWebviewUrl("/wa/documents.html", fromPhone, Map.of("memberId", String.valueOf(memberId)));
                whatsAppService.sendUrlButtonMessage(fromPhone, "💊 Health Records",
                        "Tap below to view medical documents & prescriptions for this member:",
                        "💊 View Records", docUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if ("dept_all_list".equals(buttonId) || "dept_page_1".equals(buttonId)) {
                sendAllDepartmentsPage(fromPhone, lang, 1);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (buttonId != null && buttonId.startsWith("dept_page_")) {
                int pageIdx = 1;
                try {
                    pageIdx = Integer.parseInt(buttonId.substring(10));
                } catch (Exception ignored) {}
                sendAllDepartmentsPage(fromPhone, lang, pageIdx);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (buttonId != null && buttonId.startsWith(HOSPITAL_ROW_PREFIX)) {
                Integer hospitalId = parseInt(buttonId.substring(HOSPITAL_ROW_PREFIX.length()));
                if (activeToken == null || isTerminal(activeToken)) {
                    activeToken = queueManagerService.createRegisteringToken(fromPhone);
                }
                TokenDto selected = hospitalId == null ? null : queueManagerService.selectHospital(activeToken.getId(), hospitalId);
                if (selected != null) {
                    sendConfirmationCard(fromPhone, selected, lang);
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
            }

            if ("btn_confirm_booking".equals(buttonId)) {
                if (activeToken != null) {
                    try {
                        TokenDto booked = queueManagerService.confirmBooking(activeToken.getId());
                        sendBookingConfirmedCard(fromPhone, booked, lang);
                    } catch (IllegalStateException e) {
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.bookingFailed(lang, e.getMessage()));
                    }
                } else {
                    sendServicesMenu(fromPhone, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if ("btn_choose_again".equals(buttonId)) {
                if (activeToken != null) {
                    QueueManagerService.HospitalSearchOutcome outcome = queueManagerService.restartHospitalSelection(activeToken.getId());
                    if (outcome != null && !outcome.page().results().isEmpty()) {
                        sendHospitalResultsList(fromPhone, outcome.draft(), outcome.page(), lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    } else {
                        sendLocationPrompt(fromPhone, lang, activeToken.getCategory());
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                } else {
                    sendServicesMenu(fromPhone, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if ("btn_retry_location".equals(buttonId)) {
                if (activeToken != null) {
                    sendLocationPrompt(fromPhone, lang, activeToken.getCategory());
                } else {
                    sendServicesMenu(fromPhone, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if ("btn_book_main".equals(buttonId)) {
                HospitalDto op = hospitalService.getOperatingHospital();
                if (op != null && activeToken != null) {
                    TokenDto selected = queueManagerService.selectHospital(activeToken.getId(), op.getId());
                    if (selected != null) {
                        sendConfirmationCard(fromPhone, selected, lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }
            }

            // Token session steps (in-registration flow handlers)
            if (buttonId != null && buttonId.startsWith("fam_") && !buttonId.startsWith("fam_manage_") && !buttonId.startsWith("fam_book_") && !buttonId.startsWith("fam_records_")) {
                String famVal = buttonId.substring(4);
                if ("new".equals(famVal)) {
                    if (activeToken == null || isTerminal(activeToken)) {
                        activeToken = queueManagerService.createFamilyRegisteringToken(fromPhone);
                    }
                    queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_name");
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.newMemberNamePrompt(lang));
                } else {
                    Integer memberId = parseInt(famVal);
                    if (memberId != null) {
                        FamilyMemberDto member = familyUnitService.getMemberById(memberId);
                        if (member != null) {
                            if (activeToken == null || isTerminal(activeToken)) {
                                activeToken = queueManagerService.createRegisteringToken(fromPhone);
                            }
                            queueManagerService.selectFamilyMember(activeToken.getId(), member.getId(), member.getName(), member.getAge(), member.getGender());
                            sendDepartmentSelectionList(fromPhone, lang, activeToken, member.getName());
                        }
                    }
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (buttonId != null && (buttonId.startsWith(QueueManagerService.DEPT_ROW_PREFIX) || buttonId.startsWith("#DEPT:"))) {
                String category = buttonId.startsWith("#DEPT:") ? buttonId.substring(6) : buttonId.substring(QueueManagerService.DEPT_ROW_PREFIX.length());
                String canonical = MedicalCategory.canonicalize(category);
                if (canonical != null) {
                    if (activeToken == null || isTerminal(activeToken)) {
                        activeToken = queueManagerService.createRegisteringToken(fromPhone);
                    }
                    activeToken = queueManagerService.captureDepartment(activeToken.getId(), canonical);
                    if (activeToken != null && activeToken.getPatientLat() != null && activeToken.getPatientLon() != null) {
                        HospitalService.HospitalSearchPage page = hospitalService.searchHospitals(
                                canonical, activeToken.getGender(), activeToken.getPatientLat(), activeToken.getPatientLon(), 0, QueueManagerService.HOSPITAL_PAGE_SIZE);
                        if (page != null && !page.results().isEmpty()) {
                            queueManagerService.setSessionStepWithPrev(activeToken.getId(), "awaiting_hospital_selection", "awaiting_department_selection");
                            sendHospitalResultsList(fromPhone, activeToken, page, lang);
                            return ResponseEntity.ok("EVENT_RECEIVED");
                        }
                    }
                    sendLocationPrompt(fromPhone, lang, canonical);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
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
                queueManagerService.setSessionStepWithPrev(activeToken.getId(), "awaiting_new_member_gender", "awaiting_new_member_rel");
                queueManagerService.setSessionStep(activeToken.getId(), "awaiting_new_member_gender:" + rel);
                whatsAppService.sendButtonsMessage(fromPhone, "", botMessages.genderPrompt(lang), botMessages.genderButtons(lang), appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            
            if (activeToken != null && activeToken.getSessionStep() != null && activeToken.getSessionStep().startsWith("awaiting_new_member_gender")) {
                Gender gender = Gender.match(buttonId, cleanMessage);
                if (gender == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidGenderReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                queueManagerService.captureGender(activeToken.getId(), gender.code());
                String rel = "Family";
                if (activeToken.getSessionStep().contains(":")) {
                    rel = activeToken.getSessionStep().substring(activeToken.getSessionStep().indexOf(":") + 1);
                }
                queueManagerService.setSessionStepWithPrev(activeToken.getId(), "awaiting_new_member_age:" + rel, "awaiting_new_member_gender");
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
                sendDepartmentSelectionList(fromPhone, lang, activeToken, newMember.getName());
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
                sendDepartmentSelectionList(fromPhone, lang, activeToken, activeToken.getName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_category".equals(activeToken.getSessionStep())) {
                String category = MedicalCategory.match(incomingMessage);
                if (category == null) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.invalidCategoryReminder(lang));
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                queueManagerService.captureDepartment(activeToken.getId(), category);
                sendLocationPrompt(fromPhone, lang, category);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && ("awaiting_location".equals(activeToken.getSessionStep()) || (incomingLat != null && incomingLon != null))) {
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
                    HospitalDto operating = hospitalService.getOperatingHospital();
                    whatsAppService.sendButtonsMessage(fromPhone, "", 
                            botMessages.emptyHospitalsRecoveryPrompt(lang, activeToken.getCategory(), operating != null ? operating.getName() : null),
                            botMessages.emptyHospitalsButtons(lang, operating != null ? operating.getId() : null),
                            appProperties.getClinicName());
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
                if (cleanMsg.startsWith("profile ") || cleanMsg.startsWith("info ") || cleanMsg.startsWith("details ") || cleanMsg.endsWith(" profile")) {
                    String numStr = cleanMsg.replaceAll("[^0-9]", "");
                    Integer idx = parseInt(numStr);
                    if (idx != null && page != null && idx >= 1 && idx <= page.results().size()) {
                        HospitalService.HospitalMatch match = page.results().get(idx - 1);
                        sendHospitalProfile(fromPhone, match.hospital(), match.distanceKm(), lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }

                Integer selectedIdx = parseInt(cleanMsg);
                if (selectedIdx != null && page != null && selectedIdx >= 1 && selectedIdx <= page.results().size()) {
                    HospitalDto chosen = page.results().get(selectedIdx - 1).hospital();
                    TokenDto selected = queueManagerService.selectHospital(activeToken.getId(), chosen.getId());
                    if (selected != null) {
                        sendConfirmationCard(fromPhone, selected, lang);
                        return ResponseEntity.ok("EVENT_RECEIVED");
                    }
                }

                sendHospitalResultsList(fromPhone, activeToken, page, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (activeToken != null && "awaiting_confirmation".equals(activeToken.getSessionStep())) {
                ConfirmationChoice choice = ConfirmationChoice.match(buttonId, cleanMessage);
                if (choice == ConfirmationChoice.CONFIRM) {
                    try {
                        TokenDto booked = queueManagerService.confirmBooking(activeToken.getId());
                        sendBookingConfirmedCard(fromPhone, booked, lang);
                    } catch (IllegalStateException e) {
                        whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.bookingFailed(lang, e.getMessage()));
                    }
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                if (choice == ConfirmationChoice.CHOOSE_AGAIN) {
                    QueueManagerService.HospitalSearchOutcome outcome = queueManagerService.restartHospitalSelection(activeToken.getId());
                    if (outcome != null && !outcome.page().results().isEmpty()) {
                        sendHospitalResultsList(fromPhone, outcome.draft(), outcome.page(), lang);
                    } else {
                        sendLocationPrompt(fromPhone, lang, activeToken.getCategory());
                    }
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                sendConfirmationCard(fromPhone, activeToken, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Let a patient switch language at any later point by typing/tapping it again.
            Lang switchTo = Lang.match(buttonId, cleanMessage);
            if (switchTo != null && switchTo != lang) {
                waSessionService.setLanguage(fromPhone, switchTo);
                whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.languageSwitched(switchTo));
                sendServicesMenu(fromPhone, switchTo);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Service-level stage handlers
            if ("awaiting_doc_name".equals(session.stage())) {
                String label = incomingMessage.trim();
                if (label.isEmpty()) {
                    whatsAppService.sendWhatsAppMessage(fromPhone, switch(lang){case EN->"Please type a name for the document.";case HI->"कृपया दस्तावेज़ का नाम टाइप करें।";case MR->"कृपया कागदपत्राचे नाव टाइप करा.";}); 
                    return ResponseEntity.ok("EVENT_RECEIVED");
                }
                WaSessionService.PendingMedia pending = waSessionService.getPendingMedia(fromPhone);
                if (pending != null) {
                    String accessToken = appProperties.getMetaAccessToken();
                    String apiVersion = appProperties.getMetaApiVersion();
                    patientDocumentService.saveFromWhatsAppMedia(fromPhone, pending.memberId(), pending.mediaId(), pending.mediaType(), label, accessToken, apiVersion);
                    waSessionService.clearPendingMedia(fromPhone);
                }
                waSessionService.setStage(fromPhone, "ready");
                String savedMsg = switch(lang) {
                    case EN -> "✅  *DOCUMENT SAVED!*\n\n📄  *" + label + "*\n👤  Patient: " + (pending != null && pending.memberId() != null ? "Saved" : "Saved") + "\n📅  " + java.time.LocalDate.now() + "\n\nYour document is now in the Health Vault.";
                    case HI -> "✅  *दस्तावेज़ सहेजा गया!*\n\n📄  *" + label + "*\n📅  " + java.time.LocalDate.now() + "\n\nआपका दस्तावेज़ अब हेल्थ वॉल्ट में है।";
                    case MR -> "✅  *कागदपत्र जतन केले!*\n\n📄  *" + label + "*\n📅  " + java.time.LocalDate.now() + "\n\nतुमचे कागदपत्र Health Vault मध्ये आहे.";
                };
                whatsAppService.sendWhatsAppMessage(fromPhone, savedMsg);
                String docUrl = buildAuthWebviewUrl("/wa/documents.html", fromPhone, Map.of());
                whatsAppService.sendUrlButtonMessage(fromPhone, switch(lang){case EN->"💊 Health Vault";case HI->"💊 हेल्थ वॉल्ट";case MR->"💊 Health Vault";},
                        switch(lang){case EN->"View all your saved medical documents:";case HI->"सभी सहेजे गए दस्तावेज़ देखें:";case MR->"सर्व जतन केलेले कागदपत्र पहा:";},
                        switch(lang){case EN->"💊 Open Vault";case HI->"💊 वॉल्ट खोलें";case MR->"💊 Vault उघडा";}, docUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            
            if (buttonId != null && buttonId.startsWith("rec_upload_member_")) {
                Integer memberId = parseInt(buttonId.substring("rec_upload_member_".length()));
                waSessionService.setPendingMedia(fromPhone, null, null, memberId);
                waSessionService.setStage(fromPhone, "in_records_media_wait");
                String patientName = "Patient";
                if (memberId != null && members != null) {
                    patientName = members.stream().filter(m -> m.getId().equals(memberId)).map(FamilyMemberDto::getName).findFirst().orElse("Patient");
                }
                String uploadPrompt = switch(lang) {
                    case EN -> "📤  *UPLOAD DOCUMENT*\n\n" + "Patient: *" + patientName + "*\n\n" +
                            "Please send your document now as a WhatsApp attachment.\n\n" +
                            "✅  Supported formats:\n  📄 PDF · 🖼️ Image (JPG/PNG)\n\n" +
                            "_Type *back* to go back or *menu* for main menu._";
                    case HI -> "📤  *दस्तावेज़ अपलोड करें*\n\nमरीज़: *" + patientName + "*\n\nकृपया अभी अपना दस्तावेज़ WhatsApp अटैचमेंट के रूप में भेजें।\n\n✅  समर्थित प्रारूप:\n  📄 PDF · 🖼️ JPG/PNG\n\n_वापस जाने के लिए *back* लिखें।_";
                    case MR -> "📤  *कागदपत्र अपलोड करा*\n\nरुग्ण: *" + patientName + "*\n\nकृपया आत्ता तुमचे कागदपत्र WhatsApp अटॅचमेंट म्हणून पाठवा.\n\n✅  समर्थित फॉर्मेट:\n  📄 PDF · 🖼️ JPG/PNG\n\n_मागे जाण्यासाठी *back* लिहा._";
                };
                whatsAppService.sendWhatsAppMessage(fromPhone, uploadPrompt);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            if (buttonId != null && buttonId.startsWith("rec_view_member_")) {
                Integer memberId = parseInt(buttonId.substring("rec_view_member_".length()));
                String docUrl = buildAuthWebviewUrl("/wa/documents.html", fromPhone, Map.of("memberId", memberId != null ? String.valueOf(memberId) : ""));
                whatsAppService.sendUrlButtonMessage(fromPhone, switch(lang){case EN->"💊 Health Records";case HI->"💊 स्वास्थ्य रिकॉर्ड";case MR->"💊 आरोग्य नोंदी";},
                        switch(lang){case EN->"Tap to view medical documents:";case HI->"मेडिकल दस्तावेज़ देखने के लिए टैप करें:";case MR->"वैद्यकीय कागदपत्रे पाहण्यासाठी टॅप करा:";},
                        switch(lang){case EN->"💊 View Records";case HI->"💊 देखें";case MR->"💊 पहा";}, docUrl, appProperties.getClinicName());
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            Intent intent = Intent.match(buttonId, cleanMessage);
            
            if (intent == Intent.UPLOAD_RECORD || "rec_upload".equals(buttonId)) {
                waSessionService.setStage(fromPhone, "in_records_member_select_upload");
                sendRecordsMemberSelectionList(fromPhone, lang, members, "upload");
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.VIEW_RECORDS || "rec_view".equals(buttonId)) {
                waSessionService.setStage(fromPhone, "in_records_member_select_view");
                sendRecordsMemberSelectionList(fromPhone, lang, members, "view");
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            
            if (intent == Intent.APPOINTMENT) {
                handleAppointmentService(fromPhone, lang, activeToken, members);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.BOOK_APPOINTMENT) {
                if (activeToken == null || isTerminal(activeToken)) {
                    if (members != null && members.size() == 1) {
                        TokenDto draft = queueManagerService.createRegisteringToken(fromPhone);
                        FamilyMemberDto head = members.get(0);
                        queueManagerService.selectFamilyMember(draft.getId(), head.getId(), head.getName(), head.getAge(), head.getGender());
                        queueManagerService.setSessionStepWithPrev(draft.getId(), "awaiting_department_selection", "awaiting_family_selection");
                        sendDepartmentSelectionList(fromPhone, lang, draft, head.getName());
                    } else {
                        queueManagerService.createFamilyRegisteringToken(fromPhone);
                        sendFamilySelectionList(fromPhone, lang, members);
                    }
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.alreadyActiveToken(lang, activeToken.displayTokenCode(), activeToken.getStatus()));
                    sendTokenDashboardCard(fromPhone, activeToken, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.TRACK_APPOINTMENT) {
                if (activeToken == null || isTerminal(activeToken)) {
                    whatsAppService.sendButtonsMessage(fromPhone, "", switch(lang) {
                        case EN -> "❌  *No Active Appointment Found*\n\nYou don't have an active OPD appointment right now.\n\nWould you like to book one?";
                        case HI -> "❌  *कोई सक्रिय अपॉइंटमेंट नहीं*\n\nफिलहाल आपका कोई सक्रिय ओपीडी अपॉइंटमेंट नहीं है।\n\nक्या आप एक बुक करना चाहते हैं?";
                        case MR -> "❌  *कोणतेही सक्रिय अपॉइंटमेंट नाही*\n\nसध्या तुमचे कोणतेही सक्रिय ओपीडी अपॉइंटमेंट नाही.\n\nएक बुक करायचे आहे का?";
                    }, switch(lang) {
                        case EN -> List.of(new WaButton("apt_book", "📅 Book Appointment"), new WaButton("btn_main_menu", "🏠 Main Menu"));
                        case HI -> List.of(new WaButton("apt_book", "📅 अपॉइंटमेंट बुक"), new WaButton("btn_main_menu", "🏠 मुख्य मेनू"));
                        case MR -> List.of(new WaButton("apt_book", "📅 बुक करा"), new WaButton("btn_main_menu", "🏠 मुख्य मेनू"));
                    }, appProperties.getClinicName());
                } else {
                    sendStatusCard(fromPhone, activeToken, lang);
                }
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.FAMILY_ABHA) {
                handleFamilyAbhaService(fromPhone, lang, members);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.HEALTH_RECORDS) {
                handleHealthRecordsService(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.REFERRALS) {
                handleReferralsService(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.CHANGE_LANGUAGE) {
                waSessionService.resetToLanguagePicker(fromPhone);
                sendLanguagePrompt(fromPhone, false);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            if (intent == Intent.SERVICES) {
                sendServicesMenu(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }
            
            if (intent == Intent.CANCEL_TOKEN || "btn_cancel_token".equals(buttonId) || "cancel".equalsIgnoreCase(cleanMessage) || "रद्द".equals(cleanMessage)) {
                if (activeToken != null) {
                    queueManagerService.updateTokenStatus(String.valueOf(activeToken.getId()), "cancelled");
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.tokenCancelled(lang, activeToken.displayTokenCode()));
                } else {
                    whatsAppService.sendWhatsAppMessage(fromPhone, botMessages.noActiveTokenToCancel(lang));
                }
                waSessionService.setStage(fromPhone, "ready");
                sendServicesMenu(fromPhone, lang);
                return ResponseEntity.ok("EVENT_RECEIVED");
            }

            // Fallback: If no intent or step matched, send services menu so the user always gets a reply
            log.info("ℹ️ No specific intent matched for '{}'. Sending services menu to {}.", cleanMessage, fromPhone);
            waSessionService.setStage(fromPhone, "ready");
            sendServicesMenu(fromPhone, lang);
            return ResponseEntity.ok("EVENT_RECEIVED");

        } catch (Exception e) {
            log.error("💥 Error processing Meta webhook message from {}", fromPhone, e);
        }
        return ResponseEntity.ok("EVENT_RECEIVED");
    }

    private void sendLanguagePrompt(String phone, boolean isGreeting) {
        String msg = isGreeting
                ? botMessages.greetingAndLanguagePrompt(appProperties.getClinicName())
                : botMessages.languageNotUnderstood();
        List<WaButton> buttons = List.of(
                new WaButton("btn_lang_en", "English"),
                new WaButton("btn_lang_hi", "हिंदी"),
                new WaButton("btn_lang_mr", "मराठी")
        );
        whatsAppService.sendButtonsMessage(phone, "", msg, buttons, appProperties.getClinicName());
    }

    private void sendWelcomeCard(String phone, Lang lang) {
        String title = botMessages.welcomeTitle(lang, appProperties.getClinicName());
        String body = botMessages.welcomeDescription(lang);
        whatsAppService.sendButtonsMessage(phone, title, body, botMessages.welcomeButtons(lang), appProperties.getClinicName());
    }

    private void sendServicesMenu(String phone, Lang lang) {
        whatsAppService.sendListMessage(
            phone,
            botMessages.servicesMenuTitle(lang),
            botMessages.servicesMenuDescription(lang),
            botMessages.servicesListSections(lang),
            appProperties.getClinicName(),
            switch(lang) {
                case EN -> "📋 Our Services";
                case HI -> "📋 हमारी सेवाएं";
                case MR -> "📋 आमच्या सेवा";
            }
        );
    }
    
    private void handleAppointmentService(String phone, Lang lang, TokenDto activeToken, List<FamilyMemberDto> members) {
        String title = switch(lang) { case EN -> "🏥 OPD APPOINTMENT"; case HI -> "🏥 ओपीडी अपॉइंटमेंट"; case MR -> "🏥 ओपीडी अपॉइंटमेंट"; };
        String body = switch(lang) { case EN -> "What would you like to do with your appointment?"; case HI -> "आप अपने अपॉइंटमेंट के साथ क्या करना चाहते हैं?"; case MR -> "तुम्हाला तुमच्या अपॉइंटमेंटचे काय करायचे आहे?"; };
        List<WaButton> btns = switch(lang) {
            case EN -> List.of(new WaButton("apt_book", "📅 Book"), new WaButton("apt_track", "📊 Track"));
            case HI -> List.of(new WaButton("apt_book", "📅 बुक करें"), new WaButton("apt_track", "📊 ट्रैक करें"));
            case MR -> List.of(new WaButton("apt_book", "📅 बुक करा"), new WaButton("apt_track", "📊 ट्रॅक करा"));
        };
        whatsAppService.sendButtonsMessage(phone, title, body, btns, appProperties.getClinicName());
    }
    
    private void handleFamilyAbhaService(String phone, Lang lang, List<FamilyMemberDto> members) {
        List<WaListRow> rows = new ArrayList<>();
        if (members != null) {
            for (FamilyMemberDto m : members) {
                String abha = Boolean.TRUE.equals(m.getIsAbhaLinked()) ? " · ABHA ✅" : " · ABHA ❌";
                String rel = m.getRelationship() != null && !m.getRelationship().equalsIgnoreCase("HEAD") ? m.getRelationship() : "Self";
                String age = m.getAge() != null ? m.getAge() + " yrs" : "";
                String title = "👤 " + truncateTitle(m.getName(), 18);
                String desc = rel + (age.isEmpty() ? "" : " · " + age) + abha;
                rows.add(new WaListRow("fam_manage_" + m.getId(), title, desc));
            }
        }
        String addTitle = switch(lang) { case EN -> "➕ Add New Member"; case HI -> "➕ नया सदस्य जोड़ें"; case MR -> "➕ नवीन सदस्य जोडा"; };
        rows.add(new WaListRow("fam_manage_new", addTitle, switch(lang) { case EN -> "Register a new family member"; case HI -> "नए परिवार सदस्य को पंजीकृत करें"; case MR -> "नवीन कुटुंब सदस्य नोंदवा"; }));
        String header = switch(lang) { case EN -> "👨‍👩‍👧 FAMILY & ABHA"; case HI -> "👨‍👩‍👧 परिवार और आभा"; case MR -> "👨‍👩‍👧 कुटुंब आणि आभा"; };
        String body = switch(lang) { case EN -> "Your linked family members. Select to manage ABHA or book appointment:"; case HI -> "आपके परिवार के सदस्य। ABHA प्रबंधन या अपॉइंटमेंट के लिए चुनें:"; case MR -> "तुमचे कुटुंब सदस्य. ABHA व्यवस्थापन किंवा अपॉइंटमेंटसाठी निवडा:"; };
        String btn = switch(lang) { case EN -> "👨‍👩‍👧 Manage Family"; case HI -> "👨‍👩‍👧 परिवार प्रबंधन"; case MR -> "👨‍👩‍👧 कुटुंब व्यवस्थापन"; };
        String section = switch(lang) { case EN -> "Your Family"; case HI -> "आपका परिवार"; case MR -> "तुमचे कुटुंब"; };
        whatsAppService.sendListMessage(phone, header, body, List.of(new WaListSection(section, rows)), appProperties.getClinicName(), btn);
    }
    
    private void handleHealthRecordsService(String phone, Lang lang) {
        waSessionService.setStage(phone, "in_records_submenu");
        String title = switch(lang) { case EN -> "💊 HEALTH RECORDS"; case HI -> "💊 स्वास्थ्य रिकॉर्ड"; case MR -> "💊 आरोग्य नोंदी"; };
        String body = switch(lang) { case EN -> "What would you like to do with your medical documents?"; case HI -> "आप अपने मेडिकल दस्तावेज़ों के साथ क्या करना चाहते हैं?"; case MR -> "तुम्हाला तुमच्या वैद्यकीय कागदपत्रांसह काय करायचे आहे?"; };
        List<WaButton> btns = switch(lang) {
            case EN -> List.of(new WaButton("rec_upload", "📤 Upload Doc"), new WaButton("rec_view", "👁️ View Records"));
            case HI -> List.of(new WaButton("rec_upload", "📤 अपलोड करें"), new WaButton("rec_view", "👁️ देखें"));
            case MR -> List.of(new WaButton("rec_upload", "📤 अपलोड करा"), new WaButton("rec_view", "👁️ पहा"));
        };
        whatsAppService.sendButtonsMessage(phone, title, body, btns, appProperties.getClinicName());
    }
    
    private void handleReferralsService(String phone, Lang lang) {
        String refUrl = buildAuthWebviewUrl("/wa/referrals.html", phone, Map.of());
        String title = switch(lang) { case EN -> "📋 REFERRAL FOLLOW-UPS"; case HI -> "📋 रेफरल फॉलो-अप"; case MR -> "📋 रेफरल फॉलो-अप"; };
        String body = switch(lang) { case EN -> "View your active and past referrals from doctors. Tap below to open your referral dashboard:"; case HI -> "डॉक्टरों के रेफरल देखें:"; case MR -> "डॉक्टरांचे रेफरल पहा:"; };
        String btn = switch(lang) { case EN -> "📋 Open Referrals"; case HI -> "📋 रेफरल देखें"; case MR -> "📋 रेफरल पहा"; };
        whatsAppService.sendUrlButtonMessage(phone, title, body, btn, refUrl, appProperties.getClinicName());
    }
    
    private void sendFamilySelectionList(String phone, Lang lang, List<FamilyMemberDto> members) {
        List<WaListRow> rows = new ArrayList<>();
        if (members != null) {
            for (FamilyMemberDto m : members) {
                String abha = Boolean.TRUE.equals(m.getIsAbhaLinked()) ? " · ABHA ✅" : "";
                String rel = m.getRelationship() != null && !m.getRelationship().equalsIgnoreCase("HEAD") ? m.getRelationship() : "Self";
                String age = m.getAge() != null ? m.getAge() + " yrs" : "";
                String title = "👤 " + truncateTitle(m.getName(), 18);
                String desc = rel + (age.isEmpty() ? "" : " · " + age) + abha;
                rows.add(new WaListRow("fam_" + m.getId(), title, desc));
            }
        }
        String addTitle = switch(lang) { case EN -> "➕ Add New Member"; case HI -> "➕ नया सदस्य जोड़ें"; case MR -> "➕ नवीन सदस्य जोडा"; };
        rows.add(new WaListRow("fam_new", addTitle, switch(lang) { case EN -> "Register a new family member"; case HI -> "नए परिवार सदस्य को पंजीकृत करें"; case MR -> "नवीन कुटुंब सदस्य नोंदवा"; }));
        String header = switch(lang) { case EN -> "👨‍👩‍👧 WHO IS THIS FOR?"; case HI -> "👨‍👩‍👧 यह किसके लिए है?"; case MR -> "👨‍👩‍👧 हे कोणासाठी आहे?"; };
        String body = switch(lang) { case EN -> "Choose a family member for the appointment:"; case HI -> "अपॉइंटमेंट के लिए परिवार का सदस्य चुनें:"; case MR -> "अपॉइंटमेंटसाठी कुटुंब सदस्य निवडा:"; };
        String btn = switch(lang) { case EN -> "👥 Select Member"; case HI -> "👥 सदस्य चुनें"; case MR -> "👥 सदस्य निवडा"; };
        String section = switch(lang) { case EN -> "Your Family"; case HI -> "आपका परिवार"; case MR -> "तुमचे कुटुंब"; };
        whatsAppService.sendListMessage(phone, header, body, List.of(new WaListSection(section, rows)), appProperties.getClinicName(), btn);
    }
    
    private void sendRecordsMemberSelectionList(String phone, Lang lang, List<FamilyMemberDto> members, String action) {
        List<WaListRow> rows = new ArrayList<>();
        String prefix = "rec_" + action + "_member_";
        if (members != null) {
            for (FamilyMemberDto m : members) {
                String title = "👤 " + truncateTitle(m.getName(), 20);
                String rel = m.getRelationship() != null && !m.getRelationship().equalsIgnoreCase("HEAD") ? m.getRelationship() : "Self";
                String age = m.getAge() != null ? m.getAge() + " yrs" : "";
                rows.add(new WaListRow(prefix + m.getId(), title, rel + (age.isEmpty() ? "" : " · " + age)));
            }
        }
        boolean isUpload = "upload".equals(action);
        String header = switch(lang) { case EN -> "💊 SELECT PATIENT"; case HI -> "💊 मरीज़ चुनें"; case MR -> "💊 रुग्ण निवडा"; };
        String body = isUpload 
            ? switch(lang){ case EN->"Whose document do you want to upload?"; case HI->"किसका दस्तावेज़ अपलोड करना है?"; case MR->"कोणाचे कागदपत्र अपलोड करायचे आहे?"; }
            : switch(lang){ case EN->"Whose records do you want to view?"; case HI->"किसके रिकॉर्ड देखने हैं?"; case MR->"कोणाचे रेकॉर्ड पहायचे आहेत?"; };
        String btn = switch(lang){ case EN->"💊 Select Patient"; case HI->"💊 मरीज़ चुनें"; case MR->"💊 रुग्ण निवडा"; };
        String section = switch(lang){ case EN->"Your Family"; case HI->"आपका परिवार"; case MR->"तुमचे कुटुंब"; };
        whatsAppService.sendListMessage(phone, header, body, List.of(new WaListSection(section, rows)), appProperties.getClinicName(), btn);
    }
    
    private String getDeptEmoji(String name) {
        String n = name.toLowerCase();
        if (n.contains("cardiac surgery") || n.contains("cardiac") || n.contains("cardio")) {
            if (n.contains("paediatric") || n.contains("child") || n.contains("infant")) return "👶";
            return n.contains("surgery") ? "🫀" : "❤️";
        }
        if (n.contains("gastrointestinal") || n.contains("laparoscopic") || n.contains("colorectal") || n.contains("general surgery")) return "🔪";
        if (n.contains("general medicine") || n.contains("internal medicine")) return "🩺";
        if (n.contains("family medicine")) return "👨‍👩‍👧";
        if (n.contains("orthopaedic") || n.contains("orthopedic")) return "🦴";
        if (n.contains("oncology") || n.contains("cancer")) return "🎗️";
        if (n.contains("neurology") || n.contains("neurosurgery") || n.contains("neuro")) return "🧠";
        if (n.contains("paediatric nephrology") || n.contains("paediatric") || n.contains("child") || n.contains("infant")) return "👶";
        if (n.contains("nephrology") || n.contains("nephro")) return "🫘";
        if (n.contains("urology") || n.contains("pulmonology")) return "🫁";
        if (n.contains("gastroenterology")) return "🫃";
        if (n.contains("endocrinology")) return "💉";
        if (n.contains("dermatology") || n.contains("skin")) return "✨";
        if (n.contains("psychiatry") || n.contains("psychology") || n.contains("counseling")) return "🧘";
        if (n.contains("ent") || n.contains("ear")) return "👂";
        if (n.contains("obstetrics") || n.contains("gynaecology") || n.contains("gynecology")) return "🌸";
        if (n.contains("fertility") || n.contains("ivf")) return "🌱";
        if (n.contains("ophthalmology") || n.contains("eye")) return "👁️";
        if (n.contains("dentistry") || n.contains("dental")) return "🦷";
        if (n.contains("physiotherapy")) return "💪";
        if (n.contains("nutrition") || n.contains("dietetics")) return "🥗";
        if (n.contains("bariatric")) return "⚖️";
        if (n.contains("hepatobiliary") || n.contains("pancreatic")) return "🟤";
        if (n.contains("rheumatology")) return "🦾";
        if (n.contains("hematology")) return "🩸";
        return "🩺";
    }
    
    private void sendDepartmentSelectionList(String phone, Lang lang, TokenDto token, String patientName) {
        String header = switch(lang) { case EN -> "🩺 SELECT HEALTH NEED"; case HI -> "🩺 स्वास्थ्य आवश्यकता चुनें"; case MR -> "🩺 आरोग्य गरज निवडा"; };
        String body = switch(lang) {
            case EN -> "For *" + (patientName != null ? patientName : "Patient") + "*:\nChoose from common health needs or tap 'All Departments':";
            case HI -> "*" + (patientName != null ? patientName : "मरीज़") + "* के लिए:\nसामान्य समस्या चुनें या 'सभी विभाग' पर टैप करें:";
            case MR -> "*" + (patientName != null ? patientName : "रुग्ण") + "* साठी:\nसामान्य समस्या निवडा किंवा 'सर्व विभाग' वर टॅप करा:";
        };
        String btn = switch(lang) { case EN -> "🩺 Choose Department"; case HI -> "🩺 विभाग चुनें"; case MR -> "🩺 विभाग निवडा"; };
        whatsAppService.sendListMessage(phone, header, body, botMessages.quickDepartmentSections(lang), appProperties.getClinicName(), btn);
    }

    private void sendAllDepartmentsPage(String phone, Lang lang, int pageIndex) {
        List<String> allCats = MedicalCategory.ALL;
        int total = allCats.size();
        int pageSize = 8;
        int totalPages = (int) Math.ceil((double) total / pageSize);
        if (pageIndex < 1) pageIndex = 1;
        if (pageIndex > totalPages) pageIndex = totalPages;

        int start = (pageIndex - 1) * pageSize;
        int end = Math.min(start + pageSize, total);

        List<WaListRow> rows = new ArrayList<>();
        for (int i = start; i < end; i++) {
            String cat = allCats.get(i);
            String emoji = getDeptEmoji(cat);
            String title = emoji + " " + truncateTitle(cat, 21);
            String desc = truncateTitle(cat, 60);
            rows.add(new WaListRow(QueueManagerService.DEPT_ROW_PREFIX + cat, title, desc));
        }

        if (pageIndex > 1) {
            String prevTitle = switch(lang) {
                case EN -> "◀️ Prev (" + (pageIndex - 1) + "/" + totalPages + ")";
                case HI -> "◀️ पिछला (" + (pageIndex - 1) + "/" + totalPages + ")";
                case MR -> "◀️ मागील (" + (pageIndex - 1) + "/" + totalPages + ")";
            };
            rows.add(new WaListRow("dept_page_" + (pageIndex - 1), prevTitle, switch(lang) {
                case EN -> "Previous specialties";
                case HI -> "पिछले विभाग देखें";
                case MR -> "मागील विभाग पहा";
            }));
        }
        if (pageIndex < totalPages) {
            String nextTitle = switch(lang) {
                case EN -> "▶️ Next (" + (pageIndex + 1) + "/" + totalPages + ")";
                case HI -> "▶️ अगला (" + (pageIndex + 1) + "/" + totalPages + ")";
                case MR -> "▶️ पुढील (" + (pageIndex + 1) + "/" + totalPages + ")";
            };
            rows.add(new WaListRow("dept_page_" + (pageIndex + 1), nextTitle, switch(lang) {
                case EN -> "More specialties";
                case HI -> "और विभाग देखें";
                case MR -> "आणखी विभाग पहा";
            }));
        }

        String sectionName = switch(lang) {
            case EN -> "Specialties (" + pageIndex + "/" + totalPages + ")";
            case HI -> "विभाग (पेज " + pageIndex + "/" + totalPages + ")";
            case MR -> "विभाग (पृष्ठ " + pageIndex + "/" + totalPages + ")";
        };

        String header = switch(lang) { case EN -> "🏥 ALL 33 DEPARTMENTS"; case HI -> "🏥 सभी ३३ विभाग"; case MR -> "🏥 सर्व ३३ विभाग"; };
        String body = switch(lang) {
            case EN -> "Page " + pageIndex + " of " + totalPages + " · Tap below to choose your specialty:";
            case HI -> "पेज " + pageIndex + " / " + totalPages + " · अपनी आवश्यक विशेषता चुनें:";
            case MR -> "पृष्ठ " + pageIndex + " / " + totalPages + " · तुमची वैद्यकीय शाखा निवडा:";
        };
        String btn = switch(lang) { case EN -> "🏥 Specialties"; case HI -> "🏥 विभाग सूची"; case MR -> "🏥 शाखा यादी"; };

        whatsAppService.sendListMessage(phone, header, body, List.of(new WaListSection(sectionName, rows)), appProperties.getClinicName(), btn);
    }
    
    private void redispatchStep(String phone, TokenDto token, Lang lang, List<FamilyMemberDto> members) {
        String step = token.getSessionStep();
        if (step == null) { sendServicesMenu(phone, lang); return; }
        switch (step) {
            case "awaiting_family_selection" -> sendFamilySelectionList(phone, lang, members);
            case "awaiting_department_selection" -> sendDepartmentSelectionList(phone, lang, token, token.getName());
            case "awaiting_location" -> sendLocationPrompt(phone, lang, token.getCategory());
            case "awaiting_hospital_selection" -> {
                HospitalService.HospitalSearchPage page = hospitalService.searchHospitals(
                        token.getCategory(), token.getGender(), token.getPatientLat(), token.getPatientLon(), 0, QueueManagerService.HOSPITAL_PAGE_SIZE);
                if (page != null && !page.results().isEmpty()) sendHospitalResultsList(phone, token, page, lang);
                else sendLocationPrompt(phone, lang, token.getCategory());
            }
            case "awaiting_confirmation" -> sendConfirmationCard(phone, token, lang);
            case "awaiting_new_member_name" -> whatsAppService.sendWhatsAppMessage(phone, botMessages.newMemberNamePrompt(lang));
            case "awaiting_new_member_rel" -> whatsAppService.sendWhatsAppMessage(phone, botMessages.newMemberRelationPrompt(lang));
            case "awaiting_new_member_gender" -> whatsAppService.sendButtonsMessage(phone, "", botMessages.genderPrompt(lang), botMessages.genderButtons(lang), appProperties.getClinicName());
            case "awaiting_new_member_age" -> whatsAppService.sendWhatsAppMessage(phone, botMessages.newMemberAgePrompt(lang));
            case "awaiting_name" -> whatsAppService.sendWhatsAppMessage(phone, botMessages.nameRegistrationPrompt(lang));
            case "awaiting_gender" -> sendGenderPrompt(phone, lang);
            case "awaiting_age" -> whatsAppService.sendWhatsAppMessage(phone, botMessages.agePrompt(lang));
            default -> sendServicesMenu(phone, lang);
        }
    }

    private void redispatchStage(String phone, String stage, Lang lang) {
        switch (stage) {
            case "in_records_submenu" -> handleHealthRecordsService(phone, lang);
            case "in_appointment_submenu" -> handleAppointmentService(phone, lang, null, null);
            default -> sendServicesMenu(phone, lang);
        }
    }
    
    private String truncateTitle(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private void sendGenderPrompt(String phone, Lang lang) {
        whatsAppService.sendButtonsMessage(phone, "", botMessages.genderPrompt(lang), botMessages.genderButtons(lang), appProperties.getClinicName());
    }

    private void sendLocationPrompt(String phone, Lang lang, String category) {
        String msg = botMessages.locationPrompt(lang);
        whatsAppService.sendWhatsAppMessage(phone, msg);

        String webviewUrl = buildAuthWebviewUrl("/wa/hospitals.html", phone, Map.of("category", category != null ? category : "General OPD"));
        whatsAppService.sendUrlButtonMessage(phone, botMessages.findHospitalLinkButtonText(lang),
                botMessages.findHospitalLinkPrompt(lang), "🌐 Search Here", webviewUrl, appProperties.getClinicName());
    }
    
    private boolean isOpdOpen(HospitalDto h) {
        if (h.getOpenTime() == null || h.getCloseTime() == null) return true;
        LocalTime now = LocalTime.now();
        LocalTime open = h.getOpenTime();
        LocalTime close = h.getCloseTime();
        if (close.isBefore(open)) {
            return now.isAfter(open) || now.isBefore(close);
        }
        return now.isAfter(open) && now.isBefore(close);
    }
    
    private String hospitalEmoji(String name) {
        if (name == null) return "🏥";
        String n = name.toLowerCase();
        if (n.contains("government") || n.contains("govt") || n.contains("civil") || n.contains("district") || n.contains("pmc") || n.contains("municipal")) return "🏛️";
        if (n.contains("clinic") || n.contains("polyclinic") || n.contains("dispensary")) return "🏪";
        if (n.contains("maternity") || n.contains("women") || n.contains("mahila")) return "🌸";
        if (n.contains("children") || n.contains("child") || n.contains("paediatric") || n.contains("bal")) return "👶";
        if (n.contains("eye") || n.contains("optic") || n.contains("netra")) return "👁️";
        if (n.contains("heart") || n.contains("cardiac") || n.contains("cardio")) return "❤️";
        if (n.contains("cancer") || n.contains("oncology")) return "🎗️";
        if (n.contains("community") || n.contains("rural") || n.contains("primary") || n.contains("phc")) return "🌿";
        return "🏥";
    }

    private void sendHospitalResultsList(String phone, TokenDto draft, HospitalService.HospitalSearchPage page, Lang lang) {
        List<WaListRow> rows = new ArrayList<>();
        List<HospitalService.HospitalMatch> results = page.results();
        int limit = Math.min(results.size(), 9); // max 9 + possibly 1 show more row
        for (int i = 0; i < limit; i++) {
            HospitalService.HospitalMatch hm = results.get(i);
            HospitalDto h = hm.hospital();
            String emoji = hospitalEmoji(h.getName());
            String title = emoji + " " + truncateTitle(h.getName(), 18);
            boolean opdOpen = isOpdOpen(h);
            String status = opdOpen ? "Open ✅" : "Closed ❌";
            String desc = String.format("%.1f", hm.distanceKm()) + " km · " + status;
            rows.add(new WaListRow("hosp_" + h.getId(), title, desc));
        }
        if (page.hasMore()) {
            String moreTitle = switch(lang) { case EN -> "➕ Show More"; case HI -> "➕ और देखें"; case MR -> "➕ आणखी पहा"; };
            rows.add(new WaListRow("show_more", moreTitle, switch(lang) { case EN -> "Next 10 hospitals"; case HI -> "अगले 10 अस्पताल"; case MR -> "पुढील 10 रुग्णालये"; }));
        }
        String header = switch(lang) { case EN -> "🏥 HOSPITALS NEAR YOU"; case HI -> "🏥 पास के अस्पताल"; case MR -> "🏥 जवळची रुग्णालये"; };
        String body = switch(lang) {
            case EN -> "Hospitals offering *" + draft.getCategory() + "* near you:\nTap below to select:";
            case HI -> "*" + draft.getCategory() + "* के लिए पास के अस्पताल:\nचुनने के लिए नीचे टैप करें:";
            case MR -> "*" + draft.getCategory() + "* साठी जवळची रुग्णालये:\nनिवडण्यासाठी खाली टॅप करा:";
        };
        String btn = switch(lang) { case EN -> "🏥 Hospitals"; case HI -> "🏥 अस्पताल"; case MR -> "🏥 रुग्णालये"; };
        String section = switch(lang) { case EN -> "Nearby Hospitals"; case HI -> "पास के अस्पताल"; case MR -> "जवळची रुग्णालये"; };
        whatsAppService.sendListMessage(phone, header, body, List.of(new WaListSection(section, rows)), appProperties.getClinicName(), btn);
        
        String webviewUrl = buildAuthWebviewUrl("/wa/hospitals.html", phone,
                Map.of("category", draft.getCategory() != null ? draft.getCategory() : "General OPD",
                       "lat", draft.getPatientLat() != null ? String.valueOf(draft.getPatientLat()) : "",
                       "lon", draft.getPatientLon() != null ? String.valueOf(draft.getPatientLon()) : ""));
        whatsAppService.sendUrlButtonMessage(phone, switch(lang){case EN->"📱 Map View";case HI->"📱 नक्शा देखें";case MR->"📱 नकाशा पहा";},
                switch(lang){case EN->"Prefer browsing on interactive map?";case HI->"क्या आप इंटरेक्टिव मैप पर देखना चाहते हैं?";case MR->"तुम्हाला परस्पर नकाशावर पाहायचे आहे का?";},
                switch(lang){case EN->"🌐 Open Map";case HI->"🌐 मैप खोलें";case MR->"🌐 नकाशा उघडा";},
                webviewUrl, appProperties.getClinicName());
    }

    private boolean isShowMoreCommand(String cleanMessage) {
        return cleanMessage.contains("more") || cleanMessage.contains("और") || cleanMessage.contains("आणखी") || cleanMessage.contains("+");
    }

    private void sendConfirmationCard(String phone, TokenDto token, Lang lang) {
        HospitalDto hospital = token.getHospitalId() != null ? hospitalService.getById(token.getHospitalId()) : null;
        String hospName = hospital != null ? hospital.getName() : "Hospital";
        String address = hospital != null && hospital.getAddress() != null ? hospital.getAddress() : "";
        double distKm = token.getPatientLat() != null && token.getPatientLon() != null && hospital != null && hospital.getLatitude() != null && hospital.getLongitude() != null
                ? geoDistanceService.distanceKm(token.getPatientLat(), token.getPatientLon(), hospital.getLatitude(), hospital.getLongitude())
                : 0.0;

        List<WaButton> buttons = List.of(
            new WaButton("btn_confirm_booking", switch(lang) {
                case EN -> "🟢 Confirm";
                case HI -> "🟢 पुष्टि करें";
                case MR -> "🟢 पुष्टी करा";
            }),
            new WaButton("btn_choose_again", switch(lang) {
                case EN -> "🔴 Choose Again";
                case HI -> "🔴 फिर से चुनें";
                case MR -> "🔴 पुन्हा निवडा";
            }),
            new WaButton("btn_go_back", switch(lang) {
                case EN -> "⬅️ Back";
                case HI -> "⬅️ वापस";
                case MR -> "⬅️ मागे";
            })
        );

        String header = switch(lang) {
            case EN -> "🏥 CONFIRM APPOINTMENT";
            case HI -> "🏥 अपॉइंटमेंट पुष्टि";
            case MR -> "🏥 अपॉइंटमेंट पुष्टी";
        };
        String patientName = token.getName() != null && !token.getName().isBlank() ? token.getName() : (switch(lang){case EN->"Self";case HI->"स्वयं";case MR->"स्वतः";});
        String body = switch(lang) {
            case EN -> "👤 *Patient:* " + patientName +
                       "\n🩺 *Specialty:* " + token.getCategory() +
                       "\n🏥 *Hospital:* " + hospName +
                       (distKm > 0 ? "\n📍 *Distance:* " + String.format("%.1f", distKm) + " km" : "") +
                       (!address.isBlank() ? "\n🏢 " + address : "");
            case HI -> "👤 *मरीज़:* " + patientName +
                       "\n🩺 *विशेषता:* " + token.getCategory() +
                       "\n🏥 *अस्पताल:* " + hospName +
                       (distKm > 0 ? "\n📍 *दूरी:* " + String.format("%.1f", distKm) + " किमी" : "") +
                       (!address.isBlank() ? "\n🏢 " + address : "");
            case MR -> "👤 *रुग्ण:* " + patientName +
                       "\n🩺 *विभाग:* " + token.getCategory() +
                       "\n🏥 *रुग्णालय:* " + hospName +
                       (distKm > 0 ? "\n📍 *अंतर:* " + String.format("%.1f", distKm) + " किमी" : "") +
                       (!address.isBlank() ? "\n🏢 " + address : "");
        };

        whatsAppService.sendButtonsMessage(phone, header, body, buttons, appProperties.getClinicName());
    }
    
    private void sendBookingConfirmedCard(String phone, TokenDto token, Lang lang) {
        HospitalDto hospital = token.getHospitalId() != null ? hospitalService.getById(token.getHospitalId()) : null;
        String hospitalName = hospital != null ? hospital.getName() : "Hospital";
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int waitMins = peopleAhead * appProperties.getAvgServiceMinutes();
        String status = token.getStatus() != null ? token.getStatus() : "waiting";
        String today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("EEE, dd MMM yyyy"));
        
        String card = buildBookingCard(lang, token.getName(), token.getAge(), token.getGender(),
                hospitalName, token.getCategory(), token.displayTokenCode(),
                peopleAhead, waitMins, status, today);
        
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String liveUrl = buildAuthWebviewUrl("/wa/track.html", phone, Map.of("key", cleanPhone, "tokenId", String.valueOf(token.getId())));
        String slipUrl = buildAuthWebviewUrl("/wa/response.html", phone, Map.of("key", cleanPhone));
        
        whatsAppService.sendWhatsAppMessage(phone, card + "\n\n" + switch(lang){case EN->"📄 *Booking Slip:* "+slipUrl;case HI->"📄 *बुकिंग पर्ची:* "+slipUrl;case MR->"📄 *बुकिंग स्लिप:* "+slipUrl;});
        whatsAppService.sendUrlButtonMessage(phone,
                switch(lang){case EN->"📊 Live Queue Tracker";case HI->"📊 लाइव कतार ट्रैकर";case MR->"📊 थेट रांग ट्रॅकर";},
                switch(lang){case EN->"Tap to watch your live queue position in real-time:";case HI->"अपनी लाइव कतार स्थिति देखने के लिए टैप करें:";case MR->"तुमची थेट रांग स्थिती पाहण्यासाठी टॅप करा:";},
                botMessages.liveTrackerButtonText(lang), liveUrl, appProperties.getClinicName());
        whatsAppService.sendButtonsMessage(phone, "", botMessages.quickActionsFooter(lang), botMessages.quickActionButtons(lang), appProperties.getClinicName());
    }

    private String buildBookingCard(Lang lang, String name, Integer age, String gender, String hospitalName, String category, String tokenCode, int ahead, int waitMins, String status, String today) {
        String div = "━━━━━━━━━━━━━━━━━━━━━━";
        String genderStr = gender == null ? "" : switch(lang) {
            case EN -> switch(gender.toUpperCase()) { case "M" -> "M"; case "F" -> "F"; default -> gender; };
            case HI -> switch(gender.toUpperCase()) { case "M" -> "पु"; case "F" -> "म"; default -> "अ"; };
            case MR -> switch(gender.toUpperCase()) { case "M" -> "पु"; case "F" -> "स्त्री"; default -> "इ"; };
        };
        String ageGender = (age != null ? age + " yrs" : "") + (genderStr.isEmpty() ? "" : " · " + genderStr);
        boolean isReserved = "reserved".equals(status);
        String statusStr = isReserved
                ? switch(lang){case EN->"🟡 Reserved Buffer (Head to Hospital)";case HI->"🟡 बफर अवधि (अस्पताल के लिए निकलें)";case MR->"🟡 बफर कालावधी (रुग्णालयासाठी निघा)";}
                : switch(lang){case EN->"🔵 Waiting in Queue";case HI->"🔵 कतार में प्रतीक्षारत";case MR->"🔵 रांगेत प्रतीक्षेत";};
        
        return switch(lang) {
            case EN -> div + "\n" +
                    "🎫  *APPOINTMENT CONFIRMED!*\n" +
                    div + "\n\n" +
                    "👥  *Patients Ahead:* " + ahead + " ahead of you\n" +
                    "⏳  *Status:*         " + statusStr + "\n" +
                    "🕐  *Est. Wait:*       ~" + waitMins + (waitMins == 1 ? " min" : " mins") + "\n\n" +
                    div + "\n" +
                    "🎟️  *Token Code:*     #" + tokenCode + "\n" +
                    "👤  *Patient:*        " + name + (ageGender.isEmpty() ? "" : " (" + ageGender + ")") + "\n" +
                    "🏥  *Hospital:*       " + hospitalName + "\n" +
                    "🩺  *Department:*     " + (category != null ? category : "General OPD") + "\n" +
                    "🗓️  *Date:*           " + today + "\n\n" +
                    div + "\n" +
                    (isReserved
                        ? "🚗  *ACTION REQUIRED:* Please head to the hospital immediately! Check in at reception on arrival for priority service.\n"
                        : "📍  _Report to the OPD Reception on arrival._\n💡  _You'll receive a call & notification when your turn approaches._");
            case HI -> div + "\n" +
                    "🎫  *अपॉइंटमेंट पुष्ट हुआ!*\n" +
                    div + "\n\n" +
                    "👥  *आगे मरीज़:*      " + ahead + " लोग आगे हैं\n" +
                    "⏳  *स्थिति:*          " + statusStr + "\n" +
                    "🕐  *अनुमानित समय:*   ~" + waitMins + " मिनट\n\n" +
                    div + "\n" +
                    "🎟️  *टोकन कोड:*       #" + tokenCode + "\n" +
                    "👤  *मरीज़:*           " + name + (ageGender.isEmpty() ? "" : " (" + ageGender + ")") + "\n" +
                    "🏥  *अस्पताल:*        " + hospitalName + "\n" +
                    "🩺  *विभाग:*          " + (category != null ? category : "सामान्य ओपीडी") + "\n" +
                    "🗓️  *तारीख:*          " + today + "\n\n" +
                    div + "\n" +
                    (isReserved
                        ? "🚗  *तत्काल कार्रवाई:* कृपया तुरंत अस्पताल के लिए निकलें! प्राथमिकता सेवा के लिए रिसेप्शन पर चेक-इन करें।\n"
                        : "📍  _आगमन पर ओपीडी रिसेप्शन पर रिपोर्ट करें।_\n💡  _बारी पास आने पर आपको कॉल और सूचना मिलेगी।_");
            case MR -> div + "\n" +
                    "🎫  *अपॉइंटमेंट निश्चित!*\n" +
                    div + "\n\n" +
                    "👥  *पुढे रुग्ण:*        " + ahead + " जण पुढे आहेत\n" +
                    "⏳  *स्थिती:*          " + statusStr + "\n" +
                    "🕐  *अंदाजे वेळ:*      ~" + waitMins + " मिनिटे\n\n" +
                    div + "\n" +
                    "🎟️  *टोकन कोड:*       #" + tokenCode + "\n" +
                    "👤  *रुग्ण:*           " + name + (ageGender.isEmpty() ? "" : " (" + ageGender + ")") + "\n" +
                    "🏥  *रुग्णालय:*        " + hospitalName + "\n" +
                    "🩺  *विभाग:*          " + (category != null ? category : "सामान्य ओपीडी") + "\n" +
                    "🗓️  *तारीख:*          " + today + "\n\n" +
                    div + "\n" +
                    (isReserved
                        ? "🚗  *तातडीने कृती:* कृपया ताबडतोब रुग्णालयासाठी निघा! प्राधान्य सेवेसाठी रिसेप्शनवर चेक-इन करा.\n"
                        : "📍  _आगमनावर ओपीडी रिसेप्शनला रिपोर्ट करा._\n💡  _पाळी जवळ आल्यावर तुम्हाला कॉल आणि मेसेज येईल._");
        };
    }

    private void sendHospitalProfile(String phone, HospitalDto hospital, double distanceKm, Lang lang) {
        String address = hospital.getAddress() != null ? hospital.getAddress() : "Address not provided";
        String msg = switch (lang) {
            case EN -> "🏥 *" + hospital.getName() + "*\n📍 " + address + "\n📏 ~" + String.format("%.1f", distanceKm) + " km away\n\nType *1* to book here, or *back* to return to the list.";
            case HI -> "🏥 *" + hospital.getName() + "*\n📍 " + address + "\n📏 ~" + String.format("%.1f", distanceKm) + " किमी दूर\n\nयहां बुक करने के लिए *1* लिखें, या सूची में लौटने के लिए *back* लिखें।";
            case MR -> "🏥 *" + hospital.getName() + "*\n📍 " + address + "\n📏 ~" + String.format("%.1f", distanceKm) + " किमी दूर\n\nयेथे बुक करण्यासाठी *1* लिहा, किंवा सूचीत परतण्यासाठी *back* लिहा.";
        };
        whatsAppService.sendWhatsAppMessage(phone, msg);
    }

    private void sendTokenDashboardCard(String phone, TokenDto token, Lang lang) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;
        String statusBadge = botMessages.statusBadge(lang, token.getStatus());

        String liveUrl = buildAuthWebviewUrl("/wa/track.html", phone, java.util.Map.of("key", cleanPhone, "tokenId", String.valueOf(token.getId())));
        String slipUrl = buildAuthWebviewUrl("/wa/response.html", phone, java.util.Map.of("key", cleanPhone));

        String title = botMessages.dashboardTitle(lang, token.displayTokenCode());
        String currentServing = token.getCurrentServing() != null ? String.valueOf(token.getCurrentServing()) : "--";
        String description = botMessages.dashboardDescription(lang, token.getName(), token.getAge(), statusBadge, token.displayTokenCode(), peopleAhead, estWait, currentServing)
                + "\n\n📄 *Digital Booking Slip:* " + slipUrl;

        whatsAppService.sendUrlButtonMessage(phone, title, description, botMessages.liveTrackerButtonText(lang), liveUrl, appProperties.getClinicName());
        whatsAppService.sendButtonsMessage(phone, "", botMessages.quickActionsFooter(lang), botMessages.quickActionButtons(lang), appProperties.getClinicName());
    }

    private void sendStatusCard(String phone, TokenDto token, Lang lang) {
        if (token == null || "registering_name".equals(token.getStatus())) {
            whatsAppService.sendWhatsAppMessage(phone, botMessages.noActiveTokenFound(lang));
            return;
        }
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String positionText = String.valueOf(token.getQueuePosition() != null ? token.getQueuePosition() : (token.getPosition() != null ? token.getPosition() : 1));
        int avgServiceTime = appProperties.getAvgServiceMinutes();
        int peopleAhead = token.getPeopleAhead() != null ? token.getPeopleAhead() : 0;
        int estWait = peopleAhead * avgServiceTime;

        String liveUrl = buildAuthWebviewUrl("/wa/track.html", phone, java.util.Map.of("key", cleanPhone, "tokenId", String.valueOf(token.getId())));

        String title = botMessages.statusTitle(lang);
        String currentServing = token.getCurrentServing() != null ? String.valueOf(token.getCurrentServing()) : "--";
        String description = botMessages.statusDescription(lang, token.displayTokenCode(), token.getName(), token.getAge(), positionText, peopleAhead, estWait, token.getStatus(), currentServing);

        whatsAppService.sendUrlButtonMessage(phone, title, description, botMessages.liveTrackerButtonText(lang), liveUrl, appProperties.getClinicName());
    }

    private boolean isTerminal(TokenDto token) {
        return token == null || "completed".equals(token.getStatus()) || "missed".equals(token.getStatus());
    }

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

        // Support 6-digit Indian Postal PIN Code (e.g. 411001, 413501)
        java.util.regex.Pattern pinPattern = java.util.regex.Pattern.compile(".*\\b([1-9][0-9]{5})\\b.*");
        java.util.regex.Matcher pinMatcher = pinPattern.matcher(candidate);
        if (pinMatcher.find()) {
            String pin = pinMatcher.group(1);
            List<HospitalDto> hospitals = hospitalService.list();
            for (HospitalDto h : hospitals) {
                if (h.getAddress() != null && h.getAddress().contains(pin)) {
                    return new SetLocationRequest(null, h.getLatitude(), h.getLongitude());
                }
            }
            HospitalDto op = hospitalService.getOperatingHospital();
            if (op != null && op.getLatitude() != null && op.getLongitude() != null) {
                return new SetLocationRequest(null, op.getLatitude(), op.getLongitude());
            }
        }

        // Support town, city, district name or words like "civil", "district", "main", "near"
        String lower = candidate.toLowerCase();
        List<HospitalDto> hospitals = hospitalService.list();
        for (HospitalDto h : hospitals) {
            if ((h.getName() != null && h.getName().toLowerCase().contains(lower)) ||
                (h.getAddress() != null && h.getAddress().toLowerCase().contains(lower))) {
                return new SetLocationRequest(null, h.getLatitude(), h.getLongitude());
            }
        }

        if (lower.contains("near") || lower.contains("civil") || lower.contains("district") || lower.contains("hospital") || lower.contains("main") || lower.contains("पास")) {
            HospitalDto op = hospitalService.getOperatingHospital();
            if (op != null && op.getLatitude() != null && op.getLongitude() != null) {
                return new SetLocationRequest(null, op.getLatitude(), op.getLongitude());
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
}
