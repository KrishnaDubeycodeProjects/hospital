package com.qdischarge.clinicqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Places the "your token is about to be called, head to the hospital now"
 * voice call, via a Twilio Studio Flow Execution
 * (https://studio.twilio.com/v2/Flows/{FlowSid}/Executions) -- plain REST
 * (RestTemplate + Basic Auth), same pattern as OtpService's Twilio Verify/
 * Messages calls, rather than pulling in the Twilio Java SDK for one
 * endpoint. The flow itself (built in the Twilio console, outside this
 * repo) owns the actual call script/voice selection; this just hands it the
 * message text plus the patient's language and the configured tone as
 * execution parameters for its Say/Gather widgets to read.
 *
 * Fired alongside the WhatsApp notification from
 * QueueManagerService#runTreatmentTimingTick -- both channels, same
 * trigger, same moment.
 *
 * No-ops (logs and returns) rather than dialing anyone when calling is
 * disabled or still on its dummy placeholder Flow SID -- mirrors
 * OtpService's "fails cleanly on dummy credentials" default, so a fresh
 * checkout never places a real phone call.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TwilioStudioCallService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String DUMMY_FLOW_SID = "FWdummy00000000000000000000000000";

    private boolean isConfigured() {
        if (!appProperties.isTwilioCallEnabled()) {
            return false;
        }
        String flowSid = appProperties.getTwilioStudioFlowSid();
        String caller = appProperties.getTwilioCallerNumber();
        return flowSid != null && !flowSid.isBlank() && !DUMMY_FLOW_SID.equals(flowSid)
                && caller != null && !caller.isBlank();
    }

    /** Fire-and-forget: never blocks or fails the caller's request thread on a slow/unreachable Twilio. */
    @Async("whatsappExecutor")
    public void triggerHeadToHospitalCall(String toPhone, String message, Lang lang) {
        if (!isConfigured()) {
            log.info("📵 Twilio Studio call skipped for {} (calling disabled or Flow SID/caller number not configured).",
                    formatPhone(toPhone));
            return;
        }
        try {
            String url = "https://studio.twilio.com/v2/Flows/%s/Executions".formatted(appProperties.getTwilioStudioFlowSid());

            Map<String, Object> parameters = new LinkedHashMap<>();
            parameters.put("message", message);
            parameters.put("language", lang != null ? lang.name().toLowerCase() : Lang.EN.name().toLowerCase());
            parameters.put("tone", appProperties.getTwilioVoiceTone());

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("To", toPhone);
            body.add("From", appProperties.getTwilioCallerNumber());
            body.add("Parameters", objectMapper.writeValueAsString(parameters));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(appProperties.getTwilioAccountSid(), appProperties.getTwilioAuthToken());

            restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
            log.info("📞 Twilio Studio call triggered for {}", formatPhone(toPhone));
        } catch (RestClientException e) {
            log.error("❌ Twilio Studio Execution error for {}: {}", formatPhone(toPhone), extractError(e));
        } catch (Exception e) {
            log.error("❌ Could not trigger Twilio Studio call for {}: {}", formatPhone(toPhone), e.getMessage());
        }
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
