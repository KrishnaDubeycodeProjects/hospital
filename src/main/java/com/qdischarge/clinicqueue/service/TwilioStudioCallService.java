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

    /** Fire-and-forget: never blocks or fails the caller's request thread on a slow/unreachable Twilio. */
    @Async("whatsappExecutor")
    public void triggerHeadToHospitalCall(String toPhone, String message, Lang lang) {
        if (!isConfigured()) {
            log.info("📵 Twilio call skipped for {} (calling disabled or caller number not configured).",
                    formatPhone(toPhone));
            return;
        }
        try {
            String url = "https://api.twilio.com/2010-04-01/Accounts/%s/Calls.json"
                    .formatted(appProperties.getTwilioAccountSid());

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("To", toPhone);
            body.add("From", appProperties.getTwilioCallerNumber());
            body.add("Twiml", buildTwiml(message, lang));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(appProperties.getTwilioAccountSid(), appProperties.getTwilioAuthToken());

            restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            log.info("📞 Twilio call triggered for {}", formatPhone(toPhone));
        } catch (RestClientException e) {
            log.error("❌ Twilio Call error for {}: {}", formatPhone(toPhone), extractError(e));
        } catch (Exception e) {
            log.error("❌ Could not trigger Twilio call for {}: {}", formatPhone(toPhone), e.getMessage());
        }
    }

    /** Twilio TTS locale for <Say>; Marathi has no dedicated classic voice, so it falls back to Hindi. */
    private String sayLanguage(Lang lang) {
        if (lang == Lang.HI || lang == Lang.MR) {
            return "hi-IN";
        }
        return "en-IN";
    }

    private String buildTwiml(String message, Lang lang) {
        String escaped = message == null ? "" : message
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
        return "<Response><Say language=\"%s\">%s</Say></Response>".formatted(sayLanguage(lang), escaped);
    }

    private String formatPhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9+]", "");
    }

    private String extractError(RestClientException e) {
        if (e instanceof HttpStatusCodeException hsce) {
            return hsce.getStatusCode() + " " + hsce.getResponseBodyAsString();
        }
        return e.getMessage();
    }
}
