package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Places automated voice calls via Twilio Voice API.
 * - triggerBookingConfirmationCall: Spoken confirmation immediately at appointment booking
 *   (with special immediate prompt if patient is #1 in line / 0 people ahead).
 * - triggerHeadToHospitalCall: Spoken "head to the hospital now" prompt when patient's turn is near.
 *
 * In serverless environments like AWS Lambda, background threads are frozen when the HTTP handler
 * returns, so calls are executed synchronously before Lambda pauses the container.
 */
@Service
@Slf4j
public class TwilioStudioCallService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;
    private final Executor callExecutor;

    public TwilioStudioCallService(
            AppProperties appProperties,
            RestTemplate restTemplate,
            @Qualifier("callExecutor") Executor callExecutor) {
        this.appProperties = appProperties;
        this.restTemplate = restTemplate;
        this.callExecutor = callExecutor;
    }

    private boolean isConfigured() {
        if (!appProperties.isTwilioCallEnabled()) {
            return false;
        }
        String caller = appProperties.getTwilioCallerNumber();
        return caller != null && !caller.isBlank();
    }

    /**
     * Places the booking confirmation voice call notifying the patient that their appointment has been booked.
     * If peopleAhead == 0 (first in line), instructs them to head to hospital immediately!
     */
    public void triggerBookingConfirmationCall(String toPhone, String patientName, String tokenCode,
                                               String department, String hospital, int peopleAhead, Lang lang) {
        String spokenMessage = buildBookingSpokenMessage(patientName, tokenCode, department, hospital, peopleAhead, lang);
        triggerCall(toPhone, spokenMessage, lang);
    }

    public void triggerBookingConfirmationCall(String toPhone, String patientName, String tokenCode,
                                               String department, String hospital, Lang lang) {
        triggerBookingConfirmationCall(toPhone, patientName, tokenCode, department, hospital, 0, lang);
    }

    /**
     * Places the "your token is about to be called, head to the hospital now" voice call
     * with clean natural spoken prompt (without raw emojis or markdown).
     */
    public void triggerHeadToHospitalCall(String toPhone, String patientName, String tokenCode,
                                          String department, String hospital, int peopleAhead, Lang lang) {
        String spokenMessage = buildHeadToHospitalSpokenMessage(patientName, tokenCode, department, hospital, peopleAhead, lang);
        triggerCall(toPhone, spokenMessage, lang);
    }

    public void triggerHeadToHospitalCall(String toPhone, String message, Lang lang) {
        triggerCall(toPhone, message, lang);
    }

    /**
     * Dispatches the call. In serverless AWS Lambda, background thread pools are frozen
     * when the handler returns, so outbound API calls are run synchronously before container pause.
     */
    public void triggerCall(String toPhone, String message, Lang lang) {
        if (!isConfigured()) {
            log.info("📵 Twilio call skipped for {} (calling disabled or caller number not configured).",
                    formatE164Phone(toPhone));
            return;
        }

        if (System.getenv("AWS_LAMBDA_FUNCTION_NAME") != null) {
            doPlaceCall(toPhone, message, lang);
            return;
        }

        callExecutor.execute(() -> doPlaceCall(toPhone, message, lang));
    }

    private void doPlaceCall(String toPhone, String message, Lang lang) {
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

            ResponseEntity<Map> resp = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            log.info("📞 Twilio voice call placed successfully to {} (status: {}, sid: {})",
                    e164ToPhone, resp.getStatusCode(), resp.getBody() != null ? resp.getBody().get("sid") : "n/a");
        } catch (RestClientException e) {
            log.error("❌ Twilio Call error for {}: {}", e164ToPhone, extractError(e));
        } catch (Exception e) {
            log.error("❌ Could not trigger Twilio call for {}: {}", e164ToPhone, e.getMessage());
        }
    }

    /**
     * Generates a clean, human-friendly spoken text for booking confirmation.
     * Specially tailored if peopleAhead <= 0 (Number 1 / first in line).
     */
    public String buildBookingSpokenMessage(String patientName, String tokenCode, String department, String hospital, int peopleAhead, Lang lang) {
        String pName = (patientName != null && !patientName.isBlank() && !"Patient".equalsIgnoreCase(patientName))
                ? patientName : "Patient";
        String dept = (department != null && !department.isBlank()) ? department : "OPD";
        String hosp = (hospital != null && !hospital.isBlank()) ? hospital : "Hospital";
        String code = (tokenCode != null && !tokenCode.isBlank()) ? tokenCode.replace("AF-", "") : "";

        if (peopleAhead <= 0) {
            return switch (lang != null ? lang : Lang.EN) {
                case HI -> String.format(
                        "नमस्ते %s। आरोग्यफ़्लो से सूचना। %s के %s विभाग में आपकी अपॉइंटमेंट की पुष्टि हो गई है। आपका टोकन नंबर %s है, और आप कतार में पहले स्थान पर हैं! कृपया तुरंत अस्पताल के लिए प्रस्थान करें। धन्यवाद।",
                        pName, hosp, dept, code);
                case MR -> String.format(
                        "नमस्कार %s. आरोग्यफ्लो कडून सूचना. %s च्या %s विभागासाठी तुमची अपॉइंटमेंट निश्चित झाली आहे. तुमचा टोकन क्रमांक %s आहे, आणि तुम्ही रांगेत पहिल्या क्रमांकावर आहात! कृपया त्वरित रुग्णालयासाठी निघा. धन्यवाद.",
                        pName, hosp, dept, code);
                case EN -> String.format(
                        "Hello %s. Your appointment at %s for %s has been confirmed. Your token number is %s, and you are first in line! Please head to the hospital now. Thank you.",
                        pName, hosp, dept, code);
            };
        }

        return switch (lang != null ? lang : Lang.EN) {
            case HI -> String.format(
                    "नमस्ते %s। आरोग्यफ़्लो से सूचना। %s के %s विभाग में आपकी अपॉइंटमेंट की पुष्टि हो गई है। आपका टोकन नंबर %s है। आपके आगे %d मरीज़ हैं। धन्यवाद।",
                    pName, hosp, dept, code, peopleAhead);
            case MR -> String.format(
                    "नमस्कार %s. आरोग्यफ्लो कडून सूचना. %s च्या %s विभागासाठी तुमची अपॉइंटमेंट निश्चित झाली आहे. तुमचा टोकन क्रमांक %s आहे. तुमच्या पुढे %d रुग्ण आहेत. धन्यवाद.",
                    pName, hosp, dept, code, peopleAhead);
            case EN -> String.format(
                    "Hello %s. This is an automated update from AarogyaFlow. Your appointment at %s for %s has been confirmed. Your token number is %s. There are %d patients ahead of you. Thank you.",
                    pName, hosp, dept, code, peopleAhead);
        };
    }

    public String buildBookingSpokenMessage(String patientName, String tokenCode, String department, String hospital, Lang lang) {
        return buildBookingSpokenMessage(patientName, tokenCode, department, hospital, 0, lang);
    }

    /**
     * Generates a clean, human-friendly spoken text for text-to-speech when heading to hospital.
     */
    public String buildHeadToHospitalSpokenMessage(String patientName, String tokenCode, String department, String hospital, int peopleAhead, Lang lang) {
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

    /** Backwards-compatible alias for buildHeadToHospitalSpokenMessage */
    public String buildSpokenMessage(String patientName, String tokenCode, String department, String hospital, int peopleAhead, Lang lang) {
        return buildHeadToHospitalSpokenMessage(patientName, tokenCode, department, hospital, peopleAhead, lang);
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

    public String formatE164Phone(String phone) {
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
