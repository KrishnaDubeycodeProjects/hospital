package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Places the "your token is about to be called, head to the hospital now"
 * voice call, via Twilio's plain Voice Calls API
 * (https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Calls.json) with
 * inline TwiML (a "Twiml" param, not a Url/Studio Flow) -- plain REST
 * (RestTemplate + Basic Auth), same pattern as OtpService's Twilio Verify/
 * Messages calls, rather than pulling in the Twilio Java SDK for one
 * endpoint. No Studio Flow or public callback URL needed: the TwiML
 * (a <Say> of the message text) is handed to Twilio directly in the
 * request, so Account SID + Auth Token + caller number is enough.
 *
 * Fired alongside the WhatsApp notification from
 * QueueManagerService#runTreatmentTimingTick -- both channels, same
 * trigger, same moment.
 *
 * No-ops (logs and returns) rather than dialing anyone when calling is
 * disabled or the caller number isn't configured -- mirrors OtpService's
 * "fails cleanly on dummy credentials" default, so a fresh checkout never
 * places a real phone call.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TwilioStudioCallService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;

    private boolean isConfigured() {
        if (!appProperties.isTwilioCallEnabled()) {
            return false;
        }
        String caller = appProperties.getTwilioCallerNumber();
        return caller != null && !caller.isBlank();
    }

    /**
     * Places the "your token is about to be called, head to the hospital now" voice call
     * with clean natural spoken prompt (without raw emojis or markdown).
     */
    @Async("callExecutor")
    public void triggerHeadToHospitalCall(String toPhone, String patientName, String tokenCode,
                                          String department, String hospital, int peopleAhead, Lang lang) {
        String spokenMessage = buildSpokenMessage(patientName, tokenCode, department, hospital, peopleAhead, lang);
        triggerHeadToHospitalCall(toPhone, spokenMessage, lang);
    }

    /** Fire-and-forget: never blocks or fails the caller's request thread on a slow/unreachable Twilio. */
    @Async("callExecutor")
    public void triggerHeadToHospitalCall(String toPhone, String message, Lang lang) {
        if (!isConfigured()) {
            log.info("📵 Twilio call skipped for {} (calling disabled or caller number not configured).",
                    formatE164Phone(toPhone));
            return;
        }
        String e164ToPhone = formatE164Phone(toPhone);
        if (e164ToPhone.isEmpty()) {
            log.warn("⚠️ Cannot place Twilio call: invalid phone number: {}", toPhone);
            return;
        }
        try {
            String url = "https://api.twilio.com/2010-04-01/Accounts/%s/Calls.json"
                    .formatted(appProperties.getTwilioAccountSid());

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("To", e164ToPhone);
            body.add("From", appProperties.getTwilioCallerNumber());
            String twiml = buildTwiml(message, lang);
            String twimletUrl = "https://twimlets.com/echo?Twiml=" + URLEncoder.encode(twiml, StandardCharsets.UTF_8);
            body.add("Url", twimletUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(appProperties.getTwilioAccountSid(), appProperties.getTwilioAuthToken());

            restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            log.info("📞 Twilio voice call successfully placed to {}", e164ToPhone);
        } catch (RestClientException e) {
            log.error("❌ Twilio Call error for {}: {}", e164ToPhone, extractError(e));
        } catch (Exception e) {
            log.error("❌ Could not trigger Twilio call for {}: {}", e164ToPhone, e.getMessage());
        }
    }

    /**
     * Generates a clean, human-friendly spoken text for text-to-speech.
     */
    public String buildSpokenMessage(String patientName, String tokenCode, String department, String hospital, int peopleAhead, Lang lang) {
        String pName = (patientName != null && !patientName.isBlank() && !"Patient".equalsIgnoreCase(patientName))
                ? patientName : "Patient";
        String dept = (department != null && !department.isBlank()) ? department : "OPD";
        String hosp = (hospital != null && !hospital.isBlank()) ? hospital : "Hospital";
        String code = (tokenCode != null && !tokenCode.isBlank()) ? tokenCode.replace("AF-", "") : "";

        return switch (lang != null ? lang : Lang.EN) {
            case HI -> String.format(
                    "नमस्ते %s। आरोग्यफ़्लो से सूचना। %s के %s विभाग में आपका टोकन नंबर %s जल्द ही बुलाया जाने वाला है। आपके आगे %d मरीज़ हैं। कृपया तुरंत अस्पताल के लिए प्रस्थान करें। धन्यवाद।",
                    pName, hosp, dept, code, peopleAhead);
            case MR -> String.format(
                    "नमस्कार %s. आरोग्यफ्लो कडून सूचना. %s च्या %s विभागामध्ये तुमचा टोकन क्रमांक %s लवकरच पुकारला जाईल. तुमच्या पुढे %d रुग्ण आहेत. कृपया त्वरित रुग्णालयासाठी निघा. धन्यवाद.",
                    pName, hosp, dept, code, peopleAhead);
            case EN -> String.format(
                    "Hello %s. This is an automated update from AarogyaFlow. Your token number %s for %s at %s is ready soon. There are %d patients ahead of you. Please head to the hospital now. Thank you.",
                    pName, code, dept, hosp, peopleAhead);
        };
    }

    /** Twilio TTS locale for <Say>; Marathi has no dedicated classic voice, so it falls back to Hindi. */
    private String sayLanguage(Lang lang) {
        if (lang == Lang.HI || lang == Lang.MR) {
            return "hi-IN";
        }
        return "en-IN";
    }

    private String buildTwiml(String message, Lang lang) {
        // Strip markdown asterisks, hashes, and non-spoken characters
        String cleanMessage = message == null ? "" : message
                .replaceAll("[*#_~`]", "")
                .replaceAll("[\\uD83C-\\uDBFF\\uDC00-\\uDFFF]+", "") // strip emojis
                .trim();

        String escaped = cleanMessage
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");

        String language = sayLanguage(lang);
        return String.format(
                "<Response><Pause length=\"1\"/><Say language=\"%s\">%s</Say><Pause length=\"2\"/><Say language=\"%s\">%s</Say></Response>",
                language, escaped, language, escaped);
    }

    private String formatE164Phone(String phone) {
        if (phone == null) return "";
        String clean = phone.replaceAll("[^0-9+]", "");
        if (clean.startsWith("+")) return clean;
        if (clean.length() == 10) return "+91" + clean;
        if (clean.length() == 12 && clean.startsWith("91")) return "+" + clean;
        return "+" + clean;
    }

    private String extractError(RestClientException e) {
        if (e instanceof HttpStatusCodeException hsce) {
            return hsce.getStatusCode() + " " + hsce.getResponseBodyAsString();
        }
        return e.getMessage();
    }
}

